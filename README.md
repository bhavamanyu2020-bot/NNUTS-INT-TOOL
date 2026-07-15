# NNUTS Tool

Internal workflow + task management tool for NNUTS (creative/media agency). Drives a
client-onboarding → marketing → production → post-production → closed pipeline, with
role-based visibility, task lifecycle tracking, and file/drive gating. Full spec and
non-negotiable rules: [`CLAUDE.md`](./CLAUDE.md). Open items / hardening backlog: [`PLAN.md`](./PLAN.md).

## Stack

Next.js 15 (App Router) · Supabase (Postgres, Auth, RLS) · Prisma (schema/migrations/types
only — see the warning below) · Zod · Tailwind · pnpm.

## Setup

1. **Get a Postgres/Auth backend.** Either:
   - A free [supabase.com](https://supabase.com) project (no install), or
   - Local Supabase CLI (`pnpm db:start`) — requires Docker Desktop.
2. `pnpm install`
3. Copy `.env.example` to `.env` and fill in your project's URL, `anon` key,
   `service_role` key, and `DATABASE_URL` (Project Settings → API / Database on
   supabase.com; the example file's values are the well-known local-CLI demo keys).
4. `pnpm prisma migrate deploy` — applies the schema.
5. `pnpm db:sql` — applies RLS policies and triggers (`supabase/sql/*.sql`, in filename order).
   Safe to re-run.
6. `pnpm prisma db seed` — creates 9 placeholder users (see below) plus sample teams,
   clients, and tasks.
7. `pnpm dev` → [http://localhost:3000](http://localhost:3000)

Steps 4–6 are also `pnpm db:setup && pnpm prisma db seed`. Full migration-workflow notes,
including why `prisma db push` must never be used here: [`prisma/README.md`](./prisma/README.md).

## Seeded users

All share the password `nnuts-dev-password` (see `prisma/seed.ts`):

| Email | Role |
|---|---|
| `super.admin@nnuts.local` | super_admin |
| `onboarding@nnuts.local` | admin_onboarding |
| `lead.production@nnuts.local` | lead (Production team) |
| `lead.postproduction@nnuts.local` | lead (Post Production team) |
| `member1@nnuts.local` – `member3@nnuts.local` | member (Production team) |
| `member4@nnuts.local`, `member5@nnuts.local` | member (Post Production team) |

## Role visibility matrix

Enforced as Postgres RLS policies (`supabase/sql/002_rls_policies.sql`), not in the UI —
hiding a row client-side is not access control here.

| Role | Sees |
|---|---|
| `super_admin` | Entire org |
| `admin_onboarding` | All clients + tasks at the `onboarding` stage |
| `lead` | Own tasks + their team's tasks |
| `member` | Only tasks assigned to them |

## ⚠️ Prisma is migrations/types only — never query with it at runtime

`@prisma/adapter-pg` connects as the table owner. A table owner **bypasses RLS by default**
unless `FORCE ROW LEVEL SECURITY` is set on every table — which this project does not do.
All user-facing reads/writes go through `lib/supabase/server.ts`'s cookie-scoped client
(`@supabase/ssr`), which authenticates as the actual signed-in user and is what RLS is
evaluated against. Prisma (`generated/prisma`, `@prisma/adapter-pg`) is used only for:

- `schema.prisma` as the schema/migration source of truth
- generated TypeScript types (imported for type-safety, never for querying)
- `prisma/seed.ts`, a trusted, non-request-path, local/CI-only script

If you find yourself calling `new PrismaClient()` anywhere under `/app`, `/components`, or
`/server`, stop — that's the footgun this section exists to warn about.

## Commands

```bash
pnpm dev              # local dev
pnpm build            # production build
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit
pnpm db:start         # supabase start (local CLI only)
pnpm db:setup         # prisma migrate deploy + apply supabase/sql/*.sql
pnpm prisma db seed   # seed data
```
