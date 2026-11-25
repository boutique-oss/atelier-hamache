import Link from "next/link";
import {
  List,
  Package,
  CalendarRange,
  Clock,
  BarChart3,
  FileText,
  ClipboardList,
  Ruler,
  CalendarDays,
  ArrowRight,
  Scissors,
  Library,
} from "lucide-react";

// Point d'entrée vers les vues de l'ERP. Chaque raccourci reprend l'icône et la
// teinte de marque (Scene.json) utilisées dans le volet latéral, pour une
// identité visuelle cohérente d'un bout à l'autre.
const LIENS = [
  { href: "/dossiers", label: "Dossiers", desc: "Tous les dossiers clients", icon: List, tint: "var(--brand-blue)" },
  { href: "/rideaux", label: "Rideaux", desc: "Calcul et chiffrage par fenêtre", icon: Scissors, tint: "var(--brand-purple)" },
  { href: "/rapports-commandes", label: "Commandes", desc: "Suivi des commandes", icon: Package, tint: "var(--brand-orange)" },
  { href: "/catalogue", label: "Catalogue", desc: "Fournisseurs et références", icon: Library, tint: "var(--brand-blue)" },
  { href: "/planning", label: "Rétroplanning", desc: "À rebours depuis la pose, charge par opérateur", icon: CalendarRange, tint: "var(--brand-green)" },
  { href: "/rapports", label: "Rapport heures", desc: "Heures par dossier", icon: BarChart3, tint: "var(--brand-pink)" },
  { href: "/pointage", label: "Pointage", desc: "Heures, congés & absences", icon: Clock, tint: "var(--brand-violet)" },
  { href: "/documents/feuille-heures-mois-vierge", label: "Feuille d'heures", desc: "Relevé mensuel à imprimer", icon: CalendarDays, tint: "var(--brand-green)" },
  { href: "/documents/predevis-vierge", label: "Prédevis vierge", desc: "Document à imprimer", icon: FileText, tint: "var(--brand-violet)" },
  { href: "/documents/fiche-rideaux", label: "Intervention rideaux", desc: "Prise de cotes à imprimer", icon: Ruler, tint: "var(--brand-blue)" },
  { href: "/documents/bon-commande", label: "Bon de commande", desc: "Commandé / à recevoir", icon: ClipboardList, tint: "var(--brand-purple)" },
];

export default function Home() {
  return (
    <main className="relative bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-12 overflow-hidden px-6 py-16">
      {/* Halos colorés flottants en fond (clin d'œil aux bulles du studio) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="anim-float absolute -left-24 top-10 h-72 w-72 rounded-full bg-[hsl(var(--brand-purple))] opacity-20 blur-3xl" />
        <span className="anim-float absolute -right-16 top-1/3 h-80 w-80 rounded-full bg-[hsl(var(--brand-violet))] opacity-20 blur-3xl [animation-delay:3s]" />
        <span className="anim-float absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[hsl(var(--brand-blue))] opacity-[0.12] blur-3xl [animation-delay:6s]" />
      </div>

      <div className="relative max-w-3xl text-center">
        <h1 className="anim-fade-up brand-display text-5xl text-foreground [animation-delay:0.08s] sm:text-6xl">
          Atelier Stéphan
          <br />
          Hamache
          <span className="text-primary">
            {" "}
            — ERP
          </span>
          <sup className="brand-display text-[0.3em] text-muted-foreground">®</sup>
        </h1>
        <p className="anim-fade-up mt-4 text-sm text-foreground/80 [animation-delay:0.16s]">
          Dossiers, commandes, planning et heures de l&apos;atelier de Poitiers.
        </p>
      </div>

      <div className="relative grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {LIENS.map(({ href, label, desc, icon: Icon, tint }, i) => (
          <Link
            key={href}
            href={href}
            className="anim-fade-up group flex flex-col gap-4 rounded-xl border border-border bg-card/70 p-5 transition-all duration-300 motion-safe:hover:-translate-y-1 hover:bg-card"
            style={{
              borderColor: `hsl(${tint} / 0.22)`,
              animationDelay: `${0.12 + i * 0.03}s`,
            }}
          >
            <div className="flex items-start justify-between">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-300 motion-safe:group-hover:scale-110"
                style={{ backgroundColor: `hsl(${tint} / 0.16)`, color: `hsl(${tint})` }}
              >
                <Icon size={22} />
              </span>
              <span aria-hidden className="brand-arrow text-muted-foreground group-hover:text-foreground">
                <ArrowRight size={13} />
              </span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-xs text-foreground/80">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
