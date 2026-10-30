-- À exécuter manuellement sur la base Neon (console Neon > SQL Editor).
-- Lien fiche ↔ heures : ajoute le type de réalisation (Fauteuil, Double
-- rideaux…) et le nombre de pièces à chaque saisie d'heures, pour compter
-- « heures / pièce ». typeTravail (type_travail) devient la PHASE transverse.
-- Additif uniquement, sans risque pour les données existantes
-- (IF NOT EXISTS = ré-exécutable sans erreur si déjà appliqué).
ALTER TABLE "heures"
  ADD COLUMN IF NOT EXISTS "type_realisation" text,
  ADD COLUMN IF NOT EXISTS "nombre" real DEFAULT 1;
