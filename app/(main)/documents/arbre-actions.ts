"use server";

import { revalidatePath } from "next/cache";

import { sql } from "@/lib/raw-sql";
import { utilisateurCourant } from "@/lib/session";
import {
  CATEGORIES_DOCUMENT,
  ensureDocuments,
  type CategorieDocument,
} from "@/lib/documents-db";

// Sous-dossiers libres du module Documents (3e niveau et plus de
// l'arborescence, sous Dossier client → Catégorie). Toute l'équipe peut les
// créer / renommer ; on ne supprime qu'un sous-dossier vide.

type Resultat = { ok: true } | { ok: false; error: string };

const CLES = new Set<string>(CATEGORIES_DOCUMENT.map((c) => c.cle));

function nomPropre(v: string): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function rafraichir(dossierId: number | null) {
  revalidatePath("/documents");
  if (dossierId != null) revalidatePath(`/dossiers/${dossierId}`);
}

// Violation de l'index unique doc_dossiers_nom_key (même nom au même endroit).
function estDoublon(e: unknown): boolean {
  return String((e as { code?: string })?.code) === "23505";
}

const DOUBLON = "Un sous-dossier porte déjà ce nom à cet endroit.";

export async function creerSousDossier(input: {
  dossierId: number;
  categorie: CategorieDocument;
  parentId: number | null;
  nom: string;
}): Promise<Resultat> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const nom = nomPropre(input.nom);
  if (!nom) return { ok: false, error: "Donnez un nom au sous-dossier." };
  const dossierId = Number(input.dossierId);
  if (!Number.isFinite(dossierId)) return { ok: false, error: "Dossier invalide." };
  if (!CLES.has(input.categorie)) return { ok: false, error: "Catégorie inconnue." };
  await ensureDocuments();

  const parentId = input.parentId == null ? null : Number(input.parentId);
  if (parentId != null) {
    // Le parent doit être au même endroit (même dossier, même catégorie).
    const [p] = await sql`SELECT dossier_id, categorie FROM doc_dossiers
      WHERE id = ${parentId}`;
    if (!p || Number(p.dossier_id) !== dossierId || p.categorie !== input.categorie) {
      return { ok: false, error: "Sous-dossier parent introuvable." };
    }
  }

  try {
    await sql`INSERT INTO doc_dossiers (parent_id, dossier_id, categorie, nom)
      VALUES (${parentId}, ${dossierId}, ${input.categorie}, ${nom})`;
  } catch (e) {
    if (estDoublon(e)) return { ok: false, error: DOUBLON };
    throw e;
  }
  rafraichir(dossierId);
  return { ok: true };
}

export async function renommerSousDossier(id: number, nomSaisi: string): Promise<Resultat> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const nom = nomPropre(nomSaisi);
  if (!nom) return { ok: false, error: "Le nom ne peut pas être vide." };
  await ensureDocuments();
  let rows: Record<string, unknown>[];
  try {
    rows = await sql`UPDATE doc_dossiers SET nom = ${nom}
      WHERE id = ${Number(id)} RETURNING dossier_id`;
  } catch (e) {
    if (estDoublon(e)) return { ok: false, error: DOUBLON };
    throw e;
  }
  if (rows.length === 0) return { ok: false, error: "Sous-dossier introuvable." };
  rafraichir(rows[0].dossier_id == null ? null : Number(rows[0].dossier_id));
  return { ok: true };
}

export async function supprimerSousDossier(id: number): Promise<Resultat> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  await ensureDocuments();
  // Suppression conditionnelle en une requête : rien ne part s'il reste un
  // fichier ou un sous-dossier dedans.
  const rows = await sql`DELETE FROM doc_dossiers s
    WHERE s.id = ${Number(id)}
      AND NOT EXISTS (SELECT 1 FROM documents WHERE doc_dossier_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM doc_dossiers WHERE parent_id = s.id)
    RETURNING dossier_id`;
  if (rows.length === 0) {
    const [existe] = await sql`SELECT 1 FROM doc_dossiers WHERE id = ${Number(id)}`;
    return {
      ok: false,
      error: existe
        ? "Ce sous-dossier n'est pas vide : déplacez ou supprimez d'abord son contenu."
        : "Sous-dossier introuvable.",
    };
  }
  rafraichir(rows[0].dossier_id == null ? null : Number(rows[0].dossier_id));
  return { ok: true };
}
