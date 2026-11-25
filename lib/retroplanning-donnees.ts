// Données du rétroplanning (opérateurs, dossiers en cours, absences), lues
// en base. Partagé par la page Planning et par l'import Excel des étapes.
import { and, asc, eq, gt, notInArray, sql as dsql } from "drizzle-orm";

import { db } from "@/db";
import { commandes, dossiers, heures, operateurs } from "@/db/schema";
import { estFermeture } from "@/lib/conges-const";
import { chargerConges } from "@/lib/pointage";
import { listerOperateursExclus } from "@/lib/retroplanning-db";
import { estIso, type Absence, type DossierRetro, type OperateurRetro } from "@/lib/retroplanning";

// Statuts sortis du rétroplanning (terminés ou abandonnés).
export const EXCLUS_RETRO = ["Clos", "Perdu"];

const plusTot = (...dates: (string | null | undefined)[]) =>
  dates.filter(estIso).sort()[0] ?? null;

export async function chargerDonneesRetro(): Promise<{
  ops: OperateurRetro[];
  dossiersRetro: DossierRetro[];
  absences: Absence[];
  // Opérateurs actifs retirés du rétroplanning (pour pouvoir les remettre).
  retires: OperateurRetro[];
}> {
  const [opsTous, dossiersDb, heuresDb, commandesDb, conges, exclus] = await Promise.all([
    db
      .select({ id: operateurs.id, nom: operateurs.nom, heuresSemaine: operateurs.heuresSemaine })
      .from(operateurs)
      .where(and(eq(operateurs.actif, true), gt(operateurs.heuresSemaine, 0)))
      .orderBy(asc(operateurs.nom)),
    db
      .select({
        id: dossiers.id,
        nom: dossiers.nomDossier,
        client: dossiers.clientNom,
        type: dossiers.typeIntervention,
        statut: dossiers.statut,
        operateurId: dossiers.operateurId,
        dateLivraison: dossiers.dateLivraison,
        debutChantier: dossiers.dateDebutChantier,
        finChantier: dossiers.dateFinChantier,
        datePlanifiee: dossiers.datePlanifiee,
        priseDeCote: dossiers.datePriseDeCote,
        heuresARealiser: dossiers.heuresARealiser,
        etapeDevis: dossiers.etapeDevis,
        etapeCmde: dossiers.etapeCmde,
        etapeAtelier: dossiers.etapeAtelier,
        etapeRealise: dossiers.etapeRealise,
      })
      .from(dossiers)
      .where(notInArray(dossiers.statut, EXCLUS_RETRO)),
    // Heures d'atelier déjà passées par dossier (déduites du reste à faire).
    db
      .select({
        dossierId: heures.dossierId,
        total: dsql<number>`coalesce(sum(${heures.heuresPassees}), 0)`,
      })
      .from(heures)
      .where(dsql`coalesce(${heures.typeTravail}, 'Atelier') = 'Atelier'`)
      .groupBy(heures.dossierId),
    db
      .select({
        dossierId: commandes.dossierId,
        total: dsql<number>`count(*)`,
        commandees: dsql<number>`count(*) filter (where ${commandes.estCommande} or ${commandes.estRecu})`,
        recues: dsql<number>`count(*) filter (where ${commandes.estRecu})`,
      })
      .from(commandes)
      .groupBy(commandes.dossierId),
    chargerConges(),
    listerOperateursExclus().catch((e) => {
      console.error("listerOperateursExclus", e);
      return new Set<number>();
    }),
  ]);
  const opsDb = opsTous.filter((o) => !exclus.has(Number(o.id)));

  const passees = new Map(heuresDb.map((h) => [Number(h.dossierId), Number(h.total) || 0]));
  const cdes = new Map(
    commandesDb.map((c) => [
      Number(c.dossierId),
      { total: Number(c.total), commandees: Number(c.commandees), recues: Number(c.recues) },
    ])
  );

  const ops: OperateurRetro[] = opsDb.map((o) => ({
    id: Number(o.id),
    nom: o.nom,
    heuresSemaine: Number(o.heuresSemaine) || 0,
  }));

  const dossiersRetro: DossierRetro[] = dossiersDb.map((d) => ({
    id: Number(d.id),
    nom: d.nom,
    client: d.client ?? "",
    type: d.type ?? "Autre",
    statut: d.statut,
    // Opérateur retiré du rétroplanning : confection proposée sans opérateur.
    operateurId: d.operateurId == null || exclus.has(Number(d.operateurId)) ? null : Number(d.operateurId),
    // Échéance = la première date où le travail doit être prêt.
    echeance: plusTot(d.dateLivraison, d.debutChantier) ?? (estIso(d.datePlanifiee) ? d.datePlanifiee : null),
    finChantier: d.finChantier,
    priseDeCote: d.priseDeCote,
    heuresReste: Math.max(0, (Number(d.heuresARealiser) || 0) - (passees.get(Number(d.id)) ?? 0)),
    etapeDevis: !!d.etapeDevis,
    etapeCmde: !!d.etapeCmde,
    etapeAtelier: !!d.etapeAtelier,
    etapeRealise: !!d.etapeRealise,
    commandes: cdes.get(Number(d.id)) ?? { total: 0, commandees: 0, recues: 0 },
  }));

  const absences: Absence[] = conges
    .filter((c) => c.statut === "Validé")
    .map((c) => ({ operateur: estFermeture(c) ? null : c.operateur, debut: c.dateDebut, fin: c.dateFin }));

  const retires: OperateurRetro[] = opsTous
    .filter((o) => exclus.has(Number(o.id)))
    .map((o) => ({ id: Number(o.id), nom: o.nom, heuresSemaine: Number(o.heuresSemaine) || 0 }));

  return { ops, dossiersRetro, absences, retires };
}
