import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProjectMemberRole } from '@/lib/auth/getCurrentUser';
import { ProjectMembersPanel } from '@/components/project/ProjectMembersPanel';
import type { AppUser, ProjectMemberRole } from '@/types/domain';

interface Props {
  params: Promise<{ projectId: string }>;
}

interface MemberRow {
  user_id: string;
  role: ProjectMemberRole;
  user: AppUser | null;
}

export default async function ProjectSettingsPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireUser();
  const memberRole = await getProjectMemberRole(projectId);
  if (user.role !== 'admin' && memberRole !== 'pm') notFound();

  const supabase = await createClient();
  const [{ data: members }, { data: allUsers }] = await Promise.all([
    supabase
      .from('project_members')
      .select('user_id, role, user:users!user_id(id, email, full_name, avatar_url, role, is_active)')
      .eq('project_id', projectId),
    user.role === 'admin'
      ? supabase
          .from('users')
          .select('id, email, full_name, avatar_url, role, is_active')
          .eq('is_active', true)
          .order('full_name', { ascending: true })
      : Promise.resolve({ data: [] as AppUser[] }),
  ]);

  const memberRows = ((members ?? []) as unknown as MemberRow[]).filter(
    (m): m is MemberRow & { user: AppUser } => Boolean(m.user),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage members and the workflow for this project.
          </p>
        </div>
        {user.role === 'admin' ? (
          <Link
            href={`/projects/${projectId}/settings/workflow`}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Workflow builder →
          </Link>
        ) : null}
      </header>

      <ProjectMembersPanel
        projectId={projectId}
        members={memberRows}
        candidateUsers={(allUsers ?? []) as AppUser[]}
        canAddPm={user.role === 'admin'}
      />
    </div>
  );
}
