import Link from "next/link";

import { periode, plusJours, premierDuMois, type Vue } from "@/lib/retroplanning";

const fr = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...o });

// Choix de la vue (jour / semaine / mois) et navigation dans le temps.
// Tout passe par l'URL (?vue=…&date=…) : lien partageable, retour arrière OK.
export function PeriodeNav({
  vue,
  refDate,
  today,
  base = "/planning",
}: {
  vue: Vue;
  refDate: string;
  today: string;
  base?: string;
}) {
  const { debut, fin } = periode(vue, refDate);
  const precedent =
    vue === "jour" ? plusJours(refDate, -1) : vue === "semaine" ? plusJours(debut, -7) : plusJours(debut, -1);
  const suivant =
    vue === "jour" ? plusJours(refDate, 1) : vue === "semaine" ? plusJours(debut, 7) : plusJours(fin, 1);
  const lien = (v: Vue, d: string) => `${base}?vue=${v}&date=${v === "mois" ? premierDuMois(d) : d}`;

  const titre =
    vue === "jour"
      ? fr(refDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : vue === "semaine"
        ? `Semaine du ${fr(debut, { day: "numeric", month: "long" })} au ${fr(fin, { day: "numeric", month: "long", year: "numeric" })}`
        : fr(debut, { month: "long", year: "numeric" });

  const bouton = "rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted";
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2" aria-label="Période">
      <div className="flex overflow-hidden rounded-md border">
        {(["jour", "semaine", "mois"] as Vue[]).map((v) => (
          <Link
            key={v}
            // Changer de vue garde le jour de référence ; depuis le mois en
            // cours, jour et semaine s'ouvrent sur aujourd'hui.
            href={lien(v, vue === "mois" && v !== "mois" && refDate.slice(0, 7) === today.slice(0, 7) ? today : refDate)}
            aria-current={v === vue ? "page" : undefined}
            className={"px-3 py-1.5 text-sm capitalize " + (v === vue ? "bg-foreground text-background" : "hover:bg-muted")}
          >
            {v}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Link href={lien(vue, precedent)} className={bouton} aria-label="Période précédente">
          ◀
        </Link>
        <Link href={lien(vue, today)} className={bouton + " px-3"}>
          Aujourd&apos;hui
        </Link>
        <Link href={lien(vue, suivant)} className={bouton} aria-label="Période suivante">
          ▶
        </Link>
      </div>
      <h2 className="ml-1 text-base font-semibold first-letter:uppercase">{titre}</h2>
    </nav>
  );
}
