// Accès base du calculateur rideaux (SQL brut, comme les routes d'export : pas
// de cache Drizzle sur des données qui changent souvent).
//
// Deux tables :
//  - calculs_rideaux : un chiffrage enregistré (projet + fenêtres en JSON).
//    Les fenêtres stockent les ENTRÉES ; les totaux (tissu, heures, HT, TTC)
//    sont recalculés côté serveur à l'enregistrement et gardés pour la liste /
//    la recherche. Les paramètres utilisés sont figés avec le chiffrage pour
//    qu'un calcul rouvert plus tard affiche les mêmes prix.
//  - rideaux_parametres : ligne unique (id = 1) des paramètres atelier.
import { sql } from "@/lib/raw-sql";
import { PARAMS_DEF, sanitizeParams, type ParamsRideaux } from "@/lib/rideaux/calcul";

let pret: Promise<void> | null = null;

// Création idempotente des tables (évite une étape de migration manuelle :
// la première ouverture du calculateur en prod suffit).
export function ensureRideauxTables(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS calculs_rideaux (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nom text NOT NULL DEFAULT '',
        client text DEFAULT '',
        dossier_id bigint REFERENCES dossiers(id) ON DELETE SET NULL,
        lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
        params jsonb,
        nb_fenetres int DEFAULT 0,
        metrage_tissu real DEFAULT 0,
        metrage_doublure real DEFAULT 0,
        heures real DEFAULT 0,
        total_ht real DEFAULT 0,
        total_ttc real DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_calculs_rideaux_dossier ON calculs_rideaux (dossier_id)`;
      await sql`CREATE TABLE IF NOT EXISTS rideaux_parametres (
        id smallint PRIMARY KEY DEFAULT 1,
        data jsonb NOT NULL,
        valide boolean DEFAULT false,
        updated_at timestamptz DEFAULT now(),
        CONSTRAINT rideaux_parametres_ligne_unique CHECK (id = 1)
      )`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

export async function getParamsAtelier(): Promise<{ params: ParamsRideaux; valide: boolean }> {
  await ensureRideauxTables();
  const [row] = await sql`SELECT data, valide FROM rideaux_parametres WHERE id = 1`;
  if (!row) return { params: sanitizeParams(PARAMS_DEF), valide: false };
  return { params: sanitizeParams(row.data), valide: !!row.valide };
}

export type CalculResume = {
  id: number;
  nom: string;
  client: string;
  dossierId: number | null;
  dossierNom: string | null;
  nbFenetres: number;
  metrageTissu: number;
  heures: number;
  totalHt: number;
  totalTtc: number;
  tissus: string;
  updatedAt: string;
  createdAt: string;
};

// Liste des chiffrages, filtrée par une recherche libre sur le projet, le
// client, le dossier lié et le contenu des fenêtres (désignation, tissu…).
export async function listCalculs(q: string): Promise<CalculResume[]> {
  await ensureRideauxTables();
  const motif = "%" + q.trim().replace(/[%_\\]/g, (c) => "\\" + c) + "%";
  const rows = await sql`
    SELECT c.id, c.nom, c.client, c.dossier_id, d.nom_dossier, c.nb_fenetres,
           c.metrage_tissu, c.heures, c.total_ht, c.total_ttc,
           c.created_at, c.updated_at,
           (SELECT string_agg(DISTINCT NULLIF(l->>'tissu', ''), ' · ')
              FROM jsonb_array_elements(c.lignes) l) AS tissus
    FROM calculs_rideaux c
    LEFT JOIN dossiers d ON d.id = c.dossier_id
    WHERE ${q.trim() === ""}
       OR c.nom ILIKE ${motif} OR c.client ILIKE ${motif}
       OR d.nom_dossier ILIKE ${motif} OR d.client_nom ILIKE ${motif}
       OR c.lignes::text ILIKE ${motif}
       OR c.id::text = ${q.trim().replace(/^#/, "")}
    ORDER BY c.updated_at DESC
    LIMIT 300`;
  return rows.map((r) => ({
    id: Number(r.id),
    nom: r.nom || "",
    client: r.client || "",
    dossierId: r.dossier_id == null ? null : Number(r.dossier_id),
    dossierNom: r.nom_dossier ?? null,
    nbFenetres: Number(r.nb_fenetres) || 0,
    metrageTissu: Number(r.metrage_tissu) || 0,
    heures: Number(r.heures) || 0,
    totalHt: Number(r.total_ht) || 0,
    totalTtc: Number(r.total_ttc) || 0,
    tissus: r.tissus || "",
    updatedAt: String(r.updated_at),
    createdAt: String(r.created_at),
  }));
}

export async function getCalcul(id: number) {
  await ensureRideauxTables();
  const [r] = await sql`SELECT id, nom, client, dossier_id, lignes, params, created_at, updated_at
    FROM calculs_rideaux WHERE id = ${id}`;
  if (!r) return null;
  return {
    id: Number(r.id),
    nom: (r.nom as string) || "",
    client: (r.client as string) || "",
    dossierId: r.dossier_id == null ? null : Number(r.dossier_id),
    lignes: (r.lignes as unknown[]) || [],
    params: r.params as unknown,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listDossiersCourts() {
  const rows = await sql`SELECT id, nom_dossier, client_nom FROM dossiers
    ORDER BY id DESC LIMIT 500`;
  return rows.map((r) => ({
    id: Number(r.id),
    nom: (r.nom_dossier as string) || "",
    client: (r.client_nom as string) || "",
  }));
}
