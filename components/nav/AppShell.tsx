"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Role } from "@/generated/prisma/client";

const NAV_BY_ROLE: Record<Role, Array<{ href: string; label: string }>> = {
  super_admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/tasks", label: "Tasks" },
    { href: "/users", label: "Users" },
    { href: "/teams", label: "Teams" },
  ],
  admin_onboarding: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/tasks", label: "Tasks" },
  ],
  lead: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tasks", label: "Tasks" },
  ],
  member: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tasks", label: "Tasks" },
  ],
};

export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const navItems = NAV_BY_ROLE[role];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold">NNUTS Tool</span>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-neutral-600 hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            {userName} · {role}
          </span>
          <Button variant="secondary" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
