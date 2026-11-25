import { and, asc, eq, gt, notInArray, sql as dsql } from "drizzle-orm";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { db } from "@/db";
import { commandes, dossiers, heures, operateurs } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { PeriodeNav } from "@/components/retroplanning/periode-nav";
import { RetroplanningVue } from "@/components/retroplanning/retroplanning-vue";
import { estFermeture } from "@/lib/conges-const";
import { chargerConges } from "@/lib/pointage";
import {
  Calendrier,
  estIso,
  proposerEtapes,
  type Absence,
  type DossierRetro,
  type OperateurRetro,
  type Vue,
} from "@/lib/retroplanning";
import { listerEtapes } from "@/lib/retroplanning-db";

export const dynamic = "force-dynamic";

// Statuts sortis du rétroplanning (terminés ou abandonnés).
const EXCLUS = ["Clos", "Perdu"];
// Statuts « engagés » : un dossier sans échéance y est signalé « à dater ».
const ENGAGES = new Set(["Devis signé / Validé", "En atelier", "Prêt à poser", "SAV"]);

const aujourdhuiParis = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

const plusTot = (...dates: (string | null | undefined)[]) =>
  dates.filter(estIso).sort()[0] ?? null;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: { vue?: string; date?: string };
}) {
  const today = aujourdhuiParis();
  const vue: Vue =
    searchParams.vue === "jour" || searchParams.vue === "semaine" ? searchParams.vue : "mois";
  const ref = estIso(searchParams.date) ? searchParams.date : today;

  const [opsDb, dossiersDb, heuresDb, commandesDb, conges] = await Promise.all([
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
      .where(notInArray(dossiers.statut, EXCLUS)),
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
  ]);

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
    operateurId: d.operateurId == null ? null : Number(d.operateurId),
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

  let enregistrees: Awaited<ReturnType<typeof listerEtapes>> = [];
  let erreurTable = false;
  try {
    enregistrees = await listerEtapes(dossiersRetro.map((d) => d.id));
  } catch (e) {
    console.error("listerEtapes", e);
    erreurTable = true;
  }
  const cal = new Calendrier(ops, absences);
  const { etapes: proposees, nonTenus } = proposerEtapes(dossiersRetro, enregistrees, cal, today);
  const etapes = [...enregistrees, ...proposees];

  const planifies = new Set(etapes.map((e) => e.dossierId));
  const aDater = dossiersRetro.filter((d) => !planifies.has(d.id) && ENGAGES.has(d.statut));
  const dossiersAffiches = dossiersRetro.filter((d) => planifies.has(d.id));

  // Navigation : période précédente / suivante.
  return (
    <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
      <PageHeader
        className="mb-4"
        icon={CalendarRange}
        tint="var(--brand-green)"
        title="Rétroplanning atelier"
        subtitle="Calculé à rebours depuis la pose ou la livraison. Glissez, étirez ou double-cliquez une étape pour l'ajuster."
      />

      <PeriodeNav vue={vue} refDate={ref} today={today} />

      {erreurTable && (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          Les ajustements enregistrés n&apos;ont pas pu être lus : seul le calcul automatique est affiché.
        </p>
      )}

      <RetroplanningVue
        key={`${vue}|${ref}`}
        vue={vue}
        refDate={ref}
        today={today}
        ops={ops}
        absences={absences}
        dossiers={dossiersAffiches}
        etapesInitiales={etapes}
        nonTenus={Object.fromEntries(nonTenus)}
      />

      {aDater.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">
            À dater ({aDater.length}) — dossiers engagés sans date de livraison ni de chantier
          </h3>
          <ul className="flex flex-wrap gap-2">
            {aDater.map((d) => (
              <li key={d.id}>
                <Link href={`/dossiers/${d.id}`} className="inline-block rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
                  {d.nom}
                  <span className="ml-1.5 text-muted-foreground">{d.statut}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
