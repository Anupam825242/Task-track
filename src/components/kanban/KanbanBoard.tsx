'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks';
import { queryKeys } from '@/lib/query/keys';
import { moveTaskAction } from '@/server/actions/tasks';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import type { AppUser, Status, Task } from '@/types/domain';

interface KanbanBoardProps {
  projectId: string;
  statuses: Status[];
  initialTasks: Task[];
  members: AppUser[];
}

export default function KanbanBoard({
  projectId,
  statuses,
  initialTasks,
  members,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.tasks.all(projectId);

  // Hydrate the cache once with SSR data; from then on it's the source of truth.
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey,
    queryFn: () => Promise.resolve(initialTasks),
    initialData: initialTasks,
    staleTime: Infinity, // realtime keeps it fresh
  });

  useRealtimeTasks(projectId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, Task[]>(statuses.map((s) => [s.id, [] as Task[]]));
    for (const t of tasks) {
      const arr = map.get(t.status_id);
      if (arr) arr.push(t);
    }
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [tasks, statuses]);

  const memberById = useMemo(() => {
    const m = new Map<string, AppUser>();
    members.forEach((u) => m.set(u.id, u));
    return m;
  }, [members]);

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  /**
   * `onDragOver` provides a smooth cross-column preview without committing.
   * The actual server update happens on `onDragEnd`.
   */
  function onDragOver(_event: DragOverEvent) {
    // Intentionally empty: visual preview is handled by dnd-kit's own
    // sortable strategy; we don't reorder local state until drop.
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = String(active.id);
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged) return;

    const overId = String(over.id);
    const overTask = tasks.find((t) => t.id === overId);
    const targetStatusId = overTask?.status_id ?? overId; // dropping on column header
    if (!statuses.some((s) => s.id === targetStatusId)) return;

    // Compute neighbours in the target column (excluding the dragged task itself).
    const targetColumn = (tasksByStatus.get(targetStatusId) ?? []).filter(
      (t) => t.id !== draggedId,
    );
    const overIdx = overTask ? targetColumn.findIndex((t) => t.id === overTask.id) : targetColumn.length;
    const before = overIdx > 0 ? targetColumn[overIdx - 1] : null;
    const after = overIdx < targetColumn.length ? targetColumn[overIdx] : null;

    if (
      dragged.status_id === targetStatusId &&
      before?.id === undefined &&
      after?.id === undefined
    ) {
      return; // no-op (only task in only column)
    }

    // Optimistic update: place between neighbours
    const optimisticPosition =
      before && after
        ? (before.position + after.position) / 2
        : before
          ? before.position + 1024
          : after
            ? after.position - 1024
            : 1024;

    const previous = tasks;
    queryClient.setQueryData<Task[]>(queryKey, (old = []) =>
      old.map((t) =>
        t.id === draggedId
          ? { ...t, status_id: targetStatusId, position: optimisticPosition }
          : t,
      ),
    );

    const result = await moveTaskAction({
      taskId: draggedId,
      toStatusId: targetStatusId,
      beforeTaskId: before?.id ?? null,
      afterTaskId: after?.id ?? null,
      projectId,
    });

    if (!result.ok) {
      queryClient.setQueryData(queryKey, previous);
      toast.error('Could not move task', { description: result.error.message });
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="scrollbar-thin flex h-full gap-4 overflow-x-auto p-4">
        {statuses.map((status) => {
          const items = tasksByStatus.get(status.id) ?? [];
          return (
            <SortableContext
              key={status.id}
              items={items.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                status={status}
                tasks={items}
                projectId={projectId}
                memberById={memberById}
                members={members}
              />
            </SortableContext>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            assignee={activeTask.assigned_to ? memberById.get(activeTask.assigned_to) ?? null : null}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
