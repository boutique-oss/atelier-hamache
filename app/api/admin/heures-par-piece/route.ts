import { NextResponse } from "next/server";
import { sql as dsql } from "drizzle-orm";

import { db } from "@/db";
import { fichesAtelier, heures } from "@/db/schema";

// Lecture seule : calcule les heures PAR PIÈCE en divisant par la quantité RÉELLE
// de la fiche (nb_galettes / nb_coussins / nb_panneaux / nb_stores, ou quantité
// en tête du libellé meuble), et en regroupant les variantes d'orthographe.
// Protégé par le code d'accès. Diagnostic — à retirer après usage.
export const dynamic = "force-dynamic";

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Regroupe les libellés en pièces canoniques.
function normalizePiece(raw: string, type: string): string {
  const s = (raw || "").toLowerCase();
  if (/fauteuil/.test(s)) return "Fauteuil";
  if (/canap|m[ée]ridienne/.test(s)) return "Canapé";
  if (/chaise/.test(s)) return "Chaise";
  if (/banquette/.test(s)) return "Banquette";
  if (/chau[f]?feuse/.test(s)) return "Chauffeuse";
  if (/amphith/.test(s)) return "Amphithéâtre";
  if (/galette/.test(s)) return "Galette";
  if (/coussin/.test(s)) return "Coussin";
  if (/rideau|voilage/.test(s)) return "Rideaux";
  if (/store/.test(s)) return "Store";
  if (/lit/.test(s)) return "Lit / tête de lit";
  const t = (type || "").trim();
  if (t && t !== "Autre") return t;
  return (raw || "").trim() || "Non précisé";
}

// Quantité réelle de pièces d'une fiche.
function decodeQuantite(contenu: Record<string, any>, rawMeuble: string): number {
  const q =
    num(contenu.nb_galettes) ||
    num(contenu.nb_coussins) ||
    num(contenu.nb_panneaux) ||
    num(contenu.nb_stores);
  if (q > 0) return q;
  const m = String(rawMeuble || "").match(/^\s*(\d+)/); // "2 FAUTEUIL" -> 2
  if (m) return Number(m[1]);
  return 1;
}

export async function GET() {
  // Heures cumulées par dossier.
  const heuresParDossier = await db
    .select({
      dossierId: heures.dossierId,
      h: dsql<number>`coalesce(sum(${heures.heuresPassees}), 0)`,
    })
    .from(heures)
    .groupBy(heures.dossierId);

  // Fiches (une par dossier — dédoublonnage).
  const fiches = await db
    .select({
      dossierId: fichesAtelier.dossierId,
      type: fichesAtelier.typeIntervention,
      contenu: fichesAtelier.contenuJson,
    })
    .from(fichesAtelier);
  const ficheParDossier = new Map<
    number,
    { type: string; contenu: Record<string, any> }
  >();
  for (const f of fiches) {
    const did = f.dossierId != null ? Number(f.dossierId) : null;
    if (did == null || ficheParDossier.has(did)) continue;
    let c: Record<string, any> = {};
    try {
      c =
        typeof f.contenu === "string"
          ? JSON.parse(f.contenu || "{}")
          : ((f.contenu as Record<string, any>) || {});
    } catch {
      c = {};
    }
    ficheParDossier.set(did, { type: f.type || "", contenu: c });
  }

  const agg = new Map<
    string,
    { heures: number; quantite: number; nbDossiers: number }
  >();
  let sansFicheH = 0;
  let sansFicheN = 0;

  for (const row of heuresParDossier) {
    const did = row.dossierId != null ? Number(row.dossierId) : null;
    const h = Number(row.h) || 0;
    const fiche = did != null ? ficheParDossier.get(did) : undefined;
    if (!fiche) {
      sansFicheH += h;
      sansFicheN += 1;
      continue;
    }
    const rawMeuble = String(
      fiche.contenu.meuble || fiche.contenu.type_store || ""
    ).trim();
    const piece = normalizePiece(rawMeuble, fiche.type);
    const quantite = decodeQuantite(fiche.contenu, rawMeuble);
    const cur = agg.get(piece) || { heures: 0, quantite: 0, nbDossiers: 0 };
    cur.heures += h;
    cur.quantite += quantite;
    cur.nbDossiers += 1;
    agg.set(piece, cur);
  }

  const pieces = [...agg.entries()]
    .map(([piece, v]) => ({
      piece,
      heures: Math.round(v.heures * 10) / 10,
      quantite: v.quantite,
      heuresParPiece:
        v.quantite > 0 ? Math.round((v.heures / v.quantite) * 10) / 10 : null,
      nbDossiers: v.nbDossiers,
    }))
    .sort((a, b) => b.heures - a.heures);

  return NextResponse.json({
    pieces,
    sansFiche: { heures: Math.round(sansFicheH * 10) / 10, nbDossiers: sansFicheN },
  });
}
