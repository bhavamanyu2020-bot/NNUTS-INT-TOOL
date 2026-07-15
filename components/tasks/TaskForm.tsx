"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createTask } from "@/server/actions/tasks";
import { ServiceType } from "@/generated/prisma/enums";
import type { Client, User } from "@/generated/prisma/client";

export function TaskForm({ clients, users }: { clients: Client[]; users: User[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const assignedTo = formData.get("assignedTo") as string;
    const deadline = formData.get("deadline") as string;

    const input = {
      clientId: formData.get("clientId") as string,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      assignedTo: assignedTo || null,
      serviceType: formData.get("serviceType") as string,
      deadline: deadline || null,
    };

    const result = await createTask(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/tasks/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Client">
        <Select name="clientId" required defaultValue="">
          <option value="" disabled>
            Select a client
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.brandName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title">
        <Input name="title" required />
      </Field>
      <Field label="Description">
        <Input name="description" />
      </Field>
      <Field label="Service type">
        <Select name="serviceType" required defaultValue="">
          <option value="" disabled>
            Select a service type
          </option>
          {Object.values(ServiceType).map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assign to">
        <Select name="assignedTo" defaultValue="">
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Deadline">
        <Input name="deadline" type="datetime-local" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create task"}
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
