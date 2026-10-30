import { headers } from "next/headers";
import {
  ShieldCheck,
  KeyRound,
  Network,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { sql } from "@/lib/raw-sql";
import { getParamsSecurite } from "@/lib/securite";
import { utilisateurCourant } from "@/lib/session";

import {
  mettreAJourCode,
  mettreAJourIps,
  creerUtilisateur,
  inviterUtilisateur,
  renvoyerInvitation,
  reinitMotDePasse,
  changerRole,
  basculerActif,
  supprimerUtilisateur,
} from "./actions";
import { mailConfigure } from "@/lib/mail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sécurité — Admin — Atelier Stéphan Hamache",
};

type Utilisateur = {
  id: number | string;
  nom: string;
  identifiant: string;
  email: string | null;
  role: string;
  actif: boolean;
  a_mdp: boolean; // un mot de passe est défini (sinon : invité en attente)
};

async function tablePrete(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM parametres_securite LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

async function listerUtilisateurs(): Promise<Utilisateur[]> {
  try {
    return (await sql`
      SELECT id, nom, identifiant, email, role, actif,
             (coalesce(mdp_hash, '') <> '') AS a_mdp
      FROM utilisateurs
      ORDER BY (role = 'admin') DESC, nom
    `) as Utilisateur[];
  } catch {
    return [];
  }
}

function ipClient(): string {
  const xff = headers().get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "";
}

const champ =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const bouton =
  "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90";

export default async function SecuritePage({
  searchParams,
}: {
  searchParams: { ok?: string; err?: string };
}) {
  const moi = await utilisateurCourant();

  // Panneau réservé à l'administrateur.
  if (moi?.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          className="mb-6"
          icon={Lock}
          tint="var(--brand-blue)"
          eyebrow="Admin"
          title="Sécurité"
          subtitle="Accès réservé"
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cette section est réservée à l’administrateur. Rapproche-toi de Stéphan
            si tu as besoin d’un changement de code, d’IP ou de compte.
          </CardContent>
        </Card>
      </main>
    );
  }

  const prete = await tablePrete();
  const { codeAcces, ipsAutorisees } = await getParamsSecurite();
  const utilisateurs = await listerUtilisateurs();
  const monIp = ipClient();
  const mailOk = mailConfigure();

  const messagesOk: Record<string, string> = {
    code: "Code d’accès mis à jour.",
    ips: "Liste des IP autorisées mise à jour.",
    compte: "Compte créé.",
    invite: "Invitation envoyée par e-mail.",
    mdp: "Mot de passe réinitialisé.",
    role: "Rôle mis à jour.",
    actif: "Statut du compte mis à jour.",
    suppr: "Compte supprimé.",
  };
  const messagesErr: Record<string, string> = {
    code_vide: "Le code ne peut pas être vide.",
    code_diff: "Les deux codes saisis ne correspondent pas.",
    db: "Base non initialisée : lancez d’abord l’activation.",
    compte_invalide: "Nom, identifiant et mot de passe (4 caractères min.) requis.",
    invite_invalide: "Nom, identifiant et e-mail valide requis pour inviter.",
    mail_indispo: "Envoi d’e-mail non configuré (clé Resend manquante côté serveur).",
    mail_echec: "Compte créé mais l’e-mail n’est pas parti. Réessayez « Renvoyer l’invitation ».",
    sans_email: "Ce compte n’a pas d’adresse e-mail enregistrée.",
    identifiant_pris: "Cet identifiant est déjà utilisé.",
    mdp_court: "Mot de passe trop court (4 caractères min.).",
    dernier_admin: "Action refusée : il doit rester au moins un administrateur actif.",
  };
  const okMsg = searchParams.ok ? messagesOk[searchParams.ok] : undefined;
  const errMsg = searchParams.err ? messagesErr[searchParams.err] : undefined;

  if (!prete) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          className="mb-6"
          icon={ShieldCheck}
          tint="var(--brand-blue)"
          eyebrow="Admin"
          title="Sécurité"
          subtitle="Une activation est nécessaire"
        />
        <Card>
          <CardContent className="space-y-4 p-6 text-sm">
            <p>
              Les tables de sécurité n’existent pas encore. Lancez une fois la
              migration puis rechargez cette page :
            </p>
            <a href="/api/admin/migrate?key=ash-migrate-2026" className={bouton}>
              Activer maintenant
            </a>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <PageHeader
        icon={ShieldCheck}
        tint="var(--brand-blue)"
        eyebrow="Admin"
        title="Sécurité"
        subtitle="Comptes, code d’accès et filtrage réseau de l’atelier"
      />

      {okMsg && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} /> {okMsg}
        </div>
      )}
      {errMsg && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle size={16} /> {errMsg}
        </div>
      )}

      {/* --- Comptes & rôles --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" /> Comptes &amp; rôles
          </CardTitle>
          <CardDescription>
            Les comptes actifs se connectent par identifiant + mot de passe. Les
            opérateurs accèdent à tout l’ERP sauf cette page. Il doit toujours
            rester un administrateur actif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Liste */}
          <div className="divide-y rounded-md border">
            {utilisateurs.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                Aucun compte pour l’instant. Créez le vôtre (admin) ci-dessous —
                vous êtes actuellement connecté via le code d’accès.
              </p>
            )}
            {utilisateurs.map((u) => (
              <div key={String(u.id)} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.nom}</span>
                  <span className="text-sm text-muted-foreground">@{u.identifiant}</span>
                  {u.email && (
                    <span className="text-xs text-muted-foreground">· {u.email}</span>
                  )}
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                      (u.role === "admin"
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {u.role}
                  </span>
                  {!u.a_mdp ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      en attente d’activation
                    </span>
                  ) : (
                    !u.actif && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        inactif
                      </span>
                    )
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  {/* Rôle */}
                  <form action={changerRole} className="flex items-end gap-1">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                    >
                      <option value="operateur">opérateur</option>
                      <option value="admin">admin</option>
                    </select>
                    <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">
                      Rôle
                    </button>
                  </form>

                  {/* Activer / désactiver */}
                  <form action={basculerActif}>
                    <input type="hidden" name="id" value={String(u.id)} />
                    <input type="hidden" name="actif" value={u.actif ? "false" : "true"} />
                    <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">
                      {u.actif ? "Désactiver" : "Activer"}
                    </button>
                  </form>

                  {/* Réinitialiser le mot de passe */}
                  <form action={reinitMotDePasse} className="flex items-end gap-1">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <input
                      name="motdepasse"
                      type="password"
                      placeholder="nouveau mdp"
                      className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                    />
                    <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">
                      Mdp
                    </button>
                  </form>

                  {/* Renvoyer l'invitation (compte invité pas encore activé) */}
                  {u.email && !u.a_mdp && (
                    <form action={renvoyerInvitation}>
                      <input type="hidden" name="id" value={String(u.id)} />
                      <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">
                        Renvoyer l’invitation
                      </button>
                    </form>
                  )}

                  {/* Supprimer */}
                  <form action={supprimerUtilisateur}>
                    <input type="hidden" name="id" value={String(u.id)} />
                    <button className="h-8 rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* Inviter par e-mail (voie principale) */}
          <form action={inviterUtilisateur} className="space-y-3 rounded-md border border-dashed p-4">
            <p className="text-sm font-medium">Inviter par e-mail</p>
            <p className="text-xs text-muted-foreground">
              La personne reçoit un lien pour choisir elle-même son mot de passe. Son
              adresse sert aussi aux codes de connexion (2FA).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="nom" placeholder="Nom (ex. Raphaël)" className={champ} />
              <input name="identifiant" placeholder="Identifiant (ex. raphael)" className={champ} />
              <input name="email" type="email" placeholder="E-mail" className={champ} />
              <select name="role" defaultValue="operateur" className={champ}>
                <option value="operateur">Opérateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            {!mailOk && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle size={13} /> Envoi d’e-mail non configuré : définissez
                RESEND_API_KEY et RESEND_FROM côté Vercel pour activer l’invitation et la 2FA.
              </p>
            )}
            <button type="submit" className={bouton} disabled={!mailOk}>
              Envoyer l’invitation
            </button>
          </form>

          {/* Créer avec mot de passe (voie de secours / premier admin) */}
          <details className="rounded-md border border-dashed p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Créer avec un mot de passe (secours)
            </summary>
            <form action={creerUtilisateur} className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Compte actif immédiatement, sans e-mail de vérification. Utile pour amorcer
                le premier admin. L’e-mail (facultatif) permet la 2FA ensuite.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input name="nom" placeholder="Nom (ex. Raphaël)" className={champ} />
                <input name="identifiant" placeholder="Identifiant (ex. raphael)" className={champ} />
                <input name="email" type="email" placeholder="E-mail (facultatif)" className={champ} />
                <input name="motdepasse" type="password" placeholder="Mot de passe" className={champ} />
                <select name="role" defaultValue="operateur" className={champ}>
                  <option value="operateur">Opérateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <button type="submit" className={bouton}>
                Créer le compte
              </button>
            </form>
          </details>
        </CardContent>
      </Card>

      {/* --- Code d'accès --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={16} className="text-muted-foreground" /> Code d’accès
          </CardTitle>
          <CardDescription>
            {codeAcces
              ? "Sert désormais au bootstrap (aucun admin) et à la récupération d’urgence. Reste modifiable ici."
              : "Aucun code défini."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={mettreAJourCode} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="code" className="text-sm font-medium">
                Nouveau code
              </label>
              <input id="code" name="code" type="password" autoComplete="new-password" className={champ} />
            </div>
            <div className="space-y-1">
              <label htmlFor="code_confirm" className="text-sm font-medium">
                Confirmer le code
              </label>
              <input
                id="code_confirm"
                name="code_confirm"
                type="password"
                autoComplete="new-password"
                className={champ}
              />
            </div>
            <button type="submit" className={bouton}>
              Enregistrer le code
            </button>
          </form>
        </CardContent>
      </Card>

      {/* --- IP autorisées --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network size={16} className="text-muted-foreground" /> IP autorisées
          </CardTitle>
          <CardDescription>
            Une IP publique par ligne (ou séparées par des virgules). Liste vide =
            aucune restriction réseau.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle size={13} className="mr-1 inline" />
            Attention : restreindre les IP peut vous bloquer hors de l’atelier.
            Votre IP actuelle est&nbsp;
            <code className="font-mono font-semibold">{monIp || "inconnue"}</code>
            {monIp && " — ajoutez-la si vous activez le filtrage."}
          </div>
          <form action={mettreAJourIps} className="space-y-3">
            <textarea
              name="ips"
              rows={4}
              defaultValue={ipsAutorisees.join("\n")}
              placeholder="ex. 82.65.12.34"
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button type="submit" className={bouton}>
              Enregistrer les IP
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
