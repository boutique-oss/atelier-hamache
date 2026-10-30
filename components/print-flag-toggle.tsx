"use client";

import { useTransition } from "react";

import { toggleEtapePrint } from "@/app/(main)/dossiers/actions";

// Bascule inline le flag « fiche atelier à imprimer » d'un dossier.
export function PrintFlagToggle({
  id,
  checked,
  compact = false,
}: {
  id: number;
  checked: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleEtapePrint(id, !checked))}
      title="Fiche atelier à imprimer"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:opacity-80 disabled:opacity-50 ${
        checked
          ? "bg-emerald-100 text-emerald-800"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {checked ? "✓" : "○"} {compact ? "Imprimer" : "Fiche à imprimer"}
    </button>
  );
}
