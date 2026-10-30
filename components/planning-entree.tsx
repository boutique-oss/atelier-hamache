"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bell, Plus, Trash2, X } from "lucide-react";

import {
  creerTypeIntervention,
  enregistrerEntreePlanning,
  retirerTypeIntervention,
  supprimerEntreePlanning,
  type EntreeOrigine,
  type TypeEntree,
} from "@/app/(main)/planning/actions";
import {
  COULEURS_TYPE,
  clePerso,
  couleurType,
  type TypeIntervention,
} from "@/lib/types-intervention";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// ── Dossiers + types ajoutés pour le widget (fournis par la page) ─────────
export type DossierChoix = {
  id: number;
  nom: string;
  client: string | null;
  statut: string;
};

const PlanningCtx = createContext<{
  dossiers: DossierChoix[];
  types: TypeIntervention[];
}>({ dossiers: [], types: [] });

export function PlanningDossiersProvider({
  dossiers,
  types,
  children,
}: {
  dossiers: DossierChoix[];
  types: TypeIntervention[];
  children: React.ReactNode;
}) {
  return (
    <PlanningCtx.Provider value={{ dossiers, types }}>{children}</PlanningCtx.Provider>
  );
}

// ── Types d'intervention ──────────────────────────────────────────────────
type TypeAffiche = { value: TypeEntree; label: string; pastille: string; persoId?: number };

// Types de base + types ajoutés, dans l'ordre d'affichage.
export function useTypes(): TypeAffiche[] {
  const { types } = useContext(PlanningCtx);
  return [
    ...TYPES_ENTREE,
    ...types.map((t) => ({
      value: clePerso(t.id),
      label: t.libelle,
      pastille: `rounded-full ${couleurType(t.couleur).pastille}`,
      persoId: t.id,
    })),
  ];
}

export const TYPES_ENTREE: TypeAffiche[] = [
  { value: "dateEnlevementDepot", label: "Enlèvement / dépôt", pastille: "rounded-full bg-red-500" },
  { value: "dateLivraison", label: "Livraison", pastille: "rounded-full bg-emerald-500" },
  { value: "datePriseDeCote", label: "Prise de cote", pastille: "rounded-[2px] bg-yellow-400" },
  { value: "chantier", label: "Chantier (semaine)", pastille: "rounded bg-sky-500" },
];

// ── Rappels (minutes AVANT l'heure de l'intervention) ─────────────────────
const RAPPELS_RAPIDES: { min: number; label: string }[] = [
  { min: 2880, label: "2 jours avant" },
  { min: 1440, label: "La veille" },
  { min: 180, label: "3h avant" },
  { min: 60, label: "1h avant" },
  { min: 30, label: "30 min avant" },
  { min: 15, label: "15 min avant" },
  { min: 0, label: "À l'heure" },
];

// Rappels par défaut d'une nouvelle entrée : veille + à l'heure.
const RAPPELS_DEFAUT = [1440, 0];

