import { NextResponse } from "next/server";
import { inArray, sql as dsql } from "drizzle-orm";

import { db } from "@/db";
import { dossiers, fichesAtelier, heures } from "@/db/schema";

// Lecture seule : pour les dossiers AVEC heures mais SANS type de pièce clair
// (fiche « Autre »/sans meuble, ou sans fiche), remonte tout le texte utile
// (nom, description, observations, notes, étapes, tissus) + une détection par
// mots-clés, pour classer sémantiquement les 657 h « Non précisé ».
export const dynamic = "force-dynamic";

// Détection par mots-clés (ordre = priorité).
const RULES: [string, RegExp][] = [
  ["Fauteuil", /fauteuil|berg[eè]re|voltaire|crapaud|cabriolet|\bclub\b/i],
  ["Chaise", /chaise/i],
  ["Canapé", /canap|m[ée]ridienne|\bsofa\b/i],
  ["Banquette", /banquette/i],
  ["Chauffeuse", /chau[f]?feuse/i],
  ["Tabouret / pouf", /tabouret|\bpouf\b|repose-?pied/i],
  ["Tête de lit", /t[êe]te de lit/i],
  ["Rideaux", /rideau|voilage|tringle|\bpanneau|embrasse|\bpli\b|fronc/i],
  ["Store", /\bstore/i],
  ["Coussin", /coussin/i],
  ["Galette", /galette/i],
  ["Tenture murale", /tenture|mur tendu|tissu mural/i],
  ["Amphithéâtre", /amphith/i],
  ["Lit / habillage", /\blit\b|sommier|dessus.?de.?lit|ciel de lit/i],
];

function classer(texte: string): string | null {
  for (const [label, re] of RULES) if (re.test(texte)) return label;
  return null;
}

export async function GET() {
  const parDossier = await db
    .select({
      dossierId: heures.dossierId,
      h: dsql<number>`coalesce(sum(${heures.heuresPassees}), 0)`,
    })
    .from(heures)
    .groupBy(heures.dossierId);

  const ids = parDossier
    .map((r) => r.dossierId)
    .filter((v): v is number => v != null);
  if (ids.length === 0) return NextResponse.json({ dossiers: [] });

  const [dRows, fRows] = await Promise.all([
    db
      .select({
        id: dossiers.id,
        nom: dossiers.nomDossier,
        type: dossiers.typeIntervention,
        commentaires: dossiers.commentaires,
      })
      .from(dossiers)
      .where(inArray(dossiers.id, ids)),
    db
      .select({
        dossierId: fichesAtelier.dossierId,
        type: fichesAtelier.typeIntervention,
        contenu: fichesAtelier.contenuJson,
        notes: fichesAtelier.notesLibres,
      })
      .from(fichesAtelier)
      .where(inArray(fichesAtelier.dossierId, ids)),
  ]);

  const dMap = new Map(dRows.map((d) => [Number(d.id), d]));
  const fMap = new Map<number, (typeof fRows)[number]>();
  for (const f of fRows) {
    const did = f.dossierId != null ? Number(f.dossierId) : null;
    if (did != null && !fMap.has(did)) fMap.set(did, f);
  }

  const out: any[] = [];
  for (const row of parDossier) {
    const did = row.dossierId != null ? Number(row.dossierId) : null;
    if (did == null) continue;
    const d = dMap.get(did);
    const f = fMap.get(did);
    let c: Record<string, any> = {};
    try {
      c = f
        ? typeof f.contenu === "string"
          ? JSON.parse(f.contenu || "{}")
          : ((f.contenu as Record<string, any>) || {})
        : {};
    } catch {
      c = {};
    }

    // Déjà classé (meuble/type_store rempli) → on saute, déjà couvert ailleurs.
    const meuble = String(c.meuble || c.type_store || "").trim();
    if (meuble) continue;

    const etapes = Array.isArray(c.etapes_custom)
      ? c.etapes_custom.map((e: any) => `${e.etape ?? ""} ${e.type ?? ""}`).join(" ")
      : "";
    const tissus = Array.isArray(c.tissus_list)
      ? c.tissus_list.map((t: any) => `${t.ref ?? ""} ${t.placement ?? ""}`).join(" ")
      : "";

    const texte = [
      d?.nom,
      d?.type,
      d?.commentaires,
      f?.type,
      c.description,
      c.observations,
      c.croquis,
      c.elements,
      f?.notes,
      etapes,
      tissus,
    ]
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim();

    out.push({
      dossierId: did,
      nom: d?.nom ?? null,
      heures: Math.round(Number(row.h) * 10) / 10,
      detection: classer(texte),
      texte: texte.slice(0, 500),
    });
  }

  out.sort((a, b) => b.heures - a.heures);
  return NextResponse.json({ nb: out.length, dossiers: out });
}
