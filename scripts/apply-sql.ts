// Applies every /supabase/sql/*.sql file, in filename order, via `prisma db execute --stdin`.
// This is the only mechanism that mutates triggers/RLS policies - see prisma/README.md
// for why this runs separately from `prisma migrate` and never via `supabase db reset`.
//
// Piped via stdin rather than `--file <path>`: a path argument passed through execFileSync's
// shell:true on Windows gets naively space-split before reaching the shell's own quoting, so any
// project directory with a space in it (e.g. "NNUTS Tool") silently truncates the path. Stdin
// sidesteps the problem entirely - no path ever appears as a shell argument.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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
  // shell:true is required on Windows to invoke the npx.cmd shim (Node can't spawnSync a .cmd
  // directly). Node's shell:true deprecation warning is about unescaped *user-controlled* args -
  // every element here is a fixed literal, so there's nothing to inject.
  execFileSync("npx", ["prisma", "db", "execute", "--stdin"], {
    input: readFileSync(filePath),
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
}

console.log(`Applied ${files.length} SQL file(s).`);
