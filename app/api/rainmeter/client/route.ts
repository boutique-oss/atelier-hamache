import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { sql } from "@/lib/raw-sql";
import { blobToken } from "@/lib/blob";
import { lireDevis } from "@/lib/devis-pdf";
import { normalizeStatut } from "@/lib/dossiers";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Fiche client pour le widget Agenda (fiche rendez-vous imprimable).
//
// Même protection que /api/rainmeter : exclue du middleware, exige
// ?cle=<RAINMETER_TOKEN>. Deux usages :
//
//  ?q=<texte>  (2 caractères min.) : clients/dossiers dont le nom du dossier,
//    le client ou le téléphone correspond. Réponse texte :
//      OK|<nb total>
//      CLI|<id>|<dossier>|<client>|<téléphone>|<adresse>|<statut>   (6 max)
//
//  ?id=<dossier> : le dossier et son dernier devis signé lu SANS LES PRIX
//    (aucun montant, prix unitaire ni total n'est renvoyé) :
//      DOS|<id>|<dossier>|<client>|<téléphone>|<email>|<adresse>|<type>|<statut>|<livraison>
//      DEV|<numéro>|<date>                         (si un devis PDF est lisible)
//      OUV|<n°>|<pièce>|<quantité>|<ouvrage>|<heures>
//      TIS|<n° ouvrage>|<référence>|<coloris>|<métrage>
//      ETA|<n° ouvrage>|<étape>
//      AVI|<message>                               (devis absent ou illisible)
//
//  ?evt=<UID iCal> : même réponse que ?id=, pour le dossier dont un événement
//    Google Agenda (chantier, enlèvement, livraison, prise de cotes) a cet
//    identifiant (« abc123@google.com » ou « abc123 »). « OK|0 » si aucun.
//
// En cas d'erreur : « ERREUR|<message> ».

const MAX = 6;
const MAX_OUVRAGES = 20;

function texte(corps: string, status = 200) {
  return new NextResponse(corps + "\n", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const f = (v: unknown, max = 300) => String(v ?? "").replace(/[|\r\n]+/g, " ").trim().slice(0, max);

async function chercher(q: string) {
  const motif = `%${q}%`;
  // Téléphone comparé sans espaces ni points (06 12 34… = 061234…).
  const chiffres = q.replace(/\D/g, "");
  const motifTel = chiffres.length >= 4 ? `%${chiffres}%` : null;
  const rows = await sql`
    SELECT id, nom_dossier, COALESCE(client_nom, '') AS client, COALESCE(telephone, '') AS tel,
           COALESCE(adresse, '') AS adresse, statut, COUNT(*) OVER () AS total
    FROM dossiers
    WHERE nom_dossier ILIKE ${motif} OR client_nom ILIKE ${motif}
       OR (${motifTel}::text IS NOT NULL
           AND regexp_replace(COALESCE(telephone, ''),'[^0-9]', '', 'g') LIKE ${motifTel})
    ORDER BY (statut IN ('Clos', 'Perdu')), COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
    LIMIT ${MAX}`;
  const lignes = [`OK|${rows.length ? Number(rows[0].total) : 0}`];
  for (const r of rows) {
    lignes.push(
      `CLI|${r.id}|${f(r.nom_dossier)}|${f(r.client)}|${f(r.tel)}|${f(r.adresse)}|${f(normalizeStatut(String(r.statut ?? "")))}`
    );
  }
  return lignes;
}

// Dernier devis signé du dossier, lu sans les prix (montant ignoré).
async function lignesDevis(dossierId: number): Promise<string[]> {
  const [row] = await sql`
    SELECT pathname, nom_fichier, COALESCE(content_type, '') AS content_type
    FROM devis_signes WHERE dossier_id = ${dossierId}
    ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 1`;
  if (!row) return ["AVI|Aucun devis signé dans ce dossier"];
  const estPdf = String(row.content_type).includes("pdf") || String(row.nom_fichier).toLowerCase().endsWith(".pdf");
  if (!estPdf) return ["AVI|Le devis signé est un scan : contenu non lisible"];
  const token = blobToken();
  if (!token) return ["AVI|Stockage des fichiers non configuré"];
  try {
    const res = await get(String(row.pathname ?? ""), { access: "private", token });
    if (!res || res.statusCode !== 200 || !res.stream) return ["AVI|Fichier du devis introuvable"];
    const devis = await lireDevis(new Uint8Array(await new Response(res.stream).arrayBuffer()));
    const lignes = [`DEV|${f(devis.numero)}|${f(devis.date)}`];
    devis.ouvrages
      .filter((o) => o.probable)
      .slice(0, MAX_OUVRAGES)
      .forEach((o, i) => {
        const n = i + 1;
        lignes.push(`OUV|${n}|${f(o.piece)}|${f(o.quantite, 20)}|${f(o.texte)}|${f(o.heures, 20)}`);
        for (const t of o.tissus) lignes.push(`TIS|${n}|${f(t.ref)}|${f(t.coloris)}|${f(t.metrage, 20)}`);
        for (const e of o.etapes) lignes.push(`ETA|${n}|${f(e)}`);
      });
    return lignes;
  } catch (e) {
    console.error("[api/rainmeter/client] devis", (e as Error).message);
    return ["AVI|Devis illisible"];
  }
}

async function detail(id: number) {
  const [d] = await sql`
    SELECT id, nom_dossier, COALESCE(client_nom, '') AS client, COALESCE(telephone, '') AS tel,
           COALESCE(email, '') AS email, COALESCE(adresse, '') AS adresse,
           COALESCE(type_intervention, '') AS type, statut, COALESCE(date_livraison, '') AS livraison
    FROM dossiers WHERE id = ${id}`;
  if (!d) return null;
  return [
    `DOS|${d.id}|${f(d.nom_dossier)}|${f(d.client)}|${f(d.tel)}|${f(d.email)}|${f(d.adresse)}|${f(d.type)}|` +
      `${f(normalizeStatut(String(d.statut ?? "")))}|${f(d.livraison)}`,
    ...(await lignesDevis(id)),
  ];
}

export async function GET(req: NextRequest) {
  const attendu = process.env.RAINMETER_TOKEN;
  const p = req.nextUrl.searchParams;
  if (!attendu || p.get("cle") !== attendu) return texte("ERREUR|Cle invalide", 401);

  try {
    if (p.has("evt")) {
      const evt = (p.get("evt") || "").replace(/@google\.com$/i, "").trim().slice(0, 200);
      if (!evt) return texte("ERREUR|Evenement invalide", 400);
      const [d] = await sql`
        SELECT id FROM dossiers
        WHERE ${evt} IN (google_event_id, google_event_id_enlevement, google_event_id_livraison, google_event_id_prise_cote)
        ORDER BY id DESC LIMIT 1`;
      if (!d) return texte("OK|0");
      const lignes = await detail(Number(d.id));
      return lignes ? texte(lignes.join("\n")) : texte("OK|0");
    }
    if (p.has("id")) {
      const id = Number(p.get("id"));
      if (!Number.isInteger(id) || id <= 0) return texte("ERREUR|Dossier invalide", 400);
      const lignes = await detail(id);
      return lignes ? texte(lignes.join("\n")) : texte("ERREUR|Dossier introuvable", 404);
    }
    const q = (p.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) return texte("ERREUR|Tape au moins 2 lettres");
    return texte((await chercher(q)).join("\n"));
  } catch (e) {
    console.error("[api/rainmeter/client]", e);
    return texte("ERREUR|Base injoignable", 503);
  }
}
