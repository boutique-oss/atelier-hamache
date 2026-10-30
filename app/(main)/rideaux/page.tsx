import Link from "next/link";
import { Scissors, Plus, Search, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { RideauxDeleteButton } from "@/components/rideaux-calculateur";
import { listCalculs } from "@/lib/rideaux/db";
import { eur, f2, fh } from "@/lib/rideaux/calcul";

export const dynamic = "force-dynamic";

const dateFr = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
};

export default async function RideauxPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q || "").slice(0, 100);
  const calculs = await listCalculs(q);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        className="mb-6"
        icon={Scissors}
        tint="var(--brand-purple)"
        title="Calculateur rideaux"
        subtitle="Chiffrages enregistrés : métrage, heures de confection et prix par fenêtre"
        actions={
          <Link
            href="/rideaux/nouveau"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus size={16} /> Nouveau devis rideaux
          </Link>
        }
      />

      <form className="mb-4 flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher un chiffrage</span>
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher : projet, client, dossier, tissu, fenêtre, n°…"
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          Rechercher
        </button>
        {q && (
          <Link href="/rideaux" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Effacer
          </Link>
        )}
      </form>

      <section className="rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          {q ? <>Résultats pour « {q} »</> : "Chiffrages enregistrés"}{" "}
          <span className="text-muted-foreground">({calculs.length})</span>
        </h2>

        {calculs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {q ? "Aucun chiffrage ne correspond à cette recherche." : "Aucun chiffrage enregistré pour l'instant."}
            <div className="mt-3">
              <Link href="/rideaux/nouveau" className="font-medium text-primary hover:underline">
                Commencer un nouveau devis rideaux →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Tableau (tablette / ordinateur) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">N°</th>
                    <th className="px-4 py-2 font-semibold">Projet</th>
                    <th className="px-4 py-2 font-semibold">Client / dossier</th>
                    <th className="px-4 py-2 text-right font-semibold">Fen.</th>
                    <th className="px-4 py-2 text-right font-semibold">Tissu</th>
                    <th className="px-4 py-2 text-right font-semibold">Confection</th>
                    <th className="px-4 py-2 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-2 font-semibold">Modifié</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculs.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">#{c.id}</td>
                      <td className="max-w-[260px] px-4 py-2.5">
                        <Link href={`/rideaux/${c.id}`} className="font-medium hover:text-primary hover:underline">
                          {c.nom || "Projet sans nom"}
                        </Link>
                        {c.tissus && <p className="truncate text-xs text-muted-foreground">{c.tissus}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <p>{c.client || "—"}</p>
                        {c.dossierId && (
                          <Link href={`/dossiers/${c.dossierId}`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                            {c.dossierNom || `Dossier #${c.dossierId}`}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.nbFenetres}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{f2(c.metrageTissu)} m</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fh(c.heures)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{eur(c.totalHt)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dateFr(c.updatedAt)}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/rideaux/${c.id}`} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
                            Ouvrir
                          </Link>
                          <RideauxDeleteButton id={c.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes (téléphone) */}
            <ul className="divide-y md:hidden">
              {calculs.map((c) => (
                <li key={c.id}>
                  <Link href={`/rideaux/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        <span className="mr-1.5 font-mono text-xs text-muted-foreground">#{c.id}</span>
                        {c.nom || "Projet sans nom"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.client, c.dossierNom, dateFr(c.updatedAt)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs tabular-nums">
                        {c.nbFenetres} fen. · {f2(c.metrageTissu)} m · <b>{eur(c.totalHt)} HT</b>
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
