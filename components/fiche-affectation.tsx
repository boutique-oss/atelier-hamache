"use client";

import { useState, useTransition } from "react";

import { setFicheAffectation } from "@/app/fiches/actions";

const cls =
  "rounded-md border border-input bg-background px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

// Affectation d'une fiche de travail (opérateur + heures prévues), enregistrée
// dès qu'on change l'opérateur ou qu'on quitte le champ heures. Le dossier
// (heures à réaliser, opérateur du planning) se recalcule à partir des fiches.
export function FicheAffectation({
  ficheId,
  dossierId,
  operateurId,
  heures,
  operateurs,
}: {
  ficheId: number;
  dossierId: number;
  operateurId: number | null;
  heures: string;
  operateurs: { id: number; nom: string }[];
}) {
  const [op, setOp] = useState(operateurId ? String(operateurId) : "");
  const [h, setH] = useState(heures);
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(false);

  function enregistrer(nouvOp: string, nouvH: string) {
    setOk(false);
    start(async () => {
      await setFicheAffectation(ficheId, dossierId, nouvOp ? Number(nouvOp) : null, nouvH);
      setOk(true);
    });
  }

  return (
    <span className="flex items-center gap-1.5">
      <select
        value={op}
        disabled={pending}
        onChange={(e) => {
          setOp(e.target.value);
          enregistrer(e.target.value, h);
        }}
        className={`${cls} w-28`}
        title="Opérateur affecté à cette fiche"
      >
        <option value="">— opérateur —</option>
        {operateurs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
      <input
        value={h}
        inputMode="decimal"
        placeholder="h"
        disabled={pending}
        onChange={(e) => setH(e.target.value)}
        onBlur={() => {
          if (h !== heures) enregistrer(op, h);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`${cls} w-14 text-right`}
        title="Heures prévues pour cette fiche"
      />
      <span className="w-3 text-[10px] text-emerald-600">{ok && !pending ? "✓" : ""}</span>
    </span>
  );
}
