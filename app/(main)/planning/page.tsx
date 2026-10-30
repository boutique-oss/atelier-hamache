import { asc, desc, eq, isNotNull, or } from "drizzle-orm";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { db } from "@/db";
import { dossiers, operateurs } from "@/db/schema";
import {
  PlanningBoard,
  type ChantierPlanning,
  type CongePlanning,
  type ItemPlanning,
} from "@/components/planning-board";
import {
  LegendeTypesPerso,
  NouvelleEntreeButton,
  PlanningDossiersProvider,
} from "@/components/planning-entree";
import { ActiverNotifications } from "@/components/rappels-notifier";
import { PageHeader } from "@/components/page-header";
import { chargerConges } from "@/lib/pointage";
import { estFermeture } from "@/lib/conges-const";
import { listerEntrees, listerTypesIntervention } from "@/lib/planning-entrees-db";
import { clePerso } from "@/lib/types-intervention";

// Teinte de congé par opérateur (même logique que le calendrier du Pointage).
const CONGE_PALETTE = [
  "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-fuchsia-500",
];

// Fenêtre chargée autour du jour central (comme useKanbanDates d'Open
// Sunsama : 7 jours visibles + 14 de marge de chaque côté) ; le tableau
// recharge une fenêtre recentrée quand on défile près d'un bord.
const BUFFER_DAYS = 14;
const TOTAL_DAYS = 7 + BUFFER_DAYS * 2;

export const dynamic = "force-dynamic";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Aujourd'hui à Paris, quel que soit le fuseau du serveur.
const aujourdhuiParis = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: { centre?: string };
}) {
  const today = aujourdhuiParis();
  const centre = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.centre ?? "")
    ? searchParams.centre!
    : today;
  const debut = addDays(centre, -BUFFER_DAYS);
  const fin = addDays(debut, TOTAL_DAYS - 1);
  const jours = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(debut, i));

  // Chantiers (semaine saisie sur la fiche).
  const chantiersDb = await db
    .select({
      id: dossiers.id,
      nom: dossiers.nomDossier,
      client: dossiers.clientNom,
      debut: dossiers.dateDebutChantier,
      fin: dossiers.dateFinChantier,
      comment: dossiers.commentaireChantier,
    })
    .from(dossiers)
    .where(isNotNull(dossiers.dateDebutChantier));
  const chantiers: ChantierPlanning[] = chantiersDb
    .filter((c) => c.debut && c.debut <= fin && (c.fin || c.debut) >= debut)
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      client: c.client,
      debut: c.debut!,
      fin: c.fin || c.debut!,
      comment: c.comment ?? "",
    }));

  // Dates ponctuelles (enlèvement/dépôt, livraison, prise de cote).
  const evenements = await db
    .select({
      id: dossiers.id,
      nom: dossiers.nomDossier,
      client: dossiers.clientNom,
      dateEnlevementDepot: dossiers.dateEnlevementDepot,
      dateLivraison: dossiers.dateLivraison,
      datePriseDeCote: dossiers.datePriseDeCote,
      commentaireEnlevement: dossiers.commentaireEnlevement,
      commentaireLivraison: dossiers.commentaireLivraison,
      commentairePriseCote: dossiers.commentairePriseCote,
      heureEnlevement: dossiers.heureEnlevement,
      heureLivraison: dossiers.heureLivraison,
      heurePriseCote: dossiers.heurePriseCote,
      rappelsEnlevement: dossiers.rappelsEnlevement,
      rappelsLivraison: dossiers.rappelsLivraison,
      rappelsPriseCote: dossiers.rappelsPriseCote,
    })
    .from(dossiers)
    .where(
      or(
        isNotNull(dossiers.dateEnlevementDepot),
        isNotNull(dossiers.dateLivraison),
        isNotNull(dossiers.datePriseDeCote)
      )
    );

  const items: ItemPlanning[] = [];
  for (const e of evenements) {
    const base = { id: e.id, nom: e.nom, client: e.client };
    const ajouter = (
      field: ItemPlanning["field"],
      date: string | null,
      heure: string | null,
      rappels: string | null,
      comment: string | null
    ) => {
      if (date && date >= debut && date <= fin)
        items.push({ ...base, field, date, heure: heure ?? "", rappels: rappels ?? "", comment: comment ?? "" });
    };
    ajouter("dateEnlevementDepot", e.dateEnlevementDepot, e.heureEnlevement, e.rappelsEnlevement, e.commentaireEnlevement);
    ajouter("dateLivraison", e.dateLivraison, e.heureLivraison, e.rappelsLivraison, e.commentaireLivraison);
    ajouter("datePriseDeCote", e.datePriseDeCote, e.heurePriseCote, e.rappelsPriseCote, e.commentairePriseCote);
  }

  // Types d'intervention ajoutés + leurs entrées.
  const typesPerso = await listerTypesIntervention();
  for (const e of await listerEntrees(debut, fin)) {
    items.push({
      id: e.dossierId, nom: e.nom, client: null, field: clePerso(e.typeId),
      entreeId: e.id, date: e.date, heure: e.heure, rappels: e.rappels, comment: e.comment,
    });
  }

  // Congés validés ou demandés (les refusés sont ignorés) + couleur par opérateur.
  const opsActifs = await db
    .select({ nom: operateurs.nom })
    .from(operateurs)
    .where(eq(operateurs.actif, true))
    .orderBy(asc(operateurs.nom));
  const couleurConge = new Map<string, string>();
  opsActifs.forEach((o, i) => couleurConge.set(o.nom, CONGE_PALETTE[i % CONGE_PALETTE.length]));
  const conges: CongePlanning[] = (await chargerConges())
    .filter((c) => c.statut !== "Refusé" && c.dateDebut <= fin && c.dateFin >= debut)
    .map((c) => ({
      id: c.id,
      operateur: c.operateur,
      type: c.type,
      valide: c.statut === "Validé",
      fermeture: estFermeture(c),
      debut: c.dateDebut,
      fin: c.dateFin,
      couleur: couleurConge.get(c.operateur) ?? "bg-violet-500",
    }));

  // Tous les dossiers proposés dans le widget d'entrée, récents d'abord.
  const choixDossiers = await db
    .select({
      id: dossiers.id,
      nom: dossiers.nomDossier,
      client: dossiers.clientNom,
      statut: dossiers.statut,
    })
    .from(dossiers)
    .orderBy(desc(dossiers.updatedAt));

  return (
    <PlanningDossiersProvider dossiers={choixDossiers} types={typesPerso}>
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
        <PageHeader
          className="mb-3"
          icon={CalendarRange}
          tint="var(--brand-green)"
          title="Planning atelier"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Legende cls="rounded-full bg-red-500" label="Enlèvement / dépôt" />
              <Legende cls="rounded-full bg-emerald-500" label="Livraison" />
              <Legende cls="rounded-[2px] bg-yellow-400" label="Prise de cote" />
              <Legende cls="rounded bg-sky-500" label="Chantier" />
              <Legende cls="rounded bg-rose-600" label="Fermé / congés" />
              <LegendeTypesPerso />
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ActiverNotifications />
              <Link href="/pointage" className="text-sm text-primary hover:underline">
                Gérer les congés →
              </Link>
              <NouvelleEntreeButton date={today} />
            </div>
          }
        />

        <PlanningBoard
          jours={jours}
          centre={centre}
          today={today}
          items={items}
          chantiers={chantiers}
          conges={conges}
        />
      </main>
    </PlanningDossiersProvider>
  );
}

function Legende({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 ${cls}`} />
      {label}
    </span>
  );
}
