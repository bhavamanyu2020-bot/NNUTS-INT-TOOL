// Applies every /supabase/sql/*.sql file, in filename order, via `prisma db execute`.
// This is the only mechanism that mutates triggers/RLS policies - see prisma/README.md
// for why this runs separately from `prisma migrate` and never via `supabase db reset`.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const sqlDir = path.join(process.cwd(), "supabase", "sql");

const files = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No SQL files found under supabase/sql - nothing to apply.");
  process.exit(0);
}

for (const file of files) {
  const filePath = path.join(sqlDir, file);
  console.log(`Applying ${file}...`);
  execFileSync("npx", ["prisma", "db", "execute", "--file", filePath], {
    stdio: "inherit",
    shell: true,
  });
}

console.log(`Applied ${files.length} SQL file(s).`);
