"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { TONS, type Ton } from "@/components/small-box";

// Carte repliable du rapport d'heures. Isolée de heures-dashboard.tsx pour
// que la page puisse l'afficher sans embarquer recharts (graphiques chargés à
// part, voir charts-lazy.tsx).
export function DashCard({
  id,
  title,
  subtitle,
  ton = "primary",
  defaultOpen = true,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  ton?: Ton;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      id={id}
      className={`scroll-mt-6 rounded-md border border-t-[3px] bg-card shadow-sm ${className}`}
      style={{ borderTopColor: TONS[ton] }}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-sm font-semibold">
          {title}
          {subtitle && (
            <span className="font-normal text-muted-foreground"> · {subtitle}</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={open ? "Replier" : "Déplier"}
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </header>
      {open && <div>{children}</div>}
    </section>
  );
}
