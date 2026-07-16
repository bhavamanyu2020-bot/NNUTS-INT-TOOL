"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createTeam, updateTeam } from "@/server/actions/teams";
import type { Team, User } from "@/generated/prisma/client";

export function TeamForm({ team, leadCandidates }: { team?: Team; leadCandidates: User[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input = {
      name: formData.get("name") as string,
      leadId: (formData.get("leadId") as string) || null,
    };

    const result = team ? await updateTeam(team.id, input) : await createTeam(input);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/teams");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Team name">
        <Input name="name" required defaultValue={team?.name} />
      </Field>
      <Field label="Lead">
        <Select name="leadId" defaultValue={team?.leadId ?? ""}>
          <option value="">No lead assigned</option>
          {leadCandidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : team ? "Save changes" : "Create team"}
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
