"use client";

import { Upload } from "lucide-react";

import type { CategorieDocument } from "@/lib/documents-categories";

// Emplacements réservés aux pièces de la phase 2 (dépôt + suppression de
// fichiers), pour que la page Documents compile sans elles.
// TODO phase 2 : brancher DocumentDepot / supprimerDocument
//   - DepotEmplacement → <DocumentDepot dossierId categorie docDossierId onDone />
//     (components/document-depot.tsx), onDone = router.refresh().
//   - SupprimerDocumentEmplacement → bouton admin + confirmation appelant
//     supprimerDocument(id) (app/documents/fichiers-actions.ts), puis refresh.

export function DepotEmplacement(props: {
  dossierId: number | null;
  categorie: CategorieDocument;
  docDossierId?: number | null;
  onDone?: () => void;
}) {
  void props;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
      <Upload size={15} aria-hidden className="shrink-0" />
      <span>Dépôt de fichiers : bientôt disponible.</span>
    </div>
  );
}

export function SupprimerDocumentEmplacement(props: {
  id: number;
  nom: string;
  onDone?: () => void;
}) {
  void props;
  return null;
}
