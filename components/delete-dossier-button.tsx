"use client";

import { useTransition } from "react";

import { deleteDossier } from "@/app/(main)/dossiers/actions";

// Bouton de suppression d'un dossier depuis la liste, avec confirmation.
// Appelle l'action serveur via useTransition (fiable, avec retour visuel)
// plutôt que via la soumission d'un formulaire — la suppression en cascade des
// fiches/heures et le détachement des commandes sont gérés côté base, et les
// éventuels événements Google Agenda sont nettoyés côté action.
export function DeleteDossierButton({
  id,
  nom,
}: {
  id: number;
  nom: string;
}) {
  const [pending, start] = useTransition();

  function onDelete() {
    if (
      !confirm(
        `Supprimer définitivement le dossier « ${nom} » ?

Ses fiches atelier et ses heures seront effacées ; ses commandes resteront, détachées du dossier. Action irréversible.`
      )
    ) {
      return;
    }
    start(async () => {
      await deleteDossier(id);
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
      title={`Supprimer le dossier ${nom}`}
      aria-label={`Supprimer le dossier ${nom}`}
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
