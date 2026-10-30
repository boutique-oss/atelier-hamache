import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";
import { ensureDocuments } from "@/lib/documents-db";
import { ensureRideauxTables } from "@/lib/rideaux/db";

export const dynamic = "force-dynamic";

// Clé d'exécution (en plus du code d'accès middleware) : permet de lancer la
// migration sans cookie via ?key=… Idempotente (IF NOT EXISTS).
const MIGRATE_KEY = "ash-migrate-2026";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== MIGRATE_KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }
  try {
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_debut_chantier text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_fin_chantier text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS google_event_id text`;
    await sql`ALTER TABLE commandes ADD COLUMN IF NOT EXISTS est_commande boolean DEFAULT false`;
    await sql`ALTER TABLE commandes ADD COLUMN IF NOT EXISTS est_recu boolean DEFAULT false`;
    // Heures + rappels des 3 dates ponctuelles (événements Google Agenda horaires).
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS heure_enlevement text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS heure_livraison text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS heure_prise_cote text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS rappels_enlevement text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS rappels_livraison text`;
    await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS rappels_prise_cote text`;
    // Pointage des heures : une ligne par salarié et par jour.
    // Séparé de la table `heures` (qui compte le temps passé PAR DOSSIER) pour
    // ne pas fausser le Rapport des heures.
    await sql`CREATE TABLE IF NOT EXISTS pointage (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      operateur text NOT NULL,
      date text NOT NULL,
      heures real DEFAULT 0,
      type text DEFAULT 'Travail',
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS pointage_operateur_date_key
      ON pointage (operateur, date)`;
    // Le dirigeant est pointé pour information : aucun horaire dû.
    await sql`ALTER TABLE operateurs ADD COLUMN IF NOT EXISTS est_dirigeant boolean DEFAULT false`;
    // Demandes de congés : une ligne par période (début → fin), distinct du
    // pointage jour par jour. Alimente le calendrier des congés (Pointage +
    // Planning) et le suivi des demandes à valider.
    await sql`CREATE TABLE IF NOT EXISTS conges (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      operateur text NOT NULL,
      date_debut text NOT NULL,
      date_fin text NOT NULL,
      type text DEFAULT 'Congé payé',
      statut text DEFAULT 'Demandé',
      commentaire text DEFAULT '',
      google_event_id text,
      created_at timestamptz DEFAULT now()
    )`;
    // Lien Google Agenda pour les congés (tables conges déjà créées avant l'ajout).
    await sql`ALTER TABLE conges ADD COLUMN IF NOT EXISTS google_event_id text`;
    // Devis signés (PDF) rattachés à un dossier. Le fichier vit sur Vercel Blob ;
    // la base ne garde que l'URL publique + les métadonnées d'affichage.
    await sql`CREATE TABLE IF NOT EXISTS devis_signes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      dossier_id bigint,
      nom_fichier text NOT NULL,
      url text NOT NULL,
      pathname text NOT NULL,
      taille bigint,
      content_type text DEFAULT 'application/pdf',
      created_at timestamptz DEFAULT now()
    )`;
    await sql`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'devis_signes_dossier_id_fkey'
        ) THEN
          ALTER TABLE devis_signes
            ADD CONSTRAINT devis_signes_dossier_id_fkey
            FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;
        END IF;
      END $$`;
    await sql`CREATE INDEX IF NOT EXISTS idx_devis_signes_dossier
      ON devis_signes (dossier_id)`;
    // Paramètres de sécurité éditables depuis l'interface (Admin › Sécurité).
    // Table à ligne unique (id = 1) : code d'accès partagé + IP autorisées
    // (liste séparée par des virgules, vide = aucune restriction réseau).
    // La source de vérité devient la base ; les variables Vercel ACCESS_CODE /
    // ALLOWED_IPS servent d'amorçage et de repli si la base est vide/indisponible.
    await sql`CREATE TABLE IF NOT EXISTS parametres_securite (
      id smallint PRIMARY KEY DEFAULT 1,
      code_acces text DEFAULT '',
      ips_autorisees text DEFAULT '',
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT parametres_securite_ligne_unique CHECK (id = 1)
    )`;
    // Amorçage depuis les variables Vercel actuelles (ne fait rien si la ligne
    // existe déjà : on n'écrase jamais un réglage saisi dans l'interface).
    await sql`INSERT INTO parametres_securite (id, code_acces, ips_autorisees)
      VALUES (1, ${process.env.ACCESS_CODE || ""}, ${process.env.ALLOWED_IPS || ""})
      ON CONFLICT (id) DO NOTHING`;
    // Comptes individuels + rôles (étape 2). Tant qu'aucun admin n'existe, la
    // connexion se fait par code d'accès (bootstrap). Aucun compte n'est créé
    // ici : ils se créent depuis Admin › Sécurité › Comptes & rôles.
    await sql`CREATE TABLE IF NOT EXISTS utilisateurs (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nom text NOT NULL,
      identifiant text NOT NULL,
      mdp_sel text DEFAULT '',
      mdp_hash text DEFAULT '',
      role text NOT NULL DEFAULT 'operateur',
      actif boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS utilisateurs_identifiant_key
      ON utilisateurs (lower(identifiant))`;
    // Auth par e-mail (étape 3) : adresse du compte, invitations (lien
    // d'activation) et codes de double authentification.
    await sql`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email text`;
    // Invitations : le compte est créé inactif ; la personne reçoit un lien
    // (jeton aléatoire, seule son empreinte SHA-256 est stockée) pour choisir
    // son mot de passe. Usage unique (utilise_at) et péremption (expire_at).
    await sql`CREATE TABLE IF NOT EXISTS invitations (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      utilisateur_id bigint REFERENCES utilisateurs(id) ON DELETE CASCADE,
      email text NOT NULL,
      jeton_hash text NOT NULL,
      expire_at timestamptz NOT NULL,
      utilise_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_invitations_jeton ON invitations (jeton_hash)`;
    // Codes 2FA : code à 6 chiffres envoyé par e-mail après le mot de passe.
    // Seule l'empreinte est stockée, avec péremption et compteur d'essais.
    await sql`CREATE TABLE IF NOT EXISTS codes_2fa (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      utilisateur_id bigint REFERENCES utilisateurs(id) ON DELETE CASCADE,
      code_hash text NOT NULL,
      expire_at timestamptz NOT NULL,
      essais int DEFAULT 0,
      utilise_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_codes_2fa_util ON codes_2fa (utilisateur_id)`;
    // Catalogue échantillons : annuaire fournisseurs → collections → références.
    // Table `fournisseurs` déjà présente ; on ajoute son code EBP + les deux
    // tables filles. Suppression en cascade (supprimer un fournisseur retire
    // ses collections et références).
    await sql`ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS code_ebp text DEFAULT ''`;
    await sql`CREATE TABLE IF NOT EXISTS collections (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      fournisseur_id bigint REFERENCES fournisseurs(id) ON DELETE CASCADE,
      nom text NOT NULL,
      editeur text DEFAULT '',
      annee text DEFAULT '',
      commentaires text DEFAULT '',
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_collections_fournisseur
      ON collections (fournisseur_id)`;
    await sql`CREATE TABLE IF NOT EXISTS catalogue_refs (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      collection_id bigint REFERENCES collections(id) ON DELETE CASCADE,
      reference text NOT NULL,
      coloris text DEFAULT '',
      laize text DEFAULT '',
      prix_achat real,
      prix_vente real,
      unite text DEFAULT 'ml',
      libelle text DEFAULT '',
      code_ebp text DEFAULT '',
      num_echantillon text DEFAULT '',
      en_magasin boolean DEFAULT true,
      commentaires text DEFAULT '',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_catalogue_refs_collection
      ON catalogue_refs (collection_id)`;
    // Navette (paie) : horaire fixe (exclu des heures sup.), absences avec
    // motif, choix payer/stocker des heures sup. par semaine, stock d'heures.
    const [dejaFixe] = await sql`SELECT 1 FROM information_schema.columns
      WHERE table_name = 'operateurs' AND column_name = 'horaire_fixe'`;
    await sql`ALTER TABLE operateurs ADD COLUMN IF NOT EXISTS horaire_fixe boolean DEFAULT false`;
    // Première activation : Raphaël est en horaire fixe (modifiable ensuite).
    if (!dejaFixe) {
      await sql`UPDATE operateurs SET horaire_fixe = true WHERE nom ILIKE 'rapha%'`;
    }
    await sql`ALTER TABLE pointage ADD COLUMN IF NOT EXISTS motif text DEFAULT ''`;
    await sql`ALTER TABLE pointage ADD COLUMN IF NOT EXISTS heures_absence real DEFAULT 0`;
    await sql`CREATE TABLE IF NOT EXISTS hs_semaines (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      operateur text NOT NULL,
      lundi text NOT NULL,
      mode text NOT NULL DEFAULT 'payer',
      created_at timestamptz DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS hs_semaines_operateur_lundi_key
      ON hs_semaines (operateur, lundi)`;
    await sql`CREATE TABLE IF NOT EXISTS stock_heures (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      operateur text NOT NULL,
      date text NOT NULL,
      heures real NOT NULL DEFAULT 0,
      libelle text DEFAULT '',
      created_at timestamptz DEFAULT now()
    )`;
    // Demandes de congés / récup : heures à retirer du stock d'heures (à la
    // validation de la demande).
    await sql`ALTER TABLE conges ADD COLUMN IF NOT EXISTS heures_stock real DEFAULT 0`;
    // Calculateur rideaux : chiffrages enregistrés + paramètres atelier.
    // (Aussi créées à la volée à la première ouverture de /rideaux.)
    await ensureRideauxTables();
    // Module Documents : arborescence, fichiers, bons atelier, fiches navettes.
    // (Aussi créées à la volée au premier usage.)
    await ensureDocuments();
    // Statuts fusionnés : « Lead » → « Opportunité » ; « Devis signé » et
    // « Validé » → « Devis signé / Validé ».
    await sql`UPDATE dossiers SET statut = 'Opportunité' WHERE statut = 'Lead'`;
    await sql`UPDATE dossiers SET statut = 'Devis signé / Validé'
      WHERE statut IN ('Devis signé', 'Validé')`;
    return NextResponse.json({
      ok: true,
      message:
        "Colonnes date_debut_chantier, date_fin_chantier, google_event_id (dossiers) + est_commande, est_recu (commandes) + heure_/rappels_ (enlevement, livraison, prise_cote) + tables devis_signes, parametres_securite et utilisateurs + catalogue (fournisseurs.code_ebp, collections, catalogue_refs) + navette (horaire_fixe, motif d'absence, hs_semaines, stock_heures) + module Documents (doc_dossiers, documents, fiches_navettes, bons_atelier, heures.fiche_navette_id) prêtes.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
