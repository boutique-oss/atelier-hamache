"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, FileText } from "lucide-react";

import { bulkSetStatut, bulkUpdateFlags } from "@/app/(main)/dossiers/actions";
import {
  DossierInlineEdit,
  StatutSelect,
  FlagsEditor,
} from "@/components/dossier-inline-edit";
import { DeleteDossierButton } from "@/components/delete-dossier-button";
import { CompletionCell } from "@/components/completion-cell";
import type { DossierCompletion } from "@/lib/dossier-completion";
import { FLAGS_PREDEF, STATUT_DEVIS_VALIDE } from "@/lib/dossiers";

export type DossierRow = {
  id: number;
  nomDossier: string;
  clientNom: string | null;
  typeIntervention: string | null;
  statut: string;
  flags: string[];
  heuresARealiser: number | null;
  cmdCount: number;
  completion: DossierCompletion;
  // Devis signés (PDF) rattachés : nombre + id du plus récent (accès direct via
  // la route protégée /api/devis/[id]).
  devisCount: number;
  devisFirstId: number | null;
};

// Colonnes triables : clé → accès à la valeur + type de tri.
type SortKey = "id" | "nomDossier" | "clientNom" | "typeIntervention" | "statut" | "heures" | "cmdes" | "remplissage";
const SORT_VALUE: Record<SortKey, (d: DossierRow) => string | number> = {
  id: (d) => d.id,
  nomDossier: (d) => d.nomDossier?.toLowerCase() ?? "",
  clientNom: (d) => d.clientNom?.toLowerCase() ?? "",
  typeIntervention: (d) => d.typeIntervention?.toLowerCase() ?? "",
  statut: (d) => d.statut?.toLowerCase() ?? "",
  heures: (d) => d.heuresARealiser ?? 0,
  cmdes: (d) => d.cmdCount,
  remplissage: (d) => d.completion.pct,
};

// Filtres rapides (chips). Chacun garde les lignes qui matchent.
const QUICK_FILTERS: { key: string; label: string; test: (d: DossierRow) => boolean }[] = [
  { key: "", label: "Tous", test: () => true },
  { key: "urgent", label: "Urgents", test: (d) => d.flags.includes("Urgent") },
  { key: "relancer", label: "À relancer", test: (d) => d.flags.includes("À relancer") || d.statut === "Relance" },
  { key: "sansHeures", label: "Sans heures", test: (d) => (d.heuresARealiser ?? 0) === 0 },
  { key: "attente", label: "En attente", test: (d) => d.flags.includes("Attente tissu") || d.flags.includes("Attente client") },
  // Regroupe le PDF de devis signé rattaché ET le statut « Devis signé / Validé ».
  { key: "devisSigne", label: "Devis signé / Validé", test: (d) => d.devisCount > 0 || d.statut === STATUT_DEVIS_VALIDE },
];

