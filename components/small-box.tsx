import type { LucideIcon } from "lucide-react";
import { ArrowRightCircle } from "lucide-react";

// Couleurs sémantiques AdminLTE (primary/info/success/warning/danger) ramenées
// à la palette COS (ardoise, sauge, ocre, brique) — toutes lisibles en blanc. Module neutre (ni client ni serveur) : la small-box reçoit
// une icône Lucide, qui ne peut pas traverser la frontière vers un composant client.
export const TONS = {
  primary: "#52667B", // ardoise
  info: "#3E5266", // ardoise profonde
  success: "#4F6B4F", // sauge
  warning: "#8A6A40", // ocre
  danger: "#B34C4C", // brique
  navy: "#2F3B47", // ardoise nuit
} as const;
export type Ton = keyof typeof TONS;

/* ───────────────────────── Small box (AdminLTE) ───────────────────────── */

export function SmallBox({
  value,
  label,
  icon: Icon,
  ton,
  href,
  footer = "Plus d’infos",
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  ton: Ton;
  href?: string;
  footer?: string;
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-md text-white shadow-sm"
      style={{ backgroundColor: TONS[ton] }}
    >
      <div className="relative z-10 flex-1 p-3 pb-4">
        <div className="text-3xl font-bold tabular-nums leading-tight">{value}</div>
        <div className="mt-1 text-sm opacity-90">{label}</div>
      </div>
      <Icon
        className="pointer-events-none absolute right-2 top-2 h-16 w-16 opacity-20 transition-transform"
        strokeWidth={1.5}
      />
      {href && (
        <a
          href={href}
          className="relative z-10 flex items-center justify-center gap-1 bg-black/10 py-1 text-xs text-white/90 transition-colors hover:bg-black/20 hover:text-white"
        >
          {footer} <ArrowRightCircle className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

