import { Clock, Printer } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PageHeader } from "@/components/page-header";
import {
  ajusterStock,
  setHoraireFixe,
  setModeHS,
  supprimerMouvementStock,
} from "@/app/pointage/actions";
import { PointageMois } from "@/components/pointage-mois";
import { CongesCalendrier } from "@/components/conges-calendrier";
import {
  COEF_STOCK,
  CONGES_PAR_AN,
  chargerConges,
  chargerMois,
  jourMois,
  lundiDe,
  moisAdjacent,
  moisValide,
  nf,
  nfs,
  nomMois,
  schemaPret,
} from "@/lib/pointage";

export const dynamic = "force-dynamic";

// Repère « semaine en cours » : la semaine n'est pas finie, son chiffre
// d'heures sup. est provisoire (ne pas envoyer la navette trop tôt).
function EnCours({ jusquau }: { jusquau: string }) {
  return (
    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800">
      en cours · jusqu&apos;au {jourMois(jusquau)}
    </span>
  );
}

export default async function PointagePage({
  searchParams,
}: {
  searchParams: { mois?: string; lundi?: string };
}) {
  // Compatibilité : un ancien lien ?lundi=AAAA-MM-JJ ouvre le mois correspondant.
  const mois = moisValide(searchParams.mois ?? searchParams.lundi?.slice(0, 7));

  // Tant que la migration n'a pas été lancée, écran d'activation plutôt qu'une
  // erreur serveur.
  if (!(await schemaPret())) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          className="mb-6"
          icon={Clock}
          tint="var(--brand-violet)"
          title="Pointage des heures"
          subtitle="Une activation est nécessaire"
        />
        <section className="rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Activer le pointage</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Le pointage a besoin d&apos;une table dédiée dans la base (séparée des
            heures par dossier, pour ne pas fausser le Rapport des heures). Un clic
            suffit, aucune donnée existante n&apos;est modifiée.
          </p>
          <a
            href="/api/admin/migrate?key=ash-migrate-2026"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Activer maintenant
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Tu verras une réponse <code>&quot;ok&quot;: true</code>. Reviens ensuite sur
            cette page : elle sera prête.
          </p>
        </section>
      </main>
    );
  }

  const { jours, salaries, operateurs, extrasPrets } = await chargerMois(mois);
  const semaines = salaries[0]?.semaines ?? [];
  const demandesConges = await chargerConges();
  const z = (v: number) => (v ? nf(v) : "—");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        className="mb-6"
        icon={Clock}
        tint="var(--brand-violet)"
        title="Pointage des heures"
        subtitle="Saisie jour par jour, heures sup. par semaine, stock d’heures"
      />

      {/* Navigation de mois + impression */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <a
          href={`/pointage?mois=${moisAdjacent(mois, -1)}`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          ← Mois précédent
        </a>
        <span className="px-2 text-sm font-semibold capitalize">{nomMois(mois)}</span>
        <a
          href={`/pointage?mois=${moisAdjacent(mois, 1)}`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Mois suivant →
        </a>
        <a href="/pointage" className="text-sm text-muted-foreground hover:underline">
          Mois en cours
        </a>
        <a
          href={`/documents/feuille-pointage?lundi=${lundiDe(new Date(mois + "-01T00:00:00Z"))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Printer className="h-4 w-4" />
          Feuille semaine
        </a>
        <a
          href={`/documents/feuille-heures-mois?mois=${mois}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Printer className="h-4 w-4" />
          Fiche navette du mois
        </a>
      </div>

      {!extrasPrets && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nouveautés à activer (horaire fixe, absences avec motif, payer / stocker les heures sup.,
          stock d&apos;heures) :{" "}
          <a href="/api/admin/migrate?key=ash-migrate-2026" className="font-semibold underline">
            activer maintenant
          </a>
          , puis reviens sur cette page.
        </p>
      )}

      {semaines.some((s) => s.enCours) && salaries.length > 0 && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⏳ Semaine en cours jusqu&apos;au{" "}
          <b>{jourMois(semaines[semaines.length - 1].dimanche)}</b> : ses heures sup. sont
          provisoires. Attends la fin de cette semaine (jours du mois suivant compris) pour
          imprimer la navette de ce mois.
        </p>
      )}

      {salaries.length === 0 ? (
        <p className="mb-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Aucun salarié actif. Ajoute-les depuis le widget « Opérateurs » du{" "}
          <a href="/rapports" className="text-primary hover:underline">
            Rapport des heures
          </a>
          .
        </p>
      ) : (
        <>
          {/* 1 · Saisie du mois */}
          <section className="rounded-xl border">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
              <span>1 · Heures du mois — jour par jour</span>
              <span className="font-normal text-muted-foreground">
                Entrée = jour suivant · clic droit sur une case → Congé, Récup, Absence… · sur un nom → remplir le mois
              </span>
            </h2>
            <PointageMois jours={jours} lignes={salaries} extrasPrets={extrasPrets} />
          </section>

          {/* 2 · Heures sup. par semaine — payer ou stocker */}
          <section className="mt-5 rounded-xl border">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
              <span>2 · Heures sup. par semaine — payer ou stocker</span>
              <span className="font-normal text-muted-foreground">
                Semaine rattachée au mois de son lundi · 1 h de pause café retirée chaque semaine
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Salarié</th>
                    {semaines.map((s) => (
                      <th key={s.lundi} className="px-2 py-2 text-center font-medium">
                        S{s.num}
                        <span className="block normal-case tracking-normal">
                          {jourMois(s.lundi)} → {jourMois(s.dimanche)}
                        </span>
                        {s.enCours && <EnCours jusquau={s.dimanche} />}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium text-foreground">Payées</th>
                    <th className="px-2 py-2 text-center font-medium text-foreground">Stockées</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((l) => (
                    <tr key={l.nom} className="border-b last:border-0">
                      <th scope="row" className="px-3 py-2.5 text-left">
                        <span className="font-semibold">{l.nom}</span>
                        {extrasPrets && (
                          <form action={setHoraireFixe.bind(null, l.nom, !l.fixe)} className="mt-1">
                            <button
                              type="submit"
                              title="Horaire fixe = pas d'heures sup. (ex. Raphaël)"
                              className={`rounded border px-2 py-0.5 text-[11px] font-normal hover:bg-accent ${
                                l.fixe ? "border-amber-300 text-amber-700" : "text-muted-foreground"
                              }`}
                            >
                              {l.fixe ? "Horaire fixe ✓" : "Horaire fixe"}
                            </button>
                          </form>
                        )}
                      </th>
                      {l.fixe ? (
                        <td colSpan={semaines.length + 2} className="px-2 text-center">
                          <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
                            Horaire fixe {nf(l.horaireMensuel)} h / mois — pas d&apos;heures sup.
                          </span>
                        </td>
                      ) : (
                        <>
                          {l.semaines.map((s) => (
                            <td key={s.lundi} className="px-2 py-2 text-center">
                              {s.hs > 0 ? (
                                <>
                                  <div className={`text-base font-bold ${s.enCours ? "text-muted-foreground" : ""}`}>
                                    {nf(s.hs)} h
                                    {s.enCours && <span className="block text-[10px] font-normal">provisoire</span>}
                                  </div>
                                  {extrasPrets && (
                                    <div className="mt-1 inline-flex overflow-hidden rounded-full border text-[11px]">
                                      {(["payer", "stocker"] as const).map((m) => (
                                        <form key={m} action={setModeHS.bind(null, l.nom, s.lundi, m)}>
                                          <button
                                            type="submit"
                                            className={`px-2 py-0.5 font-medium ${
                                              s.mode === m
                                                ? m === "payer"
                                                  ? "bg-primary text-primary-foreground"
                                                  : "bg-emerald-600 text-white"
                                                : "text-muted-foreground hover:bg-accent"
                                            }`}
                                          >
                                            {m === "payer" ? "Payer" : "Stocker"}
                                          </button>
                                        </form>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : s.enCours ? (
                                <span className="text-xs text-muted-foreground">à venir</span>
                              ) : (
                                <span className="text-muted-foreground/60">0</span>
                              )}
                            </td>
                          ))}
                          <td className="px-2 text-center text-base font-bold">{z(l.hsPayees)}</td>
                          <td className="px-2 text-center text-base font-bold text-emerald-700">{z(l.hsStockees)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3 · Stock d'heures */}
          {extrasPrets && (
            <section className="mt-5 rounded-xl border">
              <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
                <span>3 · Stock d&apos;heures</span>
                <span className="font-normal text-muted-foreground">
                  1 h sup. stockée = {nf(COEF_STOCK)} h de repos · une récup retire une journée (h/jour du contrat)
                </span>
              </h2>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {salaries
                  .filter((l) => !l.fixe)
                  .map((l) => (
                    <div key={l.nom} className="rounded-lg border p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{l.nom}</span>
                        {l.stockFin < 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Négatif</span>
                        ) : l.stockFin < l.hJour ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Bas</span>
                        ) : l.stockFin > 35 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Prévoir des récups</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">OK</span>
                        )}
                      </div>
                      <div
                        className={`mt-1 text-2xl font-bold tabular-nums ${
                          l.stockFin < 0 ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {nf(l.stockFin)} h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        soit ≈ {nf(Math.max(0, l.stockFin) / (l.hJour || 7))} jour(s) de récup
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs tabular-nums">
                        <div className="flex justify-between">
                          <span>Début de mois</span>
                          <span>{nf(l.stockDebut)} h</span>
                        </div>
                        {l.mouvements.map((m, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {jourMois(m.date)} · {m.libelle}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <b className={m.heures < 0 ? "text-rose-700" : "text-emerald-700"}>
                                {nfs(m.heures)}
                              </b>
                              {m.id !== null && (
                                <form action={supprimerMouvementStock.bind(null, m.id)}>
                                  <ConfirmDeleteButton
                                    label="Supprimer cet ajustement de stock"
                                    confirmation={`Supprimer cet ajustement de ${nfs(m.heures)} h ? Le stock d'heures sera recalculé.`}
                                  />
                                </form>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ajuster le stock (solde de départ, correction…)
                        </summary>
                        <form action={ajusterStock.bind(null, l.nom)} className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            name="heures"
                            inputMode="decimal"
                            required
                            placeholder="± heures (ex. 12 ou -3,5)"
                            className="col-span-2 rounded-md border px-2 py-1.5"
                          />
                          <input name="date" type="date" defaultValue={`${mois}-01`} className="rounded-md border px-2 py-1.5" />
                          <input name="libelle" placeholder="Solde de départ" className="rounded-md border px-2 py-1.5" />
                          <button type="submit" className="col-span-2 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
                            Ajouter au stock
                          </button>
                        </form>
                      </details>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* 4 · Congés de l'année */}
          <section className="mt-5 rounded-xl border">
            <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
              4 · Congés {mois.slice(0, 4)} — 5 semaines par an ({CONGES_PAR_AN} jours)
            </h2>
            <div className="divide-y px-4">
              {salaries.map((l) => (
                <div key={l.nom} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.nom}</div>
                    <div className="mt-1 h-2 w-full max-w-56 overflow-hidden rounded-full border bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (l.congesAn / CONGES_PAR_AN) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {l.congesAn} pris sur {CONGES_PAR_AN}
                    </div>
                  </div>
                  <span className="shrink-0 text-base font-bold tabular-nums">
                    {CONGES_PAR_AN - l.congesAn} j restants
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Planning des congés — demandes début → fin, calendrier mensuel.
          Relié au Planning atelier (les congés y remontent aussi). */}
      <div className="mt-5">
        <CongesCalendrier conges={demandesConges} operateurs={operateurs} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Heures sup. = heures faites dans la semaine + h/jour par férié ou congé (lun→ven)
        − 1 h de pause café − horaire hebdo du contrat ; une semaine appartient au mois de
        son lundi. Récup et Repos comptent 0 h (la récup puise dans le stock). Les
        majorations restent calculées par le cabinet.
      </p>
    </main>
  );
}
