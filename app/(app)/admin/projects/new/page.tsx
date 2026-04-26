import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { NewProjectForm } from '@/components/admin/NewProjectForm';
import type { AppUser } from '@/types/domain';

export default async function NewProjectPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  const users = (data ?? []) as AppUser[];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">New project</h2>
        <p className="text-sm text-muted-foreground">
          A default workflow with Todo / In Progress / Review / Done is created automatically.
        </p>
      </header>
      <NewProjectForm users={users} />
    </section>
  );
}
