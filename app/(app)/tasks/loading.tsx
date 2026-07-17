import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-48" />
      </div>
      <TableSkeleton columns={5} />
    </div>
  );
}
