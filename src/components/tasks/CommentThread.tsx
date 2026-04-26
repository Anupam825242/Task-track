'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRealtimeComments } from '@/hooks/useRealtimeComments';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { cn, initials } from '@/lib/utils';
import { createCommentAction, deleteCommentAction } from '@/server/actions/comments';
import type { AppUser, Comment } from '@/types/domain';

interface Props {
  taskId: string;
  members: AppUser[];
}

interface CommentWithAuthor extends Comment {
  author: Pick<AppUser, 'id' | 'full_name' | 'avatar_url' | 'email'> | null;
}

export function CommentThread({ taskId, members }: Props) {
  const me = useCurrentUser();
  const supabase = createClient();
  const queryKey = queryKeys.comments.forTask(taskId);

  useRealtimeComments(taskId);

  const { data: comments = [], isLoading } = useQuery<CommentWithAuthor[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(
          `id, task_id, author_id, body, parent_id, created_at, updated_at,
           author:users!author_id(id, full_name, avatar_url, email)`,
        )
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentWithAuthor[];
    },
  });

  const memberById = new Map<string, AppUser>(members.map((m) => [m.id, m]));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Comments</h3>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Be the first to comment.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const author = c.author ?? (c.author_id ? memberById.get(c.author_id) ?? null : null);
            const canDelete = me?.id === c.author_id || me?.role === 'admin';
            return (
              <li key={c.id} className="flex gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  {author?.avatar_url ? <AvatarImage src={author.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(author?.full_name, author?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-md bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-medium">
                        {author?.full_name ?? author?.email ?? 'Deleted user'}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {canDelete ? <DeleteCommentButton commentId={c.id} /> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NewCommentForm taskId={taskId} />
    </div>
  );
}

function NewCommentForm({ taskId }: { taskId: string }) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const result = await createCommentAction({ taskId, body: trimmed });
    setSubmitting(false);

    if (!result.ok) {
      toast.error('Could not post comment', { description: result.error.message });
      return;
    }
    setBody('');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        className="min-h-[64px]"
        maxLength={5000}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> Send
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    setPending(true);
    const result = await deleteCommentAction({ commentId });
    setPending(false);
    if (!result.ok) {
      toast.error('Could not delete comment', { description: result.error.message });
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete comment"
      className={cn('h-6 w-6')}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
    </Button>
  );
}
