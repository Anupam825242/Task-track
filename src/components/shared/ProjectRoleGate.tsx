'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { ProjectMemberRole } from '@/types/domain';

interface ProjectRoleGateProps {
  projectId: string;
  /** Project-scoped roles permitted to see the children. */
  allow: ProjectMemberRole[];
  /** If true, system admins always see the children. Default: true. */
  allowAdmin?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Project-scoped UI gate. Reads `project_members.role` for the current
 * user via Supabase (RLS-protected) and caches it in TanStack Query.
 */
export function ProjectRoleGate({
  projectId,
  allow,
  allowAdmin = true,
  children,
  fallback = null,
}: ProjectRoleGateProps) {
  const user = useCurrentUser();
  const supabase = createClient();

  const { data: role } = useQuery({
    queryKey: [...queryKeys.projects.members(projectId), user?.id ?? 'anon'],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ProjectMemberRole | null> => {
      if (!user) return null;
      const { data } = await (supabase as ReturnType<typeof createClient>)
        .from('project_members' as never)
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      return ((data as { role: ProjectMemberRole } | null)?.role) ?? null;
    },
    staleTime: 60_000,
  });

  if (!user) return <>{fallback}</>;
  if (allowAdmin && user.role === 'admin') return <>{children}</>;
  if (role && allow.includes(role)) return <>{children}</>;
  return <>{fallback}</>;
}
