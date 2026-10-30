import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";

// Toujours dynamique ET jamais mis en cache : l'export doit refléter l'état
// courant de la base. `force-no-store` empêche le Data Cache de Next de figer
// le résultat de la requête (bug constaté : la route n'étant jamais ciblée par
// revalidatePath, une requête Drizzle mise en cache y restait périmée alors que
// les pages, elles, étaient rafraîchies). On lit donc en SQL brut, non caché.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Export CSV des références au format d'import « article » d'EBP.
// Modèle fourni par l'atelier : séparateur « ; », décimales à la virgule,
// encodage ANSI/Windows-1252. En-tête reproduit à l'identique (y compris les
// libellés tels quels) car l'import paramétrable EBP rapproche les colonnes
// par leur intitulé exact.
//   réference        -> code article EBP (code_ebp, repli sur la référence)
//   Libelé           -> libellé forcé, sinon « collection réf coloris »
//   PRIX FOURNISSEUR -> prix d'achat
//   PRIX MARGE       -> prix de vente
//   CODE FOURNISSEUR -> code EBP du fournisseur
//
// Paramètre optionnel ?fournisseur=<id> : n'exporte que ce fournisseur.
const ENTETE = "réference;Libelé;PRIX FOURNISSEUR;PRIX MARGE;CODE FOURNISSEUR";

// Nombre -> texte EBP (2 décimales, virgule). null/vide -> cellule vide.
// Accepte number OU string (le driver SQL brut peut renvoyer real en string).
function prix(n: number | string | null): string {
  if (n === null || n === undefined || n === "") return "";
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v.toFixed(2).replace(".", ",") : "";
}

// Échappement CSV : on protège toute cellule contenant le séparateur, un
// guillemet ou un saut de ligne (doublement des guillemets, entourage).
function cell(v: string | null): string {
  const s = (v ?? "").trim();
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type Ligne = {
  reference: string;
  coloris: string | null;
  libelle: string | null;
  codeEbpRef: string | null;
  prixAchat: number | string | null;
  prixVente: number | string | null;
  collectionNom: string;
  fournisseurNom: string;
  codeEbpFournisseur: string | null;
};

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("fournisseur");
  const fid = param ? Number(param) : null;

  const rows = (
    fid && Number.isFinite(fid)
      ? await sql`
          SELECT r.reference, r.coloris, r.libelle,
                 r.code_ebp AS "codeEbpRef",
                 r.prix_achat AS "prixAchat", r.prix_vente AS "prixVente",
                 c.nom AS "collectionNom",
                 f.nom AS "fournisseurNom", f.code_ebp AS "codeEbpFournisseur"
          FROM catalogue_refs r
          JOIN collections c ON c.id = r.collection_id
          JOIN fournisseurs f ON f.id = c.fournisseur_id
          WHERE c.fournisseur_id = ${fid}
          ORDER BY r.reference, r.coloris`
      : await sql`
          SELECT r.reference, r.coloris, r.libelle,
                 r.code_ebp AS "codeEbpRef",
                 r.prix_achat AS "prixAchat", r.prix_vente AS "prixVente",
                 c.nom AS "collectionNom",
                 f.nom AS "fournisseurNom", f.code_ebp AS "codeEbpFournisseur"
          FROM catalogue_refs r
          JOIN collections c ON c.id = r.collection_id
          JOIN fournisseurs f ON f.id = c.fournisseur_id
          ORDER BY f.nom, c.nom, r.reference, r.coloris`
  ) as Ligne[];

  const lignes = rows.map((r) => {
    const refCol = (r.codeEbpRef && r.codeEbpRef.trim()) || r.reference;
    const libelle =
      (r.libelle && r.libelle.trim()) ||
      [r.collectionNom, r.reference, r.coloris].filter(Boolean).join(" ");
    return [
      cell(refCol),
      cell(libelle),
      prix(r.prixAchat),
      prix(r.prixVente),
      cell(r.codeEbpFournisseur ?? ""),
    ].join(";");
  });

  const csv = [ENTETE, ...lignes].join("\r\n") + "\r\n";

  // Mode aperçu : ?preview=1 affiche le CSV DANS l'onglet (UTF-8, pas de
  // téléchargement) — pratique pour vérifier le contenu réel sans se mélanger
  // avec d'anciens fichiers du dossier Téléchargements.
  if (req.nextUrl.searchParams.get("preview")) {
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  }

  // Windows-1252 : pour le français, identique à Latin-1 sur les accents.
  const buffer = Buffer.from(csv, "latin1");

  const suffixe =
    fid && rows.length ? slug(rows[0].fournisseurNom) : "tous-fournisseurs";
  // Horodatage à la SECONDE dans le nom : chaque export est un fichier unique.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const nomFichier = `articles-ebp-${suffixe}-${stamp}.csv`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// Nom de fichier « propre » : minuscules, accents retirés, tirets.
function slug(s: string): string {
  const sansAccents = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return (
    sansAccents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "fournisseur"
  );
}
