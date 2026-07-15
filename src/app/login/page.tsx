import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-anthracite)] px-16 py-16 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -right-56 h-[520px] w-[520px] rounded-full border-[90px] border-[var(--color-brand)] opacity-10"
        />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold">
            M
          </span>
          <span className="text-sm font-semibold tracking-wide text-[var(--color-sidebar-ink)] uppercase">
            Mizeta Mail Pipeline
          </span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-page-title font-semibold text-white">
            Le email diventano pratiche operative, con un controllo umano sempre nel ciclo.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-sidebar-ink-muted)]">
            Trasporti, groupage, carichi completi e ultimo miglio: ogni email in arrivo viene
            trasformata in una pratica chiara, pronta da verificare e completare.
          </p>
        </div>
        <p className="relative z-10 text-xs text-[var(--color-sidebar-ink-muted)]">Mizeta S.r.l.</p>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <h2 className="text-section-title font-semibold text-[var(--color-anthracite)]">Accedi</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Usa le tue credenziali aziendali.</p>

          {hasError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Email o password non corretti.
            </p>
          )}

          <form action="/api/auth/login" method="POST" className="mt-6 flex flex-col gap-4">
            <FormField label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className={fieldControlClassName}
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={fieldControlClassName}
              />
            </FormField>

            <button type="submit" className={buttonClassName({ variant: "primary", size: "md" })}>
              Accedi
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
