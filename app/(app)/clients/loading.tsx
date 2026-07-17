import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton columns={4} />
    </div>
  );
}
