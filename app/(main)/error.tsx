"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Filet de sécurité des pages applicatives : sans lui, une base injoignable ou
// une requête en échec laissait une page blanche, sans issue. La barre latérale
// reste en place (on est sous le layout), et l'on propose de réessayer.
export default function ErreurPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container mx-auto max-w-xl py-16" role="alert">
      <h1 className="brand-display text-2xl">La page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Les données de l&apos;atelier sont momentanément injoignables (connexion
        coupée ou serveur occupé). Rien de ce qui était déjà enregistré n&apos;est
        perdu. Réessayez dans quelques secondes ; si cela persiste, vérifiez la
        connexion internet de l&apos;appareil.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={reset}>
          <RotateCcw size={16} aria-hidden /> Réessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground">
          Référence de l&apos;incident : <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
