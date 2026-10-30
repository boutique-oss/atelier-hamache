import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Clock, ClipboardList, Scale } from "lucide-react";

import { HeuresOperateursChart, PrevuReelChart } from "@/components/charts-lazy";
import { DashCard } from "@/components/dash-card";
import { RapportHeuresPdfBouton } from "@/components/rapport-heures-pdf-bouton";
import { SmallBox } from "@/components/small-box";
import type { Periode, RapportHeures } from "@/lib/documents-heures";
import { normalizeStatut, statutClasses } from "@/lib/dossiers";
import { cn } from "@/lib/utils";

// Rubrique « Rapports d'heures » de la page Documents : période (semaine ou
// mois) et dossier dans la colonne gauche ; indicateurs, graphiques et
// tableau prévu / réel à droite. Chaque dossier peut être exporté en PDF,
// rangé automatiquement dans ce dossier.

const champ =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm [@media(pointer:coarse)]:h-11";

const fmtH = (n: number) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")} h`;
const signe = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

export function lienHeures(p: { periode: string; ref: string; dossier: number | null }) {
  const s = new URLSearchParams({ rubrique: "heures", periode: p.periode, ref: p.ref });
  if (p.dossier) s.set("dossier", String(p.dossier));
  return `/documents?${s.toString()}`;
}

export function FiltresHeuresForm({
  periode,
  dossierId,
  dossiers,
}: {
  periode: Periode;
  dossierId: number | null;
  dossiers: { id: number; nom: string }[];
}) {
  return (
    <form className="space-y-3 rounded-lg border bg-card p-3" aria-label="Filtrer le rapport d'heures">
      <input type="hidden" name="rubrique" value="heures" />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Période</span>
        <select name="periode" defaultValue={periode.type} className={champ}>
          <option value="mois">Mois</option>
          <option value="semaine">Semaine</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Dossier</span>
        <select name="dossier" defaultValue={dossierId ?? ""} className={champ}>
          <option value="">Tous les dossiers</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 [@media(pointer:coarse)]:h-11"
        >
          Afficher
        </button>
        {(dossierId || periode.type !== "mois") && (
          <Link
            href="/documents?rubrique=heures"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground [@media(pointer:coarse)]:h-11"
          >
            Effacer
          </Link>
        )}
      </div>
    </form>
  );
}

export function RapportHeuresVue({
  periode,
  dossierId,
  rapport,
}: {
  periode: Periode;
  dossierId: number | null;
  rapport: RapportHeures;
}) {
  const { indicateurs: k, operateurs, dossiers } = rapport;
  const nav = (ref: string) => lienHeures({ periode: periode.type, ref, dossier: dossierId });
  const navBouton =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href={nav(periode.precedente)} className={navBouton} aria-label="Période précédente">
          <ChevronLeft size={16} aria-hidden />
        </Link>
        <h2 className="brand-display min-w-0 flex-1 text-center text-lg first-letter:uppercase sm:flex-none sm:px-2">
          {periode.libelle}
        </h2>
        <Link href={nav(periode.suivante)} className={navBouton} aria-label="Période suivante">
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SmallBox value={fmtH(k.pointees)} label="Heures pointées" icon={Clock} ton="primary" />
        <SmallBox value={fmtH(k.prevues)} label="Heures prévues (dossiers travaillés)" icon={BarChart3} ton="info" />
        <SmallBox
          value={k.prevues > 0 ? `${signe(k.ecart)}${fmtH(Math.abs(k.ecart))}` : "—"}
          label="Écart réel cumulé − prévu"
          icon={Scale}
          ton={k.ecart > 0 ? "danger" : "success"}
        />
        <SmallBox
          value={String(k.fichesASaisir)}
          label="Fiches navettes à saisir"
          icon={ClipboardList}
          ton={k.fichesASaisir > 0 ? "warning" : "navy"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DashCard title="Heures par opérateur" subtitle="sur la période">
          <HeuresOperateursChart data={operateurs} />
        </DashCard>
        <DashCard title="Prévu et réel par dossier" subtitle="réel cumulé depuis l'ouverture" ton="info">
          <PrevuReelChart data={dossiers} />
        </DashCard>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <h3 className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          Dossiers travaillés sur la période ({dossiers.length})
        </h3>
        {dossiers.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Aucune heure saisie sur un dossier pendant cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Dossier</th>
                  <th className="px-3 py-2 text-right font-medium">Période</th>
                  <th className="px-3 py-2 text-right font-medium">Réel cumulé</th>
                  <th className="px-3 py-2 text-right font-medium">Prévu</th>
                  <th className="px-3 py-2 text-right font-medium">Écart</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Export</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dossiers.map((d) => {
                  const ecart = d.cumul - d.prevu;
                  return (
                    <tr key={d.id} className="align-top">
                      <td className="px-3 py-2">
                        <Link href={`/documents?dossier=${d.id}`} className="font-medium hover:underline">
                          {d.nom}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {d.client && <span>{d.client}</span>}
                          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", statutClasses(d.statut))}>
                            {normalizeStatut(d.statut)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtH(d.periode)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtH(d.cumul)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {d.prevu > 0 ? fmtH(d.prevu) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          d.prevu > 0 && ecart > 0 && "text-destructive"
                        )}
                      >
                        {d.prevu > 0 ? `${signe(ecart)}${fmtH(Math.abs(ecart))}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RapportHeuresPdfBouton dossierId={d.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Le bouton PDF crée le rapport complet du dossier et le range dans son dossier, catégorie « Heures ».
      </p>
    </div>
  );
}
