// Fiche de travail IMPRIMÉE pour l'atelier : noir & blanc, gros caractères,
// lisible sur l'établi. Composant serveur partagé entre l'impression d'une
// fiche (/fiche-impression/[id]) et de toutes les fiches d'un dossier
// (/fiche-impression/dossier/[id], une fiche par page).
//
// Ordre de lecture voulu par l'atelier (2026-10-21) — une fiche = 1 page A4 :
//   1. en très gros : CLIENT — OUVRAGE ×N, livraison, heures prévues ;
//   2. client complet (adresse, téléphone) ;
//   3. mesures & confection, tissus & fournitures, étapes à cocher ;
//   4. notes à la main.
// (Alertes, observations du devis et heures réelles retirés à la demande.)
// Fiche RIDEAUX : la « prise de cotes » PDF jointe s'imprime à la suite.
import { Fragment } from "react";

import { listerPiecesJointes, type PieceJointe } from "@/lib/fiche-pieces-db";
import { lirePieces } from "@/lib/prise-cotes";
import { sql } from "@/lib/raw-sql";
import { SCHEMAS } from "@/lib/fiches-schemas";

// ── Données ────────────────────────────────────────────────────────────────

export type FicheImprimable = {
  fiche: any;
  dossier: any;
  // PDF joints (prise de cotes rideaux), imprimés après la fiche.
  pdfs: PieceJointe[];
  // Nom de l'opérateur affecté à la fiche ("" si non affectée).
  operateur: string;
};

export async function chargerFiche(ficheId: number): Promise<FicheImprimable | null> {
  const [fiche] = await sql`SELECT * FROM fiches_atelier WHERE id = ${ficheId} LIMIT 1`;
  if (!fiche) return null;
  return completer(fiche);
}

export async function chargerFichesDossier(dossierId: number): Promise<FicheImprimable[]> {
  const fiches = await sql`SELECT * FROM fiches_atelier WHERE dossier_id = ${dossierId} ORDER BY id`;
  return Promise.all(fiches.map(completer));
}

async function completer(fiche: any): Promise<FicheImprimable> {
  const [dossier] = fiche.dossier_id
    ? await sql`SELECT * FROM dossiers WHERE id = ${fiche.dossier_id} LIMIT 1`
    : [null];
  const pdfs =
    fiche.type_intervention === "Rideaux"
      ? await listerPiecesJointes(Number(fiche.id)).catch(() => [])
      : [];
  // Opérateur affecté à CETTE fiche (l'affectation se fait par fiche).
  let operateur = "";
  try {
    const opId = Number(JSON.parse(fiche.contenu_json || "{}").operateur_id);
    if (Number.isFinite(opId) && opId > 0) {
      const [o] = await sql`SELECT nom FROM operateurs WHERE id = ${opId} LIMIT 1`;
      operateur = o ? String(o.nom) : "";
    }
  } catch {
    operateur = "";
  }
  return { fiche, dossier: dossier ?? null, pdfs, operateur };
}

// ── Mise en forme ─────────────────────────────────────────────────────────

const NOIR = "#000";
const GRIS = "#444";
const POLICE = "Arial, Helvetica, 'Liberation Sans', sans-serif";

const ETAPES_DEFAUT: Record<string, string[]> = {
  Tapisserie: ["DÉCOUVERTURE", "SANGLAGE", "GARNISSAGE", "POSE TISSU", "FINITION"],
  Rideaux: ["COUPE", "COUTURE", "TÊTES", "FINITIONS", "POSE"],
  Stores: ["DÉCOUPE", "MONTAGE", "ESSAI", "POSE"],
  "Tête de lit": ["DÉCOUPE", "GARNISSAGE", "POSE TISSU", "FINITION"],
  "Habillage de lit": ["DÉCOUPE", "COUTURE", "ASSEMBLAGE", "FINITION"],
  Coussins: ["DÉCOUPE", "COUTURE", "GARNISSAGE", "FERMETURE"],
  Galettes: ["DÉCOUPE", "COUTURE", "GARNISSAGE", "FERMETURE"],
  "Tenture murale": ["PRÉPARATION", "TOILE DE FOND", "POSE TISSU", "FINITION"],
  "Pose seule": ["PRÉPARATION", "POSE", "VÉRIFICATION"],
  Autre: ["", "", ""],
};

// Libellés des champs de fiche (schéma partagé avec l'éditeur).
function libelle(type: string, key: string): string {
  const f = (SCHEMAS[type] ?? []).find((x) => x.key === key)
    ?? Object.values(SCHEMAS).flat().find((x) => x.key === key);
  return f ? `${f.label}${f.unit ? ` (${f.unit})` : ""}` : key;
}

