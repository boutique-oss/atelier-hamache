"use server";

import { revalidatePath } from "next/cache";

import { randomUUID } from "node:crypto";

import { Calendrier, ETAPES, estIso, plusJours, proposerEtapes, type CodeEtape, type Etape } from "@/lib/retroplanning";
import {
  effacerEtapesDossier,
  etapeValide,
  listerEtapes,
  remplacerEtapesDossier,
  setOperateurExclu,
} from "@/lib/retroplanning-db";
import { chargerDonneesRetro } from "@/lib/retroplanning-donnees";
import { statutsEnBase } from "@/lib/dossiers";
import { parseNum } from "@/lib/utils";

// Enregistre toutes les étapes d'un dossier telles qu'affichées sur le Gantt
// (après un déplacement, un étirement, une édition, un ajout ou une suppression).
// Pas de revalidatePath : le navigateur garde déjà l'état à jour, et un
// rechargement réinitialiserait le Gantt pendant qu'on travaille dessus.
export async function enregistrerEtapesDossier(
  dossierId: number,
  etapes: Partial<Etape>[]
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const id = Number(dossierId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erreur: "Dossier invalide" };
  if (!Array.isArray(etapes) || etapes.length > 60) return { ok: false, erreur: "Étapes invalides" };
  const propres: Etape[] = [];
  for (const e of etapes) {
    const v = etapeValide(e, id);
    if (!v) return { ok: false, erreur: "Une étape a des dates invalides" };
    propres.push(v);
  }
  try {
    await remplacerEtapesDossier(id, propres);
    return { ok: true };
  } catch (e) {
    console.error("enregistrerEtapesDossier", e);
    return { ok: false, erreur: "Enregistrement impossible" };
  }
}

