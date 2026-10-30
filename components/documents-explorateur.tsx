"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DepotEmplacement,
  SupprimerDocumentEmplacement,
} from "@/components/documents-emplacements";
import {
  creerSousDossier,
  renommerSousDossier,
  supprimerSousDossier,
} from "@/app/(main)/documents/arbre-actions";
import { CATEGORIES_DOCUMENT, type CategorieDocument } from "@/lib/documents-categories";
import type { DocDossier } from "@/lib/documents-db";
import type { ArbreDossier, FichierListe } from "@/lib/documents-arbre";
import { cn } from "@/lib/utils";

// Explorateur des documents d'UN dossier client : arborescence à gauche
// (catégories puis sous-dossiers libres), fichiers du nœud choisi à droite.
// Partagé entre la page /documents et la fiche dossier. La sélection reste
// locale (pas d'URL) pour fonctionner aussi dans la fenêtre de fiche.

type Selection = { cat: CategorieDocument | null; sd: number | null };

const LIBELLES = Object.fromEntries(CATEGORIES_DOCUMENT.map((c) => [c.cle, c.libelle])) as Record<
  CategorieDocument,
  string
>;

// Liseré d'accent du nœud sélectionné (l'orange de marque n'est jamais
// utilisé en couleur de texte sur fond clair).
const ACCENT = "#F26A21";

function typeDe(f: FichierListe): string {
  const ct = (f.contentType || "").toLowerCase();
  const ext = f.nom.includes(".") ? f.nom.split(".").pop()!.toLowerCase() : "";
  if (ct.includes("pdf") || ext === "pdf") return "PDF";
  if (ct.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "webp"].includes(ext)) return "Image";
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "Tableur";
  return ext ? ext.toUpperCase() : "Fichier";
}

function dateFr(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Paris",
      });
}

