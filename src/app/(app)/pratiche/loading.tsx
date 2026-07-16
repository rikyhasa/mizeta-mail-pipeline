import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Caricamento elenco pratiche">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
