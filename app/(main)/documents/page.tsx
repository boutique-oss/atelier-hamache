import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Clock,
  FolderOpen,
  Package,
  Search,
  Users,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { DocumentsDossier } from "@/components/documents-dossier";
import {
  compteursRubriques,
  lireDossierDocs,
  listerDossiersDocs,
  type CompteursRubriques,
} from "@/lib/documents-arbre";
import { normalizeStatut, statutClasses } from "@/lib/dossiers";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Page Documents : rubriques à gauche (seule « Clients » est active pour
// l'instant), liste des dossiers clients filtrable, puis l'arborescence du
// dossier choisi. Les URL /documents/<imprimable> (prédevis vierge, bon de
// commande…) vivent hors de ce layout, dans app/documents/.

const RUBRIQUES: {
  cle: keyof CompteursRubriques;
  libelle: string;
  icon: LucideIcon;
  tint: string;
  active: boolean;
}[] = [
  { cle: "clients", libelle: "Clients", icon: Users, tint: "var(--brand-blue)", active: true },
  { cle: "commandes", libelle: "Commandes", icon: Package, tint: "var(--brand-orange)", active: false },
  { cle: "planning", libelle: "Planning", icon: CalendarRange, tint: "var(--brand-green)", active: false },
  { cle: "heures", libelle: "Rapports d'heures", icon: BarChart3, tint: "var(--brand-pink)", active: false },
  { cle: "pointages", libelle: "Pointages", icon: Clock, tint: "var(--brand-violet)", active: false },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { dossier?: string; q?: string };
}) {
  const q = (searchParams.q || "").slice(0, 100);
  const choisiId = Number(searchParams.dossier);
  const aChoisi = Number.isFinite(choisiId) && choisiId > 0;

  const [compteurs, dossiers, choisi] = await Promise.all([
    compteursRubriques().catch(() => null),
    listerDossiersDocs(q),
    aChoisi ? lireDossierDocs(choisiId) : Promise.resolve(null),
  ]);

  const lienDossier = (id: number) => {
    const p = new URLSearchParams({ dossier: String(id) });
    if (q) p.set("q", q);
    return `/documents?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        className="mb-6"
        icon={FolderOpen}
        tint="var(--brand-blue)"
        eyebrow="Classement"
        title="Documents"
        subtitle="Tous les fichiers d'un dossier client, rangés par catégorie et sous-dossier"
      />

      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Colonne gauche : rubriques + filtre + dossiers. Sur téléphone, elle
            passe sous le dossier ouvert pour qu'on voie d'abord ses fichiers. */}
        <aside className={cn("space-y-4", choisi && "order-2 lg:order-1")}>
          <nav aria-label="Rubriques" className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {RUBRIQUES.map(({ cle, libelle, icon: Icon, tint, active }) => (
                <li
                  key={cle}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm",
                    active ? "bg-foreground/[0.06] font-medium" : "text-muted-foreground"
                  )}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `hsl(${tint} / ${active ? 0.2 : 0.1})`,
                      color: `hsl(${tint})`,
                    }}
                  >
                    <Icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{libelle}</span>
                  {active ? (
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {compteurs ? compteurs[cle] : "—"}
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Bientôt
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <form role="search" className="flex gap-2">
            {aChoisi && <input type="hidden" name="dossier" value={choisiId} />}
            <label className="relative flex-1">
              <span className="sr-only">Filtrer les dossiers</span>
              <Search
                size={15}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Dossier ou client…"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm [@media(pointer:coarse)]:h-11"
              />
            </label>
            <button
              type="submit"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent [@media(pointer:coarse)]:h-11"
            >
              Filtrer
            </button>
          </form>

          <div className="overflow-hidden rounded-lg border bg-card">
            <p className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Dossiers clients</span>
              <span className="tabular-nums">{dossiers.length}</span>
            </p>
            {dossiers.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {q ? `Aucun dossier ne correspond à « ${q} ».` : "Aucun dossier."}
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y overflow-y-auto">
                {dossiers.map((d) => {
                  const actif = choisi?.id === d.id;
                  return (
                    <li key={d.id}>
                      <Link
                        href={lienDossier(d.id)}
                        aria-current={actif ? "page" : undefined}
                        style={{ borderLeftColor: actif ? "#F26A21" : "transparent" }}
                        className={cn(
                          "block border-l-2 px-3 py-2 transition-colors [@media(pointer:coarse)]:py-3",
                          actif ? "bg-foreground/[0.07]" : "hover:bg-foreground/5"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.nom}</span>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {d.nbFichiers}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {d.client || "—"}
                          </span>
                          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", statutClasses(d.statut))}>
                            {normalizeStatut(d.statut)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Dossier choisi */}
        <section className={cn("min-w-0", choisi && "order-1 lg:order-2")}>
          {choisi ? (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="brand-display truncate text-lg">{choisi.nom}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {choisi.client && <span>{choisi.client}</span>}
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statutClasses(choisi.statut))}>
                      {normalizeStatut(choisi.statut)}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/dossiers/${choisi.id}?back=${encodeURIComponent(lienDossier(choisi.id))}`}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Ouvrir la fiche dossier <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <DocumentsDossier dossierId={choisi.id} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <FolderOpen size={28} aria-hidden className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {aChoisi ? "Ce dossier n'existe plus." : "Choisissez un dossier client"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ses fichiers s&apos;affichent ici, classés par catégorie.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
