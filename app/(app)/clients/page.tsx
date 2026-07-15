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
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Clients</h2>
          <p className="text-xs text-neutral-400">{clients?.length ?? 0} onboarded</p>
        </div>
        <Link href="/clients/new">
          <Button>New client</Button>
        </Link>
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Package</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((client) => (
              <tr key={client.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="font-medium text-neutral-900 hover:underline">
                    {client.brandName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.contactName}
                  <br />
                  <span className="text-xs">{client.contactEmail}</span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.serviceType.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-neutral-500">{client.package}</td>
              </tr>
            ))}
            {clients?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
