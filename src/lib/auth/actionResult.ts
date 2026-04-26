import { AuthError } from './getCurrentUser';

/**
 * Standard envelope for Server Action responses.
 * Use `wrapAction` to guarantee no exception escapes the boundary
 * (which Next.js otherwise serialises as opaque error digests).
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export async function wrapAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof Error) {
      return { ok: false, error: { code: 'INTERNAL', message: err.message } };
    }
    return { ok: false, error: { code: 'INTERNAL', message: 'Unknown error' } };
  }
}
