import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PeriodeNav } from "@/components/retroplanning/periode-nav";
import { RetroplanningImport } from "@/components/retroplanning/retroplanning-import";
import { RetroplanningVue } from "@/components/retroplanning/retroplanning-vue";
import { statutsEnBase } from "@/lib/dossiers";
import {
  Calendrier,
  estIso,
  proposerEtapes,
  type Vue,
} from "@/lib/retroplanning";
import { listerEtapes } from "@/lib/retroplanning-db";
import { chargerDonneesRetro } from "@/lib/retroplanning-donnees";

export const dynamic = "force-dynamic";

// Statuts « engagés » : un dossier sans échéance y est signalé « à dater ».
const ENGAGES = new Set(["Devis signé / Validé", "En atelier", "Prêt à poser", "SAV"]);

const aujourdhuiParis = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: { vue?: string; date?: string };
}) {
  const today = aujourdhuiParis();
  const vue: Vue =
    searchParams.vue === "jour" || searchParams.vue === "semaine" ? searchParams.vue : "mois";
  const ref = estIso(searchParams.date) ? searchParams.date : today;

  const { ops, dossiersRetro, absences, retires } = await chargerDonneesRetro();

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

  // Liste « Dossier » du modèle Excel : dossiers en atelier ou devis signé.
  const statutsModele = [...statutsEnBase("En atelier"), ...statutsEnBase("Devis signé / Validé")];
  const dossiersModele = dossiersRetro
    .filter((d) => statutsModele.includes(d.statut))
    .map((d) => d.nom)
    .sort((a, b) => a.localeCompare(b, "fr"));
  // Empreinte des étapes enregistrées : après un import, le Gantt est
  // remonté avec les nouvelles données (ses propres modifications, elles,
  // ne rechargent pas la page).
  let h = 0;
  for (const e of enregistrees) {
    for (const c of `${e.id}${e.debut}${e.fin}${e.heures}${e.fait}`) h = (h * 31 + c.charCodeAt(0)) | 0;
  }
  const empreinte = `${enregistrees.length}-${h}`;

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
        key={`${vue}|${ref}|${empreinte}`}
        vue={vue}
        refDate={ref}
        today={today}
        ops={ops}
        retires={retires}
        absences={absences}
        dossiers={dossiersAffiches}
        etapesInitiales={etapes}
        nonTenus={Object.fromEntries(nonTenus)}
      />

      {/* Import en masse depuis un fichier Excel / CSV (replié par défaut) */}
      <details className="mt-6 rounded-xl border">
        <summary className="cursor-pointer select-none bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Importer le rétroplanning
          <span className="ml-2 font-normal text-muted-foreground">
            Fichier Excel ou CSV — une ligne par étape
          </span>
        </summary>
        <RetroplanningImport dossiers={dossiersModele} operateurs={ops.map((o) => o.nom)} />
      </details>

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
