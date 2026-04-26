'use server';

import { revalidatePath } from 'next/cache';
import { supabaseService } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { wrapAction } from '@/lib/auth/actionResult';
import {
  CreateUserSchema,
  UpdateUserRoleSchema,
  DeactivateUserSchema,
  type CreateUserInput,
} from '@/lib/validation/user';

/**
 * Create a user via Supabase Auth Admin API. Admin only.
 *
 * - If `password` is supplied, the account is created confirmed and ready.
 * - Otherwise an invite email is sent (Supabase handles delivery).
 *
 * The `tg_sync_auth_user` trigger mirrors the new auth.users row into
 * public.users with default role 'user'. We then UPDATE public.users to
 * apply the requested role.
 */
export async function createUserAction(input: CreateUserInput) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = CreateUserSchema.parse(input);

    let userId: string;

    if (data.password) {
      const { data: created, error } = await supabaseService.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !created.user) {
        throw new Error(error?.message ?? 'Failed to create user');
      }
      userId = created.user.id;
    } else {
      const { data: invited, error } = await supabaseService.auth.admin.inviteUserByEmail(
        data.email,
        { data: { full_name: data.fullName } },
      );
      if (error || !invited.user) {
        throw new Error(error?.message ?? 'Failed to invite user');
      }
      userId = invited.user.id;
    }

    // tg_sync_auth_user has populated public.users; apply the role + name.
    const { error: profileErr } = await supabaseService
      .from('users')
      .update({ role: data.role, full_name: data.fullName })
      .eq('id', userId);
    if (profileErr) throw new Error(profileErr.message);

    revalidatePath('/admin/users');
    return { id: userId };
  });
}

export async function updateUserRoleAction(input: { userId: string; role: 'admin' | 'pm' | 'user' }) {
  return wrapAction(async () => {
    const admin = await requireRole(['admin']);
    const data = UpdateUserRoleSchema.parse(input);

    if (data.userId === admin.id && data.role !== 'admin') {
      throw new Error('You cannot demote yourself.');
    }

    const { error } = await supabaseService
      .from('users')
      .update({ role: data.role })
      .eq('id', data.userId);
    if (error) throw new Error(error.message);

    revalidatePath('/admin/users');
  });
}

export async function setUserActiveAction(input: { userId: string; active: boolean }) {
  return wrapAction(async () => {
    const admin = await requireRole(['admin']);
    const data = DeactivateUserSchema.parse(input);

    if (data.userId === admin.id && !data.active) {
      throw new Error('You cannot deactivate yourself.');
    }

    const { error } = await supabaseService
      .from('users')
      .update({ is_active: data.active })
      .eq('id', data.userId);
    if (error) throw new Error(error.message);

    revalidatePath('/admin/users');
  });
}

export async function deleteUserAction(userId: string) {
  return wrapAction(async () => {
    const admin = await requireRole(['admin']);
    if (userId === admin.id) {
      throw new Error('You cannot delete yourself.');
    }

    // Auth deletion cascades to public.users via FK on auth.users.id.
    // Tasks where this user is `created_by` will block deletion (RESTRICT).
    // Admin must reassign creator first — surface the error from PG.
    const { error } = await supabaseService.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    revalidatePath('/admin/users');
  });
}