// Revient au calcul à rebours pour un dossier (efface ses ajustements).
export async function recalculerDossier(dossierId: number): Promise<{ ok: boolean }> {
  const id = Number(dossierId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  await effacerEtapesDossier(id);
  revalidatePath("/planning");
  return { ok: true };
}

// ── Import Excel / CSV du rétroplanning ───────────────────────────────────
// Une ligne = une étape d'un dossier. Pour chaque dossier, on part de ses
// étapes enregistrées, sinon de celles proposées par le calcul à rebours
// (pour ne pas les perdre), puis : une étape du même code est mise à jour,
// sinon l'étape est ajoutée. « Repartir de zéro » = oui efface d'abord les
// autres étapes du dossier.
export type LigneRetroImport = {
  dossier?: string;
  etape?: string;
  libelle?: string;
  commentaire?: string;
  debut?: string;
  fin?: string;
  operateur?: string;
  heures?: string;
  fait?: string;
  repartir?: boolean;
};

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Libellé ou code d'étape (« Confection atelier », « AT », « atelier »…) → code.
function codeEtape(brut: string): CodeEtape | null {
  const n = sansAccent(brut);
  if (!n) return null;
  for (const [code, label] of Object.entries(ETAPES) as [CodeEtape, string][]) {
    if (n === code.toLowerCase() || n === sansAccent(label)) return code;
  }
  const mots: [string, CodeEtape][] = [
    ["cote", "PC"], ["devis", "DV"], ["commande", "CM"], ["reception", "RM"],
    ["confection", "AT"], ["atelier", "AT"], ["pose", "PO"], ["livraison", "PO"],
  ];
  return mots.find(([m]) => n.includes(m))?.[1] ?? null;
}

const ecartJours = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export async function importRetroplanning(lignes: LigneRetroImport[]) {
  if (!Array.isArray(lignes) || lignes.length > 2000) {
    return { ok: false, etapes: 0, dossiers: 0, introuvables: [] as string[], ignores: 0, erreurs: 1 };
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const { ops, dossiersRetro, absences } = await chargerDonneesRetro();
  const parNom = new Map<string, number>();
  const parClient = new Map<string, number | null>();
  for (const d of dossiersRetro) {
    parNom.set(d.nom.trim().toLowerCase(), d.id);
    const c = d.client.trim().toLowerCase();
    if (c) parClient.set(c, parClient.has(c) ? null : d.id); // null = ambigu
  }
  const opParNom = new Map(ops.map((o) => [sansAccent(o.nom), o.id]));

  // Regroupe les lignes par dossier (dans l'ordre du fichier).
  const introuvables: string[] = [];
  let ignores = 0;
  const parDossier = new Map<number, LigneRetroImport[]>();
  for (const l of lignes) {
    const nom = (l.dossier ?? "").trim();
    if (!nom || !estIso(l.debut) || !codeEtape(l.etape ?? "")) {
      ignores++;
      continue;
    }
    const id = parNom.get(nom.toLowerCase()) ?? parClient.get(nom.toLowerCase()) ?? null;
    if (!id) {
      if (!introuvables.includes(nom)) introuvables.push(nom);
      continue;
    }
    parDossier.set(id, [...(parDossier.get(id) ?? []), l]);
  }

  // Étapes de départ : enregistrées, sinon proposées par le calcul.
  const enregistrees = await listerEtapes([...parDossier.keys()]);
  const cal = new Calendrier(ops, absences);
  const { etapes: proposees } = proposerEtapes(
    dossiersRetro.filter((d) => parDossier.has(d.id)),
    enregistrees,
    cal,
    today
  );

  let nbEtapes = 0;
  let nbDossiers = 0;
  let erreurs = 0;
  for (const [dossierId, ls] of parDossier) {
    const repartir = ls.some((l) => l.repartir);
    let base: Etape[] = repartir
      ? []
      : [
          ...enregistrees.filter((e) => e.dossierId === dossierId),
          ...proposees.filter((e) => e.dossierId === dossierId),
        ].map((e) => ({ ...e, propose: false }));
    const touchees = new Set<string>();
    let ordre = base.reduce((m, e) => Math.max(m, e.ordre), 0);

    for (const l of ls) {
      const code = codeEtape(l.etape ?? "")!;
      const debut = l.debut!;
      const heures = parseNum(l.heures ?? "");
      const opNom = sansAccent(l.operateur ?? "");
      const operateurId = opNom ? opParNom.get(opNom) ?? null : undefined;
      const fait = sansAccent(l.fait ?? "");
      const libelle = (l.libelle ?? "").trim();
      const commentaire = (l.commentaire ?? "").trim();

      const existante =
        code === "AU" ? undefined : base.find((e) => e.code === code && !touchees.has(e.id));
      if (existante) {
        // Sans date de fin : même durée qu'avant, décalée au nouveau début.
        const fin = estIso(l.fin) ? l.fin : plusJours(debut, Math.max(0, ecartJours(existante.debut, existante.fin)));
        base = base.map((e) =>
          e.id === existante.id
            ? {
                ...e,
                debut,
                fin,
                libelle: libelle || e.libelle,
                commentaire: commentaire || e.commentaire,
                operateurId: operateurId === undefined ? e.operateurId : operateurId,
                heures: heures ?? e.heures,
                fait: fait === "oui" ? true : fait === "non" ? false : e.fait,
              }
            : e
        );
        touchees.add(existante.id);
      } else {
        const e: Etape = {
          id: randomUUID(),
          dossierId,
          code,
          libelle: libelle || (code === "AU" ? "Autre" : ETAPES[code]),
          commentaire,
          operateurId: operateurId ?? null,
          debut,
          fin: estIso(l.fin) ? l.fin : debut,
          heures: heures ?? 0,
          fait: fait === "oui",
          ordre: ++ordre,
          propose: false,
        };
        base.push(e);
        touchees.add(e.id);
      }
      nbEtapes++;
    }

    const propres = base.map((e) => etapeValide(e, dossierId)).filter((e): e is Etape => !!e);
    try {
      await remplacerEtapesDossier(dossierId, propres.slice(0, 60));
      nbDossiers++;
    } catch (e) {
      console.error("importRetroplanning", dossierId, e);
      erreurs++;
    }
  }
  revalidatePath("/planning");
  return { ok: nbDossiers > 0, etapes: nbEtapes, dossiers: nbDossiers, introuvables, ignores, erreurs };
}

// Retire un opérateur du rétroplanning (exclu = true) ou l'y remet.
export async function basculerOperateurRetro(
  operateurId: number,
  exclu: boolean
): Promise<{ ok: boolean }> {
  const id = Number(operateurId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  try {
    await setOperateurExclu(id, !!exclu);
  } catch (e) {
    console.error("basculerOperateurRetro", e);
    return { ok: false };
  }
  revalidatePath("/planning");
  return { ok: true };
}

// Listes déroulantes du modèle Excel, relues au moment du téléchargement :
// dossiers En atelier / Devis signé (selon leur statut actuel) et opérateurs
// présents dans le rétroplanning.
export async function listesModeleRetro(): Promise<{ dossier: string[]; operateur: string[] }> {
  const { ops, dossiersRetro } = await chargerDonneesRetro();
  const statuts = [...statutsEnBase("En atelier"), ...statutsEnBase("Devis signé / Validé")];
  return {
    dossier: dossiersRetro
      .filter((d) => statuts.includes(d.statut))
      .map((d) => d.nom)
      .sort((a, b) => a.localeCompare(b, "fr")),
    operateur: ops.map((o) => o.nom),
  };
}
