// Server actions return this instead of throwing for validation/business errors (throwing is
// reserved for programmer/auth errors) - matches CLAUDE.md's "fail loud server-side, degrade
// gracefully client-side."
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}
