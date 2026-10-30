import { KeyRound } from "lucide-react";

import { CreerCleAcces } from "@/components/cle-acces-boutons";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PageHeader } from "@/components/page-header";
import { listerClesAcces } from "@/lib/cles-acces";
import { utilisateurCourant } from "@/lib/session";

import { supprimerCle } from "@/app/cles-acces/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clés d'accès — Atelier Stéphan Hamache",
};

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });

// Clés d'accès (passkeys) de l'utilisateur connecté : se connecter en
// scannant un QR code avec son téléphone, sans mot de passe ni code e-mail.
export default async function ClesAccesPage() {
  const moi = await utilisateurCourant();
  const cles = moi ? await listerClesAcces(moi.uid) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        className="mb-6"
        icon={KeyRound}
        tint="var(--brand-blue)"
        eyebrow="Mon accès"
        title="Clés d'accès"
        subtitle="Se connecter avec son téléphone, sans mot de passe"
      />

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Créer une clé</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Sur un <b className="text-foreground">PC</b> : cliquez « Créer une clé d&apos;accès », choisissez
            « Utiliser un téléphone » (ou « Autre appareil »), puis scannez le QR code avec le téléphone.
          </li>
          <li>
            Ou directement sur le <b className="text-foreground">téléphone</b>, connecté à l&apos;ERP : même bouton.
          </li>
          <li>Le téléphone demande l&apos;empreinte, le visage ou son code : la clé est créée.</li>
        </ol>
        <CreerCleAcces />
        <p className="text-xs text-muted-foreground">
          Ensuite, sur la page de connexion : « Se connecter avec une clé d&apos;accès » → QR code → téléphone.
          Le téléphone doit avoir le Bluetooth activé et être près du PC.
        </p>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border bg-card">
        <h2 className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          Mes clés ({cles.length})
        </h2>
        {cles.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune clé pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y">
            {cles.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    Créée le {dateFr(c.createdAt)}
                    {c.derniereUtilisation ? ` · utilisée le ${dateFr(c.derniereUtilisation)}` : " · jamais utilisée"}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await supprimerCle(c.id);
                  }}
                >
                  <ConfirmDeleteButton
                    label={`Supprimer la clé « ${c.nom} »`}
                    confirmation={`Supprimer la clé « ${c.nom} » ? Ce téléphone ne pourra plus vous connecter.`}
                  />
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
