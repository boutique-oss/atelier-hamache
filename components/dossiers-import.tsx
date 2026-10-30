"use client";

import { importDossiers, type LigneDossierImport } from "@/app/(main)/dossiers/actions";
import { TableurImport, type ChampImport } from "@/components/tableur-import";
import { STATUTS_DOSSIER, TYPES_INTERVENTION } from "@/lib/dossiers";

const s = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const CHAMPS: ChampImport[] = [
  { key: "nomDossier", label: "Nom du dossier", alias: ["nomdossier", "dossier", "nom", "chantier", "projet", "intitule"], exemple: "Dupont — fauteuil Voltaire" },
  { key: "clientNom", label: "Client", alias: ["client", "clientnom", "nomclient"], exemple: "Mme Dupont" },
  { key: "telephone", label: "Téléphone", alias: ["telephone", "tel", "portable", "mobile", "phone"], exemple: "06 12 34 56 78" },
  { key: "email", label: "E-mail", alias: ["email", "mail", "courriel", "adressemail"], exemple: "dupont@exemple.fr" },
  { key: "adresse", label: "Adresse", alias: ["adresse", "adressepostale", "ville", "address"], exemple: "12 rue des Arts, Poitiers" },
  { key: "typeIntervention", label: "Type (Tapisserie, Rideaux…)", alias: ["type", "typeintervention", "intervention", "metier"], exemple: "Tapisserie", liste: [...TYPES_INTERVENTION], stricte: true },
  { key: "sousType", label: "Sous-type", alias: ["soustype", "typerealisation", "realisation", "meuble"], exemple: "Fauteuil" },
  { key: "placesAssises", label: "Places assises", alias: ["places", "placesassises", "nbplaces"], exemple: "1" },
  { key: "statut", label: "Statut", alias: ["statut", "etat", "status"], exemple: "Nouveau", liste: [...STATUTS_DOSSIER], stricte: true },
  { key: "dateOuverture", label: "Date d'ouverture", alias: ["dateouverture", "date", "ouverture", "datecreation"], kind: "date", exemple: "2026-10-15" },
  { key: "dateDevis", label: "Date devis", alias: ["datedevis", "devis"], kind: "date" },
  { key: "datePriseDeCote", label: "Prise de cote", alias: ["dateprisedecote", "prisedecote", "prisecote", "datecote"], kind: "date" },
  { key: "dateEnlevementDepot", label: "Enlèvement / dépôt", alias: ["dateenlevementdepot", "enlevement", "depot", "enlevementdepot", "dateenlevement"], kind: "date" },
  { key: "dateLivraison", label: "Livraison", alias: ["datelivraison", "livraison"], kind: "date" },
  { key: "heuresARealiser", label: "Heures à réaliser", alias: ["heures", "heuresarealiser", "heuresprevues", "temps", "h"], exemple: "8" },
  { key: "lienDossierExterne", label: "Lien externe", alias: ["lien", "liendossierexterne", "url", "lienexterne"] },
  { key: "commentaires", label: "Commentaires", alias: ["commentaires", "commentaire", "remarque", "remarques", "notes", "note"] },
];

// Import CSV / Excel des dossiers (liste des dossiers).
// `listes` : valeurs supplémentaires des listes déroulantes du modèle Excel
// (sous-types connus), fournies par la page serveur.
export function DossiersImport({
  listes = {},
}: {
  listes?: Partial<Record<string, string[]>>;
}) {
  return (
    <TableurImport
      champs={CHAMPS.map((c) => ({ ...c, liste: listes[c.key] ?? c.liste }))}
      libelle="dossier"
      nomModele="modele-import-dossiers.xlsx"
      aide="Un dossier dont le nom existe déjà est sauté (pas de doublon). Seules les dates à venir sont envoyées dans Google Agenda."
      estValide={(l) => !!(l.nomDossier || l.clientNom)}
      onImport={async (lignes) => {
        const res = await importDossiers(lignes as LigneDossierImport[]);
        const plus = [
          res.doublons ? `${s(res.doublons, "doublon")} sauté(s)` : "",
          res.ignores ? `${s(res.ignores, "ligne")} sans nom ignorée(s)` : "",
          res.erreurs ? `${s(res.erreurs, "erreur")}` : "",
        ].filter(Boolean);
        if (!res.ok)
          return {
            ok: false,
            msg: `Aucun dossier importé${plus.length ? ` (${plus.join(" · ")})` : ""}.`,
          };
        return {
          ok: true,
          msg: `✓ ${s(res.importes, "dossier")} importé(s)${plus.length ? ` · ${plus.join(" · ")}` : ""}.`,
        };
      }}
    />
  );
}
