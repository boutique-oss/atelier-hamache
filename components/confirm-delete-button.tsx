"use client";

import { X } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

// Bouton « ✕ » de suppression à placer dans un <form action={…}> (Server
// Component compris). Il demande confirmation en nommant précisément ce qui sera
// supprimé — un tap involontaire sur tablette ne doit pas effacer des heures — et
// porte un nom accessible (le glyphe seul est lu « multiplié par »). Zone de
// tap élargie à 44 px sur écran tactile.
export function ConfirmDeleteButton({
  label,
  confirmation,
  className,
}: {
  /** Nom accessible, ex. « Supprimer la ligne d'heures du 12/10 ». */
  label: string;
  /** Question posée avant suppression. */
  confirmation: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (!confirm(confirmation)) e.preventDefault();
      }}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        className
      )}
    >
      <X size={15} aria-hidden />
    </button>
  );
}
