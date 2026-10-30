"use client";

import { useState, useTransition } from "react";

import {
  setDossierEventDate,
  type DossierEventField,
} from "@/app/(main)/dossiers/actions";

const SHAPE_CLASS: Record<"dot" | "square", string> = {
  dot: "rounded-full",
  square: "rounded-[2px]",
};

const COLOR_CLASS: Record<"red" | "green" | "yellow", string> = {
  red: "bg-red-500",
  green: "bg-emerald-500",
  yellow: "bg-yellow-400",
};

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Options de rappels (minutes AVANT l'heure de l'événement).
const RAPPELS_OPTS: { min: number; label: string }[] = [
  { min: 1440, label: "La veille" },
  { min: 0, label: "Le jour même" },
  { min: 30, label: "30 min avant" },
  { min: 60, label: "1h avant" },
  { min: 120, label: "2h avant" },
];

// Rappels par défaut affichés quand le dossier n'en a pas encore : veille + jour même.
const RAPPELS_DEFAUT = [1440, 0];

// Parse un CSV de rappels (« 1440,0 ») -> minutes valides.
function parseRappels(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

// Point/carré coloré sur le calendrier de planning. Clic droit = ouvre une
// petite fenêtre pour modifier la date, l'heure, les rappels et le commentaire
// (heure/rappels/commentaire sont repris dans l'événement Google Agenda).
export function EventMarker({
  id,
  nom,
  label,
  field,
  date,
  comment,
  heure,
  rappels,
  color,
  shape,
}: {
  id: number;
  nom: string;
  label: string;
  field: DossierEventField;
  date: string;
  comment: string;
  heure: string;
  rappels: string;
  color: "red" | "green" | "yellow";
  shape: "dot" | "square";
}) {
  const [open, setOpen] = useState(false);
  const [curDate, setCurDate] = useState(date);
  const [curComment, setCurComment] = useState(comment);
  const [curHeure, setCurHeure] = useState(heure);
  const [curRappels, setCurRappels] = useState<number[]>(
    rappels ? parseRappels(rappels) : RAPPELS_DEFAUT
  );
  const [pending, startTransition] = useTransition();

  // Rappels dans l'ordre canonique des options, pour l'enregistrement.
  const rappelsOrdonnes = () =>
    RAPPELS_OPTS.filter((o) => curRappels.includes(o.min)).map((o) => o.min);

  function toggleRappel(min: number) {
    setCurRappels((prev) =>
      prev.includes(min) ? prev.filter((m) => m !== min) : [...prev, min]
    );
  }

  function save() {
    startTransition(async () => {
      await setDossierEventDate(
        id,
        field,
        curDate ? curDate : null,
        curComment,
        curHeure ? curHeure : null,
        rappelsOrdonnes()
      );
      setOpen(false);
    });
  }

  const titre = comment ? `${nom} — ${comment}` : nom;

  return (
    <>
      <span
        onContextMenu={(e) => {
          e.preventDefault();
          setCurDate(date);
          setCurComment(comment);
          setCurHeure(heure);
          setCurRappels(rappels ? parseRappels(rappels) : RAPPELS_DEFAUT);
          setOpen(true);
        }}
        title={`${titre} · clic droit pour modifier`}
        className={`inline-block h-2.5 w-2.5 shrink-0 cursor-context-menu ${
          COLOR_CLASS[color]
        } ${SHAPE_CLASS[shape]} ${comment ? "ring-1 ring-foreground/40" : ""} ${
          pending ? "opacity-40" : ""
        }`}
      />

      {open && (
        <>
          {/* Voile pour fermer en cliquant à côté */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Fenêtre centrée */}
          <div className="fixed left-1/2 top-1/2 z-50 w-72 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-3 shadow-lg">
            <div className="mb-2 text-sm font-semibold">
              {label}
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {nom}
              </span>
            </div>

            <div className="mb-2 flex gap-2">
              <label className="block flex-1 text-xs font-medium text-muted-foreground">
                Date
                <input
                  type="date"
                  value={curDate}
                  onChange={(e) => setCurDate(e.target.value)}
                  className={`${inputCls} mt-0.5 w-full`}
                />
              </label>
              <label className="block w-24 text-xs font-medium text-muted-foreground">
                Heure
                <input
                  type="time"
                  value={curHeure}
                  onChange={(e) => setCurHeure(e.target.value)}
                  title="Heure de l'événement (défaut 07:00)"
                  className={`${inputCls} mt-0.5 w-full`}
                />
              </label>
            </div>

            <div className="mb-3 text-xs font-medium text-muted-foreground">
              Rappels
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {RAPPELS_OPTS.map((o) => (
                  <label
                    key={o.min}
                    className="flex cursor-pointer items-center gap-1 font-normal text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={curRappels.includes(o.min)}
                      onChange={() => toggleRappel(o.min)}
                      className="h-3 w-3"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="mb-3 block text-xs font-medium text-muted-foreground">
              Commentaire
              <textarea
                rows={3}
                value={curComment}
                onChange={(e) => setCurComment(e.target.value)}
                placeholder="Ex : passer avant 10h, code portail…"
                className={`${inputCls} mt-0.5 w-full resize-none`}
              />
            </label>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurDate("");
                  startTransition(async () => {
                    await setDossierEventDate(id, field, null, curComment);
                    setOpen(false);
                  });
                }}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                Effacer la date
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
        </>
      )}
    </>
  );
}
