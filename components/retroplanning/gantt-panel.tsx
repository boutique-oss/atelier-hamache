"use client";

// Gantt interactif (SVAR React Gantt, licence MIT). Chargé côté navigateur
// uniquement (voir retroplanning-vue.tsx, next/dynamic ssr:false).
//
// Source de vérité = l'état `etapes` de la page. Ce composant :
//   • s'initialise UNE fois à partir de cet état ;
//   • remonte les déplacements / étirements faits à la souris (onDates) ;
//   • ouvre la fiche d'édition au double-clic (onOuvrir) ;
//   • répercute ensuite sur le Gantt tout changement d'état fait ailleurs
//     (fiche d'édition, ajout, suppression) via l'API du Gantt.
import { useEffect, useMemo, useRef } from "react";
import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import { Locale } from "@svar-ui/react-core";
import { fr } from "@svar-ui/core-locales";
import { en as ganttEn } from "@svar-ui/gantt-locales";
import "@svar-ui/react-gantt/all.css";
import "./retroplanning.css";

import {
  couleurIntervention,
  enRetard,
  estFerie,
  plusJours,
  type DossierRetro,
  type Etape,
  type Vue,
} from "@/lib/retroplanning";

const pad = (n: number) => String(n).padStart(2, "0");
const versDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const versIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const idDossier = (id: number) => `dos-${id}`;
const estResume = (id: unknown) => String(id).startsWith("dos-");

function semaineIso(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - ((x.getUTCDay() + 6) % 7));
  const debut = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - debut.getTime()) / 86400000 + 1) / 7);
}

const moisAnnee = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// Échelles et largeur de colonne par vue (toujours au pas du jour : un
// déplacement s'aligne sur une journée, quelle que soit la vue).
const ECHELLES: Record<Vue, { cellWidth: number; scales: { unit: string; step: number; format: (d: Date) => string }[] }> = {
  jour: {
    cellWidth: 130,
    scales: [
      { unit: "month", step: 1, format: moisAnnee },
      { unit: "day", step: 1, format: (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }) },
    ],
  },
  semaine: {
    cellWidth: 58,
    scales: [
      { unit: "month", step: 1, format: moisAnnee },
      { unit: "week", step: 1, format: (d) => `Semaine ${semaineIso(d)}` },
      { unit: "day", step: 1, format: (d) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) },
    ],
  },
  mois: {
    cellWidth: 24,
    scales: [
      { unit: "month", step: 1, format: moisAnnee },
      { unit: "week", step: 1, format: (d) => `S${semaineIso(d)}` },
      { unit: "day", step: 1, format: (d) => String(d.getDate()) },
    ],
  },
};

type Props = {
  vue: Vue;
  debutPeriode: string;
  today: string;
  dossiers: DossierRetro[];
  etapes: Etape[];
  nomOperateur: (id: number | null) => string;
  onDates: (id: string, debut: string, fin: string) => void;
  onOuvrir: (id: string) => void;
  onSelection: (id: string | null) => void;
};

