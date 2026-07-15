import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLIENTS_SELECT } from "@/lib/supabase/columns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Client } from "@/generated/prisma/client";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select(CLIENTS_SELECT)
    .order("created_at", { ascending: false })
    .returns<Client[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clients</h1>
        <Link href="/clients/new">
          <Button>New client</Button>
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {clients?.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`}>
            <Card className="hover:border-neutral-400">
              <p className="font-medium">{client.brandName}</p>
              <p className="text-sm text-neutral-500">
                {client.contactName} · {client.serviceType.replace(/_/g, " ")}
              </p>
            </Card>
          </Link>
        ))}
        {clients?.length === 0 && (
          <p className="text-sm text-neutral-500">No clients yet.</p>
        )}
      </div>
    </div>
  );
}
