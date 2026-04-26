'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { format, isPast, isToday } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';
import type { AppUser, Task } from '@/types/domain';

interface TaskCardProps {
  task: Task;
  assignee: AppUser | null;
  dragging?: boolean;
}

const priorityClass: Record<Task['priority'], string> = {
  low: 'border-l-muted',
  medium: 'border-l-blue-500',
  high: 'border-l-red-500',
};

const priorityLabel: Record<Task['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export default function TaskCard({ task, assignee, dragging = false }: TaskCardProps) {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();

  const newSearch = new URLSearchParams(searchParams?.toString());
  newSearch.set('task', task.id);
  const href = `/projects/${params.projectId}/board?${newSearch.toString()}`;

  const dueLabel = task.due_date ? formatDue(task.due_date) : null;
  const overdue =
    task.due_date && !isToday(new Date(task.due_date)) && isPast(new Date(task.due_date));

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'block rounded-md border border-l-4 bg-background p-3 text-left text-sm shadow-sm transition-shadow hover:shadow-md',
        priorityClass[task.priority],
        dragging && 'rotate-1 cursor-grabbing shadow-lg',
      )}
    >
      <p className="line-clamp-3 font-medium leading-snug">{task.title}</p>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {dueLabel ? (
            <span
              className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}
              aria-label={`Due ${dueLabel}`}
            >
              <Calendar className="h-3 w-3" />
              {dueLabel}
            </span>
          ) : null}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {priorityLabel[task.priority]}
          </span>
        </div>

        {assignee ? (
          <Avatar className="h-6 w-6">
            {assignee.avatar_url ? <AvatarImage src={assignee.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-[10px]">
              {initials(assignee.full_name, assignee.email)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </Link>
  );
}

function formatDue(date: string) {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  return format(d, 'MMM d');
}
