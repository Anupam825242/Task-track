import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import type { Project } from '@/types/domain';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, description, created_by, archived_at, created_at, updated_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const projects = (data ?? []) as Project[];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-muted/20">
      <Sidebar projects={projects} userRole={user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