const toMin = (hm: string) => {
  const [h, m] = (hm || "07:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHm = (min: number) => {
  const x = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

// Libellé d'un rappel : jour + heure d'envoi calculés depuis l'heure de
// l'intervention (ex. « Veille à 07:00 »), + le délai.
export function libelleRappel(min: number, heure: string): string {
  const envoi = toMin(heure) - min;
  const jours = Math.ceil(-envoi / 1440);
  const jour =
    envoi >= 0 ? "Jour J" : jours === 1 ? "Veille" : `J-${jours}`;
  const delai =
    min === 0
      ? "à l'heure"
      : min % 1440 === 0
        ? `${min / 1440} j avant`
        : min % 60 === 0
          ? `${min / 60} h avant`
          : min >= 60
            ? `${Math.floor(min / 60)} h ${min % 60} avant`
            : `${min} min avant`;
  return `${jour} à ${toHm(envoi)} · ${delai}`;
}

export function parseRappels(csv: string | null | undefined): number[] {
  if (!csv) return RAPPELS_DEFAUT;
  const mins = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return mins.length ? mins : RAPPELS_DEFAUT;
}

// ── Valeurs du widget ─────────────────────────────────────────────────────
export type EntreeInitiale = {
  dossierId: number | null;
  type: TypeEntree;
  date: string;
  heure: string;
  rappels: number[];
  comment: string;
};

// Widget (fenêtre) de saisie / modification d'une entrée de planning :
// dossier, type d'intervention, date + heure, rappels (notifications) et
// commentaire. `edition` = entrée existante (dossier + type d'origine).
export function EntreeWidget({
  initiale,
  edition,
  onClose,
}: {
  initiale: EntreeInitiale;
  edition?: EntreeOrigine | null;
  onClose: () => void;
}) {
  const { dossiers } = useContext(PlanningCtx);
  const types = useTypes();
  // Ajout d'un type d'intervention depuis le widget.
  const [ajoutType, setAjoutType] = useState(false);
  const [nouveauType, setNouveauType] = useState("");
  const [nouvelleCouleur, setNouvelleCouleur] = useState(COULEURS_TYPE[0].value);
  const [dossierId, setDossierId] = useState<number | null>(initiale.dossierId);
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<TypeEntree>(initiale.type);
  const [date, setDate] = useState(initiale.date);
  const [heure, setHeure] = useState(initiale.heure);
  const [rappels, setRappels] = useState<number[]>(initiale.rappels);
  const [comment, setComment] = useState(initiale.comment);
  // Rappel personnalisé : jour (0 = jour J, 1 = veille, 2 = J-2…) + heure.
  const [persoJour, setPersoJour] = useState(1);
  const [persoHeure, setPersoHeure] = useState("18:00");
  const [erreur, setErreur] = useState("");
  const [pending, startTransition] = useTransition();

  const dossier = dossiers.find((d) => d.id === dossierId) ?? null;
  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = q
      ? dossiers.filter((d) =>
          `${d.nom} ${d.client ?? ""} ${d.statut}`.toLowerCase().includes(q)
        )
      : dossiers;
    // Tous les dossiers (liste défilante) ; plafonné pour rester fluide.
    return liste.slice(0, 300);
  }, [recherche, dossiers]);

  function creerType() {
    setErreur("");
    startTransition(async () => {
      const r = await creerTypeIntervention(nouveauType, nouvelleCouleur);
      if (!r.ok || !r.type) return setErreur(r.error ?? "Ajout impossible.");
      setType(clePerso(r.type.id));
      setNouveauType("");
      setAjoutType(false);
    });
  }

  function retirerType(t: TypeAffiche) {
    if (!t.persoId) return;
    if (!confirm(`Supprimer le type « ${t.label} » et toutes ses entrées du planning ?`)) return;
    startTransition(async () => {
      await retirerTypeIntervention(t.persoId!);
      if (type === t.value) setType("dateLivraison");
      if (edition && edition.type === t.value) onClose();
    });
  }

  const estChantier = type === "chantier";
  const rappelsTries = [...new Set(rappels)].sort((a, b) => b - a);

  function ajouterRappel(min: number) {
    if (min < 0) {
      setErreur("Ce rappel tombe après l'heure de l'intervention.");
      return;
    }
    setErreur("");
    setRappels((prev) => (prev.includes(min) ? prev : [...prev, min]));
  }

  function ajouterPerso() {
    ajouterRappel(toMin(heure) + persoJour * 1440 - toMin(persoHeure));
  }

  function save() {
    setErreur("");
    if (!dossierId) return setErreur("Choisis un dossier.");
    if (!date) return setErreur("Choisis une date.");
    startTransition(async () => {
      const r = await enregistrerEntreePlanning(
        { dossierId, type, date, heure, rappels: rappelsTries, comment },
        edition ?? null
      );
      if (!r.ok) setErreur(r.error ?? "Enregistrement impossible.");
      else onClose();
    });
  }

  function supprimer() {
    if (!edition) return;
    startTransition(async () => {
      await supprimerEntreePlanning(edition);
      onClose();
    });
  }

  // Rendu dans <body> (portail) : la fenêtre ne doit pas hériter d'un parent
  // déplaçable (glisser-déposer du planning) ni de son défilement.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-4 text-left shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">
            {edition ? "Modifier l'entrée" : "Nouvelle entrée de planning"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Dossier */}
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          Dossier
          {dossier ? (
            <div className="mt-0.5 flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm text-foreground">
              <span className="min-w-0 truncate">
                <span className="font-medium">{dossier.nom}</span>
                {dossier.client && (
                  <span className="text-muted-foreground"> · {dossier.client}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setDossierId(null)}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un dossier ou un client…"
                className={`${inputCls} mt-0.5 w-full`}
              />
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border">
                {resultats.length === 0 ? (
                  <p className="px-2 py-1.5 font-normal text-muted-foreground">
                    Aucun dossier trouvé.
                  </p>
                ) : (
                  resultats.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDossierId(d.id);
                        setRecherche("");
                      }}
                      className="block w-full truncate px-2 py-1.5 text-left text-sm font-normal text-foreground hover:bg-muted"
                    >
                      <span className="font-medium">{d.nom}</span>
                      {d.client && (
                        <span className="text-muted-foreground"> · {d.client}</span>
                      )}
                      <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        {d.statut}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* 2. Type d'intervention */}
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          Type d&apos;intervention
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {types.map((t) => (
              <div
                key={t.value}
                className={`group flex items-center rounded-md border text-sm font-normal text-foreground ${
                  type === t.value
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-muted"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setType(t.value)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                >
                  <span className={`inline-block h-3 w-3 shrink-0 ${t.pastille}`} />
                  <span className="truncate">{t.label}</span>
                </button>
                {t.persoId && (
                  <button
                    type="button"
                    onClick={() => retirerType(t)}
                    title="Supprimer ce type"
                    className="mr-1 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!ajoutType && (
              <button
                type="button"
                onClick={() => setAjoutType(true)}
                className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-sm font-normal text-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter un type
              </button>
            )}
          </div>
          {ajoutType && (
            <div className="mt-1.5 rounded-md border bg-muted/30 p-2 font-normal text-foreground">
              <input
                autoFocus
                value={nouveauType}
                onChange={(e) => setNouveauType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    creerType();
                  }
                }}
                placeholder="Ex : Pose, SAV, Rendez-vous client…"
                className={`${inputCls} w-full`}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {COULEURS_TYPE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNouvelleCouleur(c.value)}
                      title={c.value}
                      className={`h-5 w-5 rounded-full ${c.pastille} ${
                        nouvelleCouleur === c.value ? "ring-2 ring-foreground ring-offset-1" : ""
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAjoutType(false)}
                    className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={creerType}
                    disabled={pending || !nouveauType.trim()}
                    className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date + heure */}
        <div className="mb-3 flex gap-2">
          <label className="block flex-1 text-xs font-medium text-muted-foreground">
            {estChantier ? "Un jour de la semaine" : "Date"}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} mt-0.5 w-full`}
            />
          </label>
          {!estChantier && (
            <label className="block w-28 text-xs font-medium text-muted-foreground">
              Heure
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                title="Heure de l'intervention (défaut 07:00)"
                className={`${inputCls} mt-0.5 w-full`}
              />
            </label>
          )}
        </div>

        {/* 3. Rappels / notifications */}
        {!estChantier && (
          <div className="mb-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" /> Rappels (notification + Google Agenda)
            </span>
            {rappelsTries.length === 0 ? (
              <p className="mt-1 font-normal text-muted-foreground/70">
                Aucun rappel — la veille et à l&apos;heure seront utilisés par défaut.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {rappelsTries.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 font-normal text-foreground"
                  >
                    {libelleRappel(m, heure)}
                    <button
                      type="button"
                      onClick={() => setRappels((p) => p.filter((x) => x !== m))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Retirer ce rappel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {RAPPELS_RAPIDES.filter((o) => !rappels.includes(o.min)).map((o) => (
                <button
                  key={o.min}
                  type="button"
                  onClick={() => ajouterRappel(o.min)}
                  className="rounded border border-dashed px-1.5 py-0.5 font-normal text-foreground hover:bg-muted"
                >
                  + {o.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-normal text-foreground">
              <span className="text-muted-foreground">Autre :</span>
              <select
                value={persoJour}
                onChange={(e) => setPersoJour(Number(e.target.value))}
                className={inputCls}
              >
                <option value={0}>Jour J</option>
                <option value={1}>Veille</option>
                <option value={2}>J-2</option>
                <option value={3}>J-3</option>
                <option value={7}>J-7</option>
              </select>
              <span className="text-muted-foreground">à</span>
              <input
                type="time"
                value={persoHeure}
                onChange={(e) => setPersoHeure(e.target.value)}
                className={`${inputCls} w-24`}
              />
              <button
                type="button"
                onClick={ajouterPerso}
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}

        <label className="mb-3 block text-xs font-medium text-muted-foreground">
          Commentaire
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex : passer avant 10h, code portail…"
            className={`${inputCls} mt-0.5 w-full resize-none`}
          />
        </label>

        {erreur && <p className="mb-2 text-xs text-destructive">{erreur}</p>}

        <div className="flex items-center justify-between gap-2">
          {edition ? (
            <button
              type="button"
              onClick={supprimer}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              Supprimer du planning
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// Bouton « Nouvelle entrée » (en-tête de page, ou barre « + Ajouter » en
// tête d'une colonne jour, date pré-remplie).
export function NouvelleEntreeButton({
  date = "",
  colonne = false,
}: {
  date?: string;
  colonne?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {colonne ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-sm text-muted-foreground shadow-sm hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nouvelle entrée
        </button>
      )}
      {open && (
        <EntreeWidget
          initiale={{
            dossierId: null,
            type: "dateLivraison",
            date,
            heure: "",
            rappels: RAPPELS_DEFAUT,
            comment: "",
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Intervention ponctuelle du planning : carte dans une colonne jour, ou bloc
// positionné dans la timeline horaire (`style` = top/height).
// Clic (gauche ou droit) = ouvre le widget de modification.
export function CarteIntervention({
  id,
  nom,
  client,
  field,
  date,
  heure,
  rappels,
  comment,
  entreeId,
  bloc = false,
  style,
}: {
  id: number;
  nom: string;
  client?: string | null;
  field: Exclude<TypeEntree, "chantier">;
  date: string;
  heure: string;
  rappels: string;
  comment: string;
  entreeId?: number;
  bloc?: boolean;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const types = useTypes();
  const t =
    types.find((x) => x.value === field) ??
    { value: field, label: "Intervention", pastille: "rounded-full bg-slate-500" };
  const ouvrir = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };
  return (
    <>
      {bloc ? (
        <button
          type="button"
          onClick={ouvrir}
          onContextMenu={ouvrir}
          style={style}
          title={`${t.label} — ${nom} · ${heure || "07:00"}${comment ? " — " + comment : ""}`}
          className="absolute left-1 right-1 flex overflow-hidden rounded-md border bg-background text-left text-xs shadow-sm hover:border-primary/50"
        >
          <span className={`w-1 shrink-0 !rounded-none ${t.pastille}`} />
          <span className="min-w-0 px-1.5 py-0.5">
            <span className="block truncate font-medium">{nom}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {heure || "07:00"} · {t.label}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={ouvrir}
          onContextMenu={ouvrir}
          title="Clic pour modifier"
          className="w-full rounded-lg border bg-background p-2.5 text-left shadow-sm transition hover:border-primary/50 hover:shadow"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-medium leading-snug">{nom}</span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {heure || "07:00"}
            </span>
          </div>
          {client && <p className="mt-0.5 truncate text-xs text-muted-foreground">{client}</p>}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 ${t.pastille}`} />
            <span className="truncate">{t.label}</span>
            {rappels !== "" && <Bell className="ml-auto h-3 w-3 shrink-0" />}
          </div>
          {comment && (
            <p className="mt-1.5 line-clamp-2 border-t pt-1.5 text-xs text-muted-foreground">
              {comment}
            </p>
          )}
        </button>
      )}
      {open && (
        <EntreeWidget
          initiale={{
            dossierId: id,
            type: field,
            date,
            heure,
            rappels: parseRappels(rappels),
            comment,
          }}
          edition={{ dossierId: id, type: field, entreeId: entreeId ?? null }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Légende des types ajoutés (à côté de la légende fixe du planning).
export function LegendeTypesPerso() {
  const { types } = useContext(PlanningCtx);
  return (
    <>
      {types.map((t) => (
        <span key={t.id} className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-3 rounded-full ${couleurType(t.couleur).pastille}`}
          />
          {t.libelle}
        </span>
      ))}
    </>
  );
}
