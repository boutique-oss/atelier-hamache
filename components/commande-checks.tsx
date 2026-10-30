"use client";

import { useTransition } from "react";

// Coche inline (sur la fiche dossier) qui bascule l'état d'une commande via
// une action serveur, sans formulaire de modification. Optimiste/désactivée
// pendant l'enregistrement.
export function ToggleCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: (valeur: boolean) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
      <input
        type="checkbox"
        defaultChecked={checked}
        disabled={pending}
        onChange={(e) =>
          start(() => {
            void onToggle(e.target.checked);
          })
        }
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}

// Date saisissable inline (jour de livraison d'une commande). Enregistre dès
// que la valeur change ; vider le champ efface la date.
export function DateInline({
  value,
  onSave,
}: {
  value: string;
  onSave: (date: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <input
      type="date"
      defaultValue={value}
      disabled={pending}
      onChange={(e) =>
        start(() => {
          void onSave(e.target.value);
        })
      }
      className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
    />
  );
}
