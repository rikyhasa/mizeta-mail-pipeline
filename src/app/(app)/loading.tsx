import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Caricamento dashboard">
      <Skeleton className="h-6 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
