import { NextRequest, NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { calendarConfigured, deleteEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// Clé d'exécution (en plus du code d'accès middleware) : évite un déclenchement
// accidentel. À ouvrir : /api/admin/clean-chantier-events?key=ash-clean-2026
const CLEAN_KEY = "ash-clean-2026";

// Supprime de Google Agenda les anciens événements « début / fin de chantier »
// (stockés dans dossiers.google_event_id). Le code ne les crée plus, mais les
// anciens restaient orphelins dans l'agenda. On les efface un par un puis on
// remet la colonne à NULL. N'affecte PAS les 3 événements ponctuels conservés
// (enlèvement/dépôt, livraison, prise de cote), qui ont leurs propres colonnes.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== CLEAN_KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }
  if (!calendarConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Google Agenda non configuré" },
      { status: 500 }
    );
  }
  try {
    const rows = await db
      .select({ id: dossiers.id, googleEventId: dossiers.googleEventId })
      .from(dossiers)
      .where(isNotNull(dossiers.googleEventId));

    let supprimes = 0;
    const erreurs: string[] = [];
    for (const r of rows) {
      if (!r.googleEventId) continue;
      try {
        await deleteEvent(r.googleEventId); // ignore déjà 404/410
        await db
          .update(dossiers)
          .set({ googleEventId: null })
          .where(eq(dossiers.id, r.id));
        supprimes++;
      } catch (e) {
        erreurs.push(`dossier ${r.id}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      ok: erreurs.length === 0,
      candidats: rows.length,
      supprimes,
      erreurs,
      message: `${supprimes} événement(s) « chantier » supprimé(s) de l'agenda.`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
