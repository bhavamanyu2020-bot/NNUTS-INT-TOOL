"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient as createClientAction, updateClient } from "@/server/actions/clients";
import { ServiceType } from "@/generated/prisma/enums";
import type { Client } from "@/generated/prisma/client";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input = {
      brandName: formData.get("brandName") as string,
      contactName: formData.get("contactName") as string,
      contactEmail: formData.get("contactEmail") as string,
      contactPhone: (formData.get("contactPhone") as string) || null,
      package: formData.get("package") as string,
      serviceType: formData.get("serviceType") as string,
      documentsLink: (formData.get("documentsLink") as string) || null,
      driveFolderLink: (formData.get("driveFolderLink") as string) || null,
      timeline: (formData.get("timeline") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    const result = client
      ? await updateClient(client.id, input)
      : await createClientAction(input);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/clients/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Brand name">
        <Input name="brandName" required defaultValue={client?.brandName} />
      </Field>
      <Field label="Contact name">
        <Input name="contactName" required defaultValue={client?.contactName} />
      </Field>
      <Field label="Contact email">
        <Input name="contactEmail" type="email" required defaultValue={client?.contactEmail} />
      </Field>
      <Field label="Contact phone">
        <Input name="contactPhone" defaultValue={client?.contactPhone ?? ""} />
      </Field>
      <Field label="Package">
        <Input name="package" required defaultValue={client?.package} />
      </Field>
      <Field label="Service type">
        <Select name="serviceType" required defaultValue={client?.serviceType ?? ""}>
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
      <Field label="Documents link">
        <Input name="documentsLink" type="url" defaultValue={client?.documentsLink ?? ""} />
      </Field>
      <Field label="Drive folder link">
        <Input name="driveFolderLink" type="url" defaultValue={client?.driveFolderLink ?? ""} />
      </Field>
      <Field label="Timeline">
        <Input name="timeline" defaultValue={client?.timeline ?? ""} />
      </Field>
      <Field label="Notes">
        <Input name="notes" defaultValue={client?.notes ?? ""} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : client ? "Save changes" : "Create client"}
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
