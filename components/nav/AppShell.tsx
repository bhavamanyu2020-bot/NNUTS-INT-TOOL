"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/generated/prisma/client";

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
type NavSection = { label: string; items: NavItem[] };

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  super_admin: [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "grid" }] },
    { label: "Clients", items: [{ href: "/clients", label: "Clients", icon: "building" }] },
    { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: "check" }] },
    {
      label: "Team",
      items: [
        { href: "/users", label: "Users", icon: "users" },
        { href: "/teams", label: "Teams", icon: "layers" },
      ],
    },
  ],
  admin_onboarding: [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "grid" }] },
    { label: "Clients", items: [{ href: "/clients", label: "Clients", icon: "building" }] },
    { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: "check" }] },
  ],
  lead: [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "grid" }] },
    { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: "check" }] },
  ],
  member: [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "grid" }] },
    { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: "check" }] },
  ],
};

const ICONS = {
  grid: (
    <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
  ),
  building: (
    <path d="M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M5 21h14M12 21v-4M14 4h4a1 1 0 0 1 1 1v16M8 7h.01M8 11h.01M8 15h.01" />
  ),
  check: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  users: (
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  ),
  layers: (
    <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  ),
  signOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
} as const;

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin_onboarding: "Onboarding Admin",
  lead: "Lead",
  member: "Member",
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
  const pathname = usePathname();
  const sections = NAV_BY_ROLE[role];
  const activeItem = sections.flatMap((s) => s.items).find((i) => pathname.startsWith(i.href));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <aside className="flex w-64 flex-shrink-0 flex-col bg-slate-950 text-slate-300">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
            N
          </div>
          <div>
            <p className="text-sm font-semibold text-white">NNUTS Tool</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Internal Panel</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-indigo-500/15 text-white"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                      }`}
                    >
                      <Icon name={item.icon} className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-3 py-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{userName}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            >
              <Icon name="signOut" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <div>
            <p className="text-xs text-neutral-400">NNUTS / {activeItem?.label ?? ""}</p>
            <h1 className="text-base font-semibold text-neutral-900">{activeItem?.label}</h1>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
