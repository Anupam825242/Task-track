'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Task } from '@/types/domain';

/**
 * Subscribes the current client to all task changes for a project.
 * Updates the TanStack Query cache so the Kanban board (and any other
 * subscribed view) reflects remote edits in real time.
 */
export function useRealtimeTasks(projectId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const key = queryKeys.tasks.all(projectId);

          qc.setQueryData<Task[]>(key, (old = []) => {
            if (payload.eventType === 'INSERT') {
              const incoming = payload.new as Task;
              return old.some((t) => t.id === incoming.id) ? old : [...old, incoming];
            }
            if (payload.eventType === 'UPDATE') {
              const incoming = payload.new as Task;
              return old.map((t) => (t.id === incoming.id ? incoming : t));
            }
            if (payload.eventType === 'DELETE') {
              const removedId = (payload.old as { id: string }).id;
              return old.filter((t) => t.id !== removedId);
            }
            return old;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);
}
