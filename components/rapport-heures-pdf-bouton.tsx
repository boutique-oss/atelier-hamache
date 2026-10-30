"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Loader2 } from "lucide-react";

import { genererRapportHeuresPdf } from "@/app/documents/rapport-heures-actions";
import { cn } from "@/lib/utils";

// Génère le PDF du rapport d'heures d'un dossier, le range dans le dossier
// (catégorie Heures) et l'ouvre dans un nouvel onglet.
export function RapportHeuresPdfBouton({ dossierId, className }: { dossierId: number; className?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          // Onglet ouvert pendant le clic : sinon le navigateur bloque la
          // fenêtre ouverte après l'attente du serveur.
          const onglet = window.open("", "_blank");
          demarrer(async () => {
            const res = await genererRapportHeuresPdf(dossierId);
            if (!res.ok) {
              onglet?.close();
              setErreur(res.error);
              return;
            }
            const url = `/api/documents/${res.id}`;
            if (onglet) onglet.location.href = url;
            else window.location.href = url;
            router.refresh();
          });
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60 [@media(pointer:coarse)]:py-2.5",
          className
        )}
      >
        {enCours ? <Loader2 size={13} aria-hidden className="animate-spin" /> : <FileDown size={13} aria-hidden />}
        {enCours ? "Génération…" : "PDF"}
      </button>
      {erreur && (
        <span role="alert" className="text-xs text-destructive">
          {erreur}
        </span>
      )}
    </span>
  );
}
