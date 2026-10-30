import Link from "next/link";

import { FicheNavetteScan } from "@/components/fiche-navette-scan";
import { libelleSemaine, operateursPointage, semaineIsoDe } from "@/lib/fiches-navettes";
import { ajouterJours, lundiDe } from "@/lib/pointage";

export const dynamic = "force-dynamic";

// Page TÉLÉPHONE de l'atelier (sans barre latérale) : on choisit son nom et la
// semaine, on photographie sa fiche navette papier. La fiche part « à saisir »
// dans Documents › Pointages. Fonctionne sur le wifi de l'atelier (filtre IP).
export default async function ScanFicheNavettePage() {
  const operateurs = await operateursPointage();
  const lundi = lundiDe(new Date());
  // Semaine en cours d'abord, puis les deux précédentes (fiche rendue en retard).
  const semaines = [0, -7, -14].map((n) => {
    const iso = semaineIsoDe(ajouterJours(lundi, n));
    return { value: iso, label: (n === 0 ? "Cette semaine · " : "") + libelleSemaine(iso) };
  });

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-background px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pointage</p>
      <h1 className="brand-display mt-1 text-2xl">Envoyer ma fiche navette</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Photographiez la fiche remplie : le bureau la saisira dans le pointage.
      </p>
      <div className="mt-6">
        <FicheNavetteScan operateurs={operateurs} semaines={semaines} />
      </div>
      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/documents/fiche-navette-vierge" target="_blank" className="text-muted-foreground underline">
          Fiche vierge à imprimer
        </Link>
        <Link href="/" className="text-muted-foreground underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
