import "server-only";
import type { Role, User } from "@/generated/prisma/client";

export class UnauthorizedError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// UX-layer guard only - gives a fast, clear error instead of a raw RLS-denied query result.
// This is NOT a substitute for RLS (CLAUDE.md 4.3: visibility is enforced by RLS, not the app
// layer). Even if this check were skipped entirely, RLS still enforces who can see/write what.
export function requireRole(user: User | null, allowedRoles: Role[]): User {
  if (!user) throw new UnauthorizedError("Not signed in");
  if (!allowedRoles.includes(user.role)) {
    throw new UnauthorizedError(`Role '${user.role}' is not permitted to perform this action`);
  }
  return user;
}
