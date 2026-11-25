"use server";

import { revalidatePath } from "next/cache";

import type { Etape } from "@/lib/retroplanning";
import {
  effacerEtapesDossier,
  etapeValide,
  remplacerEtapesDossier,
} from "@/lib/retroplanning-db";

// Enregistre toutes les étapes d'un dossier telles qu'affichées sur le Gantt
// (après un déplacement, un étirement, une édition, un ajout ou une suppression).
// Pas de revalidatePath : le navigateur garde déjà l'état à jour, et un
// rechargement réinitialiserait le Gantt pendant qu'on travaille dessus.
export async function enregistrerEtapesDossier(
  dossierId: number,
  etapes: Partial<Etape>[]
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const id = Number(dossierId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erreur: "Dossier invalide" };
  if (!Array.isArray(etapes) || etapes.length > 60) return { ok: false, erreur: "Étapes invalides" };
  const propres: Etape[] = [];
  for (const e of etapes) {
    const v = etapeValide(e, id);
    if (!v) return { ok: false, erreur: "Une étape a des dates invalides" };
    propres.push(v);
  }
  try {
    await remplacerEtapesDossier(id, propres);
    return { ok: true };
  } catch (e) {
    console.error("enregistrerEtapesDossier", e);
    return { ok: false, erreur: "Enregistrement impossible" };
  }
}

// Revient au calcul à rebours pour un dossier (efface ses ajustements).
export async function recalculerDossier(dossierId: number): Promise<{ ok: boolean }> {
  const id = Number(dossierId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  await effacerEtapesDossier(id);
  revalidatePath("/planning");
  return { ok: true };
}
