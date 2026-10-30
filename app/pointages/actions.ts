"use server";

import { revalidatePath } from "next/cache";

import { ensureDocuments } from "@/lib/documents-db";
import { lireFiche, lundiDeSemaineIso, SEUIL_JOUR, TYPES_JOUR, TYPES_NEUTRES } from "@/lib/fiches-navettes";
import { sql } from "@/lib/raw-sql";
import { utilisateurCourant } from "@/lib/session";

// Crée la fiche navette d'un scan que le téléphone vient de déposer
// (document catégorie fiche_navette, origine scan). Statut : à saisir.
export async function creerFicheNavette(
  documentId: number,
  operateur: string,
  semaineIso: string
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!(await utilisateurCourant())) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const docId = Number(documentId);
  const op = String(operateur ?? "").trim();
  if (!Number.isInteger(docId) || !op || !lundiDeSemaineIso(String(semaineIso))) {
    return { ok: false, error: "Opérateur, semaine ou photo manquant." };
  }
  await ensureDocuments();
  const [doc] = await sql`SELECT 1 FROM documents WHERE id = ${docId} AND categorie = 'fiche_navette'`;
  if (!doc) return { ok: false, error: "Photo introuvable : renvoyez-la." };
  const [o] = await sql`SELECT 1 FROM operateurs WHERE nom = ${op} AND actif = true`;
  if (!o) return { ok: false, error: "Opérateur inconnu." };

  // Un même scan ne crée qu'une fiche (double appui, nouvel essai).
  const [deja] = await sql`SELECT id FROM fiches_navettes WHERE document_id = ${docId}`;
  if (deja) return { ok: true, id: Number(deja.id) };
  const [row] = await sql`INSERT INTO fiches_navettes (operateur, semaine_iso, document_id, statut)
    VALUES (${op}, ${semaineIso}, ${docId}, 'a_saisir') RETURNING id`;
  revalidatePath("/documents");
  return { ok: true, id: Number(row.id) };
}

export type JourSaisi = { date: string; type: string; heures: number | null };

export type ResultatIntegration =
  | { ok: true; ecrits: number }
  | { ok: false; error: string }
  | { ok: false; avertissements: string[] };

const jjmm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const h = (n: number) => `${(Math.round(n * 100) / 100).toString().replace(".", ",")} h`;

// « Valider et intégrer » : écrit les jours saisis dans `pointage` (un upsert
// par jour modifié) et passe la fiche à « intégrée », le tout dans UNE
// transaction. Les contrôles sont des avertissements : sans `forcer`, la
// fonction les renvoie sans rien écrire ; l'utilisateur confirme ensuite.
export async function integrerFicheNavette(
  ficheId: number,
  jours: JourSaisi[],
  forcer = false
): Promise<ResultatIntegration> {
  if (!(await utilisateurCourant())) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const fiche = await lireFiche(Number(ficheId));
  if (!fiche) return { ok: false, error: "Fiche introuvable." };

  const parDate = new Map(fiche.jours.map((j) => [j.date, j]));
  const aEcrire: { date: string; type: string; heures: number }[] = [];
  const avertissements: string[] = [];

  for (const saisi of Array.isArray(jours) ? jours : []) {
    const jour = parDate.get(String(saisi?.date));
    const type = String(saisi?.type ?? "");
    if (!jour || !type) continue; // jour hors semaine, ou case laissée vide
    if (!(TYPES_JOUR as readonly string[]).includes(type) && type !== jour.existant?.type) {
      return { ok: false, error: `Type de journée inconnu le ${jjmm(jour.date)}.` };
    }
    const heures =
      type === "Travail"
        ? Math.max(0, Number(saisi.heures) || 0)
        : TYPES_NEUTRES.includes(type)
          ? fiche.hJour
          : type === jour.existant?.type
            ? jour.existant.heures // type déjà en base (ex. Absence) : inchangé
            : 0;
    if (heures > 24) return { ok: false, error: `Plus de 24 h le ${jour.libelle.toLowerCase()} ${jjmm(jour.date)}.` };

    const e = jour.existant;
    if (e && e.type === type && Math.abs(e.heures - heures) < 0.001) continue; // rien ne change
    if (type === "Travail" && heures > SEUIL_JOUR) {
      avertissements.push(`${jour.libelle} ${jjmm(jour.date)} : ${h(heures)}, plus de ${SEUIL_JOUR} h dans la journée.`);
    }
    if (e) {
      avertissements.push(
        `${jour.libelle} ${jjmm(jour.date)} déjà pointé : ${e.type} ${h(e.heures)} → ${type} ${h(heures)}.`
      );
    }
    aEcrire.push({ date: jour.date, type, heures });
  }

  if (fiche.statut === "integree") {
    avertissements.unshift("Cette fiche a déjà été intégrée.");
  } else if (fiche.autresIntegrees > 0) {
    avertissements.unshift(`Une autre fiche de ${fiche.operateur} pour cette semaine est déjà intégrée.`);
  }
  if (avertissements.length > 0 && !forcer) return { ok: false, avertissements };

  await sql.transaction([
    ...aEcrire.map(
      (j) => sql`INSERT INTO pointage (operateur, date, heures, type, fiche_navette_id)
        VALUES (${fiche.operateur}, ${j.date}, ${j.heures}, ${j.type}, ${fiche.id})
        ON CONFLICT (operateur, date) DO UPDATE
        SET heures = EXCLUDED.heures, type = EXCLUDED.type,
            fiche_navette_id = EXCLUDED.fiche_navette_id`
    ),
    sql`UPDATE fiches_navettes SET statut = 'integree' WHERE id = ${fiche.id}`,
  ]);
  revalidatePath("/documents");
  revalidatePath("/pointage");
  return { ok: true, ecrits: aEcrire.length };
}

// « Vérifiée » : la saisie est relue mais pas encore intégrée (ou retour
// à « à saisir »). Une fiche intégrée ne change plus de statut ici.
export async function marquerFiche(
  ficheId: number,
  statut: "a_saisir" | "verifiee"
): Promise<{ ok: boolean; error?: string }> {
  if (!(await utilisateurCourant())) return { ok: false, error: "Session expirée : reconnectez-vous." };
  if (statut !== "a_saisir" && statut !== "verifiee") return { ok: false, error: "Statut invalide." };
  await ensureDocuments();
  await sql`UPDATE fiches_navettes SET statut = ${statut}
    WHERE id = ${Number(ficheId)} AND statut <> 'integree'`;
  revalidatePath("/documents");
  return { ok: true };
}