export function DossiersTable({
  rows,
  statutOptions,
  listeQs,
}: {
  rows: DossierRow[];
  statutOptions: string[];
  // Filtres courants de la liste (q, statut, type), conservés à l'ouverture.
  listeQs: string;
}) {
  // Clic sur un dossier = fiche en fenêtre par-dessus la liste (?d=<id>).
  const ficheHref = (id: number) =>
    `/dossiers?${listeQs ? `${listeQs}&` : ""}d=${id}`;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [flagsMenu, setFlagsMenu] = useState(false);
  const [flagChoice, setFlagChoice] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  // Vue : filtre rapide, tri, regroupement par statut.
  const [quick, setQuick] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Groupement par statut activé par défaut ; le volet « Clos » est replié et
  // ne s'ouvre qu'au clic sur son en-tête.
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["Clos"]));

  // Lignes filtrées + triées (ce qui est réellement affiché / sélectionnable).
  const view = useMemo(() => {
    const f = QUICK_FILTERS.find((q) => q.key === quick) ?? QUICK_FILTERS[0];
    const filtered = rows.filter(f.test);
    const get = SORT_VALUE[sortKey];
    const sorted = [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, quick, sortKey, sortDir]);

  const ids = useMemo(() => view.map((r) => r.id), [view]);
  const allSelected = selected.size > 0 && ids.every((id) => selected.has(id));

  // Groupes par statut (SAV en tête, puis ordre = statutOptions, extras à la fin).
  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, DossierRow[]>();
    for (const d of view) {
      const arr = map.get(d.statut) ?? [];
      arr.push(d);
      map.set(d.statut, arr);
    }
    // Le groupe SAV passe toujours en tête.
    const order = (s: string) => {
      if (s === "SAV") return -1;
      const i = statutOptions.indexOf(s);
      return i === -1 ? 999 : i;
    };
    return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [grouped, view, statutOptions]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }
  function clear() {
    setSelected(new Set());
  }
  function toggleGroup(s: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const selectedIds = () => [...selected];

  function applyStatut(statut: string) {
    if (!statut) return;
    start(() => bulkSetStatut(selectedIds(), statut));
  }
  function applyFlags(mode: "add" | "remove") {
    const chosen = [...flagChoice];
    if (chosen.length === 0) return;
    start(async () => {
      await bulkUpdateFlags(
        selectedIds(),
        mode === "add" ? chosen : [],
        mode === "remove" ? chosen : []
      );
      setFlagsMenu(false);
      setFlagChoice(new Set());
    });
  }
  function toggleFlagChoice(f: string) {
    setFlagChoice((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  const barCls =
    "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  // Rendu d'une ligne dossier (réutilisé en mode plat et groupé).
  function renderRow(d: DossierRow) {
    const isSel = selected.has(d.id);
    return (
      <tr key={d.id} className={`border-t hover:bg-muted/30 ${isSel ? "bg-primary/5" : ""}`}>
        <td className="px-3 py-3">
          <input type="checkbox" checked={isSel} onChange={() => toggle(d.id)} className="h-4 w-4" />
        </td>
        <td className="px-3 py-3 text-muted-foreground">{d.id}</td>
        <td className="px-3 py-3 font-medium">
          <Link
            href={ficheHref(d.id)}
            scroll={false}
            className="text-[15px] hover:text-primary hover:underline"
          >
            {d.nomDossier}
          </Link>
        </td>
        <td className="px-3 py-3">{d.clientNom || "—"}</td>
        <td className="px-3 py-3 text-muted-foreground">{d.typeIntervention || "—"}</td>
        <DossierInlineEdit
          key={`${d.id}-${d.statut}-${d.flags.join(",")}`}
          id={d.id}
          statut={d.statut}
          flags={d.flags}
          statutOptions={statutOptions}
        />
        <td className="px-3 py-3 text-right tabular-nums">{d.heuresARealiser ?? 0}</td>
        <td className="px-3 py-3 text-right tabular-nums">{d.cmdCount}</td>
        <td className="px-3 py-3 text-center">
          {d.devisCount === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : d.devisCount === 1 && d.devisFirstId ? (
            <a
              href={`/api/devis/${d.devisFirstId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir le devis signé (PDF)"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
            </a>
          ) : (
            <Link
              href={ficheHref(d.id)}
              scroll={false}
              title={`${d.devisCount} devis signés — ouvrir la fiche`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              <span className="text-xs">{d.devisCount}</span>
            </Link>
          )}
        </td>
        <td className="px-3 py-3">
          <CompletionCell
            pct={d.completion.pct}
            filledCount={d.completion.filledCount}
            total={d.completion.total}
            items={d.completion.items}
          />
        </td>
        <td className="px-3 py-3 text-right">
          <DeleteDossierButton id={d.id} nom={d.nomDossier} />
        </td>
      </tr>
    );
  }

  // Rendu d'un dossier en carte (vue mobile < lg). Même infos que la ligne du
  // tableau, empilées et lisibles sur petit écran, avec édition rapide du
  // statut et des étiquettes.
  function renderCard(d: DossierRow) {
    const isSel = selected.has(d.id);
    return (
      <div
        key={d.id}
        className={`rounded-xl border p-3 ${isSel ? "border-primary/40 bg-primary/5" : ""}`}
      >
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={isSel}
            onChange={() => toggle(d.id)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <Link
              href={ficheHref(d.id)}
              scroll={false}
              className="block font-medium leading-snug hover:text-primary hover:underline"
            >
              {d.nomDossier}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              #{d.id}
              {d.clientNom ? ` · ${d.clientNom}` : ""}
              {d.typeIntervention ? ` · ${d.typeIntervention}` : ""}
            </p>
          </div>
          <DeleteDossierButton id={d.id} nom={d.nomDossier} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <StatutSelect id={d.id} statut={d.statut} statutOptions={statutOptions} />
          <FlagsEditor
            key={`${d.id}-${d.flags.join(",")}`}
            id={d.id}
            flags={d.flags}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{d.heuresARealiser ?? 0} h</span>
          <span className="tabular-nums">
            {d.cmdCount} cmde{d.cmdCount > 1 ? "s" : ""}
          </span>
          {d.devisCount > 0 &&
            (d.devisCount === 1 && d.devisFirstId ? (
              <a
                href={`/api/devis/${d.devisFirstId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> Devis
              </a>
            ) : (
              <Link
                href={ficheHref(d.id)}
                scroll={false}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> {d.devisCount} devis
              </Link>
            ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5">
          <CompletionCell
            pct={d.completion.pct}
            filledCount={d.completion.filledCount}
            total={d.completion.total}
            items={d.completion.items}
          />
        </div>
      </div>
    );
  }

  // En-tête de colonne triable.
  function Th({ label, k, align = "left" }: { label: string; k: SortKey; align?: "left" | "right" }) {
    const active = sortKey === k;
    return (
      <th className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
        <button
          type="button"
          onClick={() => sortBy(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        >
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : null}
        </button>
      </th>
    );
  }

  return (
    <div>
      {/* Filtres rapides + regroupement */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map((q) => {
          const n = q.key === "" ? rows.length : rows.filter(q.test).length;
          const on = quick === q.key;
          return (
            <button
              key={q.key || "tous"}
              type="button"
              onClick={() => setQuick(q.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {q.label} <span className={on ? "opacity-80" : "text-muted-foreground"}>({n})</span>
            </button>
          );
        })}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Grouper par statut
        </label>
      </div>

      {/* Barre d'actions groupées — visible dès qu'une ligne est cochée */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Statut :</span>
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                applyStatut(e.target.value);
                e.target.value = "";
              }}
              className={barCls}
            >
              <option value="">— choisir —</option>
              {statutOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="relative">
            <button
              type="button"
              disabled={pending}
              onClick={() => setFlagsMenu((o) => !o)}
              className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Flags ▾
            </button>
            {flagsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFlagsMenu(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border bg-background p-2 shadow-md">
                  <div className="mb-2 flex flex-col gap-1">
                    {FLAGS_PREDEF.map((f) => (
                      <label
                        key={f}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={flagChoice.has(f)}
                          onChange={() => toggleFlagChoice(f)}
                          className="h-3.5 w-3.5"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={pending || flagChoice.size === 0}
                      onClick={() => applyFlags("add")}
                      className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      disabled={pending || flagChoice.size === 0}
                      onClick={() => applyFlags("remove")}
                      className="flex-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="ml-auto text-xs text-muted-foreground hover:underline"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Vue mobile : cartes empilées (< lg) */}
      <div className="space-y-3 lg:hidden">
        {view.length === 0 ? (
          <p className="rounded-xl border px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun dossier ne correspond.
          </p>
        ) : groups ? (
          groups.map(([statut, list]) => {
            const isCollapsed = collapsed.has(statut);
            return (
              <div key={statut} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(statut)}
                  className="flex w-full items-center gap-2 text-sm font-semibold hover:text-primary"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {statut}
                  <span className="font-normal text-muted-foreground">({list.length})</span>
                </button>
                {!isCollapsed && list.map(renderCard)}
              </div>
            );
          })
        ) : (
          view.map(renderCard)
        )}
      </div>

      {/* Vue desktop : tableau (≥ lg) */}
      <div className="hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4"
                  title="Tout sélectionner"
                />
              </th>
              <Th label="#" k="id" />
              <Th label="Dossier" k="nomDossier" />
              <Th label="Client" k="clientNom" />
              <Th label="Type" k="typeIntervention" />
              <Th label="Statut" k="statut" />
              <th className="px-3 py-3 font-medium">Flags</th>
              <Th label="Heures" k="heures" align="right" />
              <Th label="Cmdes" k="cmdes" align="right" />
              <th className="px-3 py-3 text-center font-medium">Devis</th>
              <Th label="Remplissage" k="remplissage" />
              <th className="px-3 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                  Aucun dossier ne correspond.
                </td>
              </tr>
            ) : groups ? (
              groups.map(([statut, list]) => {
                const isCollapsed = collapsed.has(statut);
                return (
                  <GroupBlock
                    key={statut}
                    statut={statut}
                    count={list.length}
                    collapsed={isCollapsed}
                    onToggle={() => toggleGroup(statut)}
                  >
                    {!isCollapsed && list.map(renderRow)}
                  </GroupBlock>
                );
              })
            ) : (
              view.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Bloc de groupe (ligne d'en-tête cliquable + ses lignes).
function GroupBlock({
  statut,
  count,
  collapsed,
  onToggle,
  children,
}: {
  statut: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t bg-muted/30">
        <td colSpan={12} className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {statut}
            <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        </td>
      </tr>
      {children}
    </>
  );
}
