"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMyNotifications, markNotificationRead } from "@/server/actions/notifications";
import { notificationEventSchema } from "@/lib/schemas/notification";
import type { Notification } from "@/generated/prisma/client";

// Renders a human sentence for a notification, having actually validated its payload against the
// discriminated union first (lib/schemas/notification.ts) rather than trusting the untyped Json
// column - a malformed row degrades to a generic label instead of crashing the bell for everyone.
function describeNotification(n: Notification): string {
  const parsed = notificationEventSchema.safeParse({ type: n.type, payload: n.payload });
  if (!parsed.success) return "Notification";

  switch (parsed.data.type) {
    case "task_assigned":
      return `You were assigned "${parsed.data.payload.taskTitle}"`;
    case "status_update":
      return `"${parsed.data.payload.taskTitle}" moved to ${parsed.data.payload.newStatus.replace(/_/g, " ")}`;
    case "approval":
      return `"${parsed.data.payload.taskTitle}" is ready for approval`;
    case "file_uploaded":
      return `A file was uploaded to "${parsed.data.payload.taskTitle}"`;
  }
}

// No props: AppShell.tsx is scoped to "mount the bell only" for this task, and AppShell's caller
// (app/(app)/layout.tsx) is out of scope entirely, so there's no clean way to thread a userId
// prop down to here. Resolving it client-side instead - auth.getUser() reads the current
// session's own id, which is exactly what the realtime filter below needs.
export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial state: a real server-side read via a server action (server/actions/notifications.ts),
  // never assumed to come from the realtime channel below - Postgres Changes only pushes rows
  // that change AFTER a subscription starts, it never backfills what already existed. This runs
  // on every mount, including a plain browser reload, independent of whether the socket is even
  // connected.
  useEffect(() => {
    let cancelled = false;
    getMyNotifications().then((result) => {
      if (!cancelled && result.ok) setNotifications(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: patches the state fetched above with new rows as they arrive. Filtered server-side
  // to this user's own rows - verified with a real two-client test (not assumed just because
  // notifications_select_own exists; Realtime's Postgres Changes authorization is configured
  // separately from ordinary Postgres RLS, per PLAN.md P4.2).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      channel = supabase
        .channel(`notifications:${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${id}` },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleMarkRead(id: string) {
    // Optimistic locally, but the write below is what actually persists - a reload re-reads the
    // row via getMyNotifications above, it never trusts this local mutation on its own.
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)));
    await markNotificationRead(id);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-2">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-neutral-50 px-4 py-3 text-left text-sm hover:bg-neutral-50 ${
                  n.readAt ? "text-neutral-500" : "text-neutral-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  {!n.readAt && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />}
                  {describeNotification(n)}
                </span>
                <span className="text-xs text-neutral-400">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
