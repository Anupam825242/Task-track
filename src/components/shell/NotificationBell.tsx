'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Notification } from '@/types/domain';

const NOTIFICATION_LABELS: Record<string, string> = {
  task_assigned: 'assigned a task to you',
  task_status_changed: 'changed task status',
  comment_added: 'commented on a task',
};

export function NotificationBell() {
  const me = useCurrentUser();
  const supabase = createClient();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: queryKeys.notifications,
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, recipient_id, type, task_id, project_id, payload, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  // Realtime: prepend new notifications to the cache
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`notifs:${me.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${me.id}`,
        },
        (payload) => {
          const incoming = payload.new as Notification;
          qc.setQueryData<Notification[]>(queryKeys.notifications, (old = []) =>
            [incoming, ...old].slice(0, 30),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, supabase, qc]);

  const unread = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);

  async function markAllRead() {
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      toast.error('Could not mark read', { description: error.message });
      return;
    }
    qc.setQueryData<Notification[]>(queryKeys.notifications, (old = []) =>
      old.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
  }

  if (!me) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread.length > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
          {unread.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">All clear.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={
                  n.read_at
                    ? 'border-b last:border-b-0'
                    : 'border-b bg-accent/40 last:border-b-0'
                }
              >
                <Link
                  href={
                    n.task_id && n.project_id
                      ? `/projects/${n.project_id}/board?task=${n.task_id}`
                      : '#'
                  }
                  className="block px-3 py-2"
                >
                  <div className="text-sm">
                    {NOTIFICATION_LABELS[n.type] ?? n.type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String((n.payload?.title as string) ?? '')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
