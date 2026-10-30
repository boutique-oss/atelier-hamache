-- À exécuter manuellement sur la base Neon (console Neon > SQL Editor).
-- Ajoute les 3 dates ponctuelles du planning (enlèvement/dépôt, livraison,
-- prise de cote), leur googleEventId associé, et leur commentaire libre.
-- Additif uniquement, sans risque pour les données existantes
-- (IF NOT EXISTS = ré-exécutable sans erreur si déjà appliqué).
ALTER TABLE "dossiers"
  ADD COLUMN IF NOT EXISTS "date_enlevement_depot" text,
  ADD COLUMN IF NOT EXISTS "date_livraison" text,
  ADD COLUMN IF NOT EXISTS "date_prise_de_cote" text,
  ADD COLUMN IF NOT EXISTS "google_event_id_enlevement" text,
  ADD COLUMN IF NOT EXISTS "google_event_id_livraison" text,
  ADD COLUMN IF NOT EXISTS "google_event_id_prise_cote" text,
  ADD COLUMN IF NOT EXISTS "commentaire_enlevement" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "commentaire_livraison" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "commentaire_prise_cote" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "commentaire_chantier" text DEFAULT '';
