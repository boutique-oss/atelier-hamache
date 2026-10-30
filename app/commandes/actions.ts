"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  catalogueRefs,
  collections,
  commandes,
  dossiers,
  fournisseurs,
} from "@/db/schema";
import { put } from "@vercel/blob";

import { blobToken } from "@/lib/blob";
import { ensureImports } from "@/lib/commande-imports-db";
import { lirePdfCommande, type LigneLue } from "@/lib/pdf-commande";
import { sql as rawSql } from "@/lib/raw-sql";
import { parseNum } from "@/lib/utils";

// Nom de la collection fourre-tout où atterrissent les articles créés
// automatiquement à partir des commandes (une par fournisseur).
const COLLECTION_COMMANDES = "Commandes";

// Alimente le catalogue fournisseur à partir d'une commande saisie.
// Règles décidées avec l'atelier :
//   - un article = une (désignation + référence) ; le COLORIS est ignoré
//     (sinon autant de doublons que de coloris commandés) ;
//   - l'article est rangé dans une collection « Commandes » du fournisseur
//     (créée au besoin), et le fournisseur lui-même est créé s'il n'existe pas ;
//   - le prix affiché = prix ACTUEL du catalogue fournisseur (même référence
//     trouvée ailleurs dans son catalogue), avec repli sur le prix unitaire de
//     la commande (montant ÷ quantité) si la référence n'est pas encore tarifée.
// Sans fournisseur nommé on ne peut rien rattacher : on n'écrit rien.
async function syncArticleCatalogue(input: {
  fournisseur: string;
  designation: string;
  reference: string;
  unite: string;
  montant: number | null;
  qte: number | null;
}) {
  const fournisseurNom = input.fournisseur.trim();
  const designation = input.designation.trim();
  const reference = input.reference.trim();
  if (!fournisseurNom) return;
  // Clé de regroupement = désignation + référence : au moins l'une des deux.
  if (!designation && !reference) return;

  // 1) Fournisseur (nom unique) — créé s'il manque.
  let [f] = await db
    .select({ id: fournisseurs.id })
    .from(fournisseurs)
    .where(eq(fournisseurs.nom, fournisseurNom));
  if (!f) {
    try {
      [f] = await db
        .insert(fournisseurs)
        .values({ nom: fournisseurNom })
        .returning({ id: fournisseurs.id });
    } catch {
      // Course à l'unicité (créé entre-temps) : on relit.
      [f] = await db
        .select({ id: fournisseurs.id })
        .from(fournisseurs)
        .where(eq(fournisseurs.nom, fournisseurNom));
    }
  }
  if (!f) return;

  // 2) Collection « Commandes » du fournisseur — créée si absente.
  let [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.fournisseurId, f.id),
        eq(collections.nom, COLLECTION_COMMANDES)
      )
    );
  if (!col) {
    [col] = await db
      .insert(collections)
      .values({
        fournisseurId: f.id,
        nom: COLLECTION_COMMANDES,
        commentaires: "Articles créés automatiquement depuis les commandes.",
      })
      .returning({ id: collections.id });
  }
  if (!col) return;

  // 3) Prix « actuel du catalogue » : même référence tarifée ailleurs dans le
  //    catalogue du fournisseur (hors collection Commandes).
  let prixVente: number | null = null;
  let prixAchat: number | null = null;
  if (reference) {
    const [catPrix] = await db
      .select({
        prixVente: catalogueRefs.prixVente,
        prixAchat: catalogueRefs.prixAchat,
      })
      .from(catalogueRefs)
      .innerJoin(collections, eq(catalogueRefs.collectionId, collections.id))
      .where(
        and(
          eq(collections.fournisseurId, f.id),
          sql`${collections.nom} <> ${COLLECTION_COMMANDES}`,
          eq(catalogueRefs.reference, reference),
          sql`${catalogueRefs.prixVente} is not null`
        )
      )
      .limit(1);
    if (catPrix) {
      prixVente = catPrix.prixVente;
      prixAchat = catPrix.prixAchat;
    }
  }
  // Repli : prix unitaire de la commande (montant ÷ qté), sinon le montant brut.
  if (prixVente === null && input.montant != null) {
    prixVente =
      input.qte && input.qte > 0 ? input.montant / input.qte : input.montant;
  }

  // 4) Article déjà présent ? (même désignation + référence, coloris ignoré)
  const [existing] = await db
    .select({ id: catalogueRefs.id })
    .from(catalogueRefs)
    .where(
      and(
        eq(catalogueRefs.collectionId, col.id),
        eq(catalogueRefs.reference, reference),
        eq(catalogueRefs.libelle, designation)
      )
    )
    .limit(1);

  if (existing) {
    // On rafraîchit le prix pour rester sur le « prix actuel », uniquement si
    // on en connaît un (on n'écrase pas un prix par du vide).
    if (prixVente !== null) {
      await db
        .update(catalogueRefs)
        .set({
          prixVente,
          ...(prixAchat !== null ? { prixAchat } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(catalogueRefs.id, existing.id));
    }
    return;
  }

  await db.insert(catalogueRefs).values({
    collectionId: col.id,
    reference,
    coloris: "", // ignoré volontairement : un seul article par réf+désignation
    libelle: designation, // désignation de la commande = libellé de l'article
    prixVente,
    prixAchat,
    unite: input.unite || "ml",
    enMagasin: false, // article commandé, pas un échantillon boutique
    commentaires: "Ajouté automatiquement depuis une commande.",
  });
}

// Ajoute une commande fournisseur rattachée à un dossier.
export async function addCommande(dossierId: number, fd: FormData) {
  const str = (k: string) => ((fd.get(k) as string) || "").trim();
  const num = (k: string) => parseNum(fd.get(k));

  const fournisseur = str("fournisseur");
  const designation = str("designation");
  // Garde-fou : au moins un fournisseur ou une désignation. On renvoie { ok }
  // pour que le formulaire ne se vide pas quand rien n'a été enregistré.
  if (!fournisseur && !designation) return { ok: false };

  const unite = str("unite") || "ml";
  const qte = num("qte");
  const montant = num("montant");

  await db.insert(commandes).values({
    dossierId,
    fournisseur,
    client: str("client"),
    designation,
    reference: str("reference"),
    coloris: str("coloris"),
    qte,
    unite,
    montant,
    dateCde: str("dateCde") || null,
    commentaires: str("commentaires"),
  });
  // Alimente le catalogue fournisseur (article + prix) à partir de la commande.
  await syncArticleCatalogue({
    fournisseur,
    designation,
    reference: str("reference"),
    unite,
    montant,
    qte,
  });
  revalidatePath(`/dossiers/${dossierId}`);
  // La liste des dossiers affiche un compteur de commandes par dossier.
  revalidatePath("/dossiers");
  revalidatePath("/rapports-commandes");
  // Le catalogue vient d'être alimenté : on rafraîchit ses pages.
  revalidatePath("/catalogue");
  // Le bon de commande imprimable liste les articles non reçus : sans ceci, il
  // reste figé en cache routeur et on imprime une version périmée.
  revalidatePath("/documents/bon-commande");
  return { ok: true };
}

// Ajoute une commande de FOURNITURE (atelier / stock), non rattachée à un
// dossier : dossierId reste null. Saisie depuis le Rapport des commandes.
export async function addCommandeFourniture(fd: FormData) {
  const str = (k: string) => ((fd.get(k) as string) || "").trim();
  const num = (k: string) => parseNum(fd.get(k));

  const fournisseur = str("fournisseur");
  const designation = str("designation");
  // Garde-fou : au moins un fournisseur ou une désignation
  if (!fournisseur && !designation) return { ok: false };

  const unite = str("unite") || "ml";
  const qte = num("qte");
  const montant = num("montant");
  // Client lié : un dossier existant choisi dans la liste (dossierId), sinon
  // un simple nom de client libre (commande hors dossier).
  const dossierId = Number(str("dossierId")) || null;

  await db.insert(commandes).values({
    dossierId,
    fournisseur,
    client: str("client"),
    designation,
    reference: str("reference"),
    coloris: str("coloris"),
    qte,
    unite,
    montant,
    dateCde: str("dateCde") || null,
    commentaires: str("commentaires"),
  });
  // Alimente le catalogue fournisseur (article + prix) à partir de la commande.
  await syncArticleCatalogue({
    fournisseur,
    designation,
    reference: str("reference"),
    unite,
    montant,
    qte,
  });
  revalidatePath("/rapports-commandes");
  revalidatePath("/dossiers");
  if (dossierId) revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath("/catalogue");
  revalidatePath("/documents/bon-commande");
  return { ok: true };
}

// Valeurs complètes d'une commande, telles qu'éditées dans la fenêtre de
// modification (widget). Nombres en texte : virgule décimale tolérée.
export type CommandeEdit = {
  fournisseur: string;
  designation: string;
  reference: string;
  coloris: string;
  qte: string;
  unite: string;
  montant: string;
  dateCde: string;
  dateLivraison: string;
  dossierId: number | null;
  client: string;
  commentaires: string;
  estCommande: boolean;
  estRecu: boolean;
};

// Corrige une commande existante (fenêtre « Modifier » depuis le Rapport des
// commandes ou la fiche dossier). Même garde-fou que la saisie : au moins un
// fournisseur ou une désignation, sinon rien n'est écrit.
export async function updateCommande(id: number, v: CommandeEdit) {
  const t = (s: string | null | undefined) => (s ?? "").trim();
  const fournisseur = t(v.fournisseur);
  const designation = t(v.designation);
  if (!fournisseur && !designation) {
    return { ok: false, error: "Renseigne au moins un fournisseur ou une désignation." };
  }

  const [avant] = await db
    .select({ dossierId: commandes.dossierId })
    .from(commandes)
    .where(eq(commandes.id, id));
  if (!avant) return { ok: false, error: "Commande introuvable (supprimée ?)." };

  const unite = t(v.unite) || "ml";
  const qte = parseNum(v.qte);
  const montant = parseNum(v.montant);
  const dossierId = v.dossierId || null;

  await db
    .update(commandes)
    .set({
      fournisseur,
      designation,
      reference: t(v.reference),
      coloris: t(v.coloris),
      qte,
      unite,
      montant,
      dateCde: t(v.dateCde) || null,
      dateLivraison: t(v.dateLivraison) || null,
      dossierId,
      client: t(v.client),
      commentaires: t(v.commentaires),
      // « Reçu » implique « commandé ».
      estCommande: v.estCommande || v.estRecu,
      estRecu: v.estRecu,
    })
    .where(eq(commandes.id, id));

  // Article corrigé → le catalogue suit (l'ancien libellé n'est pas supprimé).
  await syncArticleCatalogue({
    fournisseur,
    designation,
    reference: t(v.reference),
    unite,
    montant,
    qte,
  });

  if (avant.dossierId) revalidatePath(`/dossiers/${avant.dossierId}`);
  if (dossierId) revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath("/dossiers");
  revalidatePath("/rapports-commandes");
  revalidatePath("/catalogue");
  revalidatePath("/documents/bon-commande");
  return { ok: true as const };
}

// Article déjà saisi, proposé en suggestion dans les champs Désignation /
// Référence / Coloris des formulaires de commande.
export type ArticleRecent = {
  fournisseur: string;
  designation: string;
  reference: string;
  coloris: string;
  unite: string;
};

// Articles DIFFÉRENTS déjà saisis (fournisseur + désignation + réf + coloris),
// du plus récent au plus ancien. Le champ n'en affiche que 3 à la fois.
export async function articlesRecents(max = 500): Promise<ArticleRecent[]> {
  const rows = await db
    .select({
      fournisseur: commandes.fournisseur,
      designation: commandes.designation,
      reference: commandes.reference,
      coloris: commandes.coloris,
      unite: commandes.unite,
    })
    .from(commandes)
    .orderBy(sql`${commandes.id} desc`)
    .limit(3000);
  const vus = new Set<string>();
  const out: ArticleRecent[] = [];
  for (const r of rows) {
    const a = {
      fournisseur: (r.fournisseur ?? "").trim(),
      designation: (r.designation ?? "").trim(),
      reference: (r.reference ?? "").trim(),
      coloris: (r.coloris ?? "").trim(),
      unite: (r.unite ?? "").trim() || "ml",
    };
    if (!a.designation && !a.reference) continue;
    const cle = [a.fournisseur, a.designation, a.reference, a.coloris]
      .join("|")
      .toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

// Ligne de commande issue d'un fichier CSV / Excel (déjà mappée côté client).
export type LigneImport = {
  fournisseur?: string;
  designation?: string;
  reference?: string;
  coloris?: string;
  client?: string;
  qte?: string;
  unite?: string;
  montant?: string;
  dateCde?: string;
  dateLivraison?: string;
  commentaires?: string;
  dossier?: string;
  estCommande?: boolean;
  estRecu?: boolean;
};

// Import en masse depuis le Rapport des commandes. Même règles que la saisie
// manuelle (fournisseur ou désignation obligatoire, catalogue alimenté).
// La colonne « Dossier » rattache la ligne si elle donne le n° ou le nom exact
// (insensible à la casse) d'un dossier existant ; sinon : fourniture libre.
export async function importCommandes(lignes: LigneImport[]) {
  const dossiersRows = await db
    .select({ id: dossiers.id, nom: dossiers.nomDossier })
    .from(dossiers);
  const parNom = new Map(
    dossiersRows.map((d) => [d.nom.trim().toLowerCase(), d.id])
  );
  const ids = new Set(dossiersRows.map((d) => d.id));
  const trouverDossier = (v: string) => {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s.replace(/^#/, ""));
    if (Number.isInteger(n) && ids.has(n)) return n;
    return parNom.get(s.toLowerCase()) ?? null;
  };

  let importees = 0;
  let ignorees = 0;
  let rattachees = 0;
  for (const l of lignes) {
    const t = (v?: string) => (v ?? "").toString().trim();
    const fournisseur = t(l.fournisseur);
    const designation = t(l.designation);
    if (!fournisseur && !designation) {
      ignorees++;
      continue;
    }
    const unite = t(l.unite) || "ml";
    const qte = parseNum(t(l.qte));
    const montant = parseNum(t(l.montant));
    const dossierId = trouverDossier(t(l.dossier));
    if (dossierId) rattachees++;

    await db.insert(commandes).values({
      dossierId,
      fournisseur,
      client: t(l.client),
      designation,
      reference: t(l.reference),
      coloris: t(l.coloris),
      qte,
      unite,
      montant,
      dateCde: t(l.dateCde) || null,
      dateLivraison: t(l.dateLivraison) || null,
      commentaires: t(l.commentaires),
      estCommande: !!l.estCommande || !!l.estRecu,
      estRecu: !!l.estRecu,
    });
    await syncArticleCatalogue({
      fournisseur,
      designation,
      reference: t(l.reference),
      unite,
      montant,
      qte,
    });
    importees++;
  }

  revalidatePath("/rapports-commandes");
  revalidatePath("/dossiers", "layout");
  revalidatePath("/catalogue");
  revalidatePath("/documents/bon-commande");
  return { ok: importees > 0, importees, ignorees, rattachees };
}

// Bascule l'état « commandé » ou « reçu » d'une ligne de commande (coches
// inline sur la fiche dossier, hors formulaire de modification).
export async function toggleCommandeFlag(
  id: number,
  dossierId: number,
  champ: "estCommande" | "estRecu",
  valeur: boolean
) {
  await db
    .update(commandes)
    .set({ [champ]: valeur })
    .where(eq(commandes.id, id));
  revalidatePath(`/dossiers/${dossierId}`);
  // La liste des dossiers affiche un compteur de commandes par dossier.
  revalidatePath("/dossiers");
  revalidatePath("/rapports-commandes");
  // Le bon de commande imprimable liste les articles non reçus : sans ceci, il
  // reste figé en cache routeur et on imprime une version périmée.
  revalidatePath("/documents/bon-commande");
}

// Renseigne (ou efface) le jour de livraison d'une commande. Saisie inline
// depuis le Rapport des commandes. Chaîne vide = on efface la date.
export async function setCommandeDateLivraison(
  id: number,
  dossierId: number,
  date: string
) {
  await db
    .update(commandes)
    .set({ dateLivraison: date ? date : null })
    .where(eq(commandes.id, id));
  if (dossierId) revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath("/rapports-commandes");
  revalidatePath("/documents/bon-commande");
}

// Supprime une commande.
export async function deleteCommande(id: number, dossierId: number) {
  await db.delete(commandes).where(eq(commandes.id, id));
  revalidatePath(`/dossiers/${dossierId}`);
  // La liste des dossiers affiche un compteur de commandes par dossier.
  revalidatePath("/dossiers");
  revalidatePath("/rapports-commandes");
  // Le bon de commande imprimable liste les articles non reçus : sans ceci, il
  // reste figé en cache routeur et on imprime une version périmée.
  revalidatePath("/documents/bon-commande");
}

// ─── Import d'un PDF fournisseur (accusé de réception / bon de commande) ───

const MAX_PDF = 14 * 1024 * 1024;

function fichierPdf(fd: FormData): File | string {
  const file = fd.get("fichier");
  if (!(file instanceof File) || file.size === 0) return "Aucun fichier sélectionné.";
  const nom = (file.name || "").toLowerCase();
  if (file.type !== "application/pdf" && !nom.endsWith(".pdf")) {
    return "Ce n'est pas un PDF.";
  }
  if (file.size > MAX_PDF) return "PDF trop volumineux (14 Mo maximum).";
  return file;
}

// Étape 1 : lit le PDF (sans l'enregistrer) et renvoie les lignes repérées,
// la date et le fournisseur devinés, pour le tableau de vérification.
export async function lirePdfFournisseur(fd: FormData): Promise<
  | { ok: true; lignes: LigneLue[]; date: string; fournisseur: string; pages: number }
  | { ok: false; error: string }
> {
  const file = fichierPdf(fd);
  if (typeof file === "string") return { ok: false, error: file };
  try {
    const lu = await lirePdfCommande(new Uint8Array(await file.arrayBuffer()));
    if (!lu.texte.trim()) {
      return {
        ok: false,
        error:
          "Aucun texte dans ce PDF (document scanné ?). La lecture sans IA ne fonctionne qu'avec les PDF « texte ».",
      };
    }
    // Fournisseur deviné : un nom de l'annuaire présent dans le texte (le
    // plus long d'abord, pour préférer « Casal Paris » à « Casal »).
    const noms = (await db.select({ nom: fournisseurs.nom }).from(fournisseurs))
      .map((f) => f.nom.trim())
      .filter((n) => n.length >= 3)
      .sort((a, b) => b.length - a.length);
    const bas = lu.texte.toLowerCase();
    const fournisseur = noms.find((n) => bas.includes(n.toLowerCase())) ?? "";
    return { ok: true, lignes: lu.lignes, date: lu.date, fournisseur, pages: lu.pages };
  } catch (e) {
    console.error("Lecture PDF échouée:", (e as Error).message);
    return { ok: false, error: "PDF illisible ou protégé." };
  }
}

export type LigneImportPdf = {
  reference: string;
  designation: string;
  coloris: string;
  qte: string;
  unite: string;
  montant: string;
  dossierId: number | null;
};

// Étape 2 : après vérification, enregistre le PDF (Vercel Blob, privé), crée
// les commandes (cochées « Commandé »), alimente le catalogue et relie chaque
// commande à son PDF. Champs : fichier + donnees (JSON).
export async function importerPdfFournisseur(
  fd: FormData
): Promise<{ ok: true; creees: number } | { ok: false; error: string }> {
  const file = fichierPdf(fd);
  if (typeof file === "string") return { ok: false, error: file };
  const token = blobToken();
  if (!token) {
    return { ok: false, error: "Stockage des fichiers non configuré (Vercel Blob)." };
  }

  let donnees: { fournisseur: string; dateCde: string; lignes: LigneImportPdf[] };
  try {
    donnees = JSON.parse(String(fd.get("donnees") ?? ""));
  } catch {
    return { ok: false, error: "Données invalides." };
  }
  const t = (s: string | null | undefined) => (s ?? "").trim();
  const fournisseur = t(donnees.fournisseur);
  const lignes = (donnees.lignes ?? []).filter(
    (l) => t(l.designation) || t(l.reference)
  );
  if (!fournisseur) return { ok: false, error: "Indique le fournisseur." };
  if (lignes.length === 0) return { ok: false, error: "Aucune ligne à importer." };

  await ensureImports();
  const nom = (file.name || "commande.pdf").trim();
  const blob = await put(`commandes-import/${nom}`, file, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: true,
    token,
  });
  const [imp] = await rawSql`INSERT INTO commande_imports
      (fournisseur, nom_fichier, pathname, url, taille, content_type)
    VALUES (${fournisseur}, ${nom}, ${blob.pathname}, ${blob.url}, ${file.size},
      'application/pdf')
    RETURNING id`;
  const importId = Number(imp.id);

  // Clients des dossiers choisis (repris dans le champ client de la commande).
  const ids = [...new Set(lignes.map((l) => l.dossierId).filter(Boolean))] as number[];
  const clients = new Map<number, string>();
  for (const id of ids) {
    const [d] = await db
      .select({ client: dossiers.clientNom, nom: dossiers.nomDossier })
      .from(dossiers)
      .where(eq(dossiers.id, id));
    if (d) clients.set(id, d.client || d.nom);
  }

  for (const l of lignes) {
    const unite = t(l.unite) || "ml";
    const qte = parseNum(l.qte);
    const montant = parseNum(l.montant);
    const dossierId = l.dossierId || null;
    const [row] = await db
      .insert(commandes)
      .values({
        dossierId,
        fournisseur,
        client: dossierId ? clients.get(dossierId) ?? "" : "",
        designation: t(l.designation),
        reference: t(l.reference),
        coloris: t(l.coloris),
        qte,
        unite,
        montant,
        dateCde: t(donnees.dateCde) || null,
        commentaires: `Importé du PDF « ${nom} »`,
        estCommande: true,
      })
      .returning({ id: commandes.id });
    await rawSql`UPDATE commandes SET import_id = ${importId} WHERE id = ${row.id}`;
    await syncArticleCatalogue({
      fournisseur,
      designation: t(l.designation),
      reference: t(l.reference),
      unite,
      montant,
      qte,
    });
    if (dossierId) revalidatePath(`/dossiers/${dossierId}`);
  }

  revalidatePath("/rapports-commandes");
  revalidatePath("/dossiers");
  revalidatePath("/catalogue");
  revalidatePath("/documents/bon-commande");
  return { ok: true, creees: lignes.length };
}
