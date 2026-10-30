"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addHeuresBatch } from "@/app/heures/actions";
import { Button } from "@/components/ui/button";
import { PHASES, typesRealisationPour } from "@/lib/types-realisation";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Clés localStorage : on retient le dernier opérateur et la dernière date saisis
// pour pré-remplir la saisie suivante (gain de temps sur le pointage quotidien).
const LS_OP = "heures:lastOp";
const LS_DATE = "heures:date";

function Submit({ nLignes }: { nLignes: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Enregistrement…" : `Enregistrer (${nLignes})`}
    </Button>
  );
}

// Saisie d'heures SIMPLIFIÉE (adoption équipe). L'essentiel — Opérateur + Heures —
// est mis en avant ; Réalisation & Phase restent disponibles mais masqués derrière
// « + détails » (repli sur type_realisation=null / phase=Atelier). La date est
// commune et optionnelle (défaut = aujourd'hui). Description & Nb retirés.
//
// NB technique : addHeuresBatch lit les champs comme des tableaux alignés PAR
// POSITION. Les champs détails restent donc TOUJOURS montés (juste masqués en
// CSS quand repliés) pour ne pas décaler les indices entre les lignes.
export function HeuresForm({
  dossierId,
  operateurs,
  typeIntervention,
}: {
  dossierId: number;
  operateurs: string[];
  typeIntervention?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const action = addHeuresBatch.bind(null, dossierId);
  const realisations = typesRealisationPour(typeIntervention);

  // Chaque ligne a un id local (pour le rendu) ; les données vivent dans le DOM.
  const [rows, setRows] = useState<number[]>([0, 1]);
  const nextId = useRef(2);
  // Réalisation & Phase masqués par défaut : saisie minimale.
  const [showDetails, setShowDetails] = useState(false);

  // Valeurs mémorisées (chargées côté client après montage pour éviter tout
  // décalage d'hydratation) : pré-remplissent l'opérateur et la date.
  const [lastOp, setLastOp] = useState("");
  const [savedDate, setSavedDate] = useState("");
  useEffect(() => {
    try {
      setLastOp(localStorage.getItem(LS_OP) || "");
      setSavedDate(localStorage.getItem(LS_DATE) || "");
    } catch {
      /* localStorage indisponible : on garde les défauts */
    }
  }, []);

  // Message de retour (succès / rien à enregistrer), effacé après quelques s.
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  // On remonte le <form> après un enregistrement réussi (change la clé) : les
  // champs reprennent alors proprement leurs valeurs par défaut (dont l'opérateur
  // et la date mémorisés). Plus fiable que form.reset() avec des defaultValue
  // qui changent.
  const [formKey, setFormKey] = useState(0);

  const addRow = () => setRows((r) => [...r, nextId.current++]);
  const removeRow = (id: number) =>
    setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r));

  const detailCls = showDetails ? "flex flex-col gap-1 text-xs" : "hidden";

  return (
    <div className="px-4 py-3">
      <form
        key={formKey}
        action={async (fd) => {
          const res = await action(fd);
          const saved = res?.saved ?? 0;
          if (saved > 0) {
            // Mémorise le 1er opérateur non vide + la date pour la prochaine fois.
            const op = String(fd.get("operateur") || "").trim();
            const d = String(fd.get("date") || "").trim();
            try {
              if (op) localStorage.setItem(LS_OP, op);
              if (d) localStorage.setItem(LS_DATE, d);
            } catch {
              /* ignore */
            }
            if (op) setLastOp(op);
            if (d) setSavedDate(d);
            setRows([0, 1]);
            nextId.current = 2;
            setFeedback({
              ok: true,
              msg: `✓ ${saved} ligne${saved > 1 ? "s" : ""} enregistrée${
                saved > 1 ? "s" : ""
              }`,
            });
            setFormKey((k) => k + 1);
          } else {
            // Rien enregistré : on NE vide PAS la saisie, on explique pourquoi.
            setFeedback({
              ok: false,
              msg: "Rien enregistré : renseigne au moins l'opérateur et les heures.",
            });
          }
        }}
        className="space-y-2"
      >
        {/* En-tête : date commune (discrète) + interrupteur détails */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Date (commune)</span>
            <input
              name="date"
              type="date"
              defaultValue={savedDate || today}
              className={inputCls}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            + détails (réalisation, phase)
          </label>
        </div>

        <datalist id="operateurs-list">
          {operateurs.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        {/* Lignes */}
        <div className="space-y-1.5">
          {rows.map((id, idx) => (
            <div key={id} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Opérateur</span>
                <input
                  name="operateur"
                  list="operateurs-list"
                  // Seule la 1re ligne est pré-remplie avec le dernier opérateur :
                  // les lignes suivantes restent vides (souvent d'autres personnes).
                  defaultValue={idx === 0 ? lastOp : ""}
                  className={`${inputCls} w-40`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Heures</span>
                <input
                  name="heures"
                  type="text"
                  inputMode="decimal"
                  placeholder="ex : 1,5"
                  className={`${inputCls} w-24 text-base font-semibold`}
                />
              </label>

              {/* Détails facultatifs — toujours montés (alignement des indices) */}
              <label className={detailCls}>
                <span className="text-muted-foreground">Type de réalisation</span>
                <select name="typeRealisation" defaultValue="" className={`${inputCls} w-36`}>
                  <option value="">— À préciser —</option>
                  {realisations.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className={detailCls}>
                <span className="text-muted-foreground">Phase</span>
                <select name="typeTravail" defaultValue="Atelier" className={inputCls}>
                  {PHASES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => removeRow(id)}
                className="pb-1.5 text-xs text-muted-foreground hover:text-destructive"
                title="Retirer la ligne"
                aria-label="Retirer la ligne"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            + Ajouter une ligne
          </button>
          <Submit nLignes={rows.length} />
          {feedback && (
            <span
              role="status"
              className={`text-xs font-medium ${
                feedback.ok ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
