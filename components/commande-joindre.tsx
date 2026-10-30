"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";

import { DepotEmplacement } from "@/components/documents-emplacements";

// Joindre le PDF du bon fournisseur à une commande (rubrique Commandes de la
// page Documents). Le fichier part en catégorie « Commandes », rattaché à la
// commande et à son dossier client : il apparaît aussi dans ce dossier.
export function CommandeJoindre({
  commandeId,
  dossierId,
}: {
  commandeId: number;
  dossierId: number | null;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground [@media(pointer:coarse)]:py-2"
      >
        <Paperclip size={13} aria-hidden /> {ouvert ? "Fermer" : "Joindre"}
      </button>
      {ouvert && (
        <DepotEmplacement
          dossierId={dossierId}
          categorie="commande"
          commandeId={commandeId}
          onDone={() => setOuvert(false)}
        />
      )}
    </div>
  );
}
