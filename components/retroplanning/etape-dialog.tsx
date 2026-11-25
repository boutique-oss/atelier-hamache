"use client";

// Fiche d'une étape (double-clic sur une barre) ou d'un dossier (double-clic
// sur sa ligne) : modifier, cocher « fait », supprimer, ajouter, recalculer.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  CODES_ETAPE,
  ETAPES,
  couleurIntervention,
  type CodeEtape,
  type DossierRetro,
  type Etape,
  type OperateurRetro,
} from "@/lib/retroplanning";

export type Edition =
  | { mode: "etape"; etape: Etape }
  | { mode: "ajout"; etape: Etape }
  | { mode: "dossier"; dossierId: number };

const champ = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";

export function EtapeDialog({
  edition,
  dossier,
  ops,
  onClose,
  onSave,
  onDelete,
  onAjouter,
  onRecalculer,
}: {
  edition: Edition;
  dossier: DossierRetro | undefined;
  ops: OperateurRetro[];
  onClose: () => void;
  onSave: (e: Etape) => void;
  onDelete: (e: Etape) => void;
  onAjouter: (dossierId: number) => void;
  onRecalculer: (dossierId: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const [e, setE] = useState<Etape | null>(edition.mode === "dossier" ? null : edition.etape);
  const maj = (patch: Partial<Etape>) => setE((x) => (x ? { ...x, ...patch } : x));
  const couleur = couleurIntervention(dossier?.type);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="w-[min(92vw,460px)] rounded-lg border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderTop: `4px solid ${couleur.fond}` }}>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {dossier?.type ?? "Autre"} · {dossier?.statut}
          </p>
          <h2 className="truncate font-semibold">{dossier?.nom ?? "Dossier"}</h2>
        </div>
        <button type="button" onClick={onClose} className="ml-auto rounded px-2 text-lg leading-none hover:bg-muted" aria-label="Fermer">
          ×
        </button>
      </div>

      {edition.mode === "dossier" || !e ? (
        <div className="space-y-3 p-4 text-sm">
          {dossier?.echeance && (
            <p>
              Échéance : <strong>{dossier.echeance.split("-").reverse().join("/")}</strong>
            </p>
          )}
          <div className="flex flex-col gap-2">
            {dossier && (
              <button type="button" onClick={() => onAjouter(dossier.id)} className="rounded-md bg-foreground px-3 py-2 text-left font-medium text-background">
                + Ajouter une étape
              </button>
            )}
            {dossier && (
              <Link href={`/dossiers/${dossier.id}`} className="rounded-md border px-3 py-2 hover:bg-muted">
                Ouvrir la fiche du dossier →
              </Link>
            )}
            {dossier && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Effacer les ajustements de ce dossier et revenir au calcul automatique ?")) onRecalculer(dossier.id);
                }}
                className="rounded-md border px-3 py-2 text-left hover:bg-muted"
              >
                Recalculer à rebours (efface les ajustements)
              </button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-3 p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (e.fin < e.debut) return;
            onSave({ ...e, libelle: e.libelle.trim() || ETAPES[e.code], commentaire: (e.commentaire ?? "").trim() });
          }}
        >
          {e.propose && (
            <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              Étape calculée automatiquement. Dès que vous l&apos;enregistrez, les étapes de ce dossier sont figées.
            </p>
          )}
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Code</span>
              <select
                className={champ}
                value={e.code}
                onChange={(ev) => {
                  const code = ev.target.value as CodeEtape;
                  maj({ code, libelle: e.libelle === ETAPES[e.code] ? ETAPES[code] : e.libelle });
                }}
              >
                {CODES_ETAPE.map((c) => (
                  <option key={c} value={c}>
                    {c} — {ETAPES[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Libellé</span>
              <input className={champ} value={e.libelle} maxLength={120} onChange={(ev) => maj({ libelle: ev.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Début</span>
              <input
                type="date"
                required
                className={champ}
                value={e.debut}
                onChange={(ev) => ev.target.value && maj({ debut: ev.target.value, fin: e.fin < ev.target.value ? ev.target.value : e.fin })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Fin</span>
              <input
                type="date"
                required
                min={e.debut}
                className={champ}
                value={e.fin}
                onChange={(ev) => ev.target.value && maj({ fin: ev.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Opérateur</span>
              <select
                className={champ}
                value={e.operateurId ?? ""}
                onChange={(ev) => maj({ operateurId: ev.target.value ? Number(ev.target.value) : null })}
              >
                <option value="">— Aucun —</option>
                {ops.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Heures prévues</span>
              <input
                type="number"
                min={0}
                step={0.5}
                className={champ}
                value={e.heures || ""}
                placeholder="0"
                onChange={(ev) => maj({ heures: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Commentaire</span>
            <textarea
              className={champ + " min-h-[72px] resize-y"}
              value={e.commentaire ?? ""}
              maxLength={2000}
              rows={3}
              placeholder="Note pour cette étape (tissu en attente, rendez-vous client…)"
              onChange={(ev) => maj({ commentaire: ev.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.fait} onChange={(ev) => maj({ fait: ev.target.checked })} className="h-4 w-4" />
            Étape faite
          </label>

          <div className="flex items-center gap-2 border-t pt-3">
            {edition.mode === "etape" && (
              <button
                type="button"
                onClick={() => confirm("Supprimer cette étape ?") && onDelete(e)}
                className="rounded-md px-3 py-1.5 text-sm text-[#FF0000] hover:bg-[#FF0000]/10"
              >
                Supprimer
              </button>
            )}
            <button type="button" onClick={onClose} className="ml-auto rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="submit" className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
              {edition.mode === "ajout" ? "Ajouter" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
