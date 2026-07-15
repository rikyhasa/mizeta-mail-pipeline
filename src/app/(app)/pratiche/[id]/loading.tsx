import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Caricamento pratica">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-11 w-full rounded-none" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
