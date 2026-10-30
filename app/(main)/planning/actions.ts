"use server";

import { revalidatePath } from "next/cache";

import {
  setDossierChantier,
  setDossierEventDate,
  type DossierEventField,
} from "@/app/(main)/dossiers/actions";
import {
  ajouterTypeIntervention,
  deplacerEntree,
  ecrireEntree,
  supprimerEntree,
  supprimerTypeIntervention,
} from "@/lib/planning-entrees-db";
import { idPerso, type TypeIntervention } from "@/lib/types-intervention";
import { sundayOfWeek, mondayIsoOf } from "@/lib/weeks";

// Type d'intervention d'une entrée de planning : une des 3 dates ponctuelles
// du dossier, la semaine de chantier, ou un type ajouté (« perso:<id> »).
export type TypeEntree = DossierEventField | "chantier" | `perso:${number}`;

export type EntreePlanning = {
  dossierId: number;
  type: TypeEntree;
  date: string; // AAAA-MM-JJ (pour un chantier : n'importe quel jour de la semaine)
  heure: string; // "HH:MM" ou "" (défaut 07:00)
  rappels: number[]; // minutes avant l'heure
  comment: string;
};

// Entrée d'origine en modification. `entreeId` = ligne planning_entrees
// pour un type ajouté.
export type EntreeOrigine = { dossierId: number; type: TypeEntree; entreeId?: number | null };

// Écrit une entrée de planning (sur son dossier, ou dans planning_entrees).
async function ecrire(e: EntreePlanning, entreeId: number | null) {
  const typeId = idPerso(e.type);
  if (typeId) {
    await ecrireEntree({ id: entreeId, dossierId: e.dossierId, typeId, date: e.date, heure: e.heure, rappels: e.rappels, comment: e.comment });
  } else if (e.type === "chantier") {
    const lundi = mondayIsoOf(e.date);
    await setDossierChantier(e.dossierId, lundi || null, lundi ? sundayOfWeek(lundi) : null, e.comment);
  } else {
    await setDossierEventDate(e.dossierId, e.type as DossierEventField, e.date || null, e.comment, e.heure || null, e.rappels);
  }
}

// Efface une entrée (date / semaine du dossier, ou ligne d'un type ajouté).
async function effacer(o: EntreeOrigine) {
  if (idPerso(o.type)) {
    if (o.entreeId) await supprimerEntree(o.entreeId);
  } else if (o.type === "chantier") await setDossierChantier(o.dossierId, null, null);
  else await setDossierEventDate(o.dossierId, o.type as DossierEventField, null);
}

// Création ou modification d'une entrée depuis le widget du planning.
// Si le type change de « famille » (date du dossier ↔ type ajouté) ou si le
// dossier change pour une date du dossier, l'ancienne entrée est effacée.
export async function enregistrerEntreePlanning(
  e: EntreePlanning,
  avant?: EntreeOrigine | null
): Promise<{ ok: boolean; error?: string }> {
  if (!e.dossierId) return { ok: false, error: "Choisis un dossier." };
  if (!e.date) return { ok: false, error: "Choisis une date." };
  let entreeId: number | null = null;
  if (avant) {
    const persoAvant = idPerso(avant.type) != null;
    const persoApres = idPerso(e.type) != null;
    if (persoAvant && persoApres) {
      entreeId = avant.entreeId ?? null; // même ligne, mise à jour sur place
    } else if (persoAvant !== persoApres || avant.dossierId !== e.dossierId || avant.type !== e.type) {
      await effacer(avant);
    }
  }
  await ecrire(e, entreeId);
  revalidatePath("/planning");
  return { ok: true };
}

// Glisser-déposer : déplace une entrée vers un autre jour (colonne) ou à une
// autre heure (timeline). `heure` absente = heure inchangée. Un chantier
// déplacé prend la semaine du jour visé.
export async function deplacerEntreePlanning(
  o: EntreeOrigine,
  date: string,
  heure?: string
): Promise<{ ok: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
  const typeId = idPerso(o.type);
  if (typeId) {
    if (o.entreeId) await deplacerEntree(o.entreeId, date, heure);
  } else if (o.type === "chantier") {
    const lundi = mondayIsoOf(date);
    await setDossierChantier(o.dossierId, lundi, sundayOfWeek(lundi));
  } else {
    await setDossierEventDate(o.dossierId, o.type as DossierEventField, date, undefined, heure);
  }
  revalidatePath("/planning");
  return { ok: true };
}

// Suppression d'une entrée depuis le widget.
export async function supprimerEntreePlanning(o: EntreeOrigine) {
  await effacer(o);
  revalidatePath("/planning");
  return { ok: true };
}

// Ajout d'un type d'intervention depuis le widget.
export async function creerTypeIntervention(
  libelle: string,
  couleur: string
): Promise<{ ok: boolean; type?: TypeIntervention; error?: string }> {
  const t = await ajouterTypeIntervention(libelle, couleur);
  if (!t) return { ok: false, error: "Donne un nom au type." };
  revalidatePath("/planning");
  return { ok: true, type: t };
}

// Suppression d'un type ajouté (et de ses entrées).
export async function retirerTypeIntervention(id: number) {
  await supprimerTypeIntervention(id);
  revalidatePath("/planning");
  return { ok: true };
}
