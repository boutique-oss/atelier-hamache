-- ══════════════════════════════════════════════════════════════════
-- Atelier Stéphan Hamache — Schéma Supabase (PostgreSQL)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════

-- DOSSIERS
CREATE TABLE dossiers (
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
CREATE INDEX idx_dossiers_statut ON dossiers(statut);

-- FOURNISSEURS
CREATE TABLE fournisseurs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  url_site TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  commentaires TEXT DEFAULT ''
);

-- COMMANDES
CREATE TABLE commandes (
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
CREATE INDEX idx_commandes_client ON commandes(client);
CREATE INDEX idx_commandes_fournisseur ON commandes(fournisseur);

-- HEURES
CREATE TABLE heures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  operateur TEXT NOT NULL,
  date TEXT NOT NULL,
  heures_passees REAL NOT NULL,
  type_travail TEXT DEFAULT 'Atelier',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FICHES_ATELIER
CREATE TABLE fiches_atelier (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  type_intervention TEXT NOT NULL,
  contenu_json TEXT NOT NULL DEFAULT '{}',
  notes_libres TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS
CREATE TABLE tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre TEXT NOT NULL,
  type TEXT DEFAULT 'dossiers',
  statut TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTERVENTIONS_RIDEAUX
CREATE TABLE interventions_rideaux (
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

-- PREDEVIS
CREATE TABLE predevis (
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

-- ══ Row Level Security ═══════════════════════════════════════════
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE heures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiches_atelier ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions_rideaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE predevis ENABLE ROW LEVEL SECURITY;

-- Seuls les utilisateurs connectés peuvent accéder aux données
CREATE POLICY "auth_all" ON dossiers          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON fournisseurs      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON commandes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON heures            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON fiches_atelier    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tasks             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON interventions_rideaux FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON predevis          FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ══ Storage bucket pour les PDFs ════════════════════════════════
-- À créer manuellement dans Supabase Dashboard → Storage → New bucket
-- Nom : "pdfs", Accès : Private
