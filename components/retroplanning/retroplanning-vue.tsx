"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { enregistrerEtapesDossier, recalculerDossier } from "@/app/(main)/planning/actions";
import { ChargeOperateurs } from "@/components/retroplanning/charge-operateurs";
import { EtapeDialog, type Edition } from "@/components/retroplanning/etape-dialog";
import {
  COULEURS_INTERVENTION,
  ETAPES,
  CODES_ETAPE,
  Calendrier,
  periode,
  type Absence,
  type DossierRetro,
  type Etape,
  type OperateurRetro,
  type Vue,
} from "@/lib/retroplanning";

// Le Gantt manipule le DOM du navigateur : jamais rendu côté serveur.
const GanttPanel = dynamic(() => import("@/components/retroplanning/gantt-panel"), {
  ssr: false,
  loading: () => (
    <div className="retro-gantt flex items-center justify-center text-sm text-muted-foreground">
      Chargement du rétroplanning…
    </div>
  ),
});

type Props = {
  vue: Vue;
  refDate: string;
  today: string;
  ops: OperateurRetro[];
  // Opérateurs actifs retirés du rétroplanning.
  retires: OperateurRetro[];
  absences: Absence[];
  dossiers: DossierRetro[];
  etapesInitiales: Etape[];
  nonTenus: Record<number, number>;
};

const nouvelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function RetroplanningVue({ vue, refDate, today, ops, retires, absences, dossiers, etapesInitiales, nonTenus }: Props) {
  const router = useRouter();
  const [etapes, setEtapes] = useState<Etape[]>(etapesInitiales);
  const etapesRef = useRef(etapes);
  etapesRef.current = etapes;
  const [edition, setEdition] = useState<Edition | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ type: "ok" | "encours" | "erreur"; texte: string } | null>(null);

  const cal = useMemo(() => new Calendrier(ops, absences), [ops, absences]);
  const { debut: debutPeriode, fin: finPeriode } = periode(vue, refDate);

  // Gantt lisible : par défaut, seuls les dossiers qui ont une étape sur la
  // période affichée (ou une étape en retard). Liste figée à l'ouverture de la
  // vue, pour qu'un dossier ne disparaisse pas pendant qu'on déplace ses étapes.
  const [tous, setTous] = useState(false);
  const idsPeriode = useMemo(
    () =>
      new Set(
        etapesInitiales
          .filter((e) => (e.debut <= finPeriode && e.fin >= debutPeriode) || (!e.fait && e.fin < today))
          .map((e) => e.dossierId)
      ),
    [etapesInitiales, debutPeriode, finPeriode, today]
  );
  const dossiersGantt = useMemo(
    () => (tous ? dossiers : dossiers.filter((d) => idsPeriode.has(d.id))),
    [tous, dossiers, idsPeriode]
  );
  const etapesGantt = useMemo(() => {
    if (tous) return etapes;
    const ids = new Set(dossiersGantt.map((d) => d.id));
    return etapes.filter((e) => ids.has(e.dossierId));
  }, [tous, etapes, dossiersGantt]);
  const parDossier = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const nomOperateur = useCallback((id: number | null) => ops.find((o) => o.id === id)?.nom ?? "—", [ops]);

  // ── Enregistrement : une file par dossier, toujours avec l'état le plus récent.
  const files = useRef(new Map<number, Promise<void>>());
  const enregistrer = useCallback((dossierId: number) => {
    setEtat({ type: "encours", texte: "Enregistrement…" });
    const precedent = files.current.get(dossierId) ?? Promise.resolve();
    const suivant = precedent.then(async () => {
      const siennes = etapesRef.current.filter((e) => e.dossierId === dossierId);
      const r = await enregistrerEtapesDossier(dossierId, siennes).catch(() => ({ ok: false as const, erreur: "Réseau indisponible" }));
      if (r.ok) setEtat({ type: "ok", texte: "Enregistré" });
      else setEtat({ type: "erreur", texte: `Non enregistré : ${r.erreur}` });
    });
    files.current.set(dossierId, suivant);
  }, []);

  // Applique un changement à des étapes, puis enregistre le dossier concerné.
  // Toutes les étapes du dossier perdent leur statut « proposé » : elles sont
  // désormais la référence (le calcul automatique ne les réécrit plus).
  const modifier = useCallback(
    (dossierId: number, transformer: (siennes: Etape[]) => Etape[]) => {
      const avant = etapesRef.current;
      const siennes = avant.filter((e) => e.dossierId === dossierId);
      const apres = transformer(siennes).map((e) => ({ ...e, propose: false }));
      const inchange =
        apres.length === siennes.length &&
        apres.every((e, i) => {
          const s = siennes[i];
          return s && s.id === e.id && s.debut === e.debut && s.fin === e.fin && s.code === e.code &&
            s.libelle === e.libelle && s.heures === e.heures && s.fait === e.fait && s.operateurId === e.operateurId && !s.propose;
        });
      if (inchange) return;
      const suivant = [...avant.filter((e) => e.dossierId !== dossierId), ...apres];
      etapesRef.current = suivant;
      setEtapes(suivant);
      enregistrer(dossierId);
    },
    [enregistrer]
  );

  const onDates = useCallback(
    (id: string, debut: string, fin: string) => {
      const e = etapesRef.current.find((x) => x.id === id);
      if (!e) return;
      modifier(e.dossierId, (s) => s.map((x) => (x.id === id ? { ...x, debut, fin } : x)));
    },
    [modifier]
  );

  const onOuvrir = useCallback((id: string) => {
    if (id.startsWith("dos-")) {
      const dossierId = Number(id.slice(4));
      setEdition({ mode: "dossier", dossierId });
      return;
    }
    const e = etapesRef.current.find((x) => x.id === id);
    if (e) setEdition({ mode: "etape", etape: e });
  }, []);

  const dossierSelectionne = (() => {
    if (!selection) return null;
    if (selection.startsWith("dos-")) return Number(selection.slice(4));
    return etapesRef.current.find((e) => e.id === selection)?.dossierId ?? null;
  })();

  const ajouterEtape = (dossierId: number) => {
    const siennes = etapesRef.current.filter((e) => e.dossierId === dossierId);
    const jour = today;
    setEdition({
      mode: "ajout",
      etape: {
        id: nouvelId(),
        dossierId,
        code: "AU",
        libelle: ETAPES.AU,
        commentaire: "",
        operateurId: parDossier.get(dossierId)?.operateurId ?? null,
        debut: jour,
        fin: jour,
        heures: 0,
        fait: false,
        ordre: siennes.reduce((m, e) => Math.max(m, e.ordre), 0) + 1,
        propose: false,
      },
    });
  };

  const enregistrerEdition = (e: Etape) => {
    modifier(e.dossierId, (s) => (s.some((x) => x.id === e.id) ? s.map((x) => (x.id === e.id ? e : x)) : [...s, e]));
    setEdition(null);
  };
  const supprimerEtape = (e: Etape) => {
    modifier(e.dossierId, (s) => s.filter((x) => x.id !== e.id));
    setEdition(null);
  };
  const recalculer = async (dossierId: number) => {
    setEdition(null);
    setEtat({ type: "encours", texte: "Recalcul…" });
    await files.current.get(dossierId);
    await recalculerDossier(dossierId);
    router.refresh();
    setEtat({ type: "ok", texte: "Recalculé" });
  };

  const alertes = Object.entries(nonTenus)
    .map(([id, h]) => ({ d: parDossier.get(Number(id)), h }))
    .filter((x) => x.d);
  const retards = etapes.filter((e) => !e.fait && e.fin < today).length;

  return (
    <div className="space-y-4">
      <ChargeOperateurs etapes={etapes} ops={ops} retires={retires} cal={cal} vue={vue} refDate={refDate} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <button
          type="button"
          disabled={dossierSelectionne == null}
          onClick={() => dossierSelectionne != null && ajouterEtape(dossierSelectionne)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium enabled:hover:bg-muted disabled:opacity-50"
          title={dossierSelectionne == null ? "Sélectionnez d'abord un dossier ou une étape" : "Ajouter une étape à ce dossier"}
        >
          <Plus size={15} /> Ajouter une étape
        </button>
        {Object.entries(COULEURS_INTERVENTION).map(([type, c]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: c.fond }} />
            {type}
          </span>
        ))}
        <span className="text-muted-foreground">
          {CODES_ETAPE.filter((c) => c !== "AU").map((c) => `${c} ${ETAPES[c]}`).join(" · ")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm outline outline-2 outline-[#FF0000]" /> En retard
        </span>
        <span className="flex items-center gap-1.5">
          <span className="retro-legende-propose inline-block h-3 w-5 rounded-sm bg-[#6B6B6B]" /> Rayé = calcul automatique
        </span>
        {etat && (
          <span
            role="status"
            className={
              "ml-auto " +
              (etat.type === "erreur" ? "font-semibold text-[#FF0000]" : "text-muted-foreground")
            }
          >
            {etat.texte}
          </span>
        )}
      </div>

      {(alertes.length > 0 || retards > 0) && (
        <div className="rounded-md border border-[#FF0000]/50 bg-[#FF0000]/5 px-3 py-2 text-sm">
          {retards > 0 && (
            <p>
              <strong>{retards}</strong> étape{retards > 1 ? "s" : ""} en retard (date passée, non faite).
            </p>
          )}
          {alertes.map(({ d, h }) => (
            <p key={d!.id}>
              <strong>{d!.nom}</strong> : {(Math.round(h * 10) / 10).toLocaleString("fr-FR")} h ne tiennent pas avant
              l&apos;échéance du {d!.echeance?.split("-").reverse().join("/")} avec la capacité actuelle.
            </p>
          ))}
        </div>
      )}

      <label className="flex w-fit items-center gap-2 text-sm">
        <input type="checkbox" checked={tous} onChange={(ev) => setTous(ev.target.checked)} className="h-4 w-4" />
        Tous les dossiers
        <span className="text-muted-foreground">
          ({tous ? dossiers.length : `${dossiersGantt.length} sur la période / ${dossiers.length}`})
        </span>
      </label>

      {dossiersGantt.length === 0 ? (
        <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          {dossiers.length === 0
            ? "Aucun dossier en cours avec une date de livraison ou de chantier."
            : "Aucune étape sur cette période. Cochez « Tous les dossiers » pour tout voir."}
        </p>
      ) : (
        <GanttPanel
          key={tous ? "tous" : "periode"}
          vue={vue}
          debutPeriode={debutPeriode}
          today={today}
          dossiers={dossiersGantt}
          etapes={etapesGantt}
          nomOperateur={nomOperateur}
          onDates={onDates}
          onOuvrir={onOuvrir}
          onSelection={setSelection}
        />
      )}

      {edition && (
        <EtapeDialog
          edition={edition}
          dossier={parDossier.get(edition.mode === "dossier" ? edition.dossierId : edition.etape.dossierId)}
          ops={ops}
          onClose={() => setEdition(null)}
          onSave={enregistrerEdition}
          onDelete={supprimerEtape}
          onAjouter={ajouterEtape}
          onRecalculer={recalculer}
        />
      )}
    </div>
  );
}
