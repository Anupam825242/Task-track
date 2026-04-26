import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { requireUser, getProjectMemberRole } from '@/lib/auth/getCurrentUser';
import { createClient } from '@/lib/supabase/server';
import { ProjectViewTabs } from '@/components/project/ProjectViewTabs';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, description, archived_at')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) notFound();

  // Membership re-check (RLS already filters, but this lets us 404 cleanly
  // for non-members instead of leaking an empty project shell).
  const memberRole = await getProjectMemberRole(projectId);
  if (user.role !== 'admin' && !memberRole) notFound();

  const isPmOrAdmin = user.role === 'admin' || memberRole === 'pm';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            {project.description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
          {isPmOrAdmin ? (
            <Link
              href={`/projects/${projectId}/settings`}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          ) : null}
        </div>
        <div className="mt-3">
          <ProjectViewTabs projectId={projectId} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
