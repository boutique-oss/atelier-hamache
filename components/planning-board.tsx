"use client";

// Tableau du planning, porté de la logique d'Open Sunsama
// (apps/web/src/components/kanban/kanban-board.tsx, day-column.tsx,
// kanban-calendar-panel.tsx, calendar/event-layout.ts) :
//  - mode « Tableau » (jours côte à côte, défilement horizontal infini) ou
//    « Jour » (une seule colonne large + son agenda au centre), mémorisé ;
//  - barre d'outils : ‹ Aujourd'hui ›, aller à une date, recherche, tri ;
//  - colonne jour : en-tête cliquable, compteur, barre de progression
//    réservée sur chaque jour (remplie aujourd'hui), barre « + Ajouter »
//    alignée, cartes, glisser-déposer d'un jour à l'autre ;
//  - panneau agenda à droite qui suit le premier jour visible : journée
//    entière en bandeau, grille horaire + demi-heures, bornes de journée en
//    zigzag, ligne « maintenant » rafraîchie chaque minute, défilement auto
//    vers l'heure courante, clic sur un créneau = nouvelle entrée, dépôt
//    d'une carte = la caler à cette heure, chevauchements côte à côte.

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Search,
  Square,
} from "lucide-react";

import { deplacerEntreePlanning, type EntreeOrigine, type TypeEntree } from "@/app/(main)/planning/actions";
import { ChantierItem } from "@/components/chantier-item";
import { CarteIntervention, EntreeWidget, useTypes } from "@/components/planning-entree";

// ── Données reçues de la page ─────────────────────────────────────────────
export type ItemPlanning = {
  id: number; // dossier
  nom: string;
  client: string | null;
  field: Exclude<TypeEntree, "chantier">;
  entreeId?: number;
  date: string;
  heure: string;
  rappels: string;
  comment: string;
};
export type ChantierPlanning = {
  id: number;
  nom: string;
  client: string | null;
  debut: string;
  fin: string;
  comment: string;
};
export type CongePlanning = {
  id: number;
  operateur: string;
  type: string;
  valide: boolean;
  fermeture: boolean;
  debut: string;
  fin: string;
  couleur: string;
};

// ── Constantes (mêmes rôles que dans Open Sunsama) ────────────────────────
const COLUMN_WIDTH = 280; // useKanbanDates.COLUMN_WIDTH
const VISIBLE_DAYS = 7; // pas de navigation ‹ ›
const HOUR_HEIGHT = 60;
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 21;
const SNAP_INTERVAL = 15; // minutes
const DUREE_MIN = 30; // durée d'un créneau (identique à l'événement Google)
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const MODE_KEY = "planning-mode";
const SORT_KEY = "planning-tri";

