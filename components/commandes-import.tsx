"use client";

import { importCommandes, type LigneImport } from "@/app/commandes/actions";
import { TableurImport, type ChampImport } from "@/components/tableur-import";

const s = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const CHAMPS: ChampImport[] = [
  { key: "fournisseur", label: "Fournisseur", alias: ["fournisseur", "fourn", "frs", "supplier"], exemple: "Casal" },
  { key: "designation", label: "Désignation", alias: ["designation", "libelle", "article", "produit", "description"], exemple: "Velours Mohair" },
  { key: "reference", label: "Référence", alias: ["reference", "ref", "refarticle", "codearticle"], exemple: "REF-1234" },
  { key: "coloris", label: "Coloris", alias: ["coloris", "couleur", "color"], exemple: "Bleu nuit" },
  { key: "qte", label: "Qté", alias: ["qte", "quantite", "qty", "qt"], exemple: "4,5" },
  { key: "unite", label: "Unité", alias: ["unite", "u", "unit"], exemple: "ml" },
  { key: "montant", label: "Montant €", alias: ["montant", "prix", "total", "montantht", "prixht", "totalht"], kind: "montant", exemple: "180" },
  { key: "dateCde", label: "Date cde", alias: ["datecde", "datecommande", "date", "datedecommande"], kind: "date", exemple: "2026-10-15" },
  { key: "dateLivraison", label: "Date livraison", alias: ["datelivraison", "livraison", "datedelivraison"], kind: "date" },
  { key: "client", label: "Client", alias: ["client", "nomclient"], exemple: "Mme Dupont" },
  { key: "dossier", label: "Dossier (n° ou nom)", alias: ["dossier", "nomdossier", "chantier", "ndossier", "numdossier"], stricte: true },
  { key: "commentaires", label: "Commentaires", alias: ["commentaires", "commentaire", "remarque", "remarques", "notes", "note"] },
  { key: "estCommande", label: "Commandé (oui/non)", alias: ["commande", "estcommande"], kind: "bool", exemple: "oui" },
  { key: "estRecu", label: "Reçu (oui/non)", alias: ["recu", "estrecu", "livre"], kind: "bool", exemple: "non" },
];

// Import CSV / Excel des commandes (Rapport des commandes).
// `listes` : valeurs des listes déroulantes du modèle Excel, par champ
// (fournisseurs, unités, dossiers…), fournies par la page serveur.
export function CommandesImport({
  listes = {},
}: {
  listes?: Partial<Record<string, string[]>>;
}) {
  return (
    <TableurImport
      champs={CHAMPS.map((c) => ({ ...c, liste: listes[c.key] ?? c.liste }))}
      libelle="commande"
      nomModele="modele-import-commandes.xlsx"
      aide="Sans coche « Commandé », les lignes arrivent dans « À commander ». Le catalogue fournisseur est alimenté comme pour une saisie manuelle."
      estValide={(l) => !!(l.fournisseur || l.designation)}
      onImport={async (lignes) => {
        const res = await importCommandes(lignes as LigneImport[]);
        if (!res.ok)
          return {
            ok: false,
            msg: "Aucune ligne importée : il faut au moins un fournisseur ou une désignation par ligne.",
          };
        const plus = [
          res.rattachees ? `${res.rattachees} rattachée(s) à un dossier` : "",
          res.ignorees ? `${s(res.ignorees, "ligne")} ignorée(s) (ni fournisseur ni désignation)` : "",
        ].filter(Boolean);
        return {
          ok: true,
          msg: `✓ ${s(res.importees, "commande")} importée(s)${plus.length ? ` · ${plus.join(" · ")}` : ""}.`,
        };
      }}
    />
  );
}
