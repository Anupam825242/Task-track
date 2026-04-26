'use client';

import { useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteProjectAction, updateProjectAction } from '@/server/actions/projects';

interface Props {
  projectId: string;
  isArchived: boolean;
  ArchiveIcon: ComponentType<{ className?: string }>;
  DeleteIcon: ComponentType<{ className?: string }>;
}

export function ProjectAdminActions({ projectId, isArchived, ArchiveIcon, DeleteIcon }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleArchive() {
    setPending(true);
    const result = await updateProjectAction({ projectId, archived: !isArchived });
    setPending(false);
    if (!result.ok) {
      toast.error('Action failed', { description: result.error.message });
      return;
    }
    toast.success(isArchived ? 'Project restored' : 'Project archived');
    router.refresh();
  }

  async function hardDelete() {
    if (!confirm('Permanently delete this project and ALL its tasks, comments, and history?')) {
      return;
    }
    setPending(true);
    const result = await deleteProjectAction(projectId);
    setPending(false);
    if (!result.ok) {
      toast.error('Could not delete project', { description: result.error.message });
      return;
    }
    toast.success('Project deleted');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleArchive}
        disabled={pending}
        aria-label={isArchived ? 'Restore project' : 'Archive project'}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveIcon className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={hardDelete}
        disabled={pending}
        aria-label="Delete project permanently"
      >
        <DeleteIcon className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
