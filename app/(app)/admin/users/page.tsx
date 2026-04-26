import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { UsersAdminPanel } from '@/components/admin/UsersAdminPanel';
import type { AppUser } from '@/types/domain';

export default async function AdminUsersPage() {
  const me = await requireRole(['admin']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, is_active')
    .order('created_at', { ascending: false });

  const users = (data ?? []) as AppUser[];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          Create new users, change roles, deactivate or delete accounts.
        </p>
      </header>
      <UsersAdminPanel users={users} currentUserId={me.id} />
    </section>
  );
}
