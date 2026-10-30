import { NextResponse } from "next/server";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import data from "@/lib/import-archives-data.json";

export const dynamic = "force-dynamic";

type Rec = { nomDossier: string; statut: string };

function norm(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// LECTURE SEULE : compare le statut ERP au statut issu du tableau Trello.
// Ne modifie rien. À ouvrir : /api/admin/statut-ecarts
export async function GET() {
  try {
    const attendu = new Map<string, string>();
    for (const r of data as Rec[]) attendu.set(norm(r.nomDossier), r.statut);

    const rows = await db
      .select({
        id: dossiers.id,
        nom: dossiers.nomDossier,
        client: dossiers.clientNom,
        statut: dossiers.statut,
      })
      .from(dossiers);

    const ecarts: {
      id: number;
      nom: string;
      statutERP: string;
      statutTrello: string;
    }[] = [];
    for (const d of rows) {
      const cible =
        attendu.get(norm(d.nom)) ?? attendu.get(norm(d.client));
      if (cible && cible !== d.statut) {
        ecarts.push({
          id: d.id,
          nom: d.nom,
          statutERP: d.statut,
          statutTrello: cible,
        });
      }
    }
    ecarts.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

    return NextResponse.json({
      ok: true,
      total_dossiers: rows.length,
      nb_ecarts: ecarts.length,
      ecarts,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
