"use client";

import { importRetroplanning, type LigneRetroImport } from "@/app/(main)/planning/actions";
import { TableurImport, type ChampImport } from "@/components/tableur-import";
import { ETAPES } from "@/lib/retroplanning";

const s = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// Import CSV / Excel du rétroplanning : une ligne = une étape d'un dossier.
// `dossiers` : dossiers en atelier ou devis signé (liste déroulante du modèle) ;
// `operateurs` : opérateurs actifs.
export function RetroplanningImport({
  dossiers,
  operateurs,
}: {
  dossiers: string[];
  operateurs: string[];
}) {
  const champs: ChampImport[] = [
    { key: "dossier", label: "Dossier", alias: ["dossier", "nomdossier", "nom", "client", "chantier", "projet"], liste: dossiers },
    { key: "etape", label: "Étape", alias: ["etape", "tache", "phase", "type", "intervention", "code"], liste: Object.values(ETAPES), stricte: true },
    { key: "libelle", label: "Libellé (facultatif)", alias: ["libelle", "intitule", "description", "detail"] },
    { key: "debut", label: "Début", alias: ["debut", "datedebut", "date", "du", "le"], kind: "date" },
    { key: "fin", label: "Fin", alias: ["fin", "datefin", "au", "jusquau", "echeance"], kind: "date" },
    { key: "operateur", label: "Opérateur", alias: ["operateur", "qui", "personne", "tapissier", "responsable"], liste: operateurs, stricte: true },
    { key: "heures", label: "Heures", alias: ["heures", "h", "temps", "duree", "heuresprevues"] },
    { key: "commentaire", label: "Commentaire", alias: ["commentaire", "commentaires", "remarque", "remarques", "note", "notes"] },
    { key: "fait", label: "Fait", alias: ["fait", "termine", "fini", "realise", "ok"], liste: ["oui", "non"], stricte: true },
    { key: "repartir", label: "Repartir de zéro", alias: ["repartirdezero", "repartir", "effacer", "remplacertout"], kind: "bool" },
  ];
  return (
    <TableurImport
      champs={champs}
      libelle="étape"
      nomModele="modele-import-retroplanning.xlsx"
      aide="Une étape du même type est mise à jour, sinon ajoutée ; les autres étapes du dossier sont gardées, sauf « Repartir de zéro » = oui. Fin vide = même durée qu'avant."
      estValide={(l) => !!(l.dossier && l.etape && l.debut)}
      onImport={async (lignes) => {
        const res = await importRetroplanning(lignes as LigneRetroImport[]);
        const plus = [
          res.introuvables.length
            ? `dossier introuvable ou clos : ${res.introuvables.slice(0, 3).join(", ")}${res.introuvables.length > 3 ? "…" : ""}`
            : "",
          res.ignores ? `${s(res.ignores, "ligne")} incomplète(s)` : "",
          res.erreurs ? s(res.erreurs, "erreur") : "",
        ].filter(Boolean);
        return {
          ok: res.ok,
          msg: res.ok
            ? `✓ ${s(res.etapes, "étape")} sur ${s(res.dossiers, "dossier")}${plus.length ? ` · ${plus.join(" · ")}` : ""}.`
            : `Rien d'importé${plus.length ? ` (${plus.join(" · ")})` : ""}.`,
        };
      }}
    />
  );
}
