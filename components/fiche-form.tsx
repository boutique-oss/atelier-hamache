"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { addFiche } from "@/app/fiches/actions";
import { Button } from "@/components/ui/button";

const TYPES = ["Tapisserie", "Rideaux", "Atelier", "Autre"];
const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Ajouter"}
    </Button>
  );
}

export function FicheForm({
  dossierId,
  defaultClient,
}: {
  dossierId: number;
  defaultClient?: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const action = addFiche.bind(null, dossierId);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2 px-4 py-3"
    >
      <input type="hidden" name="clientNom" value={defaultClient ?? ""} readOnly />

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Type</span>
        <select name="typeIntervention" defaultValue="Tapisserie" className={inputCls}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Notes</span>
        <input name="notesLibres" className={`${inputCls} w-full`} />
      </label>
      <Submit />
    </form>
  );
}
