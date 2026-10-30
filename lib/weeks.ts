// Helpers de semaines (lundi → dimanche, en UTC) pour le planning.
// Une "semaine" est identifiée par la date ISO de son lundi (AAAA-MM-JJ).

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Lundi (UTC, minuit) de la semaine contenant `d`.
export function mondayOf(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  const m = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  m.setUTCDate(m.getUTCDate() - day);
  return m;
}

// Lundi iso de la semaine d'une date iso (AAAA-MM-JJ). "" si vide.
export function mondayIsoOf(dateIso: string | null | undefined): string {
  if (!dateIso) return "";
  return isoDate(mondayOf(new Date(dateIso)));
}

// Dimanche (lundi + 6 jours) à partir d'un lundi iso.
export function sundayOfWeek(mondayIso: string): string {
  const m = new Date(mondayIso);
  m.setUTCDate(m.getUTCDate() + 6);
  return isoDate(m);
}

// Libellé "Semaine du 31/03/2026" à partir d'un lundi iso.
export function weekLabel(mondayIso: string): string {
  const m = new Date(mondayIso);
  const dd = String(m.getUTCDate()).padStart(2, "0");
  const mm = String(m.getUTCMonth() + 1).padStart(2, "0");
  return `Semaine du ${dd}/${mm}/${m.getUTCFullYear()}`;
}

// Libellé court "31/03 → 06/04" à partir d'un lundi iso.
export function weekRangeShort(mondayIso: string): string {
  const m = new Date(mondayIso);
  const s = new Date(m);
  s.setUTCDate(s.getUTCDate() + 6);
  const f = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}`;
  return `${f(m)} → ${f(s)}`;
}

// Options de semaines (lundis iso) autour d'aujourd'hui pour un <select>.
// `include` force l'ajout d'une semaine hors plage (ex. chantier passé) afin
// qu'elle reste sélectionnable.
export function weekSelectOptions(opts?: {
  back?: number;
  ahead?: number;
  include?: string;
}): { value: string; label: string }[] {
  const back = opts?.back ?? 6;
  const ahead = opts?.ahead ?? 26;
  const start = mondayOf(new Date());
  start.setUTCDate(start.getUTCDate() - back * 7);

  const list: { value: string; label: string }[] = [];
  for (let i = 0; i <= back + ahead; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    const v = isoDate(d);
    list.push({ value: v, label: weekLabel(v) });
  }
  if (opts?.include && !list.some((o) => o.value === opts.include)) {
    list.push({ value: opts.include, label: weekLabel(opts.include) });
    list.sort((a, b) => (a.value < b.value ? -1 : 1));
  }
  return list;
}
