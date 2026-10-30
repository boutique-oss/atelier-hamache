import type { ReactNode } from "react";

import { sql } from "@/lib/raw-sql";
import { sha256Hex } from "@/lib/auth";
import { activerCompte } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activation du compte — Atelier Stéphan Hamache",
};

const champ =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Vérifie que le jeton correspond à une invitation encore valable.
async function invitationValide(token: string): Promise<{ nom: string } | null> {
  if (!token) return null;
  try {
    const jetonHash = await sha256Hex(token);
    const rows = (await sql`
      SELECT u.nom
      FROM invitations i JOIN utilisateurs u ON u.id = i.utilisateur_id
      WHERE i.jeton_hash = ${jetonHash} AND i.utilise_at IS NULL AND i.expire_at > now()
      LIMIT 1
    `) as { nom: string }[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

export default async function ActiverPage({
  searchParams,
}: {
  searchParams: { token?: string; err?: string };
}) {
  const token = (searchParams.token || "").trim();
  const invite = await invitationValide(token);

  const cadre = (contenu: ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-base font-bold leading-tight">Atelier Stéphan Hamache</p>
          <p className="text-xs text-muted-foreground">Activation de votre compte</p>
        </div>
        {contenu}
      </div>
    </main>
  );

  // Lien invalide, déjà utilisé ou expiré.
  if (!invite) {
    return cadre(
      <div className="space-y-3 text-center text-sm">
        <p className="text-destructive">Ce lien d’activation est invalide ou a expiré.</p>
        <p className="text-muted-foreground">
          Demandez à l’administrateur de vous renvoyer une invitation.
        </p>
        <a href="/login" className="text-xs text-muted-foreground underline">
          Aller à la connexion
        </a>
      </div>
    );
  }

  const messagesErr: Record<string, string> = {
    court: "Mot de passe trop court (6 caractères minimum).",
    diff: "Les deux mots de passe ne correspondent pas.",
    invalide: "Lien invalide ou expiré.",
  };
  const errMsg = searchParams.err ? messagesErr[searchParams.err] : undefined;

  return cadre(
    <form action={activerCompte} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">
        Bonjour <span className="font-medium">{invite.nom}</span>, choisissez votre mot de passe
        pour activer votre accès.
      </p>
      <div className="space-y-2">
        <label htmlFor="motdepasse" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="motdepasse"
          name="motdepasse"
          type="password"
          autoComplete="new-password"
          autoFocus
          className={champ}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="motdepasse_confirm" className="text-sm font-medium">
          Confirmer le mot de passe
        </label>
        <input
          id="motdepasse_confirm"
          name="motdepasse_confirm"
          type="password"
          autoComplete="new-password"
          className={champ}
        />
      </div>
      {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
      <button
        type="submit"
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
      >
        Activer mon compte
      </button>
    </form>
  );
}
