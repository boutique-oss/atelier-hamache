import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import {
  calendarConfigured,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Clé d'exécution (en plus du code d'accès middleware).
// À ouvrir : /api/admin/resync-events?key=ash-resync-2026
const RESYNC_KEY = "ash-resync-2026";

// Config des 3 événements ponctuels — identique à EVENT_CONFIG de actions.ts
// (dupliquée ici car ce fichier "use server" ne l'exporte pas). colorId alignés
// sur le planning : enlèvement=rouge(11), livraison=vert(10), prise de cote=jaune(5).
const EVENTS = [
  {
    dateField: "dateEnlevementDepot",
    eventIdCol: "googleEventIdEnlevement",
    commentCol: "commentaireEnlevement",
    heureCol: "heureEnlevement",
    rappelsCol: "rappelsEnlevement",
    label: "Enlèvement / dépôt",
    colorId: "11",
  },
  {
    dateField: "dateLivraison",
    eventIdCol: "googleEventIdLivraison",
    commentCol: "commentaireLivraison",
    heureCol: "heureLivraison",
    rappelsCol: "rappelsLivraison",
    label: "Livraison",
    colorId: "10",
  },
  {
    dateField: "datePriseDeCote",
    eventIdCol: "googleEventIdPriseCote",
    commentCol: "commentairePriseCote",
    heureCol: "heurePriseCote",
    rappelsCol: "rappelsPriseCote",
    label: "Prise de cote",
    colorId: "5",
  },
] as const;

// Rappels par défaut (veille + jour même) + parse du CSV stocké par dossier.
const RAPPELS_DEFAUT = [1440, 0];
function parseRappels(csv: string | null): number[] {
  if (!csv) return RAPPELS_DEFAUT;
  const mins = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return mins.length ? mins : RAPPELS_DEFAUT;
}

// Re-synchronise TOUT l'agenda en un passage :
//  1) supprime les anciens événements « début/fin de chantier » (google_event_id) ;
//  2) pour chaque date ponctuelle renseignée : recrée l'événement s'il manque,
//     sinon le met à jour → applique couleur + horaire 7h + rappels aux existants.
// Idempotente : relançable sans risque.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== RESYNC_KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }
  if (!calendarConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Google Agenda non configuré" },
      { status: 500 }
    );
  }

  const erreurs: string[] = [];
  let chantiersSupprimes = 0;
  let evtCrees = 0;
  let evtMisAJour = 0;

  try {
    const rows = await db.select().from(dossiers);

    for (const d of rows) {
      // 1) Ancien événement chantier orphelin.
      if (d.googleEventId) {
        try {
          await deleteEvent(d.googleEventId);
          await db
            .update(dossiers)
            .set({ googleEventId: null })
            .where(eq(dossiers.id, d.id));
          chantiersSupprimes++;
        } catch (e) {
          erreurs.push(`chantier ${d.id}: ${(e as Error).message}`);
        }
      }

      // 2) Les 3 événements ponctuels (couleur + 7h + rappels).
      for (const cfg of EVENTS) {
        const date = d[cfg.dateField as keyof typeof d] as string | null;
        const existingId = d[cfg.eventIdCol as keyof typeof d] as string | null;
        const commentaire = d[cfg.commentCol as keyof typeof d] as string | null;
        const heure = d[cfg.heureCol as keyof typeof d] as string | null;
        const rappels = parseRappels(
          d[cfg.rappelsCol as keyof typeof d] as string | null
        );
        if (!date) continue;
        const ev = {
          summary: `${cfg.label} — ${d.nomDossier}`,
          description: [d.clientNom, d.adresse, d.telephone, commentaire]
            .filter(Boolean)
            .join(" · "),
          startDate: date,
          endDate: date,
          heure: heure || null,
          rappels,
          colorId: cfg.colorId,
        };
        try {
          if (existingId) {
            await updateEvent(existingId, ev);
            evtMisAJour++;
          } else {
            const newId = await createEvent(ev);
            await db
              .update(dossiers)
              .set({ [cfg.eventIdCol]: newId })
              .where(eq(dossiers.id, d.id));
            evtCrees++;
          }
        } catch (e) {
          erreurs.push(`${cfg.label} ${d.id}: ${(e as Error).message}`);
        }
      }
    }

    return NextResponse.json({
      ok: erreurs.length === 0,
      dossiers: rows.length,
      chantiersSupprimes,
      evtCrees,
      evtMisAJour,
      erreurs,
      message: `Re-synchro terminée : ${chantiersSupprimes} chantier(s) supprimé(s), ${evtCrees} créé(s), ${evtMisAJour} recoloré(s)/mis à jour.`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, erreurs },
      { status: 500 }
    );
  }
}
