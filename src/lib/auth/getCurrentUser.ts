import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AppUser, UserRole } from '@/types/domain';

/**
 * Returns the signed-in user's profile, or `null` if not authenticated.
 *
 * Cached per-request (React `cache`) so multiple Server Components in
 * the same render share a single Supabase round-trip.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_active) return null;
  return profile as AppUser;
});

export class AuthError extends Error {
  constructor(
    public code: 'UNAUTHENTICATED' | 'FORBIDDEN',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('UNAUTHENTICATED');
  return user;
}

export async function requireRole(allowed: UserRole[]): Promise<AppUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new AuthError('FORBIDDEN');
  return user;
}

/**
 * Project-scoped permission checks. Hits the DB through the user's JWT,
 * so RLS limits the lookup to memberships the user can actually see.
 */
export async function getProjectMemberRole(
  projectId: string,
): Promise<'pm' | 'member' | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  return (data?.role as 'pm' | 'member' | null) ?? null;
}

export async function requireProjectMember(projectId: string): Promise<AppUser> {
  const user = await requireUser();
  if (user.role === 'admin') return user;
  const role = await getProjectMemberRole(projectId);
  if (!role) throw new AuthError('FORBIDDEN');
  return user;
}

export async function requireProjectPM(projectId: string): Promise<AppUser> {
  const user = await requireUser();
  if (user.role === 'admin') return user;
  const role = await getProjectMemberRole(projectId);
  if (role !== 'pm') throw new AuthError('FORBIDDEN');
  return user;
}
