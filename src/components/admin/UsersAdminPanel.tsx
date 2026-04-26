'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createUserAction,
  deleteUserAction,
  setUserActiveAction,
  updateUserRoleAction,
} from '@/server/actions/users';
import { initials } from '@/lib/utils';
import type { AppUser, UserRole } from '@/types/domain';

interface Props {
  users: AppUser[];
  currentUserId: string;
}

const roleOptions: UserRole[] = ['admin', 'pm', 'user'];

export function UsersAdminPanel({ users, currentUserId }: Props) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating((v) => !v)} size="sm">
          <Plus className="h-4 w-4" /> {creating ? 'Cancel' : 'New user'}
        </Button>
      </div>

      {creating ? <CreateUserForm onDone={() => setCreating(false)} /> : null}

      <ul className="divide-y rounded-lg border bg-card">
        {users.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">No users.</li>
        ) : (
          users.map((u) => <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />)
        )}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await createUserAction({
      email: String(fd.get('email')),
      fullName: String(fd.get('fullName')),
      role: (fd.get('role') as UserRole) ?? 'user',
      password: (fd.get('password') as string) || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error('Could not create user', { description: result.error.message });
      return;
    }
    toast.success('User created');
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
    >
      <div className="space-y-1">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="user"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password (optional — invite if blank)</Label>
        <Input id="password" name="password" type="password" minLength={8} maxLength={72} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create user'}
        </Button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────

function UserRow({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [active, setActive] = useState(user.is_active);
  const [pending, setPending] = useState(false);

  async function changeRole(next: UserRole) {
    if (next === role) return;
    setPending(true);
    const result = await updateUserRoleAction({ userId: user.id, role: next });
    setPending(false);
    if (!result.ok) {
      toast.error('Could not change role', { description: result.error.message });
      return;
    }
    setRole(next);
    toast.success('Role updated');
  }

  async function toggleActive() {
    setPending(true);
    const result = await setUserActiveAction({ userId: user.id, active: !active });
    setPending(false);
    if (!result.ok) {
      toast.error('Failed', { description: result.error.message });
      return;
    }
    setActive(!active);
  }

  async function deleteUser() {
    if (!confirm(`Delete ${user.email}? Tasks they created will block deletion until reassigned.`)) {
      return;
    }
    setPending(true);
    const result = await deleteUserAction(user.id);
    setPending(false);
    if (!result.ok) {
      toast.error('Could not delete user', { description: result.error.message });
      return;
    }
    toast.success('User deleted');
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9">
          {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
          <AvatarFallback>{initials(user.full_name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{user.full_name ?? user.email}</span>
            {isSelf ? (
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">you</span>
            ) : null}
            {!active ? (
              <span className="rounded bg-destructive/10 px-1.5 text-xs text-destructive">
                inactive
              </span>
            ) : null}
          </div>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value as UserRole)}
          disabled={pending || isSelf}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          disabled={pending || isSelf}
          onClick={toggleActive}
          aria-label={active ? 'Deactivate user' : 'Activate user'}
        >
          {active ? 'Deactivate' : 'Activate'}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={pending || isSelf}
          onClick={deleteUser}
          aria-label="Delete user"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
    </li>
  );
}
