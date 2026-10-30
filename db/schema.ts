// ============================================================
//  atelier-erp — Schéma RÉEL (introspection de la base Neon déployée)
//  Source de vérité unique. Régénérer avec : npx drizzle-kit pull
//  NB: dates en text(), montants en real(), ids GENERATED ALWAYS AS IDENTITY.
// ============================================================
import { pgTable, unique, bigint, text, real, boolean, timestamp, date, foreignKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const fournisseurs = pgTable("fournisseurs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "fournisseurs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	nom: text().notNull(),
	urlSite: text("url_site").default(''),
	contact: text().default(''),
	commentaires: text().default(''),
	// Code du fournisseur dans EBP (colonne « CODE FOURNISSEUR » du modèle
	// d'import article). Repris tel quel dans l'export CSV de mise à jour tarifs.
	codeEbp: text("code_ebp").default(''),
}, (table) => [
	unique("fournisseurs_nom_key").on(table.nom),
]);

// ---- Catalogue échantillons (annuaire fournisseurs → collections → réfs) ----
// Hiérarchie à 3 niveaux : fournisseurs → collections → références (les
// échantillons de tissu présents en magasin). Sert d'annuaire à la commande et
// de source pour l'export CSV de mise à jour des tarifs dans EBP.
export const collections = pgTable("collections", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "collections_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	fournisseurId: bigint("fournisseur_id", { mode: "number" }),
	nom: text().notNull(),
	// Éditeur/marque quand il diffère du fournisseur (ex : distribué par X).
	editeur: text().default(''),
	annee: text().default(''),
	commentaires: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.fournisseurId],
		foreignColumns: [fournisseurs.id],
		name: "collections_fournisseur_id_fkey"
	}).onDelete("cascade"),
]);

// Une référence = un tissu (réf. + coloris) dont l'échantillon est en boutique.
// `codeEbp` = colonne « réference » du modèle EBP (clé de rapprochement pour
// l'import tarif) ; `prixAchat`/`prixVente` = « PRIX FOURNISSEUR »/« PRIX MARGE ».
export const catalogueRefs = pgTable("catalogue_refs", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "catalogue_refs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	collectionId: bigint("collection_id", { mode: "number" }),
	reference: text().notNull(),
	coloris: text().default(''),
	// Largeur/laize du rouleau (texte libre : « 140 cm », « 280 cm »…).
	laize: text().default(''),
	prixAchat: real("prix_achat"),
	prixVente: real("prix_vente"),
	unite: text().default('ml'),
	// Libellé forcé pour EBP (colonne « Libelé »). Vide = calculé à l'export.
	libelle: text().default(''),
	// Code article EBP (colonne « réference »). Vide = on retombe sur reference.
	codeEbp: text("code_ebp").default(''),
	numEchantillon: text("num_echantillon").default(''),
	// Échantillon physiquement présent en magasin (nuancier boutique).
	enMagasin: boolean("en_magasin").default(true),
	commentaires: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.collectionId],
		foreignColumns: [collections.id],
		name: "catalogue_refs_collection_id_fkey"
	}).onDelete("cascade"),
]);

export const commandes = pgTable("commandes", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "commandes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	fournisseur: text().default(''),
	client: text().default(''),
	designation: text().default(''),
	reference: text().default(''),
	coloris: text().default(''),
	dateCde: text("date_cde"),
	qte: real(),
	qteNote: text("qte_note").default(''),
	unite: text().default('ml'),
	montant: real(),
	qteLivree: real("qte_livree"),
	dateLivraison: text("date_livraison"),
	controle: text().default(''),
	commentaires: text().default(''),
	// Suivi visuel : produit commandé / reçu (coches sur la fiche dossier).
	estCommande: boolean("est_commande").default(false),
	estRecu: boolean("est_recu").default(false),
	// Lien vers le hub dossiers (nullable) — résout les commandes fournisseur orphelines
	dossierId: bigint("dossier_id", { mode: "number" }),
}, (table) => [
	foreignKey({
		columns: [table.dossierId],
		foreignColumns: [dossiers.id],
		name: "commandes_dossier_id_fkey"
	}).onDelete("set null"),
]);

