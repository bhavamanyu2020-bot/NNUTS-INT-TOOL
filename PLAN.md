# PLAN.md — NNUTS Tool: remaining backlog

> Companion to `CLAUDE.md`. Round 2 closed most of the original audit's findings (P0.1-P0.3,
> P2.1-P2.9, P3.2-P3.4, P5.1-lite/P5.2-lite, P0.4 — see git history for the commit that landed
> each). What's left below is genuinely unbuilt or unverified, not just unpolished.

## Ground rules (unchanged)

- One task = one commit = one reviewable diff.
- `pnpm typecheck && pnpm lint` after every task. Add `pnpm test` once P1.1 exists.
- If a fix would require weakening an RLS policy or FSM guard to pass, that's a bug — flag it,
  don't loosen the guard.
- Every new `.sql` file goes in `supabase/sql/` with a numeric prefix, applied by `pnpm db:sql`,
  and must be idempotent (`DROP ... IF EXISTS` before every `CREATE POLICY`/`CREATE TRIGGER`).
  Never `prisma db push`.

## P0.4 — done, partially

Verified against a real Supabase project: all 9 seeded users can log in; role-scoped visibility
at `/tasks`/`/clients` confirmed correct for 6 of 9 (super_admin, admin_onboarding, both leads,
2 members) by querying as each authenticated user directly; an illegal status jump and a no-file
`approval_sent` transition are both rejected by the DB triggers; `pnpm db:sql` is idempotent
(ran three times clean). Two real bugs were only surfaced by this (both fixed - see git history):
`scripts/apply-sql.ts` truncating paths with spaces on Windows, and `prisma/seed.ts` crashing on
the `server-only` import outside Next's bundler. Not yet exhaustively covered: the remaining 3
members, and a dedicated check of "lead sees a task they just created unassigned" as its own
scenario (the underlying P2.5 fix is confirmed via the production lead's overall visibility, not
isolated). This gap is exactly what P1's automated suite should close permanently.

## P1 — Automated test suite (highest-leverage remaining item)

Zero automated coverage of the RLS/FSM invariants exists. Vitest + a harness that authenticates
as any seeded user via `signInWithPassword` (never service-role, never the Prisma adapter — both
bypass RLS and prove nothing) and exercises:

- the full permission matrix (`CLAUDE.md` §4.3) across all four roles × seven tables, negatives
  included (member cannot select a teammate's task, cannot insert a task at all, etc.)
- every FSM transition (legal + illegal) against the DB triggers directly, not the TS guards
- the file gate, the insert guard (P2.1), the column guard (P2.4)

## P3.1 — Auth → users sync

`users.id` must equal `auth.users.id`, but only `prisma/seed.ts` does that today — onboarding a
real employee means hand-written SQL. Add `supabase/sql/011_handle_new_user.sql`: trigger on
`auth.users` INSERT creating the matching `public.users` row (default role `member`), plus
`ON DELETE` handling. Use `ON CONFLICT DO NOTHING` and make `prisma/seed.ts`'s insert an upsert —
the trigger will fire before the seed script's own insert once this lands. Then: a
super_admin-only `/admin/users` page to set role/team/lead afterward.

## P4 — Notifications (largest unbuilt feature)

Table + enum + Zod schema exist; no writes, no delivery.

- **P4.1**: `supabase/sql/012_notification_triggers.sql` — rows for `task_assigned` (assigned_to
  changes), `status_update`, `approval` (→ `approval_sent`), `file_uploaded`. `SECURITY DEFINER`
  + `SET search_path = public` (RLS grants no client INSERT on `notifications`). Never notify the
  actor about their own action. Define the payload shape as a real Zod schema in
  `lib/schemas/notification.ts` (currently `z.record(z.string(), z.unknown())` — no shape at all)
  and keep the trigger's JSON in sync.
- **P4.2**: Realtime bell in `components/nav/AppShell.tsx` — unread count, dropdown, mark-as-read,
  live via Supabase Realtime filtered to the current user. Enable the Realtime publication on
  `notifications`. **Verify, don't assume**, that Realtime honors `notifications_select_own` —
  Realtime RLS is configured separately from Postgres RLS. Test with two authenticated clients.
- **P4.3**: pg_cron job (or scheduled Edge Function) inserting `deadline_reminder` for tasks due
  within 24h and not `completed`. Idempotent — no duplicates on re-run.

## P5.1 remainder — richer analytics views

The lite version (`supabase/sql/010_analytics_views.sql`) covers task counts by status/stage and
client count, feeding the dashboard's stat cards. Still open: overdue tasks, per-member load,
average time-in-stage (derivable from `audit_log`'s trigger-written history — this is what P2.2
was partly *for*), per-client pipeline health. All views must use `security_invoker = true`
(Postgres 15+) — getting this backwards silently leaks the whole org's numbers through the view,
exactly like P5.1-lite's existing views correctly avoid.

## P6.1 — CI

`.github/workflows/ci.yml`: on PR — install, boot Supabase (or point at a disposable test
project), migrate, apply `supabase/sql/*`, seed, then `pnpm typecheck && pnpm lint && pnpm test`.
Blocked on P1 existing (nothing to run yet beyond typecheck/lint).
