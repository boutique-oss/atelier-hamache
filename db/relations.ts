import { relations } from "drizzle-orm/relations";
import { dossiers, heures, fichesAtelier, interventionsRideaux, predevis, commandes, devisSignes, fournisseurs, collections, catalogueRefs } from "./schema";

// Catalogue : fournisseur → collections → références.
export const fournisseursRelations = relations(fournisseurs, ({many}) => ({
	collections: many(collections),
}));

export const collectionsRelations = relations(collections, ({one, many}) => ({
	fournisseur: one(fournisseurs, {
		fields: [collections.fournisseurId],
		references: [fournisseurs.id]
	}),
	refs: many(catalogueRefs),
}));

export const catalogueRefsRelations = relations(catalogueRefs, ({one}) => ({
	collection: one(collections, {
		fields: [catalogueRefs.collectionId],
		references: [collections.id]
	}),
}));

export const heuresRelations = relations(heures, ({one}) => ({
	dossier: one(dossiers, {
		fields: [heures.dossierId],
		references: [dossiers.id]
	}),
}));

// Commandes fournisseur rattachées au dossier (lien ajouté après coup)
export const commandesRelations = relations(commandes, ({one}) => ({
	dossier: one(dossiers, {
		fields: [commandes.dossierId],
		references: [dossiers.id]
	}),
}));

export const dossiersRelations = relations(dossiers, ({many}) => ({
	heures: many(heures),
	fichesAteliers: many(fichesAtelier),
	interventionsRideaux: many(interventionsRideaux),
	predevis: many(predevis),
	commandes: many(commandes),
	devisSignes: many(devisSignes),
}));

export const devisSignesRelations = relations(devisSignes, ({one}) => ({
	dossier: one(dossiers, {
		fields: [devisSignes.dossierId],
		references: [dossiers.id]
	}),
}));

export const fichesAtelierRelations = relations(fichesAtelier, ({one}) => ({
	dossier: one(dossiers, {
		fields: [fichesAtelier.dossierId],
		references: [dossiers.id]
	}),
}));

export const interventionsRideauxRelations = relations(interventionsRideaux, ({one}) => ({
	dossier: one(dossiers, {
		fields: [interventionsRideaux.dossierId],
		references: [dossiers.id]
	}),
}));

export const predevisRelations = relations(predevis, ({one}) => ({
	dossier: one(dossiers, {
		fields: [predevis.dossierId],
		references: [dossiers.id]
	}),
}));