type Mode = "board" | "day";
type Tri = "heure" | "type" | "dossier";
const TRIS: { value: Tri; label: string }[] = [
  { value: "heure", label: "Heure" },
  { value: "type", label: "Type d'intervention" },
  { value: "dossier", label: "Dossier (A → Z)" },
];

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const jourSemaine = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const dateLongue = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
};
const toMin = (hm: string) => {
  const [h, m] = (hm || "07:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const yDepuisMin = (min: number) => ((min - TIMELINE_START_HOUR * 60) / 60) * HOUR_HEIGHT;
const minDepuisY = (y: number) => {
  const brut = TIMELINE_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  const snap = Math.round(brut / SNAP_INTERVAL) * SNAP_INTERVAL;
  return Math.min(Math.max(snap, TIMELINE_START_HOUR * 60), TIMELINE_END_HOUR * 60 - SNAP_INTERVAL);
};
const cleItem = (i: ItemPlanning) => `${i.field}-${i.id}-${i.entreeId ?? ""}`;
const maintenantMin = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

// Préférence mémorisée dans le navigateur (comme useBoardMode / useSortPreference).
function usePreference<T extends string>(key: string, defaut: T, valides: readonly T[]) {
  const [v, setV] = useState<T>(defaut);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key) as T | null;
      if (s && valides.includes(s)) setV(s);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const maj = useCallback(
    (n: T) => {
      setV(n);
      try {
        localStorage.setItem(key, n);
      } catch {}
    },
    [key]
  );
  return [v, maj] as const;
}

// ── Chevauchements côte à côte (port de calendar/event-layout.ts) ─────────
type LayoutItem = { id: string; start: number; end: number };
type LayoutResult = { lane: number; columnCount: number };

function layoutOverlappingItems(items: LayoutItem[]): Map<string, LayoutResult> {
  const result = new Map<string, LayoutResult>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: LayoutItem[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const placements = cluster.map((it) => {
      let lane = laneEnds.findIndex((e) => e <= it.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.end);
      } else laneEnds[lane] = it.end;
      return { id: it.id, lane };
    });
    const columnCount = Math.max(1, ...placements.map((p) => p.lane + 1));
    for (const p of placements) result.set(p.id, { lane: p.lane, columnCount });
    cluster = [];
    clusterEnd = -Infinity;
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return result;
}

// ── Glisser-déposer (HTML5 natif) ─────────────────────────────────────────
type Charge = { o: EntreeOrigine; date: string; heure: string; nom: string };
const MIME = "application/x-planning";
let chargeCourante: Charge | null = null; // dataTransfer illisible pendant dragover

function demarrerGlisser(e: React.DragEvent, c: Charge) {
  chargeCourante = c;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(MIME, JSON.stringify(c));
}
function lireCharge(e: React.DragEvent): Charge | null {
  try {
    const brut = e.dataTransfer.getData(MIME);
    return brut ? (JSON.parse(brut) as Charge) : chargeCourante;
  } catch {
    return chargeCourante;
  }
}

// ── Tableau ───────────────────────────────────────────────────────────────
export function PlanningBoard({
  jours,
  centre,
  today,
  items,
  chantiers,
  conges,
}: {
  jours: string[]; // fenêtre chargée (centre − 14 j … centre + 27 j)
  centre: string;
  today: string;
  items: ItemPlanning[];
  chantiers: ChantierPlanning[];
  conges: CongePlanning[];
}) {
  const router = useRouter();
  const types = useTypes();
  const [mode, setMode] = usePreference<Mode>(MODE_KEY, "board", ["board", "day"]);
  const [tri, setTri] = usePreference<Tri>(SORT_KEY, "heure", ["heure", "type", "dossier"]);
  const [recherche, setRecherche] = useState("");
  const [jourSeul, setJourSeul] = useState(centre);
  const [leading, setLeading] = useState(centre);
  const [creation, setCreation] = useState<{ date: string; heure: string } | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const cibleScroll = useRef<string | null>(centre);

  // Déplacements optimistes, effacés quand la page renvoie les nouvelles données.
  const [deplaces, setDeplaces] = useState<Map<string, { date: string; heure?: string }>>(new Map());
  useEffect(() => setDeplaces(new Map()), [items, chantiers]);

  const labelType = useMemo(() => new Map(types.map((t) => [t.value, t.label])), [types]);
  const ordreType = useMemo(() => new Map(types.map((t, i) => [t.value, i])), [types]);

  const itemsVus = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return items
      .map((i) => {
        const d = deplaces.get(cleItem(i));
        return d ? { ...i, date: d.date, heure: d.heure ?? i.heure } : i;
      })
      .filter(
        (i) =>
          !q ||
          `${i.nom} ${i.client ?? ""} ${i.comment} ${labelType.get(i.field) ?? ""}`
            .toLowerCase()
            .includes(q)
      );
  }, [items, deplaces, recherche, labelType]);

  const chantiersVus = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return chantiers
      .map((c) => {
        const d = deplaces.get(`chantier-${c.id}`);
        if (!d) return c;
        const dow = (jourSemaine(d.date) + 6) % 7;
        const lundi = addDays(d.date, -dow);
        return { ...c, debut: lundi, fin: addDays(lundi, 6) };
      })
      .filter((c) => !q || `${c.nom} ${c.client ?? ""} ${c.comment} chantier`.toLowerCase().includes(q));
  }, [chantiers, deplaces, recherche]);

  const trier = useCallback(
    (liste: ItemPlanning[]) =>
      [...liste].sort((a, b) => {
        if (tri === "type")
          return (ordreType.get(a.field) ?? 99) - (ordreType.get(b.field) ?? 99) || toMin(a.heure) - toMin(b.heure);
        if (tri === "dossier") return a.nom.localeCompare(b.nom, "fr");
        return toMin(a.heure) - toMin(b.heure);
      }),
    [tri, ordreType]
  );

  const itemsDuJour = useCallback(
    (jour: string) => trier(itemsVus.filter((i) => i.date === jour)),
    [itemsVus, trier]
  );
  const chantiersDuJour = useCallback(
    (jour: string) =>
      jourSemaine(jour) === 0 ? [] : chantiersVus.filter((c) => c.debut <= jour && c.fin >= jour),
    [chantiersVus]
  );
  const congesDuJour = useCallback(
    (jour: string) => conges.filter((c) => c.debut <= jour && c.fin >= jour),
    [conges]
  );

  // ── Navigation (useKanbanDates) ──
  const indexDe = (jour: string) => jours.indexOf(jour);
  const recentrer = useCallback(
    (jour: string) => {
      cibleScroll.current = jour;
      router.replace(jour === today ? "/planning" : `/planning?centre=${jour}`, { scroll: false });
    },
    [router, today]
  );
  const allerA = useCallback(
    (jour: string, instant = false) => {
      const i = jours.indexOf(jour);
      const el = containerRef.current;
      if (i < 0 || !el) return recentrer(jour);
      el.scrollTo({ left: i * COLUMN_WIDTH, behavior: instant ? "auto" : "smooth" });
    },
    [jours, recentrer]
  );

  // Après chargement d'une nouvelle fenêtre : replacer le jour visé à gauche.
  useEffect(() => {
    if (mode !== "board") return;
    const cible = cibleScroll.current;
    if (!cible) return;
    const i = jours.indexOf(cible);
    if (i < 0) {
      recentrer(cible);
    } else if (containerRef.current) {
      containerRef.current.scrollLeft = i * COLUMN_WIDTH;
      setLeading(cible);
      cibleScroll.current = null;
    }
  }, [jours, mode, recentrer]);

  // Jour de tête lu depuis le défilement ; près des bords on recharge une
  // fenêtre centrée dessus (défilement infini).
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const i = Math.min(jours.length - 1, Math.max(0, Math.round(el.scrollLeft / COLUMN_WIDTH)));
    const jour = jours[i];
    if (jour !== leading) setLeading(jour);
    if (!cibleScroll.current && (i < 2 || i > jours.length - VISIBLE_DAYS - 2)) recentrer(jour);
  };

  const nav =
    mode === "day"
      ? {
          prec: () => {
            const j = addDays(jourSeul, -1);
            setJourSeul(j);
            if (indexDe(j) < 0) recentrer(j);
          },
          suiv: () => {
            const j = addDays(jourSeul, 1);
            setJourSeul(j);
            if (indexDe(j) < 0) recentrer(j);
          },
          auj: () => setJourSeul(today),
          aller: (j: string) => {
            setJourSeul(j);
            if (indexDe(j) < 0) recentrer(j);
          },
        }
      : {
          prec: () => allerA(addDays(leading, -VISIBLE_DAYS)),
          suiv: () => allerA(addDays(leading, VISIBLE_DAYS)),
          auj: () => allerA(today),
          aller: (j: string) => allerA(j),
        };

  const changerMode = (m: Mode) => {
    if (m === mode) return;
    if (m === "day") setJourSeul(leading);
    else cibleScroll.current = jourSeul;
    setMode(m);
  };

  // Le panneau agenda suit le jour de tête (ou le jour affiché en mode Jour).
  const jourPanneau = mode === "day" ? jourSeul : leading;

  // ── Déplacement par glisser-déposer ──
  const deplacer = (c: Charge, date: string, heure?: string) => {
    if (c.date === date && (heure === undefined || heure === c.heure)) return;
    const cle =
      c.o.type === "chantier" ? `chantier-${c.o.dossierId}` : `${c.o.type}-${c.o.dossierId}-${c.o.entreeId ?? ""}`;
    setDeplaces((m) => new Map(m).set(cle, { date, heure }));
    startTransition(async () => {
      try {
        await deplacerEntreePlanning(c.o, date, heure);
      } catch {
        // Échec : la carte revient à sa place.
        setDeplaces((m) => {
          const n = new Map(m);
          n.delete(cle);
          return n;
        });
        alert("Déplacement non enregistré — réessaie.");
      }
      router.refresh();
    });
  };

  const colonne = (jour: string, large = false) => (
    <ColonneJour
      key={jour}
      jour={jour}
      today={today}
      large={large}
      items={itemsDuJour(jour)}
      chantiers={chantiersDuJour(jour)}
      conges={congesDuJour(jour)}
      onTitre={() => (mode === "day" ? undefined : allerA(jour))}
      onAjouter={() => setCreation({ date: jour, heure: "" })}
      onDeposer={(c) => deplacer(c, jour)}
    />
  );

  const panneau = (
    <PanneauAgenda
      jour={jourPanneau}
      today={today}
      items={itemsDuJour(jourPanneau)}
      chantiers={chantiersDuJour(jourPanneau)}
      conges={congesDuJour(jourPanneau)}
      onCreneau={(heure) => setCreation({ date: jourPanneau, heure })}
      onDeposer={(c, heure) => deplacer(c, jourPanneau, heure)}
    />
  );

  return (
    <div className="flex h-[calc(100vh-9.5rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border bg-muted/20">
      {/* Barre d'outils (KanbanBoardToolbar) */}
      <div className="flex h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3">
        <div className="flex items-center">
          <button type="button" onClick={nav.prec} className="rounded-md p-1.5 hover:bg-muted" aria-label="Précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nav.auj}
            className="rounded-md border px-2.5 py-1 text-sm font-medium hover:bg-muted"
          >
            Aujourd&apos;hui
          </button>
          <button type="button" onClick={nav.suiv} className="rounded-md p-1.5 hover:bg-muted" aria-label="Suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <label className="relative flex items-center" title="Aller à une date">
          <CalendarDays className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={mode === "day" ? jourSeul : leading}
            onChange={(e) => e.target.value && nav.aller(e.target.value)}
            className="rounded-md border bg-background py-1 pl-8 pr-2 text-sm"
          />
        </label>
        <span className="hidden text-sm font-semibold md:inline">
          {mode === "day" ? `${JOURS[jourSemaine(jourSeul)]} ${dateLongue(jourSeul)}` : `Semaine du ${dateLongue(leading)}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher…"
              className="w-36 rounded-md border bg-background py-1 pl-8 pr-2 text-sm sm:w-48"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-muted-foreground" title="Tri des cartes">
            <ArrowUpDown className="h-4 w-4" />
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as Tri)}
              className="rounded-md border bg-background px-1.5 py-1 text-sm text-foreground"
            >
              {TRIS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => changerMode("day")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-sm ${mode === "day" ? "bg-muted font-medium" : "text-muted-foreground"}`}
            >
              <Square className="h-3.5 w-3.5" /> Jour
            </button>
            <button
              type="button"
              onClick={() => changerMode("board")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-sm ${mode === "board" ? "bg-muted font-medium" : "text-muted-foreground"}`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Tableau
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {mode === "day" ? (
          // Le jour et son agenda, côte à côte au centre de la page.
          <div className="flex min-h-0 flex-1 justify-center gap-5 overflow-hidden px-4">
            {colonne(jourSeul, true)}
            <div className="hidden h-full shrink-0 lg:block">{panneau}</div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              onScroll={onScroll}
              className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden sm:snap-none"
            >
              {jours.map((j) => colonne(j))}
            </div>
            <div className="hidden h-full shrink-0 lg:block">{panneau}</div>
          </>
        )}
      </div>

      {creation && (
        <EntreeWidget
          initiale={{
            dossierId: null,
            type: "dateLivraison",
            date: creation.date,
            heure: creation.heure,
            rappels: [1440, 0],
            comment: "",
          }}
          onClose={() => setCreation(null)}
        />
      )}
    </div>
  );
}

// ── Colonne jour (day-column.tsx) ─────────────────────────────────────────
function ColonneJour({
  jour,
  today,
  large,
  items,
  chantiers,
  conges,
  onTitre,
  onAjouter,
  onDeposer,
}: {
  jour: string;
  today: string;
  large: boolean;
  items: ItemPlanning[];
  chantiers: ChantierPlanning[];
  conges: CongePlanning[];
  onTitre: () => void;
  onAjouter: () => void;
  onDeposer: (c: Charge) => void;
}) {
  const [survol, setSurvol] = useState(false);
  const estAuj = jour === today;
  const passe = jour < addDays(today, -1);
  const dow = jourSemaine(jour);

  // Aujourd'hui : part des interventions dont l'heure est passée.
  const [mnt, setMnt] = useState<number | null>(null);
  useEffect(() => {
    if (!estAuj) return;
    setMnt(maintenantMin());
    const t = setInterval(() => setMnt(maintenantMin()), 60000);
    return () => clearInterval(t);
  }, [estAuj]);
  const faites = mnt === null ? 0 : items.filter((i) => toMin(i.heure) <= mnt).length;
  const progression = items.length ? Math.round((faites / items.length) * 100) : 0;

  const nom = large
    ? JOURS[dow]
    : estAuj
      ? "Aujourd'hui"
      : jour === addDays(today, 1)
        ? "Demain"
        : JOURS[dow];

  return (
    <div
      data-board-day={jour}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME)) return;
        e.preventDefault();
        if (!survol) setSurvol(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setSurvol(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const c = lireCharge(e);
        if (c) onDeposer(c);
      }}
      className={`flex h-full shrink-0 snap-start flex-col transition-colors duration-150 ${
        large ? "w-full max-w-[340px] px-1" : "w-[calc(100vw-1rem)] sm:w-[280px] sm:px-1"
      } ${survol ? "bg-primary/5 ring-2 ring-inset ring-primary/20" : ""} ${passe ? "opacity-60" : ""} ${
        dow === 0 || dow === 6 ? "bg-muted/30" : ""
      }`}
    >
      <div className="px-2 pb-2 pt-4">
        <button type="button" onClick={onTitre} className="block px-1 text-left transition-opacity hover:opacity-70">
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {nom}
            {items.length > 0 && (
              <span
                className={`rounded px-1.5 py-px text-xs font-semibold tabular-nums ${
                  estAuj ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {items.length}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">{dateLongue(jour)}</div>
        </button>

        {/* Réservée sur chaque jour pour aligner les barres « Ajouter ». */}
        <div className="mx-1 mt-2.5 h-1.5 overflow-hidden rounded-full" title={estAuj ? `${faites}/${items.length} interventions passées` : undefined}>
          {estAuj && (
            <div className="h-full w-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${progression}%` }} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onAjouter}
          className="mt-2.5 flex h-8 w-full items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm text-muted-foreground shadow-sm hover:text-foreground"
        >
          <span className="text-base leading-none">+</span>
          {estAuj || large ? "Ajouter une intervention" : "Ajouter"}
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {/* Journée entière : chantiers (déplaçables) + congés. */}
        {chantiers.map((c) => (
          <div
            key={`ch-${c.id}`}
            draggable
            onDragStart={(e) =>
              demarrerGlisser(e, { o: { dossierId: c.id, type: "chantier" }, date: jour, heure: "", nom: c.nom })
            }
          >
            <ChantierItem id={c.id} nom={`🔨 ${c.nom}`} client={c.client} debut={c.debut} comment={c.comment} />
          </div>
        ))}
        {conges.map((c) =>
          c.fermeture ? (
            <div key={`cg-${c.id}`} className="rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
              🔒 Atelier fermé
            </div>
          ) : (
            <div
              key={`cg-${c.id}`}
              title={`${c.operateur} · ${c.type}${c.valide ? "" : " (à valider)"}`}
              className={`flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] ${
                c.valide ? "bg-background" : "border-dashed bg-background/60"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${c.couleur}`} />
              <span className="font-medium">{c.operateur}</span>
              <span className="text-muted-foreground">congés</span>
            </div>
          )
        )}

        {items.map((i) => (
          <div
            key={cleItem(i)}
            draggable
            onDragStart={(e) =>
              demarrerGlisser(e, {
                o: { dossierId: i.id, type: i.field, entreeId: i.entreeId ?? null },
                date: i.date,
                heure: i.heure,
                nom: i.nom,
              })
            }
            className="cursor-grab active:cursor-grabbing"
          >
            <CarteIntervention
              id={i.id}
              nom={i.nom}
              client={i.client}
              field={i.field}
              entreeId={i.entreeId}
              date={i.date}
              heure={i.heure}
              rappels={i.rappels}
              comment={i.comment}
            />
          </div>
        ))}

        {items.length === 0 && survol && (
          <div className="h-16 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5" />
        )}
      </div>
    </div>
  );
}

// ── Panneau agenda (kanban-calendar-panel.tsx) ────────────────────────────
function PanneauAgenda({
  jour,
  today,
  items,
  chantiers,
  conges,
  onCreneau,
  onDeposer,
}: {
  jour: string;
  today: string;
  items: ItemPlanning[];
  chantiers: ChantierPlanning[];
  conges: CongePlanning[];
  onCreneau: (heure: string) => void;
  onDeposer: (c: Charge, heure: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const estAuj = jour === today;
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const [apercu, setApercu] = useState<{ nom: string; min: number } | null>(null);
  const heures = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, i) => TIMELINE_START_HOUR + i
  );

  // Ligne « maintenant », rafraîchie chaque minute.
  useEffect(() => {
    const maj = () => setMaintenant(estAuj ? maintenantMin() : null);
    maj();
    const t = setInterval(maj, 60000);
    return () => clearInterval(t);
  }, [estAuj]);

  // Défilement auto vers l'heure courante (ou 8h) à chaque changement de jour.
  useEffect(() => {
    if (!scrollRef.current) return;
    const h = estAuj ? new Date().getHours() - 1 : WORK_START_HOUR;
    scrollRef.current.scrollTop = Math.max(0, (h - TIMELINE_START_HOUR) * HOUR_HEIGHT);
  }, [jour, estAuj]);

  const layouts = useMemo(
    () =>
      layoutOverlappingItems(
        items.map((i) => ({ id: cleItem(i), start: toMin(i.heure), end: toMin(i.heure) + DUREE_MIN }))
      ),
    [items]
  );

  const minSouris = (clientY: number) => {
    const r = timelineRef.current?.getBoundingClientRect();
    return minDepuisY(r ? clientY - r.top : 0);
  };

  const d = new Date(`${jour}T00:00:00Z`);

  return (
    <div className="flex h-full w-[280px] flex-col border-l border-border/60 bg-background">
      <div className="flex h-14 shrink-0 flex-col justify-center px-3 leading-tight">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {JOURS[d.getUTCDay()].slice(0, 3)}.
        </div>
        <div className="text-base font-semibold">{dateLongue(jour)}</div>
      </div>

      {/* Bandeau journée entière */}
      {(chantiers.length > 0 || conges.length > 0) && (
        <div className="shrink-0 space-y-0.5 border-b bg-muted/30 px-2 py-1">
          {chantiers.map((c) => (
            <a
              key={`ch-${c.id}`}
              href={`/dossiers/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate rounded border-l-2 border-sky-500 bg-sky-500/10 px-1.5 py-0.5 text-[11px] hover:brightness-95"
            >
              🔨 {c.nom}
            </a>
          ))}
          {conges.map((c) => (
            <div
              key={`cg-${c.id}`}
              className="truncate rounded border-l-2 border-rose-500 bg-rose-500/10 px-1.5 py-0.5 text-[11px]"
            >
              {c.fermeture ? "🔒 Atelier fermé" : `${c.operateur} — congés`}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ minHeight: heures.length * HOUR_HEIGHT }}>
          {/* Heures */}
          <div className="sticky left-0 z-10 w-10 shrink-0 bg-background">
            {heures.map((h) => (
              <div key={h} className="relative border-b border-border/30" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-1 text-[10px] text-muted-foreground/70">{h}h</span>
              </div>
            ))}
          </div>

          {/* Grille : clic = nouvelle entrée à ce créneau ; dépôt = caler l'heure */}
          <div
            ref={timelineRef}
            className={`relative flex-1 ${apercu ? "bg-primary/[0.04]" : ""}`}
            onClick={(e) => {
              // Les clics venus d'un portail (widget ouvert) remontent ici dans
              // l'arbre React : seuls les vrais clics sur la grille comptent.
              if (!e.currentTarget.contains(e.target as Node)) return;
              if ((e.target as HTMLElement).closest("[data-time-block]")) return;
              onCreneau(toHm(minSouris(e.clientY)));
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(MIME)) return;
              e.preventDefault();
              const min = minSouris(e.clientY);
              if (!apercu || apercu.min !== min) setApercu({ nom: chargeCourante?.nom ?? "", min });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setApercu(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setApercu(null);
              const c = lireCharge(e);
              if (c && c.o.type !== "chantier") onDeposer(c, toHm(minSouris(e.clientY)));
            }}
          >
            {heures.map((h) => (
              <div key={h} className="border-b border-border/20 transition-colors hover:bg-accent/30" style={{ height: HOUR_HEIGHT }} />
            ))}
            {heures.map((h) => (
              <div
                key={`${h}-demi`}
                className="pointer-events-none absolute left-0 right-0 border-b border-border/10"
                style={{ top: (h - TIMELINE_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Début / fin de journée d'atelier, en zigzag */}
            <BorneJournee top={(WORK_START_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT} label="Début de journée" />
            <BorneJournee top={(WORK_END_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT} label="Fin de journée" />

            {/* Interventions, côte à côte quand elles se chevauchent */}
            {items.map((i) => {
              const l = layouts.get(cleItem(i)) ?? { lane: 0, columnCount: 1 };
              const largeur = 100 / l.columnCount;
              return (
                <div
                  key={cleItem(i)}
                  data-time-block
                  draggable
                  onDragStart={(e) =>
                    demarrerGlisser(e, {
                      o: { dossierId: i.id, type: i.field, entreeId: i.entreeId ?? null },
                      date: i.date,
                      heure: i.heure,
                      nom: i.nom,
                    })
                  }
                  className="absolute z-20 cursor-grab px-0.5 active:cursor-grabbing"
                  style={{
                    top: yDepuisMin(toMin(i.heure)) + 1,
                    height: (DUREE_MIN / 60) * HOUR_HEIGHT - 2,
                    left: `${l.lane * largeur}%`,
                    width: `${largeur}%`,
                  }}
                >
                  <CarteIntervention
                    bloc
                    style={{ inset: 0, height: "100%" }}
                    id={i.id}
                    nom={i.nom}
                    field={i.field}
                    entreeId={i.entreeId}
                    date={i.date}
                    heure={i.heure}
                    rappels={i.rappels}
                    comment={i.comment}
                  />
                </div>
              );
            })}

            {/* Où la carte va atterrir */}
            {apercu && (
              <div
                className="pointer-events-none absolute left-1 right-1 z-30 rounded-md border-2 border-dashed border-primary/60 bg-primary/10 px-1.5 text-[11px] text-primary"
                style={{ top: yDepuisMin(apercu.min), height: (DUREE_MIN / 60) * HOUR_HEIGHT }}
              >
                {toHm(apercu.min)} · {apercu.nom}
              </div>
            )}

            {maintenant !== null &&
              maintenant >= TIMELINE_START_HOUR * 60 &&
              maintenant <= TIMELINE_END_HOUR * 60 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
                  style={{ top: yDepuisMin(maintenant) }}
                >
                  <div className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                  <div className="h-px flex-1 bg-red-500" />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Zigzag marquant le début ou la fin de la journée (WorkdayEdge).
function BorneJournee({ top, label }: { top: number; label: string }) {
  const id = useId();
  return (
    <svg
      aria-label={label}
      role="img"
      className="pointer-events-none absolute left-0 right-0 z-[5] text-muted-foreground/40"
      style={{ top: top - 3 }}
      height="6"
      width="100%"
    >
      <defs>
        <pattern id={id} width="8" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 5 L4 1 L8 5" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="6" fill={`url(#${id})`} />
    </svg>
  );
}
