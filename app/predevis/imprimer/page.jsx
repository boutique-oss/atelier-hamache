'use client';

/*
 * DETTE TECHNIQUE — Saisie unique non respectée
 * Les constantes ci-dessous (FOURNISSEURS, TYPES_INTERVENTION, TAPISSERIE_OPS,
 * FINITION_OPTIONS, TVA_OPTIONS) sont dupliquées depuis :
 *   C:/Users/Utilisateur/Desktop/erp/PREDEVIS/PredevisPage.jsx (lignes 12-59)
 * À refactorer en module partagé (lib/predevis-constants.js) lors de
 * l'intégration du module prédevis dans atelier-app.
 */

const TYPES_INTERVENTION = [
  'Tapisserie', 'Rideaux', 'Stores', 'Tête de lit',
  'Habillage de lit', 'Coussins', 'Pose seule', 'Autre',
];

const FOURNISSEURS = [
  'CASAL', 'CASAMANCE', 'Camengo', 'Casadeco', 'Dedar', 'Designers Guild',
  'Élitis', 'Houlès', 'Jean Paul Gaultier', 'Lelièvre', 'Lizzo', 'Manuel Canovas',
  'Misia', 'Nobilis', 'Osborne & Little', 'Pierre Frey', 'Romo', 'Rubelli',
  'Sahco', 'Sanderson', 'Zimmer + Rohde', 'Zoffany', 'Autre',
];

const TAPISSERIE_OPS = [
  'Dégarnissage', 'Recollage', 'Découverture',
  'Recouverture', 'Création', 'Modification structure',
];

const FINITION_OPTIONS = ['Galons', 'Frange', 'Pose invisible', 'Clous', 'Griffe'];

const TVA_OPTIONS = [
  '20 % standard',
  '10 % rénovation logement > 2 ans',
];

const Case = ({ children }) => (
  <span className="checkbox-label">
    <span className="case" aria-hidden="true" />
    {children}
  </span>
);

const Tissu = ({ n, principal }) => (
  <div className="tissu">
    <div className="tissu-titre">
      Tissu {n}{principal ? ' — principal' : ''}
    </div>

    <div className="bloc-sous-titre">Fournisseur</div>
    <div className="grid-fourn">
      {FOURNISSEURS.map((f) => (
        <Case key={f}>{f === 'Autre' ? <>Autre&nbsp;: <span className="ligne ligne-inline" /></> : f}</Case>
      ))}
    </div>

    <div className="grid-2 tissu-row">
      <div>
        <span className="field-label">Référence</span>
        <span className="ligne ligne-grow" />
      </div>
      <div>
        <span className="field-label">Coloris</span>
        <span className="ligne ligne-grow" />
      </div>
    </div>

    <div className="grid-2 tissu-row">
      <div>
        <span className="field-label">Métrage prévisionnel</span>
        <span className="ligne ligne-court" /> m
      </div>
      <div>
        <span className="field-label">Prix HT au mètre</span>
        <span className="ligne ligne-court" /> €
      </div>
    </div>
  </div>
);

