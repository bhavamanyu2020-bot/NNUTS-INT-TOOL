# CLAUDE.md — NNUTS Internal Tool

> Read this fully before any task. This is the source of truth for architecture, conventions, and non-negotiable rules. Do not deviate without explicit instruction.

## 1. What this is

Internal workflow + task management tool for NNUTS (creative/media agency).
Drives a client-onboarding → marketing → production → post-production → closed pipeline, with role-based visibility, task lifecycle tracking, file/drive gating, notifications, and analytics dashboards.

**Not** a public product. Single-org, small team (~9 named users). Optimize for correctness and clarity over scale.

## 2. Stack (locked)

- **Framework**: Next.js 15 (App Router, Server Components default)
- **DB / Auth / Realtime / Storage**: Supabase (Postgres + RLS + Auth + Realtime)
- **ORM**: Prisma (schema-first; migrations checked in)
- **Client state**: Zustand
- **Server state / data fetching**: Server Components + `revalidatePath` (no client-side data-fetching library). TanStack Query was tried in round 1 and removed — every read flows through Server Components already, so it had nothing to do. Re-add it, scoped only to a Realtime-backed view, if one is ever built (e.g. the notification bell in a later phase).
- **Notifications**: Supabase Realtime (live) + pg_cron / Edge Function (deadline reminders)
- **Validation**: Zod (shared schemas, client + server)
- **Styling**: Tailwind
- **Package manager**: pnpm

Do not introduce new libraries without asking. No Redux, no raw fetch for server state, no client-side data mutation without a server action / route handler.

## 3. Domain model (core tables)

| Table | Purpose | Key fields |
|---|---|---|
| `users` | People + hierarchy | `role`, `team_id`, `lead_id` |
| `teams` | Production / Post-Production / etc. | `name`, `lead_id` |

**Team-model source of truth**: `users.team_id` + `teams.lead_id` are the *only* fields RLS policies authorize against. `users.lead_id` (an individual's reporting line) is informational-only — not read by any policy or trigger — kept for a possible future org-chart view. Don't wire new authorization logic to `users.lead_id`; if a rule needs "who does this person report to," that's a deliberate scope decision to make explicitly, not something to assume `lead_id` already covers.
| `clients` | Onboarded clients | `brand_name`, `contact`, `package`, `service_type`, `drive_folder_link`, `timeline` |
| `tasks` | Unit of work through the pipeline | `client_id`, `assigned_to`, `assigned_by`, `stage`, `status`, `service_type`, `deadline` |
| `task_files` | Deliverables | `task_id`, `drive_link`, `file_type` |
| `notifications` | Alerts | `user_id`, `type`, `payload`, `read_at` |
| `audit_log` | Every state change | `actor_id`, `entity`, `action`, `before`, `after`, `at` |

### Roles
`super_admin` · `admin_onboarding` · `lead` · `member`

### Task stages (pipeline)
`onboarding → marketing → production → post_production → closed`

### Task status (lifecycle state machine)
`yet_to_start → in_process → changes_required → approval_sent → completed`

## 4. NON-NEGOTIABLE RULES (production-grade invariants)

These are enforced **server-side / in the DB**. UI enforcement alone is a bug.

1. **Status is a real state machine.**
   Only valid transitions are allowed. Reject illegal jumps (e.g. `yet_to_start → completed`) in a DB trigger or a guarded server action. Never trust the client to send a valid next status.

2. **File-uploaded gate.**
   A task may only enter the `file_uploaded` / delivery state when `drive_link IS NOT NULL`. Enforce as a DB constraint/check, not frontend validation.

3. **Visibility = Row-Level Security.**
   The permission matrix below is implemented as Supabase RLS policies. Hiding rows in the UI is not access control.

   - `super_admin` → entire org
   - `admin_onboarding` → client data + onboarding tasks
   - `lead` → own tasks + their team's tasks
   - `member` → only assigned tasks

4. **Everything mutating writes to `audit_log`.** No silent state changes.
   Enforced via `AFTER INSERT/UPDATE/DELETE` triggers on `tasks`/`clients`/`task_files` (`supabase/sql/008_audit_triggers.sql`), **not** application code. RLS permits direct client-side writes that skip a server action entirely (e.g. a member updating their own task's status via supabase-js directly) — logging in app code alone would silently miss those. The trigger function is `SECURITY DEFINER` (trigger bodies don't bypass RLS otherwise) and `audit_log` has no client-facing `INSERT` policy at all.

## 5. Conventions

- **Server Components by default.** Add `"use client"` only when interactivity requires it.
- **Mutations** go through server actions or route handlers with Zod validation at the boundary. Same Zod schema shared client + server.
- **Types**: no `any`. Derive types from Prisma + Zod. Prefer `z.infer<>`.
- **Errors**: fail loud server-side, degrade gracefully client-side. No swallowed catches.
- **Naming**: tables/columns `snake_case`; TS `camelCase`; components `PascalCase`.
- **No secrets in code.** Env vars only. Never log service-role keys.
- **Dashboards/analytics are derived.** Use Postgres views / materialized views, not app-layer aggregation. Build these last.

## 6. Directory layout

```
/app            Next.js routes (App Router)
/components     UI (client + server components)
/lib            supabase client, utils, guards
/lib/schemas    Zod schemas (shared)
/lib/fsm        task status state machine + transition guards
/server         server actions, route handlers
/prisma         schema.prisma + migrations
/supabase       RLS policies, sql functions, cron
/stores         Zustand stores
```

## 7. Commands

```bash
pnpm dev              # local dev
pnpm build            # production build
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit
pnpm prisma migrate dev   # apply migrations
pnpm prisma generate      # regen client
```

Run `pnpm typecheck` and `pnpm lint` before declaring any task done.

## 8. How to work with me

- Terse, high-signal output. No filler, no "great question."
- When implementing, state assumptions inline; don't stop to ask unless genuinely blocked.
- Before writing code that touches status, files, or visibility: re-read section 4.
- If a request conflicts with a non-negotiable rule, flag it and propose the compliant version.
- Prefer small, reviewable diffs over large rewrites.
