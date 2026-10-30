import { NextResponse } from "next/server";

import { db } from "@/db";
import { dossiers, fichesAtelier } from "@/db/schema";
import data from "@/lib/import-fiches-data.json";
import { revalidateDossierViews } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

type Rec = {
  dossier: string;
  typeIntervention: string;
  contenu: { client_nom: string; description: string; observations: string };
  notes: string;
};

function norm(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Règles de rapprochement nom de dossier (mêmes fusions que l'import archives).
const RULES: [string[], string][] = [
  [["davy", "davy marcel", "davymarcel"], "davy marcel"],
  [["druet", "martin druet"], "druet"],
  [["surget", "surjet"], "surget"],
  [["golf", "golf de mignaloux"], "golf de mignaloux"],
  [["moinard", "mr et mme moinard"], "moinard"],
  [["giraud hoani", "hoani"], "giraud hoani"],
  [["bossat", "stephanie bossat"], "bossat"],
  [["prioux", "mme prioux"], "prioux"],
  [["kageyama", "kajeyama"], "kajeyama"],
  [["citya", "cytia cip"], "cytia cip"],
];
const canonMap: Record<string, string> = {};
for (const [keys, canon] of RULES) for (const k of keys) canonMap[k] = canon;
const canon = (s: string) => canonMap[norm(s)] ?? norm(s);

// Importe les fiches atelier dédoublonnées, rattachées à leur dossier (par nom
// normalisé). Idempotent : ne ré-insère pas une fiche déjà présente
// (même dossier + même note). À ouvrir : /api/admin/import-fiches
export async function GET() {
  try {
    const recs = data as Rec[];

    const dos = await db
      .select({ id: dossiers.id, nom: dossiers.nomDossier, client: dossiers.clientNom })
      .from(dossiers);
    // index nom/canon -> id
    const idByKey = new Map<string, number>();
    for (const d of dos) {
      for (const v of [d.nom, d.client]) {
        if (!v) continue;
        idByKey.set(norm(v), d.id);
        idByKey.set(canon(v), d.id);
      }
    }

    const existingFiches = await db
      .select({ dossierId: fichesAtelier.dossierId, notes: fichesAtelier.notesLibres })
      .from(fichesAtelier);
    const dejaLa = new Set(
      existingFiches.map((f) => `${f.dossierId}|${norm(f.notes)}`)
    );

    const toInsert: {
      dossierId: number;
      typeIntervention: string;
      contenuJson: string;
      notesLibres: string;
    }[] = [];
    const nonRattaches: string[] = [];
    const ignores: string[] = [];

    for (const r of recs) {
      const id = idByKey.get(norm(r.dossier)) ?? idByKey.get(canon(r.dossier));
      if (!id) {
        nonRattaches.push(`${r.dossier} — ${r.notes}`);
        continue;
      }
      const dedupKey = `${id}|${norm(r.notes)}`;
      if (dejaLa.has(dedupKey)) {
        ignores.push(`${r.dossier} — ${r.notes}`);
        continue;
      }
      dejaLa.add(dedupKey);
      toInsert.push({
        dossierId: id,
        typeIntervention: r.typeIntervention || "Autre",
        contenuJson: JSON.stringify(r.contenu ?? {}),
        notesLibres: r.notes || "",
      });
    }

    if (toInsert.length > 0) {
      await db.insert(fichesAtelier).values(toInsert);
      revalidateDossierViews();
    }

    return NextResponse.json({
      ok: true,
      total_fiches: recs.length,
      inserees: toInsert.length,
      ignorees_existantes: ignores.length,
      non_rattachees: nonRattaches,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
