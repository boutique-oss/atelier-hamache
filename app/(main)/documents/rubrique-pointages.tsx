import Link from "next/link";
import { Camera, Download, ExternalLink, Printer } from "lucide-react";

import { FicheNavetteSaisie } from "@/components/fiche-navette-saisie";
import { STATUTS_FICHE } from "@/lib/fiches-navettes-const";
import { libelleSemaine, type FicheNavetteDetail, type FicheNavetteListe } from "@/lib/fiches-navettes";
import type { StatutFicheNavette } from "@/lib/documents-db";
import { cn } from "@/lib/utils";

// Rubrique « Pointages » de la page Documents : fiches navettes scannées en
// atelier (/pointages/scan). Colonne gauche : filtre + liste des fiches.
// À droite : le scan à côté de la grille de saisie de la semaine.

const STATUT = Object.fromEntries(STATUTS_FICHE.map((s) => [s.cle, s.libelle]));
const STATUT_CLASSES: Record<StatutFicheNavette, string> = {
  a_saisir: "bg-[hsl(var(--brand-orange)/0.15)] text-foreground",
  verifiee: "bg-[hsl(var(--brand-blue)/0.15)] text-foreground",
  integree: "bg-[hsl(var(--brand-green)/0.15)] text-foreground",
};

export function lienFiche(p: { fiche?: number; statut?: string }) {
  const s = new URLSearchParams({ rubrique: "pointages" });
  if (p.statut) s.set("statut", p.statut);
  if (p.fiche) s.set("fiche", String(p.fiche));
  return `/documents?${s.toString()}`;
}

export function ListeFichesNavettes({
  fiches,
  statut,
  ficheId,
}: {
  fiches: FicheNavetteListe[];
  statut: StatutFicheNavette | "";
  ficheId: number | null;
}) {
  const filtres: { cle: StatutFicheNavette | ""; libelle: string }[] = [
    { cle: "", libelle: "Toutes" },
    ...STATUTS_FICHE,
  ];
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
        {filtres.map((f) => (
          <Link
            key={f.cle || "toutes"}
            href={lienFiche({ statut: f.cle })}
            aria-current={statut === f.cle ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium [@media(pointer:coarse)]:py-2",
              statut === f.cle ? "border-foreground/40 bg-foreground/[0.07]" : "text-muted-foreground hover:bg-foreground/5"
            )}
          >
            {f.libelle}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <p className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Fiches navettes</span>
          <span className="tabular-nums">{fiches.length}</span>
        </p>
        {fiches.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune fiche.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {fiches.map((f) => {
              const actif = f.id === ficheId;
              return (
                <li key={f.id}>
                  <Link
                    href={lienFiche({ fiche: f.id, statut })}
                    aria-current={actif ? "page" : undefined}
                    style={{ borderLeftColor: actif ? "#F26A21" : "transparent" }}
                    className={cn(
                      "block border-l-2 px-3 py-2 transition-colors [@media(pointer:coarse)]:py-3",
                      actif ? "bg-foreground/[0.07]" : "hover:bg-foreground/5"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.operateur}</span>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", STATUT_CLASSES[f.statut])}>
                        {STATUT[f.statut]}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {libelleSemaine(f.semaineIso)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link
          href="/documents/fiche-navette-vierge"
          target="_blank"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 font-medium hover:bg-accent"
        >
          <Printer size={15} aria-hidden /> Fiche vierge
        </Link>
        <Link
          href="/pointages/scan"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 font-medium hover:bg-accent"
        >
          <Camera size={15} aria-hidden /> Page scan (téléphone)
        </Link>
      </div>
    </>
  );
}

export function FicheNavetteVue({ fiche }: { fiche: FicheNavetteDetail | null }) {
  if (!fiche) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-sm font-medium">Choisissez une fiche navette</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Le scan s&apos;affiche ici, à côté de la grille de saisie de la semaine.
        </p>
      </div>
    );
  }
  const doc = fiche.document;
  const url = doc ? `/api/documents/${doc.id}` : null;
  // HEIC : Chrome et Edge sur PC ne l'affichent pas → bouton Télécharger.
  const image = doc && /^image\/(jpeg|png)$/.test(doc.contentType);
  const pdf = doc?.contentType === "application/pdf";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="brand-display text-lg">
          {fiche.operateur} <span className="text-muted-foreground">· {libelleSemaine(fiche.semaineIso)}</span>
        </h2>
        <span className={cn("self-start rounded px-1.5 py-0.5 text-xs font-medium", STATUT_CLASSES[fiche.statut])}>
          {STATUT[fiche.statut]}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-label="Scan de la fiche" className="overflow-hidden rounded-lg border bg-card">
          {!url ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">Scan supprimé.</p>
          ) : image ? (
            <a href={url} target="_blank" rel="noreferrer" title="Ouvrir en grand">
              {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API */}
              <img src={url} alt={`Fiche navette de ${fiche.operateur}`} className="max-h-[75vh] w-full object-contain" />
            </a>
          ) : pdf ? (
            <iframe src={url} title={`Fiche navette de ${fiche.operateur}`} className="h-[75vh] w-full" />
          ) : (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Aperçu indisponible dans ce navigateur (photo HEIC d&apos;iPhone).
            </p>
          )}
          {url && (
            <div className="flex gap-3 border-t px-3 py-2 text-sm">
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                <ExternalLink size={14} aria-hidden /> Ouvrir
              </a>
              <a href={`${url}?download=1`} className="inline-flex items-center gap-1.5 hover:underline">
                <Download size={14} aria-hidden /> Télécharger
              </a>
            </div>
          )}
        </section>

        <FicheNavetteSaisie
          key={`${fiche.id}-${fiche.statut}`}
          ficheId={fiche.id}
          statut={fiche.statut}
          hJour={fiche.hJour}
          jours={fiche.jours}
        />
      </div>
    </div>
  );
}
