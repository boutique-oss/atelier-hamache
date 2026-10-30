"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { operateurs, pointage } from "@/db/schema";
import { sql } from "@/lib/raw-sql";

// Types d'une journée pointée.
//   Congé / Maladie / Férié  → comptent pour l'horaire théorique (aucun écart)
//   Récup / Repos            → comptent 0 h
//   Travail                  → heures saisies
// NB : un fichier "use server" ne peut EXPORTER que des fonctions async —
// ces listes restent donc internes au module.
const TYPES_NEUTRES = ["Congé", "Maladie", "Férié"] as const;

// Heures théoriques d'une journée = contrat hebdo / 5.
async function heuresJour(nom: string): Promise<number> {
  const [op] = await db
    .select({ h: operateurs.heuresSemaine })
    .from(operateurs)
    .where(eq(operateurs.nom, nom));
  return op ? Number(op.h) / 5 : 7;
}

// Enregistre (ou remplace) la journée d'un salarié. `heures` n'est utilisé que
// pour le type « Travail » ; les autres types déduisent leur valeur du contrat.
export async function setPointage(
  operateur: string,
  date: string,
  type: string,
  heures?: number | null
) {
  if (!operateur || !date) return;

  let valeur = 0;
  if (type === "Travail") {
    valeur = Number(heures) || 0;
  } else if ((TYPES_NEUTRES as readonly string[]).includes(type)) {
    valeur = await heuresJour(operateur);
  }

  const [existant] = await db
    .select({ id: pointage.id })
    .from(pointage)
    .where(and(eq(pointage.operateur, operateur), eq(pointage.date, date)));

  if (existant) {
    await db
      .update(pointage)
      .set({ heures: valeur, type })
      .where(eq(pointage.id, existant.id));
  } else {
    await db.insert(pointage).values({ operateur, date, heures: valeur, type });
  }
  revalidatePath("/pointage");
}

// Efface la journée (la case redevient vide).
export async function effacerPointage(operateur: string, date: string) {
  await db
    .delete(pointage)
    .where(and(eq(pointage.operateur, operateur), eq(pointage.date, date)));
  revalidatePath("/pointage");
}

// Remplit la semaine à l'horaire contractuel (les jours déjà typés sont gardés).
export async function remplirSemaine(operateur: string, jours: string[]) {
  const h = await heuresJour(operateur);
  for (const date of jours) {
    const [dejaLa] = await db
      .select({ type: pointage.type })
      .from(pointage)
      .where(and(eq(pointage.operateur, operateur), eq(pointage.date, date)));
    if (dejaLa && dejaLa.type !== "Travail") continue;
    await setPointage(operateur, date, "Travail", h);
  }
  revalidatePath("/pointage");
}

// Vide la semaine d'un salarié.
export async function viderSemaine(operateur: string, jours: string[]) {
  for (const date of jours) {
    await effacerPointage(operateur, date);
  }
  revalidatePath("/pointage");
}

// ── Navette : absences avec motif, heures sup. payer/stocker, stock d'heures,
// horaire fixe. Colonnes/tables créées par /api/admin/migrate (SQL brut).

// Pose une absence avec motif, sur un jour ou une période (jusqu'à `jusquau`,
// lun→ven uniquement). Journée entière : 0 h faite, h/jour d'absence.
// Partielle (un seul jour) : `heuresFaites` travaillées + `heuresAbsence`.
export async function setAbsence(
  operateur: string,
  date: string,
  motif: string,
  partielle: boolean,
  heuresAbsence: number,
  heuresFaites: number,
  jusquau?: string
) {
  if (!operateur || !date) return;
  const hJour = await heuresJour(operateur);
  const dates: string[] = [];
  if (partielle || !jusquau || jusquau <= date) {
    dates.push(date);
  } else {
    for (let d = date; d <= jusquau; ) {
      const w = new Date(d + "T00:00:00Z").getUTCDay();
      if (w !== 0 && w !== 6) dates.push(d);
      const [y, m, j] = d.split("-").map(Number);
      d = new Date(Date.UTC(y, m - 1, j + 1)).toISOString().slice(0, 10);
    }
  }
  const hFaites = partielle ? Math.max(0, Number(heuresFaites) || 0) : 0;
  const hAbs = partielle ? Math.max(0, Number(heuresAbsence) || 0) : hJour;
  for (const d of dates) {
    await sql`INSERT INTO pointage (operateur, date, heures, type, motif, heures_absence)
      VALUES (${operateur}, ${d}, ${hFaites}, 'Absence', ${motif}, ${hAbs})
      ON CONFLICT (operateur, date) DO UPDATE
      SET heures = EXCLUDED.heures, type = 'Absence', motif = EXCLUDED.motif,
          heures_absence = EXCLUDED.heures_absence`;
  }
  revalidatePath("/pointage");
}

// Heures sup. d'une semaine : payées (navette) ou stockées (stock d'heures).
export async function setModeHS(operateur: string, lundi: string, mode: "payer" | "stocker") {
  await sql`INSERT INTO hs_semaines (operateur, lundi, mode)
    VALUES (${operateur}, ${lundi}, ${mode})
    ON CONFLICT (operateur, lundi) DO UPDATE SET mode = EXCLUDED.mode`;
  revalidatePath("/pointage");
}

// Ajustement manuel du stock (solde de départ, correction…), en heures signées.
export async function ajusterStock(operateur: string, fd: FormData) {
  const heures = Number(String(fd.get("heures") ?? "").replace(",", "."));
  if (!operateur || !Number.isFinite(heures) || heures === 0) return;
  const date = String(fd.get("date") || new Date().toISOString().slice(0, 10));
  const libelle = String(fd.get("libelle") || "").trim() || "Ajustement";
  await sql`INSERT INTO stock_heures (operateur, date, heures, libelle)
    VALUES (${operateur}, ${date}, ${heures}, ${libelle})`;
  revalidatePath("/pointage");
}

export async function supprimerMouvementStock(id: number) {
  await sql`DELETE FROM stock_heures WHERE id = ${id}`;
  revalidatePath("/pointage");
}

// Horaire fixe : salarié exclu du calcul des heures sup. (ex. Raphaël).
export async function setHoraireFixe(nom: string, fixe: boolean) {
  await sql`UPDATE operateurs SET horaire_fixe = ${fixe} WHERE nom = ${nom}`;
  revalidatePath("/pointage");
}
