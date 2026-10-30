"use client";

import { useState, useTransition } from "react";

import { setPieceDossier } from "@/app/(main)/dossiers/actions";
import { PIECES_CANONIQUES } from "@/lib/piece-classifier";

export type ClasseurItem = {
  id: number;
  nom: string;
  heures: number;
  piece: string | null;
  quantite: number;
  source: "manuel" | "saisi" | "fiche" | "auto" | "aucun";
};

const SRC: Record<ClasseurItem["source"], string> = {
  manuel: "manuel",
  saisi: "saisi",
  fiche: "fiche",
  auto: "auto (texte)",
  aucun: "à classer",
};

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Row({ item }: { item: ClasseurItem }) {
  const [piece, setPiece] = useState(item.piece ?? "");
  const [qte, setQte] = useState(String(item.quantite || 1));
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const dirty = piece !== (item.piece ?? "") || Number(qte) !== item.quantite;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{item.nom}</span>
        <span className="text-muted-foreground">
          {" "}
          · {item.heures} h ·{" "}
          <span
            className={
              item.source === "aucun" ? "text-amber-700" : "text-muted-foreground"
            }
          >
            {SRC[item.source]}
          </span>
        </span>
      </span>
      <input
        list="pieces-list"
        value={piece}
        onChange={(e) => {
          setPiece(e.target.value);
          setOk(false);
        }}
        placeholder="Type de pièce"
        className={`${inputCls} w-40`}
      />
      <input
        type="number"
        min="1"
        value={qte}
        onChange={(e) => {
          setQte(e.target.value);
          setOk(false);
        }}
        title="Nombre de pièces"
        className={`${inputCls} w-16`}
      />
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          start(async () => {
            await setPieceDossier(item.id, piece, Number(qte) || 1);
            setOk(true);
          })
        }
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {pending ? "…" : ok ? "✓ enregistré" : "Enregistrer"}
      </button>
    </div>
  );
}

// Écriveur de flag « pièce » : classe / corrige le type de pièce de chaque
// dossier ayant des heures. Écrit un flag piece:<type>|<qté> sur le dossier.
export function PieceClasseur({ items }: { items: ClasseurItem[] }) {
  return (
    <>
      <datalist id="pieces-list">
        {PIECES_CANONIQUES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="divide-y">
        {items.map((i) => (
          <Row key={i.id} item={i} />
        ))}
      </div>
    </>
  );
}
