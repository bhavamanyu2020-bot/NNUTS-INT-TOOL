import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-24" />
      <TableSkeleton columns={4} />
    </div>
  );
}