export const dossiers = pgTable("dossiers", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "dossiers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	nomDossier: text("nom_dossier").notNull(),
	clientNom: text("client_nom").default(''),
	adresse: text().default(''),
	telephone: text().default(''),
	email: text().default(''),
	statut: text().default('Nouveau').notNull(),
	flags: text().default('[]'),
	typeIntervention: text("type_intervention").default('Autre'),
	dateOuverture: text("date_ouverture"),
	etapeDevis: boolean("etape_devis").default(false),
	etapeCmde: boolean("etape_cmde").default(false),
	etapeAtelier: boolean("etape_atelier").default(false),
	etapePrint: boolean("etape_print").default(false),
	etapeRealise: boolean("etape_realise").default(false),
	lienDossierExterne: text("lien_dossier_externe").default(''),
	commentaires: text().default(''),
	heuresARealiser: real("heures_a_realiser").default(0),
	datePlanifiee: text("date_planifiee"),
	dateDevis: date("date_devis"),
	operateurId: bigint("operateur_id", { mode: "number" }),
	fichePdf: text("fiche_pdf"),
	// Dates de chantier (saisie manuelle) + lien vers l'événement Google Calendar.
	dateDebutChantier: text("date_debut_chantier"),
	dateFinChantier: text("date_fin_chantier"),
	googleEventId: text("google_event_id"),
	// Dates ponctuelles affichées sur le planning (point rouge/vert, carré jaune)
	// + lien vers leur événement Google Calendar respectif (all-day, 1 jour).
	dateEnlevementDepot: text("date_enlevement_depot"),
	dateLivraison: text("date_livraison"),
	datePriseDeCote: text("date_prise_de_cote"),
	// Heure (« HH:MM ») de chaque date ponctuelle pour l'événement Google Agenda.
	// Null = 07:00 par défaut.
	heureEnlevement: text("heure_enlevement"),
	heureLivraison: text("heure_livraison"),
	heurePriseCote: text("heure_prise_cote"),
	// Rappels de chaque date ponctuelle : minutes avant l'heure, séparées par des
	// virgules (ex : « 1440,0 » = veille + jour même). Null = veille + jour même.
	rappelsEnlevement: text("rappels_enlevement"),
	rappelsLivraison: text("rappels_livraison"),
	rappelsPriseCote: text("rappels_prise_cote"),
	googleEventIdEnlevement: text("google_event_id_enlevement"),
	googleEventIdLivraison: text("google_event_id_livraison"),
	googleEventIdPriseCote: text("google_event_id_prise_cote"),
	// Commentaire libre attaché à chaque date ponctuelle (saisi au clic droit
	// sur le planning, repris dans la description de l'événement Google Agenda).
	commentaireEnlevement: text("commentaire_enlevement").default(''),
	commentaireLivraison: text("commentaire_livraison").default(''),
	commentairePriseCote: text("commentaire_prise_cote").default(''),
	// Commentaire de la période de chantier (clic droit sur le planning).
	commentaireChantier: text("commentaire_chantier").default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.operateurId],
		foreignColumns: [operateurs.id],
		name: "dossiers_operateur_id_fkey"
	}).onDelete("set null"),
]);

export const heures = pgTable("heures", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "heures_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dossierId: bigint("dossier_id", { mode: "number" }),
	operateur: text().notNull(),
	date: text().notNull(),
	heuresPassees: real("heures_passees").notNull(),
	// typeTravail = PHASE transverse (Atelier / Pose / Bureau / Déplacement / SAV).
	typeTravail: text("type_travail").default('Atelier'),
	// Lien fiche ↔ heures : type de réalisation (Fauteuil, Double rideaux…) + nombre
	// de pièces. Vocabulaire partagé, voir lib/types-realisation.ts.
	typeRealisation: text("type_realisation"),
	nombre: real().default(1),
	description: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dossierId],
			foreignColumns: [dossiers.id],
			name: "heures_dossier_id_fkey"
		}).onDelete("cascade"),
]);

export const fichesAtelier = pgTable("fiches_atelier", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "fiches_atelier_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dossierId: bigint("dossier_id", { mode: "number" }),
	typeIntervention: text("type_intervention").notNull(),
	contenuJson: text("contenu_json").default('{}').notNull(),
	notesLibres: text("notes_libres").default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dossierId],
			foreignColumns: [dossiers.id],
			name: "fiches_atelier_dossier_id_fkey"
		}).onDelete("cascade"),
]);