export default function GanttPanel({
  vue,
  debutPeriode,
  today,
  dossiers,
  etapes,
  nomOperateur,
  onDates,
  onOuvrir,
  onSelection,
}: Props) {
  const apiRef = useRef<IApi | null>(null);
  // Vrai pendant nos propres appels à l'API : on n'écoute alors pas l'écho.
  const synchro = useRef(false);
  const cb = useRef({ onDates, onOuvrir, onSelection, nomOperateur });
  cb.current = { onDates, onOuvrir, onSelection, nomOperateur };

  const parDossier = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);

  const versTache = (e: Etape): ITask => {
    const d = parDossier.get(e.dossierId);
    return {
      id: e.id,
      parent: idDossier(e.dossierId),
      type: "task",
      text: `${e.code} · ${e.libelle}`,
      start: versDate(e.debut),
      end: versDate(plusJours(e.fin, 1)), // fin exclusive côté Gantt
      code: e.code,
      heures: e.heures,
      fait: e.fait,
      propose: e.propose,
      retard: enRetard(e, today),
      operateur: e.operateurId,
      intervention: d?.type ?? "Autre",
      dossierNom: d?.nom ?? "",
      debutIso: e.debut,
      finIso: e.fin,
    };
  };

  const bornesDossier = (dossierId: number, liste: Etape[]) => {
    const siennes = liste.filter((e) => e.dossierId === dossierId);
    if (siennes.length === 0) return null;
    const debut = siennes.reduce((m, e) => (e.debut < m ? e.debut : m), siennes[0].debut);
    const fin = siennes.reduce((m, e) => (e.fin > m ? e.fin : m), siennes[0].fin);
    return { start: versDate(debut), end: versDate(plusJours(fin, 1)) };
  };

  // Données initiales (une seule fois : le Gantt garde ensuite son propre état).
  const initial = useRef<{ tasks: ITask[]; start: Date; end: Date } | null>(null);
  if (!initial.current) {
    const ordre = [...dossiers].sort((a, b) => (a.echeance ?? "9").localeCompare(b.echeance ?? "9") || a.id - b.id);
    const tasks: ITask[] = [];
    for (const d of ordre) {
      const b = bornesDossier(d.id, etapes);
      if (!b) continue;
      tasks.push({
        id: idDossier(d.id),
        type: "summary",
        open: true,
        text: d.client && d.client !== d.nom ? `${d.nom} — ${d.client}` : d.nom,
        ...b,
        intervention: d.type,
      });
      for (const e of etapes.filter((x) => x.dossierId === d.id).sort((a, b) => a.ordre - b.ordre || a.debut.localeCompare(b.debut)))
        tasks.push(versTache(e));
    }
    const dates = etapes.flatMap((e) => [e.debut, e.fin]).sort();
    const min = [dates[0], plusJours(debutPeriode, -14)].filter(Boolean).sort()[0]!;
    const max = [dates[dates.length - 1], plusJours(debutPeriode, 75)].filter(Boolean).sort().reverse()[0]!;
    initial.current = { tasks, start: versDate(plusJours(min, -3)), end: versDate(plusJours(max, 10)) };
  }

  const init = (api: IApi) => {
    apiRef.current = api;
    // Glisser / étirer une étape → nouvelles dates (à la fin du geste).
    api.on("update-task", (ev) => {
      if (synchro.current || ev.inProgress || estResume(ev.id)) return;
      const t = api.getTask(ev.id);
      if (!t?.start || !t?.end) return;
      const debut = versIso(t.start);
      const fin = plusJours(versIso(t.end), -1);
      cb.current.onDates(String(ev.id), debut, fin < debut ? debut : fin);
    });
    // Une ligne dossier ne se déplace pas d'un bloc : on ajuste ses étapes.
    api.intercept("drag-task", (ev) => (estResume(ev.id) ? false : undefined));
    // Pas de suppression / ajout par le Gantt lui-même : tout passe par la fiche.
    api.intercept("delete-task", () => (synchro.current ? undefined : false));
    api.intercept("add-task", () => (synchro.current ? undefined : false));
    // Double-clic → notre fiche d'édition (et non l'éditeur intégré).
    api.intercept("show-editor", (ev) => {
      if (ev.id != null) cb.current.onOuvrir(String(ev.id));
      return false;
    });
    api.on("select-task", (ev) => cb.current.onSelection(ev.id == null ? null : String(ev.id)));
    // Se placer sur la période demandée.
    setTimeout(() => api.exec("scroll-chart", { date: versDate(plusJours(debutPeriode, -1)) }), 0);
  };

  // État → Gantt : ajouts, suppressions, modifications faites hors du Gantt.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const run = async () => {
      synchro.current = true;
      try {
        const vus = new Set<string>();
        for (const e of etapes) {
          vus.add(e.id);
          const voulu = versTache(e);
          const actuel = api.getTask(e.id) as ITask | undefined;
          if (!actuel) {
            // Nouveau dossier sur le Gantt ? On crée d'abord sa ligne.
            if (!api.getTask(idDossier(e.dossierId))) {
              const d = parDossier.get(e.dossierId);
              await api.exec("add-task", {
                id: idDossier(e.dossierId),
                task: { type: "summary", open: true, text: d?.nom ?? `Dossier ${e.dossierId}`, ...bornesDossier(e.dossierId, etapes) },
              });
            }
            const { id, parent, ...task } = voulu;
            await api.exec("add-task", { id, task, target: parent as string, mode: "child" });
            continue;
          }
          const change =
            actuel.text !== voulu.text ||
            versIso(actuel.start!) !== e.debut ||
            versIso(actuel.end!) !== plusJours(e.fin, 1) ||
            actuel.heures !== voulu.heures ||
            actuel.fait !== voulu.fait ||
            actuel.propose !== voulu.propose ||
            actuel.operateur !== voulu.operateur ||
            actuel.retard !== voulu.retard;
          if (change) {
            const { id, parent: _p, ...task } = voulu;
            await api.exec("update-task", { id: id!, task });
          }
        }
        // Étapes supprimées.
        const aSupprimer = (api.serialize() ?? [])
          .map((t) => String(t.id))
          .filter((id) => !estResume(id) && !vus.has(id));
        for (const id of aSupprimer) await api.exec("delete-task", { id });
        // Lignes dossier : bornes = première → dernière étape.
        for (const d of dossiers) {
          const b = bornesDossier(d.id, etapes);
          const t = api.getTask(idDossier(d.id)) as ITask | undefined;
          if (!b || !t) continue;
          if (+t.start! !== +b.start || +t.end! !== +b.end)
            await api.exec("update-task", { id: idDossier(d.id), task: b });
        }
      } finally {
        synchro.current = false;
      }
    };
    void run();
    // versTache / bornesDossier ne dépendent que de props déjà listées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapes, dossiers, today]);

  const columns = useMemo(
    () => [
      { id: "text", header: "Dossier / étape", flexgrow: 1 },
      {
        id: "heures",
        header: "h",
        width: 46,
        align: "right" as const,
        template: (v: unknown) => (Number(v) > 0 ? (Math.round(Number(v) * 10) / 10).toLocaleString("fr-FR") : ""),
      },
    ],
    []
  );

  const highlightTime = (date: Date, unit: string) => {
    if (unit !== "day") return "";
    const iso = versIso(date);
    if (iso === today) return "ri-today";
    const k = date.getDay();
    if (k === 0 || k === 6) return "wx-weekend";
    return estFerie(iso) ? "ri-ferie" : "";
  };

  const echelle = ECHELLES[vue];

  return (
    <div className="retro-gantt">
      <Locale words={{ ...fr, ...ganttEn }}>
        <Willow>
          <Gantt
            init={init}
            tasks={initial.current.tasks}
            start={initial.current.start}
            end={initial.current.end}
            scales={echelle.scales}
            cellWidth={echelle.cellWidth}
            cellHeight={30}
            scaleHeight={28}
            lengthUnit="day"
            durationUnit="day"
            columns={columns}
            gridWidth={300}
            highlightTime={highlightTime}
            taskTemplate={BarreEtape}
          />
        </Willow>
      </Locale>
    </div>
  );
}

// Contenu d'une barre : couleur de l'intervention, code d'étape, heures.
function BarreEtape({ data }: { data: ITask }) {
  if (data.type === "summary") return null;
  const c = couleurIntervention(data.intervention);
  const heures = Number(data.heures) > 0 ? ` · ${(Math.round(Number(data.heures) * 10) / 10).toLocaleString("fr-FR")} h` : "";
  const classes = ["retro-barre", data.fait && "fait", data.retard && "retard", data.propose && "propose"]
    .filter(Boolean)
    .join(" ");
  const titre = [
    data.dossierNom,
    String(data.text ?? ""),
    data.debutIso === data.finIso ? data.debutIso : `${data.debutIso} → ${data.finIso}`,
    heures ? heures.slice(3) : "",
    data.fait ? "fait" : data.retard ? "EN RETARD" : "",
    data.propose ? "calcul automatique" : "ajusté",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={classes} style={{ background: c.fond, color: c.texte }} title={titre}>
      {data.fait ? "✓ " : ""}
      {data.code}
      {heures}
    </div>
  );
}
