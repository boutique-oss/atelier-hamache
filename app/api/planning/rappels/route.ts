import { and, gte, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { listerEntrees } from "@/lib/planning-entrees-db";

export const dynamic = "force-dynamic";

// Rappels à notifier côté navigateur : interventions ponctuelles (enlèvement,
// livraison, prise de cote) d'aujourd'hui jusqu'à J+8 (un rappel « J-7 »
// tombe donc dans la fenêtre), avec leur heure et leurs rappels.
const RAPPELS_DEFAUT = "1440,0";

const TYPES = [
  { field: "dateEnlevementDepot", heure: "heureEnlevement", rappels: "rappelsEnlevement", comment: "commentaireEnlevement", label: "Enlèvement / dépôt" },
  { field: "dateLivraison", heure: "heureLivraison", rappels: "rappelsLivraison", comment: "commentaireLivraison", label: "Livraison" },
  { field: "datePriseDeCote", heure: "heurePriseCote", rappels: "rappelsPriseCote", comment: "commentairePriseCote", label: "Prise de cote" },
] as const;

export async function GET() {
  const now = new Date();
  const debut = now.toISOString().slice(0, 10);
  const fin = new Date(now.getTime() + 8 * 86400000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(dossiers)
    .where(
      or(
        and(gte(dossiers.dateEnlevementDepot, debut), lte(dossiers.dateEnlevementDepot, fin)),
        and(gte(dossiers.dateLivraison, debut), lte(dossiers.dateLivraison, fin)),
        and(gte(dossiers.datePriseDeCote, debut), lte(dossiers.datePriseDeCote, fin))
      )
    );

  const items = [];
  for (const d of rows) {
    for (const t of TYPES) {
      const date = d[t.field];
      if (!date || date < debut || date > fin) continue;
      items.push({
        key: `${d.id}-${t.field}`,
        dossierId: d.id,
        titre: `${t.label} — ${d.nomDossier}`,
        detail: [d.clientNom, d.adresse, d[t.comment]].filter(Boolean).join(" · "),
        date,
        heure: d[t.heure] || "07:00",
        rappels: (d[t.rappels] || RAPPELS_DEFAUT)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0),
      });
    }
  }
  // Entrées des types d'intervention ajoutés.
  try {
    for (const e of await listerEntrees(debut, fin)) {
      items.push({
        key: `perso-${e.id}`,
        dossierId: e.dossierId,
        titre: `${e.libelle} — ${e.nom}`,
        detail: e.comment,
        date: e.date,
        heure: e.heure || "07:00",
        rappels: (e.rappels || RAPPELS_DEFAUT)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0),
      });
    }
  } catch (err) {
    console.error("Rappels entrées planning:", (err as Error).message);
  }
  return NextResponse.json({ items });
}
