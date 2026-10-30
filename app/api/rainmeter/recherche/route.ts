import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";
import { normalizeStatut } from "@/lib/dossiers";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Recherche rapide de dossiers depuis le widget Rainmeter du bureau.
//
// Même protection que /api/rainmeter : exclue du middleware, exige
// ?cle=<RAINMETER_TOKEN>. Paramètre q (2 caractères minimum) cherché dans le
// nom du dossier, le client et le téléphone (comme le filtre de /dossiers,
// téléphone en plus).
// Réponse texte : « OK|<nb total> » puis jusqu'à 6 lignes
//   RES|<id>|<dossier>|<client>|<statut>
// ou « ERREUR|<message> ».

const MAX = 6;

function texte(corps: string, status = 200) {
  return new NextResponse(corps + "\n", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const f = (v: unknown) => String(v ?? "").replace(/[|\r\n]+/g, " ").trim();

export async function GET(req: NextRequest) {
  const attendu = process.env.RAINMETER_TOKEN;
  if (!attendu || req.nextUrl.searchParams.get("cle") !== attendu) {
    return texte("ERREUR|Cle invalide", 401);
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return texte("ERREUR|Tape au moins 2 lettres");

  const motif = `%${q}%`;
  // Téléphone comparé sans espaces ni points (06 12 34… = 061234…).
  const chiffres = q.replace(/\D/g, "");
  const motifTel = chiffres.length >= 4 ? `%${chiffres}%` : null;
  try {
    const rows = await sql`
      SELECT id, nom_dossier, COALESCE(client_nom, '') AS client, statut,
             COUNT(*) OVER () AS total
      FROM dossiers
      WHERE nom_dossier ILIKE ${motif} OR client_nom ILIKE ${motif}
         OR (${motifTel}::text IS NOT NULL
             AND regexp_replace(COALESCE(telephone, ''),'[^0-9]', '', 'g') LIKE ${motifTel})
      ORDER BY (statut IN ('Clos', 'Perdu')), COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
      LIMIT ${MAX}`;
    const lignes = [`OK|${rows.length ? Number(rows[0].total) : 0}`];
    for (const r of rows) {
      lignes.push(`RES|${r.id}|${f(r.nom_dossier)}|${f(r.client)}|${f(normalizeStatut(String(r.statut ?? "")))}`);
    }
    return texte(lignes.join("\n"));
  } catch (e) {
    console.error("[api/rainmeter/recherche]", e);
    return texte("ERREUR|Base injoignable", 503);
  }
}
