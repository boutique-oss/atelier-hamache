"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { conges, operateurs } from "@/db/schema";
import { FERMETURE_LABEL, FERMETURE_TYPE } from "@/lib/conges-const";
import { sql } from "@/lib/raw-sql";
import {
  calendarConfigured,
  createEvent,
  deleteEvent,
  updateEvent,
  type ChantierEvent,
} from "@/lib/google-calendar";

// Rafraîchit les deux vues qui affichent les congés.
function revalidateConges() {
  revalidatePath("/pointage");
  revalidatePath("/planning");
}

// Une ligne complète de la table conges (retour de insert/select .returning()).
type CongeRow = typeof conges.$inferSelect;

// ── Synchro Google Agenda ─────────────────────────────────────────────────
// colorId Google alignés (au mieux) sur la palette du calendrier interne :
//   violet→Raisin(3), bleu→Paon(7), vert→Basilic(10), ambre→Banane(5),
//   rose→Flamant(4), sarcelle→Sauge(2), fuchsia→Mandarine(6).
// Le rouge (Tomate 11) est réservé à la fermeture de l'atelier.
const GOOGLE_COLORS = ["3", "7", "10", "5", "4", "2", "6"];

// Couleur Google d'un opérateur = sa position parmi les opérateurs actifs triés
// par nom (même ordre que la légende du calendrier). Graphite (8) si inconnu.
async function couleurGoogle(nom: string): Promise<string> {
  const rows = await db
    .select({ nom: operateurs.nom })
    .from(operateurs)
    .where(eq(operateurs.actif, true))
    .orderBy(asc(operateurs.nom));
  const idx = rows.findIndex((o) => o.nom === nom);
  return idx >= 0 ? GOOGLE_COLORS[idx % GOOGLE_COLORS.length] : "8";
}

// Construit l'événement Agenda (journée entière, période début → fin) d'un congé.
function congeEvent(c: CongeRow, colorId: string): ChantierEvent {
  const ferme = c.type === FERMETURE_TYPE;
  const summary = ferme
    ? `🔒 Atelier fermé${c.commentaire ? ` — ${c.commentaire}` : ""}`
    : `${c.type ?? "Congé"} — ${c.operateur}${c.statut !== "Validé" ? " (à valider)" : ""}`;
  const description = [
    ferme ? "Fermeture de l'atelier (tout le monde)" : `Congés — ${c.operateur}`,
    c.commentaire || null,
    `Statut : ${c.statut ?? "Demandé"}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { summary, description, startDate: c.dateDebut, endDate: c.dateFin, colorId };
}

// Crée l'événement Google et mémorise son id sur la ligne. Best-effort : une
// panne Google ne doit jamais empêcher l'enregistrement du congé.
async function creerEvenementGoogle(c: CongeRow): Promise<void> {
  if (!calendarConfigured()) return;
  try {
    const colorId = c.type === FERMETURE_TYPE ? "11" : await couleurGoogle(c.operateur);
    const eventId = await createEvent(congeEvent(c, colorId));
    await db.update(conges).set({ googleEventId: eventId }).where(eq(conges.id, c.id));
  } catch (e) {
    console.error("Sync Google congé (création) échouée:", (e as Error).message);
  }
}

// Met à jour l'événement (ex. le résumé quand une demande passe « Validé »).
async function majEvenementGoogle(c: CongeRow): Promise<void> {
  if (!calendarConfigured() || !c.googleEventId) return;
  try {
    const colorId = c.type === FERMETURE_TYPE ? "11" : await couleurGoogle(c.operateur);
    await updateEvent(c.googleEventId, congeEvent(c, colorId));
  } catch (e) {
    console.error("Sync Google congé (mise à jour) échouée:", (e as Error).message);
  }
}

async function supprimerEvenementGoogle(eventId: string | null): Promise<void> {
  if (!eventId || !calendarConfigured()) return;
  try {
    await deleteEvent(eventId);
  } catch (e) {
    console.error("Sync Google congé (suppression) échouée:", (e as Error).message);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

// Enregistre une nouvelle demande de congés (période début → fin), OU une
// fermeture générale de l'atelier (case « general » cochée) qui s'applique à
// tout le monde. Crée l'événement Google Agenda correspondant.
export async function createConge(fd: FormData) {
  const general = fd.get("general") === "on" || fd.get("general") === "true";
  const dateDebut = ((fd.get("dateDebut") as string) || "").trim();
  const dateFinBrute = ((fd.get("dateFin") as string) || "").trim();
  const commentaire = ((fd.get("commentaire") as string) || "").trim();
  if (!dateDebut) return;

  // Fin >= début ; si la fin est vide ou antérieure, on prend le jour de début.
  const dateFin = dateFinBrute && dateFinBrute >= dateDebut ? dateFinBrute : dateDebut;

  let valeurs;
  if (general) {
    // Fermeture atelier : opérateur/type dédiés, validée d'office (décision).
    valeurs = {
      operateur: FERMETURE_LABEL,
      dateDebut,
      dateFin,
      type: FERMETURE_TYPE,
      statut: "Validé",
      commentaire,
    };
  } else {
    const operateur = ((fd.get("operateur") as string) || "").trim();
    const type = ((fd.get("type") as string) || "Congé payé").trim();
    if (!operateur) return;
    valeurs = { operateur, dateDebut, dateFin, type, commentaire };
  }

  const [row] = await db.insert(conges).values(valeurs).returning();
  // Heures d'absence à retirer du stock d'heures (déduites à la validation).
  const heuresStock = Number(String(fd.get("heuresStock") ?? "").replace(",", "."));
  if (row && !general && Number.isFinite(heuresStock) && heuresStock > 0) {
    try {
      await sql`UPDATE conges SET heures_stock = ${heuresStock} WHERE id = ${row.id}`;
    } catch (e) {
      console.error("heures_stock (migration à lancer ?) :", (e as Error).message);
    }
  }
  if (row) await creerEvenementGoogle(row);
  revalidateConges();
}

// Change le statut d'une demande : Demandé · Validé · Refusé.
// Refusé → retire l'événement de l'Agenda ; sinon crée/actualise l'événement.
export async function setCongeStatut(id: number, statut: string) {
  const [row] = await db
    .update(conges)
    .set({ statut })
    .where(eq(conges.id, id))
    .returning();
  if (row) {
    if (statut === "Refusé") {
      await supprimerEvenementGoogle(row.googleEventId);
      await db.update(conges).set({ googleEventId: null }).where(eq(conges.id, id));
    } else if (!row.googleEventId) {
      await creerEvenementGoogle(row);
    } else {
      await majEvenementGoogle(row);
    }
  }
  revalidateConges();
}

// Supprime une demande de congés (et son événement Google Agenda).
export async function deleteConge(id: number) {
  const [row] = await db.select().from(conges).where(eq(conges.id, id));
  await supprimerEvenementGoogle(row?.googleEventId ?? null);
  await db.delete(conges).where(eq(conges.id, id));
  revalidateConges();
}
