'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidHexColor } from '@/lib/utils';
import {
  createStatusAction,
  deleteStatusAction,
  reorderStatusesAction,
  updateStatusAction,
} from '@/server/actions/workflow';
import type { Status } from '@/types/domain';

interface Props {
  workflowId: string;
  projectId: string;
  initialStatuses: Status[];
}

export function WorkflowBuilder({ workflowId, initialStatuses }: Props) {
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);
  const [savingOrder, setSavingOrder] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setStatuses(initialStatuses);
  }, [initialStatuses]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(statuses, oldIndex, newIndex).map((s, idx) => ({
      ...s,
      position: idx,
    }));
    setStatuses(reordered);

    setSavingOrder(true);
    const result = await reorderStatusesAction({
      workflowId,
      ordered: reordered.map((s) => ({ id: s.id, position: s.position })),
    });
    setSavingOrder(false);

    if (!result.ok) {
      setStatuses(statuses); // rollback
      toast.error('Could not save order', { description: result.error.message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {statuses.map((status) => (
                <SortableStatusRow
                  key={status.id}
                  status={status}
                  onChanged={(patch) =>
                    setStatuses((prev) =>
                      prev.map((s) => (s.id === status.id ? { ...s, ...patch } : s)),
                    )
                  }
                  onDeleted={() =>
                    setStatuses((prev) => prev.filter((s) => s.id !== status.id))
                  }
                  candidateMigrationStatuses={statuses.filter((s) => s.id !== status.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {savingOrder ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            Saving order
          </p>
        ) : null}
      </div>

      {adding ? (
        <AddStatusRow
          workflowId={workflowId}
          onCreated={(s) => {
            setStatuses((prev) => [...prev, s]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add status
        </Button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────

function SortableStatusRow({
  status,
  onChanged,
  onDeleted,
  candidateMigrationStatuses,
}: {
  status: Status;
  onChanged: (patch: Partial<Status>) => void;
  onDeleted: () => void;
  candidateMigrationStatuses: Status[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
  });

  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function commit(patch: { name?: string; color?: string }) {
    if (!isValidHexColor(patch.color ?? color)) return;
    setSaving(true);
    const result = await updateStatusAction({ statusId: status.id, patch });
    setSaving(false);
    if (!result.ok) {
      setName(status.name);
      setColor(status.color);
      toast.error('Save failed', { description: result.error.message });
      return;
    }
    onChanged(patch);
  }

  async function handleDelete(migrateToStatusId?: string) {
    setSaving(true);
    const result = await deleteStatusAction({ statusId: status.id, migrateToStatusId });
    setSaving(false);
    if (!result.ok) {
      toast.error('Could not delete', { description: result.error.message });
      return;
    }
    onDeleted();
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'opacity-60' : undefined}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => commit({ color })}
          className="h-7 w-7 cursor-pointer rounded border"
          aria-label="Color"
        />

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commit({ name: name.trim() })}
          className="flex-1"
          maxLength={50}
        />

        {confirmingDelete ? (
          candidateMigrationStatuses.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span>Move tasks to:</span>
              <select
                className="rounded border bg-background px-2 py-1 text-xs"
                onChange={(e) => {
                  if (!e.target.value) return;
                  void handleDelete(e.target.value);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose
                </option>
                {candidateMigrationStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={saving}
              onClick={() => handleDelete()}
            >
              Confirm
            </Button>
          )
        ) : (
          <Button
            variant="ghost"
            size="icon"
            disabled={saving}
            aria-label="Delete status"
            onClick={() => setConfirmingDelete(true)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────

function AddStatusRow({
  workflowId,
  onCreated,
  onCancel,
}: {
  workflowId: string;
  onCreated: (s: Status) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);
    const result = await createStatusAction({ workflowId, name: name.trim(), color });
    setSubmitting(false);
    if (!result.ok) {
      toast.error('Could not create status', { description: result.error.message });
      return;
    }
    onCreated({
      id: result.data.id,
      workflow_id: workflowId,
      name: name.trim(),
      position: Number.MAX_SAFE_INTEGER, // will be reconciled on next load
      color,
      is_terminal: false,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex items-end gap-2 rounded-md border bg-card p-3">
      <div className="flex-1 space-y-1">
        <Label htmlFor="new-status-name">Name</Label>
        <Input
          id="new-status-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-status-color">Color</Label>
        <input
          id="new-status-color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border"
        />
      </div>
      <Button onClick={submit} disabled={submitting || !name.trim()}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
