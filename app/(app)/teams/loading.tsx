import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function TeamsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <TableSkeleton columns={3} />
    </div>
  );
}
