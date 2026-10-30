-- À exécuter manuellement sur la base Neon (console Neon > SQL Editor) OU via
-- l'URL /api/admin/migrate?key=ash-migrate-2026 (idempotent).
-- Catalogue échantillons : annuaire fournisseurs → collections → références.
-- La table `fournisseurs` existe déjà ; on ajoute son code EBP et les deux
-- tables filles. Additif uniquement, ré-exécutable sans risque (IF NOT EXISTS).
ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "code_ebp" text DEFAULT '';

CREATE TABLE IF NOT EXISTS "collections" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "fournisseur_id" bigint REFERENCES "fournisseurs"("id") ON DELETE CASCADE,
  "nom" text NOT NULL,
  "editeur" text DEFAULT '',
  "annee" text DEFAULT '',
  "commentaires" text DEFAULT '',
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_collections_fournisseur" ON "collections" ("fournisseur_id");

CREATE TABLE IF NOT EXISTS "catalogue_refs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "collection_id" bigint REFERENCES "collections"("id") ON DELETE CASCADE,
  "reference" text NOT NULL,
  "coloris" text DEFAULT '',
  "laize" text DEFAULT '',
  "prix_achat" real,
  "prix_vente" real,
  "unite" text DEFAULT 'ml',
  "libelle" text DEFAULT '',
  "code_ebp" text DEFAULT '',
  "num_echantillon" text DEFAULT '',
  "en_magasin" boolean DEFAULT true,
  "commentaires" text DEFAULT '',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_catalogue_refs_collection" ON "catalogue_refs" ("collection_id");
