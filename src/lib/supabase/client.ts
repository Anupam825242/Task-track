'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/db';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client. Singleton — re-using the same instance
 * keeps a single Realtime websocket and avoids duplicate auth listeners.
 */
export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return browserClient;
}
