import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLIENTS_SELECT } from "@/lib/supabase/columns";
import { ClientForm } from "@/components/clients/ClientForm";
import type { Client } from "@/generated/prisma/client";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select(CLIENTS_SELECT)
    .eq("id", id)
    .single()
    .returns<Client>();

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{client.brandName}</h1>
      <ClientForm client={client} />
    </div>
  );
}
