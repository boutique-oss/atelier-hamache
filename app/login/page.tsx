import { ConnexionCleAcces } from "@/components/cle-acces-boutons";

import { login } from "./actions";
import { getParamsSecurite } from "@/lib/securite";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accès — Atelier Stéphan Hamache",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const erreur = Boolean(searchParams?.error);
  const { aAdminActif } = await getParamsSecurite();
  // Tant qu'aucun compte admin n'existe, connexion par code d'accès (bootstrap).
  const bootstrap = !aAdminActif;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <p className="text-base font-bold leading-tight">Atelier Stéphan Hamache</p>
          <p className="text-xs text-muted-foreground">ERP atelier · Poitiers</p>
        </div>

        {bootstrap ? (
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              Code d&apos;accès
            </label>
            <input
              id="code"
              name="code"
              type="password"
              autoFocus
              autoComplete="off"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="identifiant" className="text-sm font-medium">
                Identifiant
              </label>
              <input
                id="identifiant"
                name="identifiant"
                type="text"
                autoFocus
                autoComplete="username"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="motdepasse" className="text-sm font-medium">
                Mot de passe
              </label>
              <input
                id="motdepasse"
                name="motdepasse"
                type="password"
                autoComplete="current-password"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        {erreur && (
          <p className="text-sm text-destructive">
            {bootstrap ? "Code incorrect." : "Identifiant ou mot de passe incorrect."}
          </p>
        )}

        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Entrer
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>
        <ConnexionCleAcces />

        {bootstrap && (
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            Aucun compte n&apos;existe encore : connectez-vous avec le code d&apos;accès pour
            créer les comptes dans Admin&nbsp;·&nbsp;Sécurité.
          </p>
        )}
      </form>
    </main>
  );
}
