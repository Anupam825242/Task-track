'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, KanbanSquare, ListTodo, Plus, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, UserRole } from '@/types/domain';

interface SidebarProps {
  projects: Project[];
  userRole: UserRole;
}

export function Sidebar({ projects, userRole }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <KanbanSquare className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Task Track</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        <SidebarLink href="/projects" icon={ListTodo} active={pathname === '/projects'}>
          Projects
        </SidebarLink>
        <SidebarLink href="/my-tasks" icon={Inbox} active={isActive('/my-tasks')}>
          My Tasks
        </SidebarLink>

        <div className="mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active projects
        </div>
        <ul className="mt-1 space-y-0.5">
          {projects.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet.</li>
          ) : (
            projects.map((p) => {
              const href = `/projects/${p.id}/board`;
              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    className={cn(
                      'block truncate rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive(`/projects/${p.id}`)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {p.name}
                  </Link>
                </li>
              );
            })
          )}
        </ul>

        {userRole === 'admin' ? (
          <>
            <div className="mt-6 border-t pt-3">
              <SidebarLink href="/admin/users" icon={Users} active={isActive('/admin/users')}>
                Users
              </SidebarLink>
              <SidebarLink href="/admin/projects" icon={Settings} active={isActive('/admin/projects')}>
                All projects
              </SidebarLink>
            </div>
          </>
        ) : null}
      </nav>

      {userRole === 'admin' ? (
        <div className="border-t p-3">
          <Link
            href="/admin/projects/new"
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
