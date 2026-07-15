# Migration workflow

`schema.prisma` owns tables, columns, enums, relations, and indexes only. Triggers and RLS
policies are **not** Prisma-expressible (they need `OLD` row values and cross-table lookups
that plain `CHECK` constraints can't see) and live as plain SQL under `/supabase/sql/`,
applied separately via `pnpm db:sql` (see that directory's own notes).

**Never run `prisma db push`.** It bypasses migration history and would silently produce a
database missing every trigger and RLS policy in `/supabase/sql/` — i.e. missing the FSM
guards and visibility rules CLAUDE.md calls non-negotiable. Always use
`prisma migrate dev` / `prisma migrate deploy`.

Local setup order (requires Docker Desktop running):

```
pnpm db:start      # supabase start - local Postgres/Auth/Realtime/Studio
pnpm db:setup       # prisma migrate deploy, then apply /supabase/sql/*.sql
pnpm prisma generate
pnpm prisma db seed
```

Full local reset:

```
pnpm db:stop
supabase start --no-backup 2>$null; pnpm db:start   # or just: pnpm db:start
pnpm db:setup
pnpm prisma db seed
```
