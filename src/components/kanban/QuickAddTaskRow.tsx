'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { createTaskAction } from '@/server/actions/tasks';
import type { AppUser } from '@/types/domain';

interface Props {
  projectId: string;
  statusId: string;
  members: AppUser[];
  onClose: () => void;
}

export function QuickAddTaskRow({ projectId, statusId, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      onClose();
      return;
    }

    setSubmitting(true);
    const result = await createTaskAction({
      projectId,
      statusId,
      title: trimmed,
      priority: 'medium',
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error('Could not create task', { description: result.error.message });
      return;
    }
    setTitle('');
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border bg-background p-2 shadow-sm">
      <Textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void submit()}
        placeholder="Task title — Enter to save, Esc to cancel"
        className="min-h-[60px] resize-none border-0 p-0 shadow-none focus-visible:ring-0"
        disabled={submitting}
      />
      {submitting ? (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving
        </div>
      ) : null}
    </form>
  );
}
