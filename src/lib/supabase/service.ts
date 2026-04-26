import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

/**
 * Service-role Supabase client. **Bypasses RLS entirely.**
 *
 * Only import from server-only contexts (Server Actions, Route Handlers).
 * Every server action that uses this MUST re-verify the caller's role
 * before performing the privileged operation — see
 * `src/lib/auth/getCurrentUser.ts` (`requireRole`).
 */
export const supabaseService = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'X-Client-Info': 'task-track-service' },
    },
  },
);
