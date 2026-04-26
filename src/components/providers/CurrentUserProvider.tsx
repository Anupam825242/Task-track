'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AppUser } from '@/types/domain';

const CurrentUserContext = createContext<AppUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: AppUser | null;
  children: ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

/** Returns the current user or `null` if anonymous. */
export function useCurrentUser(): AppUser | null {
  return useContext(CurrentUserContext);
}

/** Like `useCurrentUser`, but throws if no user — use inside authenticated routes. */
export function useRequiredUser(): AppUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useRequiredUser called outside an authenticated route');
  return user;
}
