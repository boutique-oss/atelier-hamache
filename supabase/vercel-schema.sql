-- ══════════════════════════════════════════════════════════════════
-- Atelier Stéphan Hamache — Schéma Vercel Postgres
-- À coller dans : Vercel → Storage → Postgres → Query
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dossiers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom_dossier TEXT NOT NULL,
  client_nom TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'Nouveau',
  flags TEXT DEFAULT '[]',
  type_intervention TEXT DEFAULT 'Autre',
  date_ouverture TEXT,
  etape_devis BOOLEAN DEFAULT false,
  etape_cmde BOOLEAN DEFAULT false,
  etape_atelier BOOLEAN DEFAULT false,
  etape_print BOOLEAN DEFAULT false,
  etape_realise BOOLEAN DEFAULT false,
  lien_dossier_externe TEXT DEFAULT '',
  commentaires TEXT DEFAULT '',
  heures_a_realiser REAL DEFAULT 0,
  date_planifiee TEXT,
  fiche_pdf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fournisseurs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  url_site TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  commentaires TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commandes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fournisseur TEXT DEFAULT '',
  client TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  coloris TEXT DEFAULT '',
  date_cde TEXT,
  qte REAL,
  qte_note TEXT DEFAULT '',
  unite TEXT DEFAULT 'ml',
  montant REAL,
  qte_livree REAL,
  date_livraison TEXT,
  controle TEXT DEFAULT '',
  commentaires TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS heures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  operateur TEXT NOT NULL,
  date TEXT NOT NULL,
  heures_passees REAL NOT NULL,
  type_travail TEXT DEFAULT 'Atelier',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiches_atelier (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  type_intervention TEXT NOT NULL,
  contenu_json TEXT NOT NULL DEFAULT '{}',
  notes_libres TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre TEXT NOT NULL,
  type TEXT DEFAULT 'dossiers',
  statut TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interventions_rideaux (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  date TEXT DEFAULT '',
  pieces_json TEXT DEFAULT '[]',
  tissu TEXT DEFAULT '',
  ref_tissu TEXT DEFAULT '',
  coloris TEXT DEFAULT '',
  metrage TEXT DEFAULT '',
  type_tete TEXT DEFAULT '',
  heures TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE SET NULL,
  materiaux_json TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predevis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference TEXT NOT NULL,
  statut TEXT DEFAULT 'brouillon',
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE SET NULL,
  client_nom TEXT DEFAULT '',
  client_tel TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  client_adresse TEXT DEFAULT '',
  description TEXT DEFAULT '',
  type_intervention TEXT DEFAULT 'Tapisserie',
  tapisserie_ops TEXT,
  urgent BOOLEAN DEFAULT false,
  tissus TEXT,
  fournitures TEXT,
  heures_estimees REAL DEFAULT 0,
  taux_horaire REAL DEFAULT 55,
  forfait_pose REAL DEFAULT 0,
  km_deplacement REAL DEFAULT 0,
  tarif_km REAL DEFAULT 0.5,
  taux_tva REAL DEFAULT 0.20,
  notes TEXT DEFAULT '',
  total_ht REAL DEFAULT 0,
  total_ttc REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
