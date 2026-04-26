import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

const STEP = 1024;
const MIN_GAP = 0.0001;

export class ReindexRequiredError extends Error {
  constructor(public projectId: string, public statusId: string) {
    super('Column position gap collapsed; reindex required');
    this.name = 'ReindexRequiredError';
  }
}

interface MoveArgs {
  projectId: string;
  toStatusId: string;
  beforeTaskId: string | null; // task above the dropped position
  afterTaskId: string | null;  // task below the dropped position
}

/**
 * Computes a new fractional `position` value for a task being inserted
 * between `beforeTaskId` and `afterTaskId` in column `toStatusId`.
 *
 * Throws `ReindexRequiredError` when the gap between neighbours has
 * converged to `MIN_GAP` — caller should then run the
 * `reindex_column_positions` RPC and retry.
 */
export async function computeFractionalPosition(
  supabase: SupabaseClient<Database>,
  args: MoveArgs,
): Promise<number> {
  const ids = [args.beforeTaskId, args.afterTaskId].filter(
    (id): id is string => Boolean(id),
  );

  let beforePos: number | null = null;
  let afterPos: number | null = null;

  if (ids.length > 0) {
    const { data, error } = await (supabase as SupabaseClient)
      .from('tasks')
      .select('id, position')
      .in('id', ids);
    if (error) throw error;

    beforePos = data?.find((r: { id: string }) => r.id === args.beforeTaskId)?.position ?? null;
    afterPos  = data?.find((r: { id: string }) => r.id === args.afterTaskId)?.position  ?? null;
  }

  if (beforePos != null && afterPos != null) {
    const gap = afterPos - beforePos;
    if (gap < MIN_GAP) {
      throw new ReindexRequiredError(args.projectId, args.toStatusId);
    }
    return beforePos + gap / 2;
  }
  if (beforePos != null) return beforePos + STEP; // dropped at end
  if (afterPos != null) return afterPos - STEP;   // dropped at top
  return STEP;                                    // first task in column
}

export const FRACTIONAL = { STEP, MIN_GAP } as const;
