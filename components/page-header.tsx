import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// En-tête de page unifié pour la refonte visuelle : pastille d'icône teintée
// (couleur de marque issue de Scene.json), intitulé « eyebrow » en capitales
// espacées et titre en typo display. Purement présentationnel → utilisable
// dans les Server Components. Voir les classes .brand-* dans app/globals.css.
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  tint = "var(--brand-purple)",
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tint?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `hsl(${tint} / 0.12)`, color: `hsl(${tint})` }}
          >
            <Icon size={20} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="brand-eyebrow text-muted-foreground">{eyebrow}</p>
          )}
          <h1 className="brand-display text-xl text-foreground sm:text-2xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
