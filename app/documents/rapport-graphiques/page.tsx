import { PrintButton } from "@/components/print-button";
import { BarresHorizontales, Colonnes, TEINTES } from "@/components/graphique-imprimable";
import { sql } from "@/lib/raw-sql";
import {
  heuresDansLeTemps,
  heuresParOperateur,
  heuresParType,
  indicateursPeriode,
  raccourcisPeriode,
  reelVsPrevuParDossier,
} from "@/lib/rapport-heures";

export const dynamic = "force-dynamic";

// Graphiques d'heures IMPRIMABLES pour une période donnée (A4 portrait).
// Période par ?from=&to= (AAAA-MM-JJ), ce mois par défaut ; ?operateur= en
// option. Bandeau de réglage masqué à l'impression. Données agrégées en SQL
// (lib/rapport-heures.ts), graphiques en SVG serveur (graphique-imprimable).

const SANS = "var(--font-sans), system-ui, sans-serif";
const SERIF = "var(--font-serif), Georgia, serif";
const MARINE = "#16324F";

const dateValide = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const dateFr = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const heuresFr = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")} h`;
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function Section({ titre, note }: { titre: string; note?: string }) {
  return (
    <h2
      style={{
        fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: TEINTES.gris, margin: "18px 0 8px",
        display: "flex", alignItems: "center", gap: 9,
      }}
    >
      {titre}
      {note && (
        <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", fontSize: 10 }}>{note}</span>
      )}
      <span style={{ flex: 1, height: 1, background: TEINTES.filet }} />
    </h2>
  );
}

