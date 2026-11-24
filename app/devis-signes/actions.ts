"use server";

import { eq } from "drizzle-orm";
import { put, del, get } from "@vercel/blob";

import { db } from "@/db";
import { devisSignes, dossiers, fichesAtelier } from "@/db/schema";
import { revalidateDossierViews } from "@/lib/revalidate";
import { blobToken } from "@/lib/blob";
import { lireDevis, type DevisLu } from "@/lib/devis-pdf";
import { lireDevisMarkdown } from "@/lib/devis-markdown";
import { revalidatePath } from "next/cache";
import { pieceRemplie } from "@/lib/prise-cotes";
import { lirePriseCotes } from "@/lib/prise-cotes-db";
import { recouper, type FicheProposee, type Recoupement, type SourceLue } from "@/lib/recoupement";
import { synchroniserDossierDepuisFiches } from "@/lib/fiches-dossier";

// Taille max acceptée (aligne-toi sur serverActions.bodySizeLimit dans
// next.config.mjs = 15 Mo). On garde une marge sous cette limite.
const MAX_TAILLE = 14 * 1024 * 1024;

// Enregistre un devis signé (PDF, éventuellement image scannée) sur Vercel Blob
// et crée la ligne en base. Retourne un message d'erreur lisible plutôt que de
// planter, pour l'afficher côté formulaire.
export async function uploadDevisSigne(
  dossierId: number,
  fd: FormData
): Promise<{ ok: boolean; error?: string }> {
  const token = blobToken();
  if (!token) {
    return {
      ok: false,
      error:
        "Stockage des fichiers non configuré (jeton Vercel Blob introuvable). Voir la configuration Vercel Blob.",
    };
  }

  const file = fd.get("fichier");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier sélectionné." };
  }

  const type = file.type || "application/octet-stream";
  const nom = (file.name || "devis-signe").trim();
  const estPdf = type === "application/pdf" || nom.toLowerCase().endsWith(".pdf");
  const estImage = type.startsWith("image/");
  const estMd = estMarkdown(nom, type);
  if (!estPdf && !estImage && !estMd) {
    return { ok: false, error: "Format non accepté : PDF, image ou devis Markdown (.md)." };
  }
  if (file.size > MAX_TAILLE) {
    return {
      ok: false,
      error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(
        1
      )} Mo). Maximum 14 Mo.`,
    };
  }

  try {
    // Chemin lisible + suffixe aléatoire (évite les collisions de noms).
    // Store PRIVÉ : le fichier n'est pas accessible par URL publique ; il est
    // servi par la route protégée /api/devis/[id] (derrière le code d'accès).
    const blob = await put(`devis-signes/${dossierId}/${nom}`, file, {
      access: "private",
      contentType: estMd ? "text/markdown; charset=utf-8" : type,
      addRandomSuffix: true,
      token,
    });

    await db.insert(devisSignes).values({
      dossierId,
      nomFichier: nom,
      url: blob.url,
      pathname: blob.pathname,
      taille: file.size,
      contentType: estMd ? "text/markdown" : type,
    });

    revalidateDossierViews(dossierId);
    return { ok: true };
  } catch (e) {
    console.error("Upload devis signé échoué:", (e as Error).message);
    return { ok: false, error: "Échec de l'envoi. Réessayez." };
  }
}

// Supprime un devis signé : le fichier sur Blob puis la ligne en base.
export async function deleteDevisSigne(id: number, dossierId: number) {
  const [row] = await db
    .select({ pathname: devisSignes.pathname, url: devisSignes.url })
    .from(devisSignes)
    .where(eq(devisSignes.id, id));

  const token = blobToken();
  if (row && token) {
    // On supprime le blob « au mieux » : une erreur ici ne doit pas empêcher de
    // retirer la ligne en base (sinon le devis resterait affiché).
    try {
      await del(row.pathname || row.url, { token });
    } catch (e) {
      console.error("Suppression blob échouée:", (e as Error).message);
    }
  }

  await db.delete(devisSignes).where(eq(devisSignes.id, id));
  revalidateDossierViews(dossierId);
}

// ─── Remplir le dossier depuis un devis (PDF EBP déjà importé) ─────────────

// Lit un devis signé stocké (Blob privé) et renvoie ce qu'on a pu y repérer,
// pour le formulaire ajustable. Rien n'est écrit à cette étape.
export async function lireDevisSigne(
  id: number
): Promise<{ ok: true; devis: DevisLu } | { ok: false; error: string }> {
  const [row] = await db
    .select({ pathname: devisSignes.pathname, contentType: devisSignes.contentType, nom: devisSignes.nomFichier })
    .from(devisSignes)
    .where(eq(devisSignes.id, id));
  if (!row) return { ok: false, error: "Devis introuvable." };
  const estPdf =
    (row.contentType ?? "").includes("pdf") || row.nom.toLowerCase().endsWith(".pdf");
  const estMd = estMarkdown(row.nom, row.contentType ?? "");
  if (!estPdf && !estMd) {
    return {
      ok: false,
      error:
        "Ce devis signé est une image (scan) : choisis ci-dessous le PDF EBP d'origine ou le devis en Markdown (.md).",
    };
  }
  const token = blobToken();
  if (!token) return { ok: false, error: "Stockage des fichiers non configuré." };
  try {
    const res = await get(row.pathname ?? "", { access: "private", token });
    if (!res || res.statusCode !== 200 || !res.stream) {
      return { ok: false, error: "Fichier du devis introuvable." };
    }
    const data = new Uint8Array(await new Response(res.stream).arrayBuffer());
    if (estMd) return lireTexteMarkdown(new TextDecoder("utf-8").decode(data));
    return lireDonneesDevis(data);
  } catch (e) {
    console.error("Lecture devis échouée:", (e as Error).message);
    return { ok: false, error: "Devis illisible ou protégé." };
  }
}

// Fichier de devis au format Markdown / texte (par le nom ou le type MIME).
function estMarkdown(nom: string, type: string) {
  return /\.(md|markdown|txt)$/i.test(nom) || /^text\/(markdown|plain)/i.test(type);
}

function lireTexteMarkdown(
  texte: string
): { ok: true; devis: DevisLu } | { ok: false; error: string } {
  const devis = lireDevisMarkdown(texte);
  if (!devis.ouvrages.length && !devis.client.nom && !devis.numero) {
    return {
      ok: false,
      error:
        "Rien de reconnu dans ce devis Markdown : il faut au moins un tableau (Désignation | Qté | P.U. | Montant) ou des lignes « Client : … », « Devis n° : … ».",
    };
  }
  return { ok: true, devis };
}

// Variante : le PDF EBP d'origine (avant signature) choisi sur l'ordinateur,
// quand le devis signé du dossier est un scan. Lu seulement, pas enregistré.
export async function lireDevisFichier(
  fd: FormData
): Promise<{ ok: true; devis: DevisLu } | { ok: false; error: string }> {
  const file = fd.get("fichier");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier sélectionné." };
  }
  const estMd = estMarkdown(file.name, file.type);
  if (!estMd && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Choisis un PDF (export EBP) ou un devis Markdown (.md)." };
  }
  if (file.size > MAX_TAILLE) return { ok: false, error: "Fichier trop volumineux (14 Mo max)." };
  try {
    if (estMd) return lireTexteMarkdown(await file.text());
    return await lireDonneesDevis(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    console.error("Lecture devis (fichier) échouée:", (e as Error).message);
    return { ok: false, error: "Devis illisible ou protégé." };
  }
}

async function lireDonneesDevis(
  data: Uint8Array
): Promise<{ ok: true; devis: DevisLu } | { ok: false; error: string }> {
  const devis = await lireDevis(data);
  if (devis.ouvrages.length === 0 && !devis.client.nom && !devis.numero) {
    return {
      ok: false,
      error:
        "Ce PDF ne contient pas de texte (devis scanné). Choisis le PDF EBP d'origine, exporté avant signature.",
    };
  }
  return { ok: true, devis };
}

export type DevisAApplique = {
  numero: string;
  // Champs client retenus (absents = on ne touche pas au dossier).
  client: Partial<{ clientNom: string; adresse: string; telephone: string; email: string; dateDevis: string }>;
  ouvrages: {
    metier: string;
    realisation: string;
    quantite: string;
    heuresPrevues: string;
    creerFiche: boolean;
    ficheType: string;
    contenu: Record<string, string>;
    tissus: { ref: string; coloris: string; metrage: string; placement?: string }[];
    etapes?: string[];
    texte: string;
  }[];
};

// Applique le formulaire validé : infos client du dossier, une ligne Travaux
// par ouvrage, et une fiche atelier pré-remplie quand c'est demandé.
export async function appliquerDevis(dossierId: number, v: DevisAApplique) {
  const set: Record<string, string | null> = {};
  for (const [k, val] of Object.entries(v.client ?? {})) {
    if (val === undefined) continue;
    const s = String(val).trim();
    set[k] = k === "dateDevis" ? (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null) : s;
  }
  if (Object.keys(set).length) {
    await db
      .update(dossiers)
      .set({ ...set, updatedAt: new Date().toISOString() })
      .where(eq(dossiers.id, dossierId));
  }

  const [d] = await db
    .select({ client: dossiers.clientNom })
    .from(dossiers)
    .where(eq(dossiers.id, dossierId));
  const ref = v.numero ? `Devis ${v.numero}` : "Devis";

  // Une fiche atelier par ouvrage retenu : ce sont les fiches qui portent
  // l'affectation (heures, opérateur) et donnent le total du dossier.
  let fiches = 0;
  for (const o of v.ouvrages ?? []) {
    if (!o.realisation.trim()) continue;
    {
      const contenu: Record<string, unknown> = {
        client_nom: d?.client ?? "",
        // Repris en tête de la fiche imprimée (ouvrage ×quantité, heures, n° devis).
        realisation: o.realisation,
        quantite: o.quantite,
        ...(o.heuresPrevues.trim() ? { heures_estimees: o.heuresPrevues.trim() } : {}),
        ...(v.numero ? { reference: v.numero } : {}),
        ...Object.fromEntries(
          Object.entries(o.contenu ?? {}).filter(([, x]) => String(x ?? "").trim())
        ),
      };
      const tissus = (o.tissus ?? []).filter((t) => t.ref || t.coloris || t.metrage);
      if (tissus.length) {
        contenu.tissus_list = tissus.map((t) => ({ ...t, placement: t.placement ?? "" }));
      }
      // Étapes de travail proposées / ajustées (format de l'éditeur de fiche).
      if (o.etapes?.length) {
        contenu.etapes_custom = o.etapes.map((etape) => ({ etape, type: "" }));
      }
      await db.insert(fichesAtelier).values({
        dossierId,
        typeIntervention: o.ficheType || "Autre",
        contenuJson: JSON.stringify(contenu),
        notesLibres: `${ref} — ${o.realisation}${Number(o.quantite) > 1 ? ` ×${o.quantite}` : ""}`,
      });
      fiches++;
    }
  }
  await synchroniserDossierDepuisFiches(dossierId);
  revalidateDossierViews(dossierId);
  return { ok: true as const, fiches };
}

// ─── Fiches de travail recoupées (devis + prise de cotes) ──────────────────

// Lit TOUTES les sources du dossier en une fois — devis signés lisibles du
// dossier, PDF EBP déposés (plusieurs possibles, champ « fichiers ») et prise
// de cotes saisie sur tablette — et renvoie une proposition : une fiche par
// métier (rideaux, tapisserie…), à ajuster avant création. Rien n'est écrit.
export async function preparerFicheRecoupee(
  dossierId: number,
  fd: FormData
): Promise<Recoupement> {
  const devis: { nom: string; lu: DevisLu }[] = [];
  const sources: SourceLue[] = [];
  const lire = async (nom: string, data: Uint8Array, md = false) => {
    try {
      const lu = md ? lireDevisMarkdown(new TextDecoder("utf-8").decode(data)) : await lireDevis(data);
      if (!lu.ouvrages.length && !lu.numero) {
        sources.push({ nom, ok: false, detail: "scan sans texte — dépose le PDF EBP d'origine" });
        return;
      }
      devis.push({ nom, lu });
      sources.push({
        nom,
        ok: true,
        detail: `devis ${lu.numero || "?"} · ${lu.ouvrages.filter((o) => o.probable).length} ouvrage(s)`,
      });
    } catch {
      sources.push({ nom, ok: false, detail: md ? "Markdown illisible" : "PDF illisible" });
    }
  };

  // 1) PDF déposés dans la fenêtre (prioritaires : souvent l'original EBP).
  for (const f of fd.getAll("fichiers")) {
    if (!(f instanceof File) || f.size === 0 || f.size > MAX_TAILLE) continue;
    const md = estMarkdown(f.name, f.type);
    if (!md && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      sources.push({ nom: f.name, ok: false, detail: "ni PDF ni Markdown" });
      continue;
    }
    await lire(f.name, new Uint8Array(await f.arrayBuffer()), md);
  }
  // 2) Devis signés déjà dans le dossier (PDF « texte » seulement).
  const token = blobToken();
  if (token) {
    const signes = await db
      .select({ nom: devisSignes.nomFichier, pathname: devisSignes.pathname, type: devisSignes.contentType })
      .from(devisSignes)
      .where(eq(devisSignes.dossierId, dossierId));
    for (const s of signes) {
      const md = estMarkdown(s.nom, s.type ?? "");
      if (!md && !(s.type ?? "").includes("pdf") && !s.nom.toLowerCase().endsWith(".pdf")) {
        sources.push({ nom: s.nom, ok: false, detail: "devis signé en image (scan)" });
        continue;
      }
      try {
        const res = await get(s.pathname ?? "", { access: "private", token });
        if (!res?.stream) continue;
        const data = new Uint8Array(await new Response(res.stream).arrayBuffer());
        // Même devis déjà déposé dans la fenêtre : on ne le compte pas deux fois.
        const avant = devis.length;
        await lire(`${s.nom} (devis signé)`, data, md);
        const dernier = devis[devis.length - 1];
        if (
          devis.length > avant &&
          dernier.lu.numero &&
          devis.slice(0, avant).some((d) => d.lu.numero === dernier.lu.numero)
        ) {
          devis.pop();
          sources[sources.length - 1].detail += " (déjà lu)";
        }
      } catch {
        sources.push({ nom: s.nom, ok: false, detail: "lecture impossible" });
      }
    }
  }
  // 3) Prise de cotes saisie sur tablette.
  const prise = await lirePriseCotes(dossierId).catch(() => ({ pieces: [], datePrise: null, majLe: null }));
  sources.push(
    prise.pieces.length
      ? {
          nom: "Prise de cotes (tablette)",
          ok: true,
          detail: `${prise.pieces.length} pièce(s)${prise.datePrise ? ` · ${prise.datePrise}` : ""}`,
        }
      : { nom: "Prise de cotes (tablette)", ok: false, detail: "pas encore saisie" }
  );

  return recouper(devis, prise.pieces, sources);
}

// Crée les fiches de travail du dossier (une par métier) à partir de la
// proposition ajustée, AVEC leur affectation (opérateur + heures). Le dossier
// est ensuite recalculé depuis ses fiches.
export async function creerFichesRecoupees(dossierId: number, fiches: FicheProposee[]) {
  const [d] = await db
    .select({ client: dossiers.clientNom })
    .from(dossiers)
    .where(eq(dossiers.id, dossierId));
  const t = (s: string | undefined | null) => String(s ?? "").trim();
  const ids: number[] = [];
  for (const f of fiches) {
    const contenu: Record<string, unknown> = {
      client_nom: d?.client ?? "",
      ...Object.fromEntries(Object.entries(f.contenu ?? {}).filter(([, x]) => t(x))),
      realisation: t(f.realisation) || f.metier,
      quantite: t(f.quantite),
      ...(t(f.heures) ? { heures_estimees: t(f.heures) } : {}),
      operateur_id: Number(f.operateurId) || null,
      ...(t(f.references) ? { reference: t(f.references) } : {}),
      ...(t(f.typeTete) ? { type_tete: t(f.typeTete) } : {}),
      ...(t(f.doublure) ? { doublure: t(f.doublure) } : {}),
      a_realiser: (f.aRealiser ?? []).filter((l) => t(l.realisation) || t(l.detail)),
      ...(f.cotes?.length ? { pieces_cotes: f.cotes.filter(pieceRemplie) } : {}),
      tissus_list: (f.tissus ?? [])
        .filter((x) => x.ref || x.coloris || x.metrage)
        .map((x) => ({ ref: x.ref, coloris: x.coloris, metrage: x.metrage, placement: x.placement ?? "" })),
      etapes_custom: (f.etapes ?? []).map((e) => t(e)).filter(Boolean).map((etape) => ({ etape, type: "" })),
    };
    const [row] = await db
      .insert(fichesAtelier)
      .values({
        dossierId,
        typeIntervention: f.ficheType || "Autre",
        contenuJson: JSON.stringify(contenu),
        notesLibres: `Fiche recoupée${t(f.references) ? ` — devis ${t(f.references)}` : ""}${f.cotes?.length ? " + prise de cotes" : ""}`,
      })
      .returning({ id: fichesAtelier.id });
    ids.push(row.id);
  }
  await synchroniserDossierDepuisFiches(dossierId);
  revalidateDossierViews(dossierId);
  return { ok: true as const, ficheIds: ids };
}

// ─── Nouveau dossier (client) depuis un devis Markdown ─────────────────────

// Lit un devis écrit en Markdown (fichier .md/.txt déposé, ou texte collé)
// et renvoie ce qu'on a pu y repérer. Rien n'est écrit à cette étape.
export async function lireDevisMarkdownAction(
  fd: FormData
): Promise<{ ok: true; devis: DevisLu } | { ok: false; error: string }> {
  let texte = String(fd.get("texte") ?? "");
  const file = fd.get("fichier");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Fichier trop volumineux (2 Mo max)." };
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !file.type.startsWith("text/")) {
      return { ok: false, error: "Choisis un fichier Markdown (.md) ou texte (.txt)." };
    }
    texte = await file.text();
  }
  if (!texte.trim()) return { ok: false, error: "Aucun devis à lire : dépose un fichier .md ou colle son texte." };
  try {
    return lireTexteMarkdown(texte);
  } catch (e) {
    console.error("Lecture devis Markdown échouée:", (e as Error).message);
    return { ok: false, error: "Texte illisible." };
  }
}

// Crée le dossier (client) puis y applique le devis validé : infos client,
// une fiche atelier par ouvrage retenu. Le type d'intervention du dossier
// suit le métier majoritaire des ouvrages. Renvoie l'id du nouveau dossier.
export async function creerDossierDepuisDevis(
  nomDossier: string,
  v: DevisAApplique
): Promise<{ ok: true; id: number; fiches: number } | { ok: false; error: string }> {
  const nom = nomDossier.trim() || String(v.client.clientNom ?? "").trim();
  if (!nom) return { ok: false, error: "Donne un nom au dossier." };
  const comptes = new Map<string, number>();
  for (const o of v.ouvrages ?? []) comptes.set(o.metier, (comptes.get(o.metier) ?? 0) + 1);
  const typeIntervention =
    [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Autre";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  try {
    const [row] = await db
      .insert(dossiers)
      .values({
        nomDossier: nom,
        typeIntervention,
        statut: "Nouveau",
        dateOuverture: aujourdhui,
        etapeDevis: true,
        commentaires: v.numero ? `Créé depuis le devis ${v.numero} (import Markdown).` : "Créé depuis un devis (import Markdown).",
      })
      .returning({ id: dossiers.id });
    const res = await appliquerDevis(row.id, v);
    revalidatePath("/dossiers");
    return { ok: true, id: row.id, fiches: res.fiches };
  } catch (e) {
    console.error("Création dossier depuis devis échouée:", (e as Error).message);
    return { ok: false, error: "Création du dossier impossible." };
  }
}
