"use client";

import { useState } from "react";

import { EntreeWidget } from "@/components/planning-entree";
import { dossierColor } from "@/lib/dossier-color";

// Chantier affiché dans une case du planning. Clic gauche = ouvrir le dossier
// (nouvel onglet). Clic droit = widget de modification (dossier, type,
// semaine, commentaire).
export function ChantierItem({
  id,
  nom,
  client,
  debut,
  comment,
}: {
  id: number;
  nom: string;
  client: string | null;
  debut: string;
  comment: string;
}) {
  const [open, setOpen] = useState(false);

  const titre = comment ? `${nom} — ${comment}` : nom;
  const couleur = dossierColor(id);

  return (
    <>
      <a
        href={`/dossiers/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        title={`${titre}${client ? " · " + client : ""} · clic droit pour modifier`}
        style={{
          backgroundColor: couleur.backgroundColor,
          color: couleur.color,
          borderColor: couleur.borderColor,
        }}
        className={`block truncate rounded border px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 ${
          comment ? "ring-1 ring-foreground/30" : ""
        }`}
      >
        {nom}
      </a>

      {open && (
        <EntreeWidget
          initiale={{
            dossierId: id,
            type: "chantier",
            date: debut,
            heure: "",
            rappels: [],
            comment,
          }}
          edition={{ dossierId: id, type: "chantier" }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
