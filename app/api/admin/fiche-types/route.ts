import { NextResponse } from "next/server";

import { db } from "@/db";
import { fichesAtelier } from "@/db/schema";

// Lecture seule : recense ce qu'il y a dans les fiches de travail (types
// d'intervention, valeurs du champ « meuble »/type, clés JSON présentes).
// Sert à démêler/normaliser les types de pièce. Protégé par le code d'accès.
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      type: fichesAtelier.typeIntervention,
      contenu: fichesAtelier.contenuJson,
    })
    .from(fichesAtelier);

  const parType: Record<string, number> = {};
  const parMeuble: Record<string, number> = {};
  const champsVus: Record<string, number> = {};

  for (const r of rows) {
    const t = (r.type || "—").trim();
    parType[t] = (parType[t] || 0) + 1;

    let c: Record<string, any> = {};
    try {
      c =
        typeof r.contenu === "string"
          ? JSON.parse(r.contenu || "{}")
          : ((r.contenu as Record<string, any>) || {});
    } catch {
      c = {};
    }
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        champsVus[k] = (champsVus[k] || 0) + 1;
      }
    }
    const meuble = String(c.meuble || c.type_store || "").trim();
    if (meuble) parMeuble[meuble] = (parMeuble[meuble] || 0) + 1;
  }

  return NextResponse.json({
    totalFiches: rows.length,
    parTypeIntervention: parType,
    parMeubleOuTypeStore: parMeuble,
    clesJsonPresentes: champsVus,
  });
}
