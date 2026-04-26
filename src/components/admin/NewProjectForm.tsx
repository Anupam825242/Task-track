'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProjectAction } from '@/server/actions/projects';
import { cn, initials } from '@/lib/utils';
import type { AppUser } from '@/types/domain';

interface Props {
  users: AppUser[];
}

export function NewProjectForm({ users }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pmIds, setPmIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  function togglePm(id: string) {
    setPmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setMemberIds((m) => {
          const mn = new Set(m);
          mn.delete(id);
          return mn;
        });
      }
      return next;
    });
  }

  function toggleMember(id: string) {
    if (pmIds.has(id)) return;
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    if (!name) return;

    setSubmitting(true);
    const result = await createProjectAction({
      name,
      description: description || null,
      pmIds: Array.from(pmIds),
      memberIds: Array.from(memberIds),
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error('Could not create project', { description: result.error.message });
      return;
    }
    toast.success('Project created');
    router.push(`/projects/${result.data.id}/board`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-1">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" maxLength={5000} />
      </div>

      <div className="space-y-2">
        <Label>Members</Label>
        <p className="text-xs text-muted-foreground">
          Tick PM for users who should manage the project. Otherwise tick Member.
        </p>
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {users.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No active users yet.</li>
          ) : (
            users.map((u) => {
              const isPm = pmIds.has(u.id);
              const isMember = memberIds.has(u.id);
              return (
                <li
                  key={u.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2',
                    (isPm || isMember) && 'bg-accent/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      {u.avatar_url ? <AvatarImage src={u.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">
                        {initials(u.full_name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm">{u.full_name ?? u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={isPm}
                        onChange={() => togglePm(u.id)}
                      />
                      PM
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={isMember}
                        disabled={isPm}
                        onChange={() => toggleMember(u.id)}
                      />
                      Member
                    </label>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create project'}
      </Button>
    </form>
  );
}
