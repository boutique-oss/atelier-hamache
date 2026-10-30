"use client";

import { useState, useTransition } from "react";
import { FileDown, FileText } from "lucide-react";

import { exporterRapportHeures } from "@/app/rapports/actions";

// « Rapport PDF » : génère le rapport d'heures du dossier et l'enregistre dans
// ses documents (catégorie Heures). Lien d'ouverture affiché une fois prêt
// (pas de window.open après attente : bloqué par les navigateurs).
export function RapportPdfBouton({ dossierId, nom }: { dossierId: number; nom: string }) {
  const [pending, start] = useTransition();
  const [docId, setDocId] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  if (docId) {
    return (
      <a
        href={`/api/documents/${docId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        title="Rapport enregistré dans les documents du dossier (Heures)"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Ouvrir le PDF
      </a>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          start(async () => {
            const res = await exporterRapportHeures(dossierId);
            if (res.ok) setDocId(res.documentId);
            else setErreur(res.error);
          });
        }}
        aria-label={`Générer le rapport d'heures PDF de ${nom}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50 [@media(pointer:coarse)]:py-2"
      >
        <FileDown className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Génération…" : "Rapport PDF"}
      </button>
      {erreur && (
        <span role="alert" className="text-xs text-destructive">
          {erreur}
        </span>
      )}
    </span>
  );
}
