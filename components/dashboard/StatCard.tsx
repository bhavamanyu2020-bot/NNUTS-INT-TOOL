import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-3xl font-semibold text-neutral-900">{value}</p>
      {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
    </Card>
  );
}
