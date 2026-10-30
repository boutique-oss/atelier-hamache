import Link from "next/link";

import { Button } from "@/components/ui/button";

// Dossier, fiche ou commande introuvable (supprimé entre-temps, ou lien erroné).
export default function Introuvable() {
  return (
    <main className="container mx-auto max-w-xl py-16">
      <h1 className="brand-display text-2xl">Élément introuvable</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ce dossier ou cette fiche n&apos;existe pas, ou a été supprimé depuis.
        Retrouvez-le depuis la liste des dossiers.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dossiers">Voir les dossiers</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </main>
  );
}
