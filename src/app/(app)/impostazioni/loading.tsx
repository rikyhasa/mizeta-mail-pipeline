export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Caricamento impostazioni">
      <div className="h-6 w-56 rounded bg-slate-200" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-32 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
