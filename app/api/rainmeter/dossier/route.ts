import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";
import { revalidateDossierViews } from "@/lib/revalidate";
import { parsePlaces } from "@/lib/sous-types";
import { ecrireSousType } from "@/lib/sous-types-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Ajout rapide d'un dossier depuis le widget Rainmeter du bureau.
//
// Même protection que /api/rainmeter : exclue du middleware, exige
// ?cle=<RAINMETER_TOKEN>. Accepte GET (le WebParser de Rainmeter ne sait faire
// que du GET) et POST (formulaire / JSON), avec les paramètres :
//   nom (obligatoire), client, tel, email, adresse, type, statut, commentaires,
//   sous_type (type de réalisation ; un libellé inconnu est ajouté à la
//   liste), places (nombre de places assises)
// Réponse texte : « OK|<id>|<nom> » ou « ERREUR|<message> ».
//
// Garde-fou anti-doublon : si le même dossier (nom + client) a été créé il y a
// moins de 2 minutes, on renvoie celui-là au lieu d'en créer un second (double
// clic, nouvel envoi du widget…).

// Mêmes listes que components/dossier-form.tsx.
const STATUTS = [
  "Nouveau", "Opportunité", "Devis", "Relance", "Négociation",
  "Devis signé / Validé", "En atelier", "Prêt à poser", "Clos", "Perdu", "SAV",
];
const TYPES = ["Autre", "Tapisserie", "Rideaux", "Atelier"];

function texte(corps: string, status = 200) {
  return new NextResponse(corps + "\n", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const propre = (v: unknown, max = 300) =>
  String(v ?? "").replace(/[\r\n|]+/g, " ").trim().slice(0, max);

async function lireParams(req: NextRequest): Promise<Record<string, string>> {
  const p: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (p[k] = v));
  if (req.method === "POST") {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      for (const [k, v] of Object.entries(j ?? {})) p[k] = String(v ?? "");
    } else {
      const fd = await req.formData().catch(() => null);
      fd?.forEach((v, k) => (p[k] = String(v)));
    }
  }
  return p;
}

async function creer(req: NextRequest) {
  const p = await lireParams(req);
  const attendu = process.env.RAINMETER_TOKEN;
  if (!attendu || p.cle !== attendu) return texte("ERREUR|Cle invalide", 401);

  const nom = propre(p.nom, 200);
  if (!nom) return texte("ERREUR|Le nom du dossier est obligatoire", 400);
  const client = propre(p.client, 200);
  // « Lead » (ancien widget) est fondu dans « Opportunité ».
  const statut = STATUTS.includes(p.statut) ? p.statut : "Opportunité";
  const type = TYPES.includes(p.type) ? p.type : "Autre";
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

  try {
    const recent = await sql`SELECT id FROM dossiers
      WHERE nom_dossier = ${nom} AND COALESCE(client_nom, '') = ${client}
        AND created_at > now() - interval '2 minutes'
      ORDER BY id DESC LIMIT 1`;
    if (recent.length) return texte(`OK|${recent[0].id}|${nom}`);

    const [row] = await sql`INSERT INTO dossiers
        (nom_dossier, client_nom, telephone, email, adresse, type_intervention,
         statut, flags, date_ouverture, commentaires)
      VALUES (${nom}, ${client}, ${propre(p.tel, 50)}, ${propre(p.email, 200)},
         ${propre(p.adresse)}, ${type}, ${statut}, '[]', ${jour}, ${propre(p.commentaires, 2000)})
      RETURNING id`;
    if (p.sous_type || p.places) {
      // Facultatif : un échec ici ne doit pas faire perdre le dossier créé.
      await ecrireSousType(Number(row.id), propre(p.sous_type, 60), parsePlaces(p.places)).catch(
        (e) => console.error("[api/rainmeter/dossier] sous-type", e)
      );
    }
    revalidateDossierViews(Number(row.id));
    return texte(`OK|${row.id}|${nom}`);
  } catch (e) {
    console.error("[api/rainmeter/dossier]", e);
    return texte("ERREUR|Base injoignable", 503);
  }
}

export const GET = creer;
export const POST = creer;
