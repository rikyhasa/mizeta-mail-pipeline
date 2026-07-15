import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Caricamento impostazioni">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-11 w-full rounded-none" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
