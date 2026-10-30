"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  CalendarRange,
  BarChart3,
  Clock,
  Plus,
  Package,
  ArrowRight,
  FolderOpen,
  FolderArchive,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

// Chaque entrée porte sa propre teinte de marque (issue de Scene.json) : l'icône
// est colorée dans une pastille légèrement teintée, pour une navigation vive et
// lisible. Les variables --brand-* sont définies dans app/globals.css.
const NAV = [
  { href: "/dossiers", label: "Dossiers", icon: List, tint: "var(--brand-blue)" },
  { href: "/rapports-commandes", label: "Commandes", icon: Package, tint: "var(--brand-orange)" },
  { href: "/planning", label: "Planning", icon: CalendarRange, tint: "var(--brand-green)" },
  { href: "/rapports", label: "Rapport heures", icon: BarChart3, tint: "var(--brand-pink)" },
  { href: "/pointage", label: "Pointage", icon: Clock, tint: "var(--brand-violet)" },
  { href: "/documents", label: "Documents", icon: FolderOpen, tint: "var(--brand-navy)" },
  // Formulaires vierges et éditions imprimables, regroupés dans un dossier.
  { href: "/logistique", label: "Logistique", icon: FolderArchive, tint: "var(--brand-orange)" },
];

type Utilisateur = { nom: string; role: string } | null | undefined;

// Contenu de navigation partagé entre le volet latéral (desktop) et le tiroir
// (mobile). `onNavigate` sert à refermer le tiroir dès qu'on clique un lien.
function NavContent({
  utilisateur,
  onNavigate,
  anime = true,
}: {
  utilisateur: Utilisateur;
  onNavigate?: () => void;
  /** Apparition échelonnée des entrées : volet desktop seulement. Dans le
   *  tiroir, les liens doivent être visibles et tapables tout de suite. */
  anime?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  // Entrée Admin visible pour l'admin (ou en l'absence de session : bootstrap).
  const peutVoirAdmin = !utilisateur || utilisateur.role === "admin";

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <p className="brand-eyebrow px-2 pb-2 pt-3 text-muted-foreground">Navigation</p>
        {NAV.map(({ href, label, icon: Icon, tint }, i) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              style={anime ? { animationDelay: `${0.05 + i * 0.05}s` } : undefined}
              className={cn(
                anime && "anim-fade-up",
                "group flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform duration-200 motion-safe:group-hover:scale-110"
                style={{
                  backgroundColor: `hsl(${tint} / ${active ? 0.24 : 0.16})`,
                  color: `hsl(${tint})`,
                }}
              >
                <Icon size={16} />
              </span>
              {label}
            </Link>
          );
        })}

      </nav>

      <div className="space-y-2 border-t border-border p-2">
        {utilisateur && (
          <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground/85">{utilisateur.nom}</p>
              <p className="brand-eyebrow text-muted-foreground">{utilisateur.role}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        )}
        {peutVoirAdmin && (
          <Link
            href="/admin/securite"
            onClick={onNavigate}
            aria-current={isActive("/admin") ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors",
              isActive("/admin")
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform duration-200 motion-safe:group-hover:scale-110"
              style={{ backgroundColor: "hsl(var(--brand-blue) / 0.16)", color: "hsl(var(--brand-blue))" }}
            >
              <ShieldCheck size={16} />
            </span>
            Admin · Sécurité
          </Link>
        )}
        <Link
          href="/dossiers/nouveau"
          onClick={onNavigate}
          className="group flex items-center justify-between gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} /> Nouveau dossier
          </span>
          <span className="brand-arrow">
            <ArrowRight size={13} />
          </span>
        </Link>
      </div>
    </>
  );
}

// En-tête de marque (réutilisé dans le volet desktop et dans le tiroir mobile).
function BrandHeader() {
  return (
    <Link href="/" className="block">
      <p className="brand-display text-foreground text-lg">
        Atelier Stéphan Hamache<sup className="text-[0.5em] text-muted-foreground">®</sup>
      </p>
      <p className="brand-eyebrow mt-1 text-muted-foreground">ERP atelier · Poitiers</p>
    </Link>
  );
}

export function Sidebar({ utilisateur }: { utilisateur?: Utilisateur }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const fermerRef = useRef<HTMLButtonElement>(null);
  const ouvrirRef = useRef<HTMLButtonElement>(null);

  // On referme le tiroir à chaque changement de route (sécurité si un lien ne
  // passe pas par onNavigate) et on verrouille le défilement du corps quand il
  // est ouvert.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Clavier : focus sur « Fermer » à l'ouverture, Échap referme, et le focus
    // revient sur le bouton menu.
    fermerRef.current?.focus();
    const ouvrir = ouvrirRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      ouvrir?.focus();
    };
  }, [open]);

  return (
    <>
      {/* --- Volet latéral desktop (≥ lg) --- */}
      <aside className="brand-side sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r lg:flex print:hidden">
        <div className="border-b border-border px-4 py-5">
          <BrandHeader />
        </div>
        <NavContent utilisateur={utilisateur} />
      </aside>

      {/* --- Barre inférieure mobile (< lg) --- */}
      <header className="brand-side fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden print:hidden">
        <button
          ref={ouvrirRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground/85 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="min-w-0 flex-1">
          <p className="brand-display truncate text-foreground text-base">
            Atelier Stéphan Hamache<sup className="text-[0.5em] text-muted-foreground">®</sup>
          </p>
        </Link>
        <Link
          href="/dossiers/nouveau"
          aria-label="Nouveau dossier"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
        >
          <Plus size={18} />
        </Link>
      </header>

      {/* --- Tiroir de navigation mobile --- */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="brand-side absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-4">
              <BrandHeader />
              <button
                ref={fermerRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <NavContent utilisateur={utilisateur} onNavigate={() => setOpen(false)} anime={false} />
          </aside>
        </div>
      )}
    </>
  );
}
