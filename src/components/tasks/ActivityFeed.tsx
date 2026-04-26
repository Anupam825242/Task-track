'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { initials } from '@/lib/utils';
import type { ActivityAction, AppUser } from '@/types/domain';

interface Props {
  taskId: string;
  members: AppUser[];
  statusNameById: Map<string, string>;
}

interface FeedRow {
  id: number;
  action: ActivityAction;
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export function ActivityFeed({ taskId, members, statusNameById }: Props) {
  const supabase = createClient();

  const { data: rows = [], isLoading } = useQuery<FeedRow[]>({
    queryKey: queryKeys.activity.forTask(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, payload, actor_id, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as FeedRow[];
    },
  });

  const memberById = new Map(members.map((m) => [m.id, m]));

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading activity…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const actor = row.actor_id ? memberById.get(row.actor_id) : null;
        return (
          <li key={row.id} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium">
              {initials(actor?.full_name, actor?.email)}
            </span>
            <div className="flex-1">
              <span className="font-medium">{actor?.full_name ?? actor?.email ?? 'Someone'}</span>{' '}
              <span className="text-muted-foreground">
                {describeAction(row.action, row.payload, statusNameById, memberById)}
              </span>
              <div className="mt-0.5 text-muted-foreground">
                {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function describeAction(
  action: ActivityAction,
  payload: Record<string, unknown>,
  statuses: Map<string, string>,
  members: Map<string, AppUser>,
): string {
  switch (action) {
    case 'task_created':
      return 'created the task';
    case 'task_updated':
      return 'updated the task';
    case 'task_deleted':
      return 'deleted the task';
    case 'task_status_changed': {
      const from = statuses.get(String(payload.from)) ?? '?';
      const to = statuses.get(String(payload.to)) ?? '?';
      return `moved status from ${from} to ${to}`;
    }
    case 'task_assigned': {
      const to = members.get(String(payload.to));
      return `assigned to ${to?.full_name ?? to?.email ?? 'someone'}`;
    }
    case 'task_unassigned':
      return 'unassigned the task';
    case 'comment_added':
      return 'commented';
    case 'comment_deleted':
      return 'deleted a comment';
    case 'member_added':
      return 'added a member';
    case 'member_removed':
      return 'removed a member';
    default:
      return action;
  }
}
