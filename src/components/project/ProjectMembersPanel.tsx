'use client';

import { useMemo, useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addProjectMemberAction, removeProjectMemberAction } from '@/server/actions/projects';
import { initials } from '@/lib/utils';
import type { AppUser, ProjectMemberRole } from '@/types/domain';

interface Props {
  projectId: string;
  members: Array<{ user_id: string; role: ProjectMemberRole; user: AppUser }>;
  candidateUsers: AppUser[];
  canAddPm: boolean;
}

export function ProjectMembersPanel({ projectId, members, candidateUsers, canAddPm }: Props) {
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const memberIdSet = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidateUsers
      .filter((u) => !memberIdSet.has(u.id))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.full_name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [candidateUsers, memberIdSet, search]);

  async function handleAdd(userId: string, role: 'pm' | 'member') {
    setPendingId(userId);
    const result = await addProjectMemberAction({ projectId, userId, role });
    setPendingId(null);
    if (!result.ok) {
      toast.error('Could not add member', { description: result.error.message });
    } else {
      toast.success('Member added');
    }
  }

  async function handleRemove(userId: string) {
    setPendingId(userId);
    const result = await removeProjectMemberAction({ projectId, userId });
    setPendingId(null);
    if (!result.ok) {
      toast.error('Could not remove member', { description: result.error.message });
    } else {
      toast.success('Member removed');
    }
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header>
        <h3 className="font-medium">Members</h3>
        <p className="text-xs text-muted-foreground">
          Project Managers can add or remove regular members. Admins can promote PMs.
        </p>
      </header>

      <ul className="divide-y rounded-md border">
        {members.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">No members yet.</li>
        ) : (
          members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  {m.user.avatar_url ? <AvatarImage src={m.user.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {initials(m.user.full_name, m.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {m.user.full_name ?? m.user.email}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {m.role === 'pm' ? 'PM' : 'Member'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.user.email}</span>
                </div>
              </div>
              {/* Don't allow removing PMs from the panel — that's an admin-only action elsewhere */}
              {m.role === 'member' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove member"
                  disabled={pendingId === m.user_id}
                  onClick={() => handleRemove(m.user_id)}
                >
                  {pendingId === m.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {candidateUsers.length > 0 ? (
        <div className="space-y-2">
          <label htmlFor="member-search" className="text-sm font-medium">
            Add a member
          </label>
          <Input
            id="member-search"
            placeholder="Search users by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() ? (
            <ul className="divide-y rounded-md border">
              {candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
              ) : (
                candidates.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="text-sm">{u.full_name ?? u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === u.id}
                        onClick={() => handleAdd(u.id, 'member')}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Member
                      </Button>
                      {canAddPm ? (
                        <Button
                          size="sm"
                          disabled={pendingId === u.id}
                          onClick={() => handleAdd(u.id, 'pm')}
                        >
                          PM
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
