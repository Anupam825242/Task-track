'use client';

import type { ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { UserRole } from '@/types/domain';

interface RoleGateProps {
  /** System roles permitted to see the children. */
  allow: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * UI-only role gate. **Not a security control** — DB RLS is the source
 * of truth. Use to hide buttons/links the user can't act on, not to
 * protect data.
 */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const user = useCurrentUser();
  if (!user || !allow.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
