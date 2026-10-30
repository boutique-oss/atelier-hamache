-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "fournisseurs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fournisseurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nom" text NOT NULL,
	"url_site" text DEFAULT '',
	"contact" text DEFAULT '',
	"commentaires" text DEFAULT '',
	CONSTRAINT "fournisseurs_nom_key" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "commandes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commandes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fournisseur" text DEFAULT '',
	"client" text DEFAULT '',
	"designation" text DEFAULT '',
	"reference" text DEFAULT '',
	"coloris" text DEFAULT '',
	"date_cde" text,
	"qte" real,
	"qte_note" text DEFAULT '',
	"unite" text DEFAULT 'ml',
	"montant" real,
	"qte_livree" real,
	"date_livraison" text,
	"controle" text DEFAULT '',
	"commentaires" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dossiers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nom_dossier" text NOT NULL,
	"client_nom" text DEFAULT '',
	"adresse" text DEFAULT '',
	"telephone" text DEFAULT '',
	"email" text DEFAULT '',
	"statut" text DEFAULT 'Nouveau' NOT NULL,
	"flags" text DEFAULT '[]',
	"type_intervention" text DEFAULT 'Autre',
	"date_ouverture" text,
	"etape_devis" boolean DEFAULT false,
	"etape_cmde" boolean DEFAULT false,
	"etape_atelier" boolean DEFAULT false,
	"etape_print" boolean DEFAULT false,
	"etape_realise" boolean DEFAULT false,
	"lien_dossier_externe" text DEFAULT '',
	"commentaires" text DEFAULT '',
	"heures_a_realiser" real DEFAULT 0,
	"date_planifiee" text,
	"fiche_pdf" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "heures" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "heures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"dossier_id" bigint,
	"operateur" text NOT NULL,
	"date" text NOT NULL,
	"heures_passees" real NOT NULL,
	"type_travail" text DEFAULT 'Atelier',
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fiches_atelier" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiches_atelier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"dossier_id" bigint,
	"type_intervention" text NOT NULL,
	"contenu_json" text DEFAULT '{}' NOT NULL,
	"notes_libres" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"titre" text NOT NULL,
	"type" text DEFAULT 'dossiers',
	"statut" text DEFAULT 'pending',
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interventions_rideaux" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interventions_rideaux_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"client" text NOT NULL,
	"telephone" text DEFAULT '',
	"adresse" text DEFAULT '',
	"date" text DEFAULT '',
	"pieces_json" text DEFAULT '[]',
	"tissu" text DEFAULT '',
	"ref_tissu" text DEFAULT '',
	"coloris" text DEFAULT '',
	"metrage" text DEFAULT '',
	"type_tete" text DEFAULT '',
	"heures" text DEFAULT '',
	"notes" text DEFAULT '',
	"dossier_id" bigint,
	"materiaux_json" text DEFAULT '[]',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "predevis" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "predevis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"reference" text NOT NULL,
	"statut" text DEFAULT 'brouillon',
	"dossier_id" bigint,
	"client_nom" text DEFAULT '',
	"client_tel" text DEFAULT '',
	"client_email" text DEFAULT '',
	"client_adresse" text DEFAULT '',
	"description" text DEFAULT '',
	"type_intervention" text DEFAULT 'Tapisserie',
	"tapisserie_ops" text,
	"urgent" boolean DEFAULT false,
	"tissus" text,
	"fournitures" text,
	"heures_estimees" real DEFAULT 0,
	"taux_horaire" real DEFAULT 55,
	"forfait_pose" real DEFAULT 0,
	"km_deplacement" real DEFAULT 0,
	"tarif_km" real DEFAULT 0.5,
	"taux_tva" real DEFAULT 0.2,
	"notes" text DEFAULT '',
	"total_ht" real DEFAULT 0,
	"total_ttc" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "heures" ADD CONSTRAINT "heures_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiches_atelier" ADD CONSTRAINT "fiches_atelier_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions_rideaux" ADD CONSTRAINT "interventions_rideaux_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predevis" ADD CONSTRAINT "predevis_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE set null ON UPDATE no action;
*/