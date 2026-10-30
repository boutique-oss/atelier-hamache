import { NextResponse } from "next/server";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import data from "@/lib/import-archives-data.json";
import { revalidateDossierViews } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

type Rec = {
  nomDossier: string;
  clientNom: string;
  statut: string;
  commentaires: string;
};

// Normalisation pour le dédoublonnage (accents, casse, ponctuation).
function norm(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Import des archives clients (Trello + dossiers fichiers), dédoublonné contre
// les dossiers DÉJÀ présents dans l'ERP (par nom normalisé). Idempotent :
// relancer n'ajoute pas de doublon. À ouvrir une fois : /api/admin/import-archives
export async function GET() {
  try {
    const recs = data as Rec[];

    const existing = await db
      .select({ id: dossiers.id, nom: dossiers.nomDossier, client: dossiers.clientNom })
      .from(dossiers);

    const have = new Set<string>();
    for (const e of existing) {
      if (e.nom) have.add(norm(e.nom));
      if (e.client) have.add(norm(e.client));
    }

    const toInsert: Rec[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();
    for (const r of recs) {
      const k = norm(r.nomDossier);
      if (have.has(k) || seen.has(k)) {
        skipped.push(r.nomDossier);
        continue;
      }
      seen.add(k);
      toInsert.push(r);
    }

    if (toInsert.length > 0) {
      await db.insert(dossiers).values(
        toInsert.map((r) => ({
          nomDossier: r.nomDossier,
          clientNom: r.clientNom,
          statut: r.statut,
          commentaires: r.commentaires || "",
        }))
      );
    }

    if (toInsert.length) revalidateDossierViews();

    return NextResponse.json({
      ok: true,
      totalCandidats: recs.length,
      inseres: toInsert.length,
      ignores_existants: skipped.length,
      noms_inseres: toInsert.map((r) => `${r.nomDossier} [${r.statut}]`),
      noms_ignores: skipped,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
