import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Uses the **anon key + user JWT from cookies** — RLS is enforced.
 *
 * For privileged operations that must bypass RLS (admin user creation,
 * cross-tenant queries), use `supabaseService` from `service.ts` instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `set` method may be called from a Server Component, where
            // mutating cookies isn't permitted. Middleware refreshes the
            // session on every request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
