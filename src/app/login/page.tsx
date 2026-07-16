import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
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
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-anthracite)] px-16 py-16 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -right-56 h-[520px] w-[520px] rounded-full border-[90px] border-[var(--color-brand)] opacity-10"
        />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold">
            M
          </span>
          <div>
            <div className="text-[18px] leading-none font-bold tracking-[0.01em] text-[var(--color-sidebar-ink)]">Mizeta</div>
            <div className="mt-0.5 text-[11px] text-[var(--color-sidebar-ink-subtle)]">MAIL PIPELINE</div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--color-brand)] uppercase">
            Da email a lavoro organizzato
          </p>
          <h1 className="mt-[22px] mb-[18px] text-[47px] leading-[1.08] font-semibold text-white">
            Le email diventano pratiche operative, con un controllo umano sempre nel ciclo.
          </h1>
          <p className="text-[17px] leading-relaxed text-[var(--color-sidebar-ink-muted)]">
            Trasporti, groupage, carichi completi e ultimo miglio: ogni email in arrivo viene
            trasformata in una pratica chiara, pronta da verificare e completare.
          </p>
        </div>
        <div className="relative z-10 flex gap-7 text-xs text-[var(--color-sidebar-ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Controllo umano
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            Posta in sola lettura
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Audit completo
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--color-brand)] uppercase">Accesso</p>
          <h2 className="mt-1 text-[27px] leading-tight font-semibold text-[var(--color-anthracite)]">Bentornato</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Usa le tue credenziali aziendali.</p>

          {hasError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Email o password non corretti.
            </p>
          )}

          <form action="/api/auth/login" method="POST" className="mt-6 flex flex-col gap-[18px]">
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

            <button type="submit" className={buttonClassName({ variant: "primary", size: "md", className: "mt-1 w-full" })}>
              Accedi
            </button>

            <p className="text-center text-xs leading-relaxed text-[var(--color-ink-muted)]">
              L&apos;app non invia email, non effettua pagamenti e non scrive nel gestionale. Le bozze di risposta
              richiedono sempre approvazione umana esplicita.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