export const tasks = pgTable("tasks", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "tasks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	titre: text().notNull(),
	type: text().default('dossiers'),
	statut: text().default('pending'),
	notes: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const interventionsRideaux = pgTable("interventions_rideaux", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "interventions_rideaux_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	client: text().notNull(),
	telephone: text().default(''),
	adresse: text().default(''),
	date: text().default(''),
	piecesJson: text("pieces_json").default('[]'),
	tissu: text().default(''),
	refTissu: text("ref_tissu").default(''),
	coloris: text().default(''),
	metrage: text().default(''),
	typeTete: text("type_tete").default(''),
	heures: text().default(''),
	notes: text().default(''),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dossierId: bigint("dossier_id", { mode: "number" }),
	materiauxJson: text("materiaux_json").default('[]'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dossierId],
			foreignColumns: [dossiers.id],
			name: "interventions_rideaux_dossier_id_fkey"
		}).onDelete("set null"),
]);

export const predevis = pgTable("predevis", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "predevis_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	reference: text().notNull(),
	statut: text().default('brouillon'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dossierId: bigint("dossier_id", { mode: "number" }),
	clientNom: text("client_nom").default(''),
	clientTel: text("client_tel").default(''),
	clientEmail: text("client_email").default(''),
	clientAdresse: text("client_adresse").default(''),
	description: text().default(''),
	typeIntervention: text("type_intervention").default('Tapisserie'),
	tapisserieOps: text("tapisserie_ops"),
	urgent: boolean().default(false),
	tissus: text(),
	fournitures: text(),
	heuresEstimees: real("heures_estimees").default(0),
	tauxHoraire: real("taux_horaire").default(55),
	forfaitPose: real("forfait_pose").default(0),
	kmDeplacement: real("km_deplacement").default(0),
	tarifKm: real("tarif_km").default(0.5),
	tauxTva: real("taux_tva").default(0.2),
	notes: text().default(''),
	totalHt: real("total_ht").default(0),
	totalTtc: real("total_ttc").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dossierId],
			foreignColumns: [dossiers.id],
			name: "predevis_dossier_id_fkey"
		}).onDelete("set null"),
]);

// Devis signés (PDF) rattachés à un dossier. Le fichier est stocké sur Vercel
// Blob ; la base ne conserve que l'URL publique et les métadonnées d'affichage
// (nom d'origine, taille, type). `pathname` sert à supprimer le blob.
export const devisSignes = pgTable("devis_signes", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "devis_signes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	dossierId: bigint("dossier_id", { mode: "number" }),
	nomFichier: text("nom_fichier").notNull(),
	url: text().notNull(),
	pathname: text().notNull(),
	taille: bigint({ mode: "number" }),
	contentType: text("content_type").default('application/pdf'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dossierId],
			foreignColumns: [dossiers.id],
			name: "devis_signes_dossier_id_fkey"
		}).onDelete("cascade"),
]);

// Liste gérée des opérateurs d'atelier (heures.operateur reste du texte).
export const operateurs = pgTable("operateurs", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "operateurs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	nom: text().notNull(),
	actif: boolean().default(true).notNull(),
	heuresSemaine: real("heures_semaine").default(35).notNull(),
	// est_dirigeant = EXCEPTION « hors pointage » : l'opérateur reste dans la
	// liste (il saisit des heures sur les dossiers) mais n'apparaît PAS dans le
	// Pointage (grille, compteur, congés). Cas de Stéphan (le dirigeant).
	estDirigeant: boolean("est_dirigeant").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("operateurs_nom_key").on(table.nom),
]);

// Pointage : une ligne par salarié et par jour. Distinct de `heures` (temps
// passé par dossier) pour ne pas fausser le Rapport des heures.
export const pointage = pgTable("pointage", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "pointage_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	operateur: text().notNull(),
	date: text().notNull(),
	heures: real().default(0),
	// Travail · Congé · Maladie · Férié · Récup · Repos
	type: text().default('Travail'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("pointage_operateur_date_key").on(table.operateur, table.date),
]);

// Demandes de congés : une ligne par PÉRIODE (début → fin) et par salarié.
// Distinct de `pointage` (jours réellement posés au jour le jour) : sert au
// planning prévisionnel des absences et au suivi des demandes (règle interne :
// à déposer au moins deux semaines avant le premier jour souhaité).
export const conges = pgTable("conges", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "conges_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	operateur: text().notNull(),
	dateDebut: text("date_debut").notNull(),
	dateFin: text("date_fin").notNull(),
	// Congé payé · Récupération · Sans solde · Autre
	type: text().default('Congé payé'),
	// Demandé · Validé · Refusé
	statut: text().default('Demandé'),
	commentaire: text().default(''),
	// Lien vers l'événement Google Agenda (all-day, couleur par opérateur ;
	// fermeture atelier en rouge). Null tant que la synchro n'a pas tourné.
	googleEventId: text("google_event_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
