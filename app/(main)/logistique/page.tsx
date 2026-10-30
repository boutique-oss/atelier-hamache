import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderArchive,
  Ruler,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";

// Dossier « Logistique » : les documents imprimables (formulaires vierges et
// éditions), auparavant listés sous « Documents » dans la barre latérale.
// Chacun s'ouvre dans un nouvel onglet, prêt à imprimer ou enregistrer en PDF.

const IMPRIMABLES: {
  href: string;
  libelle: string;
  description: string;
  icon: LucideIcon;
  tint: string;
}[] = [
  {
    href: "/documents/predevis-vierge",
    libelle: "Prédevis vierge",
    description: "À remplir à la main chez le client, en noir et blanc.",
    icon: FileText,
    tint: "var(--brand-violet)",
  },
  {
    href: "/documents/feuille-heures-mois-vierge",
    libelle: "Feuille d'heures",
    description: "Feuille du mois à remplir par l'opérateur.",
    icon: CalendarDays,
    tint: "var(--brand-green)",
  },
  {
    href: "/documents/fiche-rideaux",
    libelle: "Intervention rideaux",
    description: "Prise de cotes et fiche d'intervention rideaux.",
    icon: Ruler,
    tint: "var(--brand-blue)",
  },
  {
    href: "/documents/bon-commande",
    libelle: "Bon de commande",
    description: "Bon de commande fournisseur à compléter.",
    icon: ClipboardList,
    tint: "var(--brand-purple)",
  },
  {
    href: "/documents/rapport-graphiques",
    libelle: "Graphiques d'heures",
    description: "Graphiques imprimables pour une période choisie.",
    icon: BarChart3,
    tint: "var(--brand-pink)",
  },
];

export default function LogistiquePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        className="mb-6"
        icon={FolderArchive}
        tint="var(--brand-orange)"
        eyebrow="Imprimables"
        title="Logistique"
        subtitle="Formulaires et éditions à imprimer : chacun s'ouvre dans un nouvel onglet"
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPRIMABLES.map(({ href, libelle, description, icon: Icon, tint }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-foreground/[0.03]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `hsl(${tint} / 0.16)`, color: `hsl(${tint})` }}
              >
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {libelle}
                  <ArrowUpRight
                    size={14}
                    aria-hidden
                    className="text-muted-foreground transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                <span className="sr-only"> (nouvel onglet)</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
