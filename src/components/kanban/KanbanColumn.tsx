'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QuickAddTaskRow } from './QuickAddTaskRow';
import TaskCard from './TaskCard';
import type { AppUser, Status, Task } from '@/types/domain';

interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  projectId: string;
  memberById: Map<string, AppUser>;
  members: AppUser[];
}

export default function KanbanColumn({
  status,
  tasks,
  projectId,
  memberById,
  members,
}: KanbanColumnProps) {
  const [adding, setAdding] = useState(false);

  // Make the empty column area a drop target for cross-column moves.
  const { setNodeRef: setColumnDropRef, isOver } = useDroppable({ id: status.id });

  return (
    <section
      className={cn(
        'flex h-full w-[300px] shrink-0 flex-col rounded-lg border bg-card transition-colors',
        isOver && 'border-primary/40 bg-accent/40',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: status.color }}
            aria-hidden
          />
          <h2 className="text-sm font-medium">{status.name}</h2>
          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add task to ${status.name}`}
          onClick={() => setAdding((v) => !v)}
          className="h-7 w-7"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      <div
        ref={setColumnDropRef}
        className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto p-2"
      >
        {adding ? (
          <QuickAddTaskRow
            projectId={projectId}
            statusId={status.id}
            members={members}
            onClose={() => setAdding(false)}
          />
        ) : null}

        {tasks.length === 0 && !adding ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Drop a task here
          </p>
        ) : null}

        {tasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            assignee={task.assigned_to ? memberById.get(task.assigned_to) ?? null : null}
          />
        ))}
      </div>
    </section>
  );
}

function SortableTaskCard({ task, assignee }: { task: Task; assignee: AppUser | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(isDragging && 'opacity-30')}
    >
      <TaskCard task={task} assignee={assignee} />
    </div>
  );
}
