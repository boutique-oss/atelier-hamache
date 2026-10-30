"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DocumentDepot } from "@/components/document-depot";
import { supprimerDocument } from "@/app/documents/fichiers-actions";
import type { CategorieDocument } from "@/lib/documents-categories";

// Points de branchement de la page Documents sur les pièces de stockage
// (dépôt + suppression de fichiers sur Vercel Blob).

export function DepotEmplacement(props: {
  dossierId: number | null;
  categorie: CategorieDocument;
  docDossierId?: number | null;
  onDone?: () => void;
}) {
  return <DocumentDepot {...props} />;
}

// Réservé à l'admin (l'appelant n'affiche le bouton qu'aux admins, et
// supprimerDocument revérifie côté serveur).
export function SupprimerDocumentEmplacement({
  id,
  nom,
  onDone,
}: {
  id: number;
  nom: string;
  onDone?: () => void;
}) {
  return (
    <form
      action={async () => {
        const res = await supprimerDocument(id);
        if (!res.ok) {
          alert(res.error ?? "Suppression impossible.");
          return;
        }
        onDone?.();
      }}
      className="inline-flex"
    >
      <ConfirmDeleteButton
        label={`Supprimer « ${nom} »`}
        confirmation={`Supprimer définitivement « ${nom} » ? Le fichier sera effacé.`}
      />
    </form>
  );
}