export default function PredevisImprimerPage() {
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@400;500;600;700&display=swap');

        @page { size: A4; margin: 12mm; }

        html, body {
          margin: 0;
          padding: 0;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #000;
          background: #fff;
          font-size: 11px;
          line-height: 1.4;
        }

        * { box-sizing: border-box; }

        .serif { font-family: 'Fraunces', Georgia, serif; }

        .page-wrap {
          max-width: 186mm;
          margin: 0 auto;
        }

        /* ==== EN-TÊTE ==== */
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 8px;
          margin-bottom: 10px;
          border-bottom: 1.5px solid #000;
        }
        .doc-header .surlignage {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 4px;
        }
        .doc-header h1 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 26px;
          margin: 0;
          line-height: 1.1;
          font-weight: 500;
        }
        .doc-header .meta {
          text-align: right;
          font-size: 11px;
        }
        .doc-header .meta .ligne-court { width: 18px; }
        .doc-header .meta .ligne-mid { width: 36px; }
        .doc-header .meta .ligne-ref { width: 80px; }

        /* ==== BLOCS ==== */
        .bloc {
          border: 1px solid #000;
          padding: 7px 10px 8px;
          margin-bottom: 7px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .bloc-titre {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #000;
        }
        .bloc-sous-titre {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin: 6px 0 4px;
          font-weight: 600;
        }

        /* ==== CASES À COCHER ==== */
        .case {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 1.5px solid #000;
          background: #fff;
          margin-right: 5px;
          flex-shrink: 0;
        }
        .checkbox-label {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          line-height: 1.4;
          margin-right: 12px;
        }

        /* ==== LIGNES À REMPLIR ==== */
        .ligne {
          display: inline-block;
          border-bottom: 1px solid #000;
          height: 16px;
          vertical-align: bottom;
        }
        .ligne-pleine {
          display: block;
          border-bottom: 1px solid #000;
          height: 18px;
          margin-bottom: 5px;
        }
        .ligne-court { width: 50px; }
        .ligne-mid { width: 100px; }
        .ligne-grow { width: calc(100% - 80px); }
        .ligne-inline { width: 70px; vertical-align: bottom; }

        /* ==== GRILLES ==== */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 10px; }
        .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px 10px; }

        .field-label {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-right: 6px;
        }

        /* ==== TYPES D'INTERVENTION ==== */
        .grid-types {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 3px 8px;
        }

        /* ==== FOURNISSEURS — 4 COLONNES COMPACTES ==== */
        .grid-fourn {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 2px 8px;
          margin-bottom: 5px;
        }
        .grid-fourn .checkbox-label {
          font-size: 10px;
          margin-right: 0;
        }

        /* ==== TISSU SOUS-BLOC ==== */
        .tissu {
          padding: 5px 0 6px;
          border-top: 1px dashed #000;
        }
        .tissu:first-of-type {
          border-top: 0;
          padding-top: 2px;
        }
        .tissu-titre {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 3px;
        }
        .tissu-row { margin-top: 4px; }

        /* ==== TAPISSERIE — sous-blocs ==== */
        .tapisserie-sub {
          margin-top: 6px;
          padding-top: 5px;
          border-top: 1px dashed #000;
        }
        .tapisserie-sub-options {
          padding-left: 22px;
          margin-top: 3px;
        }

        /* ==== TABLEAU FOURNITURES ==== */
        .tableau {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .tableau th,
        .tableau td {
          border: 1px solid #000;
          padding: 3px 6px;
          text-align: left;
          height: 20px;
          font-weight: 400;
        }
        .tableau th {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        /* ==== MAIN D'ŒUVRE ==== */
        .mo-row {
          display: flex;
          gap: 30px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .mo-row > div { display: flex; align-items: baseline; gap: 8px; }

        /* ==== RÉCAPITULATIF ==== */
        .recap-row {
          display: grid;
          grid-template-columns: 1fr 90px;
          padding: 4px 0;
          border-bottom: 1px solid #000;
          font-size: 11px;
        }
        .recap-row:last-child { border-bottom: 0; }
        .recap-row.total {
          font-weight: 600;
          border-top: 1.5px solid #000;
          padding-top: 5px;
        }
        .recap-row .recap-val {
          border-bottom: 0;
          text-align: right;
        }

        /* ==== BOUTON IMPRIMER ==== */
        .no-print {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 10px;
        }
        .btn-print {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          padding: 8px 16px;
          border: 1.5px solid #000;
          background: #fff;
          color: #000;
          cursor: pointer;
          letter-spacing: 0.04em;
        }
        .btn-print:hover { background: #000; color: #fff; }

        /* ==== ÉCRAN VS IMPRESSION ==== */
        @media screen {
          body { padding: 16px; }
          .page-wrap { max-width: 210mm; padding: 0 8mm; }
        }

        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; color: #000 !important; }
          .page-wrap { max-width: none; }
          .bloc { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <div className="page-wrap">
        <div className="no-print">
          <button
            type="button"
            className="btn-print"
            onClick={() => window.print()}
          >
            Imprimer / Enregistrer en PDF
          </button>
        </div>

        {/* ============ EN-TÊTE ============ */}
        <header className="doc-header">
          <div>
            <div className="surlignage">Atelier Stéphan Hamache</div>
            <h1>Prédevis — formulaire de relevé</h1>
          </div>
          <div className="meta">
            <div>
              Date <span className="ligne ligne-court" /> /{' '}
              <span className="ligne ligne-court" /> /{' '}
              <span className="ligne ligne-mid" />
            </div>
            <div style={{ marginTop: 4 }}>
              Réf. dossier <span className="ligne ligne-ref" />
            </div>
          </div>
        </header>

        {/* ============ BLOC 1 — CLIENT & PROJET ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">1 · Client & projet</h2>

          <div style={{ marginBottom: 4 }}>
            <span className="field-label">Nom / Société</span>
            <span className="ligne" style={{ width: 'calc(100% - 110px)' }} />
          </div>

          <div style={{ marginBottom: 4 }}>
            <span className="field-label">Adresse</span>
            <span className="ligne" style={{ width: 'calc(100% - 65px)' }} />
          </div>
          <div className="ligne-pleine" />

          <div className="grid-2" style={{ marginBottom: 4 }}>
            <div>
              <span className="field-label">Téléphone</span>
              <span className="ligne ligne-grow" />
            </div>
            <div>
              <span className="field-label">Email</span>
              <span className="ligne ligne-grow" />
            </div>
          </div>

          <div className="bloc-sous-titre">Description du projet</div>
          <div className="ligne-pleine" />
          <div className="ligne-pleine" />
          <div className="ligne-pleine" />

          <div className="bloc-sous-titre">Type d'intervention</div>
          <div className="grid-types">
            {TYPES_INTERVENTION.map((t) => (
              <Case key={t}>
                {t === 'Autre' ? (
                  <>Autre&nbsp;: <span className="ligne" style={{ width: 90 }} /></>
                ) : t}
              </Case>
            ))}
          </div>

          <div className="bloc-sous-titre">TVA</div>
          <div>
            {TVA_OPTIONS.map((opt) => (
              <Case key={opt}>{opt}</Case>
            ))}
          </div>
        </section>

        {/* ============ BLOC 2 — TISSUS ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">2 · Matière — tissus (jusqu'à 3)</h2>
          <Tissu n={1} principal />
          <Tissu n={2} />
          <Tissu n={3} />
        </section>

        {/* ============ BLOC 3 — TAPISSERIE ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">3 · Opérations tapisserie</h2>

          <div className="bloc-sous-titre">Opérations</div>
          <div className="grid-3">
            {TAPISSERIE_OPS.map((op) => (
              <Case key={op}>{op}</Case>
            ))}
          </div>

          <div className="tapisserie-sub">
            <Case>
              <strong>Changement</strong>
            </Case>
            <div className="tapisserie-sub-options grid-2">
              <div>
                <span className="field-label">Matière</span>
                <Case>Mousse</Case>
                <Case>Crin</Case>
              </div>
              <div>
                <span className="field-label">Zone</span>
                <Case>Assise</Case>
                <Case>Dossier</Case>
                <Case>Les deux</Case>
              </div>
            </div>
          </div>

          <div className="tapisserie-sub">
            <Case>
              <strong>Finition</strong>
            </Case>
            <div className="tapisserie-sub-options">
              {FINITION_OPTIONS.map((opt) => (
                <Case key={opt}>{opt}</Case>
              ))}
            </div>
          </div>
        </section>

        {/* ============ BLOC 4 — FOURNITURES ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">4 · Fournitures atelier</h2>
          <table className="tableau">
            <thead>
              <tr>
                <th style={{ width: '55%' }}>Désignation</th>
                <th style={{ width: '12%' }}>Qté</th>
                <th style={{ width: '13%' }}>Unité</th>
                <th style={{ width: '20%' }}>Prix HT unitaire</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ============ BLOC 5 — MAIN D'ŒUVRE & POSE ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">5 · Main d'œuvre & pose</h2>

          <div className="mo-row">
            <div>
              <span className="field-label">Heures atelier estimées</span>
              <span className="ligne ligne-court" /> h
            </div>
            <div>
              <span className="field-label">Forfait pose</span>
              <span className="ligne ligne-court" /> €
            </div>
            <div>
              <span className="field-label">Déplacement (km AR)</span>
              <span className="ligne ligne-court" /> km
            </div>
          </div>

          <div className="bloc-sous-titre">Notes libres</div>
          <div className="ligne-pleine" />
          <div className="ligne-pleine" />
          <div className="ligne-pleine" />
        </section>

        {/* ============ BLOC 6 — RÉCAPITULATIF ============ */}
        <section className="bloc">
          <h2 className="bloc-titre">6 · Récapitulatif <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>· complété au bureau</span></h2>

          <div className="recap-row">
            <span>Sous-total tissus</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row">
            <span>Sous-total fournitures</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row">
            <span>Sous-total main d'œuvre</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row">
            <span>Sous-total pose &amp; déplacement</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row total">
            <span>Total HT</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row">
            <span>TVA (<span className="ligne" style={{ width: 30 }} /> %)</span>
            <span className="recap-val">€</span>
          </div>
          <div className="recap-row total">
            <span>Total TTC</span>
            <span className="recap-val">€</span>
          </div>
        </section>
      </div>
    </>
  );
}
