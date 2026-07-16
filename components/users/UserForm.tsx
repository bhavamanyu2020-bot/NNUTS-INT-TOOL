"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { updateUser } from "@/server/actions/users";
import { Role } from "@/generated/prisma/enums";
import type { Team, User } from "@/generated/prisma/client";

export function UserForm({ user, teams }: { user: User; teams: Team[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input = {
      role: formData.get("role") as string,
      teamId: (formData.get("teamId") as string) || null,
    };

    const result = await updateUser(user.id, input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Email">
        <p className="text-sm text-neutral-500">{user.email}</p>
      </Field>
      <Field label="Role">
        <Select name="role" required defaultValue={user.role}>
          {Object.values(Role).map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Team">
        <Select name="teamId" defaultValue={user.teamId ?? ""}>
          <option value="">No team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
