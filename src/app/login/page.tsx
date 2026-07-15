import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-anthracite)]">Mizeta Mail Pipeline</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Accedi con le tue credenziali aziendali.</p>
      </div>

      <Card>
        {hasError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Email o password non corretti.
          </p>
        )}

        <form action="/api/auth/login" method="POST" className="flex flex-col gap-4">
          <FormField label="Email" htmlFor="email">
            <input id="email" name="email" type="email" required autoComplete="username" className={fieldControlClassName} />
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
      </Card>
    </main>
  );
}