export function DocumentsExplorateur({
  arbre,
  estAdmin,
}: {
  arbre: ArbreDossier;
  estAdmin: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Selection>({ cat: null, sd: null });
  const { sousDossiers, fichiers, dossierId } = arbre;

  // Index : enfants par parent, fichiers directs par sous-dossier.
  const { enfants, parId, totalSd } = useMemo(() => {
    const enfants = new Map<number | null, DocDossier[]>();
    const parId = new Map<number, DocDossier>();
    for (const s of sousDossiers) {
      parId.set(s.id, s);
      const k = s.parentId;
      enfants.set(k, [...(enfants.get(k) ?? []), s]);
    }
    const directs = new Map<number, number>();
    for (const f of fichiers) {
      if (f.docDossierId != null) directs.set(f.docDossierId, (directs.get(f.docDossierId) ?? 0) + 1);
    }
    // Nombre de fichiers d'un sous-dossier, descendants compris.
    const totalSd = new Map<number, number>();
    const total = (id: number): number => {
      if (totalSd.has(id)) return totalSd.get(id)!;
      const n =
        (directs.get(id) ?? 0) + (enfants.get(id) ?? []).reduce((acc, e) => acc + total(e.id), 0);
      totalSd.set(id, n);
      return n;
    };
    sousDossiers.forEach((s) => total(s.id));
    return { enfants, parId, totalSd };
  }, [sousDossiers, fichiers]);

  const nbParCategorie = useMemo(() => {
    const m = new Map<CategorieDocument, number>();
    for (const f of fichiers) m.set(f.categorie, (m.get(f.categorie) ?? 0) + 1);
    return m;
  }, [fichiers]);

  // Racines d'une catégorie (parent_id NULL).
  const racines = (cat: CategorieDocument) =>
    (enfants.get(null) ?? []).filter((s) => s.categorie === cat);

  // Chemin du nœud sélectionné (pour le fil d'Ariane et l'ouverture de l'arbre).
  const chemin: DocDossier[] = [];
  for (let s = sel.sd != null ? parId.get(sel.sd) : undefined; s; s = s.parentId != null ? parId.get(s.parentId) : undefined) {
    chemin.unshift(s);
  }
  const ouverts = new Set(chemin.map((s) => s.id));

  // Contenu du nœud sélectionné : sous-dossiers enfants + fichiers directs.
  const dossiersAffiches: DocDossier[] =
    sel.cat == null ? [] : sel.sd == null ? racines(sel.cat) : enfants.get(sel.sd) ?? [];
  const fichiersAffiches =
    sel.cat == null
      ? fichiers
      : fichiers.filter(
          (f) =>
            f.categorie === sel.cat &&
            (sel.sd == null ? f.docDossierId == null : f.docDossierId === sel.sd)
        );

  // --- Actions sur les sous-dossiers ---------------------------------------
  const [edition, setEdition] = useState<null | "creer" | "renommer">(null);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choisir = (s: Selection) => {
    setSel(s);
    setEdition(null);
    setErreur(null);
  };

  const valider = () => {
    if (sel.cat == null) return;
    const cat = sel.cat;
    setErreur(null);
    startTransition(async () => {
      const res =
        edition === "renommer" && sel.sd != null
          ? await renommerSousDossier(sel.sd, nom)
          : await creerSousDossier({ dossierId, categorie: cat, parentId: sel.sd, nom });
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setEdition(null);
      setNom("");
      router.refresh();
    });
  };

  const supprimer = () => {
    if (sel.sd == null || sel.cat == null) return;
    const courant = parId.get(sel.sd);
    if (!courant || !confirm(`Supprimer le sous-dossier « ${courant.nom} » ? Il est vide.`)) return;
    const cat = sel.cat;
    const parent = courant.parentId;
    setErreur(null);
    startTransition(async () => {
      const res = await supprimerSousDossier(courant.id);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setSel({ cat, sd: parent });
      router.refresh();
    });
  };

  const sdCourant = sel.sd != null ? parId.get(sel.sd) : undefined;
  const sdVide =
    sdCourant != null && (totalSd.get(sdCourant.id) ?? 0) === 0 && (enfants.get(sdCourant.id) ?? []).length === 0;

  // --- Rendu de l'arbre ----------------------------------------------------
  const noeud = (s: DocDossier, profondeur: number): React.ReactNode => {
    const actif = sel.sd === s.id;
    const sousNoeuds = enfants.get(s.id) ?? [];
    const deplie = actif || ouverts.has(s.id);
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => choisir({ cat: s.categorie, sd: s.id })}
          aria-current={actif ? "true" : undefined}
          style={{
            paddingLeft: `${0.5 + profondeur * 0.85}rem`,
            borderLeftColor: actif ? ACCENT : "transparent",
          }}
          className={cn(
            "flex w-full items-center gap-2 border-l-2 py-1.5 pr-2 text-left text-sm transition-colors [@media(pointer:coarse)]:py-2.5",
            actif ? "bg-foreground/[0.07] font-medium text-foreground" : "text-foreground/80 hover:bg-foreground/5"
          )}
        >
          {deplie ? <FolderOpen size={14} aria-hidden className="shrink-0" /> : <Folder size={14} aria-hidden className="shrink-0" />}
          <span className="min-w-0 flex-1 truncate">{s.nom}</span>
          <span className="tabular-nums text-xs text-muted-foreground">{totalSd.get(s.id) ?? 0}</span>
        </button>
        {deplie && sousNoeuds.length > 0 && <ul>{sousNoeuds.map((e) => noeud(e, profondeur + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
      {/* Arborescence */}
      <div className="space-y-3">
        <nav aria-label="Arborescence des documents" className="overflow-hidden rounded-lg border bg-card">
          <ul className="py-1">
            <li>
              <button
                type="button"
                onClick={() => choisir({ cat: null, sd: null })}
                aria-current={sel.cat == null ? "true" : undefined}
                style={{ borderLeftColor: sel.cat == null ? ACCENT : "transparent" }}
                className={cn(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-sm transition-colors [@media(pointer:coarse)]:py-2.5",
                  sel.cat == null ? "bg-foreground/[0.07] font-medium" : "text-foreground/80 hover:bg-foreground/5"
                )}
              >
                <span className="flex-1">Tous les fichiers</span>
                <span className="tabular-nums text-xs text-muted-foreground">{fichiers.length}</span>
              </button>
            </li>
            {CATEGORIES_DOCUMENT.map(({ cle, libelle }) => {
              const actif = sel.cat === cle && sel.sd == null;
              const deplie = sel.cat === cle;
              const nb = nbParCategorie.get(cle) ?? 0;
              const rac = racines(cle);
              return (
                <li key={cle}>
                  <button
                    type="button"
                    onClick={() => choisir({ cat: cle, sd: null })}
                    aria-current={actif ? "true" : undefined}
                    aria-expanded={rac.length > 0 ? deplie : undefined}
                    style={{ borderLeftColor: actif ? ACCENT : "transparent" }}
                    className={cn(
                      "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-sm transition-colors [@media(pointer:coarse)]:py-2.5",
                      actif ? "bg-foreground/[0.07] font-medium text-foreground" : "hover:bg-foreground/5",
                      !actif && (nb > 0 || rac.length > 0 ? "text-foreground/85" : "text-muted-foreground")
                    )}
                  >
                    <ChevronRight
                      size={13}
                      aria-hidden
                      className={cn(
                        "shrink-0 transition-transform",
                        deplie && "rotate-90",
                        rac.length === 0 && "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{libelle}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{nb}</span>
                  </button>
                  {deplie && rac.length > 0 && <ul>{rac.map((s) => noeud(s, 1))}</ul>}
                </li>
              );
            })}
          </ul>
        </nav>

        <DepotEmplacement
          dossierId={dossierId}
          categorie={sel.cat ?? "autre"}
          docDossierId={sel.sd}
          onDone={() => router.refresh()}
        />
      </div>

      {/* Contenu du nœud sélectionné */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {sel.cat == null ? (
              <span className="font-medium">Tous les fichiers</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => choisir({ cat: sel.cat, sd: null })}
                  className={cn("hover:underline", sel.sd == null && "font-medium")}
                >
                  {LIBELLES[sel.cat]}
                </button>
                {chemin.map((s) => (
                  <span key={s.id} className="flex items-center gap-1">
                    <ChevronRight size={13} aria-hidden className="text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => choisir({ cat: s.categorie, sd: s.id })}
                      className={cn("hover:underline", s.id === sel.sd && "font-medium")}
                    >
                      {s.nom}
                    </button>
                  </span>
                ))}
              </>
            )}
          </p>

          {sel.cat != null && edition == null && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEdition("creer");
                  setNom("");
                  setErreur(null);
                }}
              >
                <FolderPlus size={14} aria-hidden /> Sous-dossier
              </Button>
              {sdCourant && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEdition("renommer");
                      setNom(sdCourant.nom);
                      setErreur(null);
                    }}
                  >
                    <Pencil size={14} aria-hidden /> Renommer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!sdVide || pending}
                    title={sdVide ? undefined : "Seul un sous-dossier vide peut être supprimé"}
                    onClick={supprimer}
                  >
                    <Trash2 size={14} aria-hidden /> Supprimer
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {edition != null && (
          <form
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              valider();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">
                {edition === "creer" ? "Nom du nouveau sous-dossier" : "Nouveau nom du sous-dossier"}
              </span>
              <input
                autoFocus
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={80}
                placeholder={edition === "creer" ? "Nom du sous-dossier" : "Nouveau nom"}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm [@media(pointer:coarse)]:h-11"
              />
            </label>
            <Button type="submit" size="sm" disabled={pending || !nom.trim()}>
              {edition === "creer" ? "Créer" : "Renommer"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEdition(null)}>
              Annuler
            </Button>
          </form>
        )}
        {erreur && (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        <TableauFichiers
          dossiers={dossiersAffiches}
          totalSd={totalSd}
          fichiers={fichiersAffiches}
          avecCategorie={sel.cat == null}
          estAdmin={estAdmin}
          onOuvrir={(s) => choisir({ cat: s.categorie, sd: s.id })}
          onRefresh={() => router.refresh()}
        />
      </div>
    </div>
  );
}

function TableauFichiers({
  dossiers,
  totalSd,
  fichiers,
  avecCategorie,
  estAdmin,
  onOuvrir,
  onRefresh,
}: {
  dossiers: DocDossier[];
  totalSd: Map<number, number>;
  fichiers: FichierListe[];
  avecCategorie: boolean;
  estAdmin: boolean;
  onOuvrir: (s: DocDossier) => void;
  onRefresh: () => void;
}) {
  if (dossiers.length === 0 && fichiers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Aucun fichier ici pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Nom</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Type</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Origine</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Date</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">Auteur</th>
            <th className="px-3 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {dossiers.map((s) => (
            <tr key={`sd-${s.id}`} className="hover:bg-foreground/[0.03]">
              <td className="px-3 py-2" colSpan={6}>
                <button
                  type="button"
                  onClick={() => onOuvrir(s)}
                  className="flex w-full items-center gap-2 text-left font-medium [@media(pointer:coarse)]:py-1.5"
                >
                  <Folder size={15} aria-hidden className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.nom}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {totalSd.get(s.id) ?? 0} fichier{(totalSd.get(s.id) ?? 0) > 1 ? "s" : ""}
                  </span>
                </button>
              </td>
            </tr>
          ))}
          {fichiers.map((f) => {
            const type = typeDe(f);
            return (
              <tr key={f.cle} className="align-top hover:bg-foreground/[0.03]">
                <td className="px-3 py-2">
                  <a
                    href={f.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-start gap-2 hover:underline"
                  >
                    {type === "Image" ? (
                      <ImageIcon size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 break-words">{f.nom}</span>
                  </a>
                  {/* Sur téléphone, les colonnes masquées passent sous le nom. */}
                  <p className="mt-0.5 pl-6 text-xs text-muted-foreground sm:hidden">
                    {[type, f.origine, dateFr(f.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                  {avecCategorie && (
                    <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{LIBELLES[f.categorie]}</p>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{type}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {f.lectureSeule && <Lock size={11} aria-label="Lecture seule" />}
                    {f.origine}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground sm:table-cell">
                  {dateFr(f.createdAt)}
                </td>
                <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">{f.auteur || "—"}</td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-end gap-0.5">
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ouvrir ${f.nom}`}
                      title="Ouvrir"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                    >
                      <ExternalLink size={15} aria-hidden />
                    </a>
                    <a
                      href={f.hrefTelechargement}
                      aria-label={`Télécharger ${f.nom}`}
                      title="Télécharger"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                    >
                      <Download size={15} aria-hidden />
                    </a>
                    {estAdmin && !f.lectureSeule && (
                      <SupprimerDocumentEmplacement id={f.id} nom={f.nom} onDone={onRefresh} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