export default async function RapportGraphiquesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; operateur?: string };
}) {
  const raccourcis = raccourcisPeriode();
  const ceMois = raccourcis.find((r) => r.libelle === "Ce mois")!;
  let from = dateValide(searchParams.from) || ceMois.from;
  let to = dateValide(searchParams.to) || ceMois.to;
  if (from > to) [from, to] = [to, from];
  const operateur = (searchParams.operateur || "").slice(0, 100);
  const filtre = { from, to, operateur };

  const jours = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  const pas: "semaine" | "mois" = jours <= 112 ? "semaine" : "mois";

  const [bilan, parOp, reelPrevu, parType, temps, ops] = await Promise.all([
    indicateursPeriode(filtre),
    heuresParOperateur(filtre),
    reelVsPrevuParDossier(filtre, 15),
    heuresParType(filtre),
    heuresDansLeTemps(filtre, pas),
    sql`SELECT nom FROM operateurs WHERE actif ORDER BY nom`,
  ]);

  const libelleTemps = (l: string) => {
    if (pas === "mois") {
      const [y, m] = l.split("-");
      return `${MOIS[Number(m) - 1] ?? m} ${y.slice(2)}`;
    }
    const [, m, d] = l.split("-");
    return `${d}/${m}`;
  };

  const champ: React.CSSProperties = {
    fontFamily: SANS, fontSize: 13, padding: "5px 8px", border: "1px solid #C9D0D8",
    borderRadius: 6, background: "#fff",
  };
  const indicateurs = [
    { t: "Heures pointées", v: bilan.pointees == null ? "—" : heuresFr(bilan.pointees), d: "présence" },
    { t: "Saisies sur dossiers", v: heuresFr(bilan.saisies), d: "imputées" },
    { t: "Heures prévues", v: heuresFr(bilan.prevues), d: "dossiers travaillés" },
    { t: "Réel cumulé", v: heuresFr(bilan.reelles), d: "de ces dossiers" },
    { t: "Écart", v: `${bilan.ecart > 0 ? "+" : ""}${heuresFr(bilan.ecart)}`, d: bilan.ecart > 0 ? "au-delà du prévu" : "dans le prévu" },
    { t: "Fiches à saisir", v: String(bilan.fichesASaisir), d: "fiches navettes" },
  ];

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #E7ECF0; margin: 0; }
        .sheet {
          width: 210mm; min-height: 297mm; box-sizing: border-box;
          margin: 14px auto 40px; padding: 14mm; background: #fff;
          box-shadow: 0 6px 26px rgba(16,32,48,.18); font-family: ${SANS}; color: ${TEINTES.encre};
        }
        .reglages a { color: ${MARINE}; }
        @media print {
          body { background: #fff; }
          .print-btn { display: none !important; }
          .sheet {
            box-shadow: none !important; margin: 0 !important;
            width: auto !important; min-height: 0 !important; padding: 0 !important;
          }
          .avoid { break-inside: avoid; }
        }
      `}</style>

      {/* Réglages de la période : masqués à l'impression. */}
      <div className="print-btn reglages" style={{ maxWidth: "210mm", margin: "0 auto", padding: "14px 6mm 0", fontFamily: SANS }}>
        <form method="get" style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: TEINTES.gris }}>
            Du
            <input type="date" name="from" defaultValue={from} style={champ} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: TEINTES.gris }}>
            Au
            <input type="date" name="to" defaultValue={to} style={champ} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: TEINTES.gris }}>
            Opérateur
            <select name="operateur" defaultValue={operateur} style={champ}>
              <option value="">Tous</option>
              {ops.map((o) => (
                <option key={String(o.nom)} value={String(o.nom)}>
                  {String(o.nom)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ ...champ, background: MARINE, color: "#fff", border: 0, cursor: "pointer" }}>
            Afficher
          </button>
          <PrintButton
            label="Imprimer / PDF"
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </form>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, margin: "8px 0 0" }}>
          {raccourcis.map((r) => {
            const qs = new URLSearchParams({ from: r.from, to: r.to, ...(operateur ? { operateur } : {}) });
            return (
              <a key={r.libelle} href={`?${qs}`}>
                {r.libelle}
              </a>
            );
          })}
          <a href="/rapports" style={{ marginLeft: "auto" }}>
            ← Rapport des heures
          </a>
        </p>
      </div>

      <div className="sheet">
        {/* En-tête */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 19, color: MARINE, lineHeight: 1.15 }}>Atelier Stéphan Hamache</div>
            <div style={{ fontSize: 10, color: TEINTES.gris, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>
              Tapisserie d&apos;ameublement · Poitiers
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: TEINTES.gris }}>
              Rapport d&apos;heures
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: MARINE, marginTop: 2 }}>
              du {dateFr(from)} au {dateFr(to)}
            </div>
            <div style={{ fontSize: 11, color: TEINTES.gris }}>
              {operateur ? `Opérateur : ${operateur}` : "Tous les opérateurs"} · édité le{" "}
              {new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
            </div>
          </div>
        </div>

        {/* Indicateurs */}
        <div
          className="avoid"
          style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, marginTop: 16,
            border: `1px solid ${TEINTES.filet}`, borderRadius: 6, overflow: "hidden",
          }}
        >
          {indicateurs.map((k, i) => (
            <div
              key={k.t}
              style={{
                padding: "8px 12px",
                borderLeft: i % 3 ? `1px solid ${TEINTES.filet}` : undefined,
                borderTop: i >= 3 ? `1px solid ${TEINTES.filet}` : undefined,
              }}
            >
              <div style={{ fontSize: 9.5, color: TEINTES.gris, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.t}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{k.v}</div>
              <div style={{ fontSize: 9.5, color: TEINTES.gris }}>{k.d}</div>
            </div>
          ))}
        </div>

        <div className="avoid">
          <Section titre={pas === "semaine" ? "Heures saisies par semaine" : "Heures saisies par mois"} note={pas === "semaine" ? "(lundi de chaque semaine)" : undefined} />
          <Colonnes points={temps.map((t) => ({ libelle: libelleTemps(t.libelle), valeur: t.h }))} />
        </div>

        <div className="avoid">
          <Section titre="Présence et saisie par opérateur" />
          <BarresHorizontales
            series={[
              { nom: "Présence pointée", couleur: TEINTES.clair },
              { nom: "Saisi sur dossiers", couleur: TEINTES.fonce },
            ]}
            lignes={parOp.map((o) => ({ libelle: o.operateur, valeurs: [o.pointees, o.saisies] }))}
          />
        </div>

        <div className="avoid">
          <Section titre="Réel et prévu par dossier" note="(15 dossiers les plus travaillés sur la période ; réel = cumul)" />
          <BarresHorizontales
            series={[
              { nom: "Prévu", couleur: TEINTES.clair },
              { nom: "Réel", couleur: TEINTES.fonce },
            ]}
            lignes={reelPrevu.map((d) => ({ libelle: d.nom, valeurs: [d.prevu, d.reel] }))}
          />
        </div>

        <div className="avoid">
          <Section titre="Heures par type de travail" />
          <BarresHorizontales
            series={[{ nom: "Heures", couleur: TEINTES.fonce }]}
            lignes={parType.map((t) => ({ libelle: t.libelle, valeurs: [t.h] }))}
          />
        </div>
      </div>
    </>
  );
}
