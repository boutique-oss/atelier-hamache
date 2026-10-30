// Calcul du planning atelier : file d'attente par opérateur.
// Chaque opérateur a une capacité (heures/semaine) répartie sur 5 jours ouvrés.
// Les dossiers affectés sont empilés dans l'ordre (date de devis, puis id).

export type Op = { id: number; nom: string; heuresSemaine: number };
export type Dos = {
  id: number;
  nomDossier: string;
  operateurId: number | null;
  heuresARealiser: number;
  statut: string;
  dateDevis: string | null;
};
export type Bar = {
  dossierId: number;
  nom: string;
  heures: number;
  start: Date;
  end: Date;
  jours: number;
};
export type OpPlan = { op: Op; bars: Bar[] };

const DAY = 86400000;
const EXCLU = new Set(["Clos", "Perdu"]);

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}
function isWeekend(d: Date) {
  const k = d.getUTCDay();
  return k === 0 || k === 6;
}
function nextWorkingDay(d: Date) {
  let x = new Date(d);
  while (isWeekend(x)) x = new Date(x.getTime() + DAY);
  return x;
}
// Avance de `steps` jours ouvrés (steps=0 → premier jour ouvré ≥ from).
function stepWorkingDays(from: Date, steps: number) {
  let x = nextWorkingDay(from);
  for (let i = 0; i < steps; i++) {
    do {
      x = new Date(x.getTime() + DAY);
    } while (isWeekend(x));
  }
  return x;
}

export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function computePlanning(
  ops: Op[],
  dossiers: Dos[],
  planStart: Date = todayUTC()
): { plans: OpPlan[]; nonAffectes: Dos[] } {
  const actifsDossiers = (id: number) =>
    dossiers
      .filter(
        (d) =>
          d.operateurId === id &&
          !EXCLU.has(d.statut) &&
          (d.heuresARealiser ?? 0) > 0
      )
      .sort((a, b) => {
        const da = parseDate(a.dateDevis)?.getTime() ?? Infinity;
        const db = parseDate(b.dateDevis)?.getTime() ?? Infinity;
        return da - db || a.id - b.id;
      });

  const plans: OpPlan[] = ops
    .filter((o) => (o.heuresSemaine ?? 0) > 0)
    .map((op) => {
      const daily = op.heuresSemaine / 5;
      let cursor = nextWorkingDay(planStart);
      const bars: Bar[] = [];
      for (const d of actifsDossiers(op.id)) {
        const jours = Math.max(1, Math.ceil(d.heuresARealiser / daily));
        const start = cursor;
        const end = stepWorkingDays(start, jours - 1);
        bars.push({
          dossierId: d.id,
          nom: d.nomDossier,
          heures: d.heuresARealiser,
          start,
          end,
          jours,
        });
        cursor = stepWorkingDays(end, 1);
      }
      return { op, bars };
    });

  // Dossiers à planifier mais sans opérateur affecté
  const nonAffectes = dossiers.filter(
    (d) =>
      d.operateurId == null &&
      !EXCLU.has(d.statut) &&
      (d.heuresARealiser ?? 0) > 0
  );

  return { plans, nonAffectes };
}
