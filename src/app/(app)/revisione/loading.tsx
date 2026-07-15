export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Caricamento coda di revisione">
      <div className="h-6 w-72 rounded bg-slate-200" />
      <div className="h-40 rounded-lg bg-slate-100" />
      <div className="h-40 rounded-lg bg-slate-100" />
    </div>
  );
}
