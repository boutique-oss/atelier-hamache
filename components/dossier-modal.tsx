"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Fenêtre (widget) qui affiche une fiche dossier par-dessus la liste, sans
// changer de page. Ouverte via ?d=<id> sur /dossiers ; fermer = revenir à la
// liste avec ses filtres (closeHref). La fiche reste disponible en pleine
// page (/dossiers/<id>) pour un lien direct ou un nouvel onglet.
export function DossierModal({
  id,
  closeHref,
  children,
}: {
  id: number;
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const fermer = () => router.push(closeHref, { scroll: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Échap ferme, sauf si on est en train de saisir dans un champ (les
      // blocs éditables utilisent Échap pour annuler leur propre saisie).
      const cible = e.target as HTMLElement | null;
      if (e.key !== "Escape" || cible?.closest("input, textarea, select, form"))
        return;
      fermer();
    };
    window.addEventListener("keydown", onKey);
    // Pas de défilement de la liste derrière la fenêtre.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeHref]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/40 p-2 sm:p-6"
      onMouseDown={(e) => {
        // Clic sur le voile (hors fenêtre) = fermer.
        if (e.target === e.currentTarget) fermer();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative h-fit w-full max-w-4xl rounded-xl border bg-background px-4 pb-6 pt-2 shadow-2xl sm:px-6">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-end gap-1 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <Link
            href={`/dossiers/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Ouvrir en pleine page (nouvel onglet)"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            <ExternalLink size={13} /> Pleine page
          </Link>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            title="Fermer (Échap)"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
