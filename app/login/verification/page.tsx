import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_PREAUTH, verifierEnveloppe } from "@/lib/auth";
import { verifierCode, renvoyerCode } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vérification — Atelier Stéphan Hamache",
};

type PreAuth = { uid: number; nom: string; exp: number };

const champ =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  // Sans étape pré-auth valide (mot de passe déjà vérifié), pas de code à saisir.
  const pre = await verifierEnveloppe<PreAuth>(cookies().get(COOKIE_PREAUTH)?.value);
  if (!pre) redirect("/login");

  const messagesErr: Record<string, string> = {
    code: "Code incorrect. Réessayez.",
    expire: "Code expiré ou introuvable. Renvoyez-en un nouveau.",
    trop: "Trop de tentatives. Renvoyez un nouveau code.",
  };
  const errMsg = searchParams.error ? messagesErr[searchParams.error] : undefined;
  const okMsg = searchParams.ok === "renvoye" ? "Un nouveau code a été envoyé." : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-base font-bold leading-tight">Vérification</p>
          <p className="text-xs text-muted-foreground">
            Un code à 6 chiffres a été envoyé par e-mail.
          </p>
        </div>

        <form action={verifierCode} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              Code reçu
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className={champ + " text-center text-lg tracking-[0.5em]"}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="souvenir" defaultChecked className="h-4 w-4" />
            Se souvenir de cet appareil (30 jours)
          </label>

          {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
          {okMsg && <p className="text-sm text-green-600 dark:text-green-400">{okMsg}</p>}

          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Valider
          </button>
        </form>

        <form action={renvoyerCode}>
          <button
            type="submit"
            className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Renvoyer un code
          </button>
        </form>
      </div>
    </main>
  );
}