const fr = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "";

// Hauteurs serrées : une fiche = une page A4 (marges 8 mm).
function Titre({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase",
        borderBottom: `2.5px solid ${NOIR}`, padding: "0 0 2px", margin: "10px 0 5px",
      }}
    >
      {children}
    </div>
  );
}

function Case() {
  return (
    <span
      style={{ display: "inline-block", width: 20, height: 20, border: `2.5px solid ${NOIR}`, flexShrink: 0 }}
    />
  );
}

const cellule: React.CSSProperties = {
  border: `1.5px solid ${NOIR}`, padding: "4px 7px", fontSize: 14, verticalAlign: "top",
};
const entete: React.CSSProperties = {
  ...cellule, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
  background: "#fff", textAlign: "left", padding: "3px 7px",
};
const petitLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" };

export function FicheAtelierSheet({ data, saut }: { data: FicheImprimable; saut?: boolean }) {
  const { fiche, dossier } = data;
  const contenu: Record<string, any> =
    typeof fiche.contenu_json === "string" ? JSON.parse(fiche.contenu_json || "{}") : fiche.contenu_json || {};
  const type: string = fiche.type_intervention || dossier?.type_intervention || "Autre";

  // En-tête : client — ouvrage ×N, livraison, heures prévues.
  const client = String(contenu.client_nom || dossier?.client_nom || dossier?.nom_dossier || "").toUpperCase();
  const ouvrage = String(contenu.realisation || contenu.meuble || contenu.type_store || type).toUpperCase();
  const quantite =
    contenu.quantite || contenu.nb_stores || contenu.nb_coussins || contenu.nb_galettes || contenu.nb_panneaux || "";
  const qte = quantite && String(quantite) !== "1" ? ` ×${quantite}` : "";
  // Heures de CETTE fiche (le dossier n'en est que le total).
  const heuresPrevues = contenu.heures_estimees || "";
  const livraison = dossier?.date_livraison || dossier?.date_fin_chantier || "";

  // Mesures & confection : champs du schéma remplis (hors textes longs).
  const schema = SCHEMAS[type] ?? SCHEMAS["Autre"];
  // Avec des cotes par pièce, tête et doublure y figurent déjà : pas de doublon.
  const dejaDansCotes = Array.isArray(contenu.pieces_cotes) && contenu.pieces_cotes.length > 0;
  const mesures = schema
    .filter((f) => f.type !== "textarea" && f.key !== "meuble")
    .filter((f) => !(dejaDansCotes && (f.key === "type_tete" || f.key === "doublure")))
    .map((f) => ({ label: libelle(type, f.key), valeur: contenu[f.key] }))
    .filter((m) => m.valeur !== undefined && m.valeur !== null && String(m.valeur).trim() !== "");
  const textes = schema.filter((f) => f.type === "textarea" && f.key !== "observations" && contenu[f.key]);

  // Tissus & fournitures, étapes.
  const tissus: any[] = Array.isArray(contenu.tissus_list) ? contenu.tissus_list : [];
  const fournitures: any[] = Array.isArray(contenu.fournitures_list) ? contenu.fournitures_list : [];
  const lignesMat = [...tissus, ...fournitures].filter((t) => t && (t.ref || t.coloris || t.metrage));
  const etapes: string[] = Array.isArray(contenu.etapes_custom) && contenu.etapes_custom.length
    ? contenu.etapes_custom.map((e: any) => [e.etape, e.type].filter(Boolean).join(" — "))
    : ETAPES_DEFAUT[type] ?? ETAPES_DEFAUT.Autre;
  // Fiche recoupée (rideaux) : cotes par pièce de la prise de cotes tablette
  // + ouvrages à réaliser du devis.
  const cotes = lirePieces(contenu.pieces_cotes);
  const aRealiser: { realisation: string; quantite: string; detail: string }[] = Array.isArray(contenu.a_realiser)
    ? contenu.a_realiser
    : [];

  const reference = contenu.reference ? `Devis ${contenu.reference}` : "";
  // Les notes générées (« Devis … — Canapé ») redisent l'en-tête : masquées.
  const notes = /^(devis\b|fiche recoup)/i.test(String(fiche.notes_libres || "").trim())
    ? ""
    : String(fiche.notes_libres || "").trim();

  return (
    <section
      className="fiche"
      style={{
        fontFamily: POLICE, color: NOIR, background: "#fff", width: "100%", maxWidth: 800,
        margin: "0 auto", padding: "16px 20px 18px",
        breakAfter: saut ? "page" : undefined, pageBreakAfter: saut ? "always" : undefined,
      }}
    >
      {/* Bandeau : qui / quoi */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
        <span>FICHE DE TRAVAIL · {type.toUpperCase()}</span>
        <span>
          {[reference, dossier ? `Dossier n° ${dossier.id}` : "", `Fiche n° ${fiche.id}`].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div style={{ border: `3.5px solid ${NOIR}`, padding: "7px 12px", marginTop: 4, fontWeight: 900, lineHeight: 1.05 }}>
        <div style={{ fontSize: 32, wordBreak: "break-word" }}>{client || "CLIENT ?"}</div>
        <div style={{ fontSize: 24, marginTop: 4 }}>
          {ouvrage}
          {qte}
        </div>
      </div>

      {/* Livraison / heures / client */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cellule, width: "24%", borderWidth: 2 }}>
              <div style={petitLabel}>LIVRAISON</div>
              <div style={{ fontSize: 19, fontWeight: 900 }}>{fr(livraison) || "___ / ___ / ______"}</div>
            </td>
            <td style={{ ...cellule, width: "14%", borderWidth: 2 }}>
              <div style={petitLabel}>HEURES PRÉVUES</div>
              <div style={{ fontSize: 19, fontWeight: 900 }}>
                {heuresPrevues ? `${String(heuresPrevues).replace(".", ",")} h` : "____ h"}
              </div>
            </td>
            <td style={{ ...cellule, width: "18%", borderWidth: 2 }}>
              <div style={petitLabel}>OPÉRATEUR</div>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{data.operateur || "__________"}</div>
            </td>
            <td style={{ ...cellule, width: "28%", fontSize: 13 }}>
              <div style={petitLabel}>ADRESSE</div>
              {dossier?.adresse || contenu.client_adresse || "—"}
            </td>
            <td style={{ ...cellule, width: "16%", fontSize: 13 }}>
              <div style={petitLabel}>TÉLÉPHONE</div>
              {dossier?.telephone || contenu.client_tel || "—"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cotes par pièce (prise de cotes chez le client) */}
      {cotes.length > 0 && (
        <>
          <Titre>Cotes par pièce</Titre>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Pièce", "Tringle", "Crochets", "Haut. tringle/sol", "Tête", "Bas", "Unique / paire", "Retours G / D", "Doublure"].map(
                  (h) => (
                    <th key={h} style={entete}>{h}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {cotes.map((c, i) => (
                <Fragment key={i}>
                  <tr className="garder">
                    <td style={{ ...cellule, fontWeight: 900 }}>{c.piece || i + 1}</td>
                    <td style={{ ...cellule, fontSize: 17, fontWeight: 900, whiteSpace: "nowrap" }}>{c.longueurTringle ? `${c.longueurTringle} m` : ""}</td>
                    <td style={{ ...cellule, fontSize: 17, fontWeight: 900, whiteSpace: "nowrap" }}>{c.nbCrochets}</td>
                    <td style={{ ...cellule, fontSize: 17, fontWeight: 900, whiteSpace: "nowrap" }}>{c.hauteurTringleSol ? `${c.hauteurTringleSol} m` : ""}</td>
                    <td style={{ ...cellule, fontWeight: 700 }}>{c.typeTete}</td>
                    <td style={cellule}>{c.typeBas}</td>
                    <td style={{ ...cellule, fontWeight: 700 }}>
                      {c.uniquePaire}
                      {c.uniquePaire === "Unique" && (c.uniqueG || c.uniqueD) ? ` (G ${c.uniqueG || "—"} / D ${c.uniqueD || "—"})` : ""}
                    </td>
                    <td style={cellule}>{c.retourG || c.retourD ? `${c.retourG || "—"} / ${c.retourD || "—"}` : ""}</td>
                    <td style={{ ...cellule, fontWeight: 700 }}>{c.doublure}</td>
                  </tr>
                  {c.note && (
                    <tr className="garder">
                      <td colSpan={9} style={{ ...cellule, fontSize: 13 }}>
                        <span style={{ fontSize: 11, color: GRIS }}>Note : </span>
                        {c.note}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* À réaliser (lignes du devis) */}
      {aRealiser.length > 0 && (
        <>
          <Titre>À réaliser (devis)</Titre>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {aRealiser.map((l, i) => (
                <tr key={i} className="garder">
                  <td style={{ ...cellule, width: "26%", fontWeight: 900 }}>
                    {l.realisation}
                    {l.quantite && l.quantite !== "1" ? ` ×${l.quantite}` : ""}
                  </td>
                  <td style={{ ...cellule, fontSize: 13 }}>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Mesures & confection */}
      {mesures.length > 0 && (
        <>
          <Titre>Mesures & confection</Titre>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Array.from({ length: Math.ceil(mesures.length / 2) }, (_, i) => (
                <tr key={i} className="garder">
                  {[mesures[2 * i], mesures[2 * i + 1]].map((m, j) =>
                    m ? (
                      <td key={j} style={{ ...cellule, width: "50%" }}>
                        <span style={{ fontSize: 11, color: GRIS }}>{m.label} : </span>
                        <strong style={{ fontSize: 16 }}>{String(m.valeur)}</strong>
                      </td>
                    ) : (
                      <td key={j} style={{ ...cellule, width: "50%" }} />
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Tissus & fournitures */}
      <Titre>Tissus & fournitures</Titre>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...entete, width: "48%" }}>Référence / nom</th>
            <th style={{ ...entete, width: "20%" }}>Coloris</th>
            <th style={{ ...entete, width: "18%" }}>Placement</th>
            <th style={{ ...entete, width: "14%", textAlign: "right" }}>Métrage</th>
          </tr>
        </thead>
        <tbody>
          {(lignesMat.length ? lignesMat : [{}]).map((t: any, i: number) => (
            <tr key={i} className="garder">
              <td style={{ ...cellule, fontWeight: 800, height: 26 }}>{t.ref || ""}</td>
              <td style={cellule}>{t.coloris || ""}</td>
              <td style={cellule}>{t.placement || ""}</td>
              <td style={{ ...cellule, textAlign: "right", fontWeight: 800 }}>
                {t.metrage ? `${t.metrage} m` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Étapes à cocher */}
      <Titre>Étapes — cocher quand c&apos;est fait</Titre>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...entete, width: "6%" }} />
            <th style={{ ...entete, width: "58%" }}>Étape</th>
            <th style={{ ...entete, width: "22%" }}>Fait par</th>
            <th style={{ ...entete, width: "14%" }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {etapes.map((e, i) => (
            <tr key={i} className="garder">
              <td style={{ ...cellule, textAlign: "center", verticalAlign: "middle", padding: "3px" }}>
                <Case />
              </td>
              <td style={{ ...cellule, fontSize: 16, fontWeight: 900, verticalAlign: "middle", height: 30 }}>
                {e}
              </td>
              <td style={cellule} />
              <td style={cellule} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Textes de la fiche */}
      {textes.map((f) => (
        <div key={f.key} className="garder">
          <Titre>{f.label}</Titre>
          <div style={{ ...cellule, fontSize: 13, whiteSpace: "pre-wrap" }}>{String(contenu[f.key])}</div>
        </div>
      ))}
      {notes && (
        <div className="garder">
          <Titre>Notes</Titre>
          <div style={{ ...cellule, fontSize: 13, whiteSpace: "pre-wrap" }}>{notes}</div>
        </div>
      )}

      {/* Notes à la main (observations du devis et heures réelles retirées
          à la demande de l'atelier, 2026-10-21) */}
      <div className="garder">
        <Titre>Notes atelier</Titre>
        <div
          style={{
            border: `1.5px solid ${NOIR}`, height: 4 * 27,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 26px, ${GRIS} 26px 27px)`,
          }}
        />
      </div>
    </section>
  );
}

// Styles d'impression communs (A4 portrait, noir & blanc, une fiche par page).
export const STYLES_IMPRESSION = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e9e9e9; color: #000; font-family: ${POLICE}; }
  .feuille { background: #fff; max-width: 840px; margin: 18px auto; box-shadow: 0 2px 18px rgba(0,0,0,.15); }
  .print-btn {
    position: fixed; top: 14px; right: 14px; z-index: 999; background: #000; color: #fff;
    border: none; padding: 10px 22px; font: 700 13px ${POLICE}; text-transform: uppercase;
    letter-spacing: .08em; cursor: pointer; border-radius: 6px;
  }
  @media print {
    @page { size: A4; margin: 8mm; }
    body { background: #fff; }
    .feuille { box-shadow: none; margin: 0; max-width: none; }
    .print-btn { display: none !important; }
    /* La page A4 (marges 8 mm) est plus étroite que l'écran : on réduit
       un peu pour qu'une fiche tienne sur une seule page. */
    .fiche { padding: 0 !important; zoom: 0.86; }
    .garder, tr { break-inside: avoid; page-break-inside: avoid; }
    /* Prise de cotes jointe : chaque page sur sa propre feuille, à la taille de la page. */
    .piece-jointe { break-before: page; page-break-before: always; }
    .piece-jointe img { max-height: 279mm; width: auto !important; max-width: 100%; margin: 0 auto; }
    .no-print { display: none !important; }
  }
`;
