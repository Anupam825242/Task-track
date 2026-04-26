'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Comment } from '@/types/domain';

export function useRealtimeComments(taskId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!taskId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const key = queryKeys.comments.forTask(taskId);
          qc.setQueryData<Comment[]>(key, (old = []) => {
            if (payload.eventType === 'INSERT') {
              const incoming = payload.new as Comment;
              return old.some((c) => c.id === incoming.id) ? old : [...old, incoming];
            }
            if (payload.eventType === 'UPDATE') {
              const incoming = payload.new as Comment;
              return old.map((c) => (c.id === incoming.id ? incoming : c));
            }
            if (payload.eventType === 'DELETE') {
              const removedId = (payload.old as { id: string }).id;
              return old.filter((c) => c.id !== removedId);
            }
            return old;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, qc]);
}
