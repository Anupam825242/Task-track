'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { initials } from '@/lib/utils';
import type { AppUser } from '@/types/domain';
import { NotificationBell } from './NotificationBell';

export function Topbar({ user }: { user: AppUser }) {
  const router = useRouter();
  const supabase = createClient();

  async function onSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Sign-out failed', { description: error.message });
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  const roleLabel =
    user.role === 'admin' ? 'Admin' : user.role === 'pm' ? 'Project Manager' : 'Member';

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b bg-card px-4">
      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent"
            aria-label="Account menu"
          >
            <Avatar>
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
              <AvatarFallback>{initials(user.full_name, user.email)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.full_name ?? user.email}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <span className="mt-1 inline-flex w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut} className="cursor-pointer text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
