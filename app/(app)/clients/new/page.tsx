import { ClientForm } from "@/components/clients/ClientForm";

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">New client</h1>
      <ClientForm />
    </div>
  );
}
