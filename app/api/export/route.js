import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

const TAUX_HORAIRE = 55; // € HT / heure

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

// ── Utilitaires HTML ─────────────────────────────────────────────────────────

function esc(v) {
  if (v === null || v === undefined || v === '') return '<span class="nd">—</span>';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d) {
  if (!d) return '<span class="nd">—</span>';
  const [y, m, day] = String(d).split('-');
  if (!y || !m || !day) return esc(d);
  return `${day}/${m}/${y}`;
}

function fmtH(v) {
  const n = parseFloat(v) || 0;
  return n > 0 ? `${n}h` : '<span class="nd">—</span>';
}

const STATUT_CLS = {
  'Nouveau': 'st-nouveau', 'Devis envoyé': 'st-devis', 'Validé': 'st-valide',
  'En atelier': 'st-atelier', 'Prêt à poser': 'st-pret', 'Clos': 'st-clos',
};

function badge(s) {
  const cls = STATUT_CLS[s] || 'st-nouveau';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

function flagBadges(flagsJson) {
  try {
    const flags = JSON.parse(flagsJson || '[]');
    if (!flags.length) return '<span class="nd">—</span>';
    return flags.map(f => `<span class="flag">${esc(f)}</span>`).join(' ');
  } catch { return '<span class="nd">—</span>'; }
}

function tableHtml(cols, rows, emptyMsg = 'Aucune donnée') {
  if (!rows.length) return `<p class="empty">${emptyMsg}</p>`;
  const head = cols.map(c => `<th>${c.label}</th>`).join('');
  const body = rows.map((r, i) => {
    const cells = cols.map(c => {
      const val = c.render ? c.render(r) : esc(r[c.key]);
      return `<td${c.num ? ' class="num"' : ''}>${val}</td>`;
    }).join('');
    return `<tr class="${i % 2 === 1 ? 'alt' : ''}">${cells}</tr>`;
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function statCard(label, value, color = '#1A1814') {
  return `<div class="stat-card"><div class="stat-val" style="color:${color}">${value}</div><div class="stat-lbl">${label}</div></div>`;
}

// ── Template HTML principal ──────────────────────────────────────────────────

function htmlDoc(title, body, landscape = false) {
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASH · ${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4${landscape ? ' landscape' : ''};margin:14mm 16mm}
@media print{
  .toolbar{display:none!important}
  .page-break{page-break-before:always}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid;page-break-after:auto}
}
body{
  font-family:'Arial',sans-serif;font-size:10.5px;
  color:#1A1814;background:#fff;line-height:1.45
}

/* ── Toolbar (masqué à l'impression) ── */
.toolbar{
  position:sticky;top:0;z-index:100;
  background:#1A1814;color:#FAF7F2;
  padding:10px 20px;
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:24px
}
.toolbar-title{font-size:13px;font-weight:600}
.toolbar-title span{color:#9B5E2A}
.btn-print{
  background:#9B5E2A;color:#fff;border:none;
  padding:8px 18px;border-radius:5px;cursor:pointer;
  font-size:12px;font-weight:700;letter-spacing:.02em
}
.btn-print:hover{background:#B8702F}

/* ── En-tête document ── */
.doc-header{
  display:flex;justify-content:space-between;align-items:flex-end;
  border-bottom:2px solid #9B5E2A;padding-bottom:10px;margin-bottom:20px
}
.doc-brand{font-size:9px;color:#9B5E2A;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px}
.doc-title{font-size:22px;font-weight:700;color:#1A1814}
.doc-meta{font-size:9px;color:#9A9387;text-align:right;line-height:1.6}

/* ── Titres de section ── */
.section-title{
  font-size:12px;font-weight:700;color:#1A1814;
  border-left:3px solid #9B5E2A;padding-left:9px;
  margin:22px 0 10px
}
.section-count{font-size:9px;color:#9A9387;font-weight:400;margin-left:6px}

/* ── Tables ── */
table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:10px}
thead tr{background:#FAF7F2}
th{
  color:#6B6557;font-size:8.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;
  padding:6px 8px;border-bottom:1.5px solid #E8E2D5;
  text-align:left;white-space:nowrap
}
td{padding:5px 8px;border-bottom:1px solid #F0EBDF;vertical-align:top}
tr.alt td{background:#FAF7F2}
td.num{text-align:right;font-variant-numeric:tabular-nums}

/* ── Badges statut ── */
.badge{
  display:inline-block;padding:2px 6px;border-radius:3px;
  font-size:8px;font-weight:700;white-space:nowrap
}
.st-nouveau{background:#F1EEE6;color:#5F5950}
.st-devis{background:#E5EDF3;color:#2D5F7C}
.st-valide{background:#EDE6EF;color:#5C3D5E}
.st-atelier{background:#F5E9DC;color:#8C5219}
.st-pret{background:#E5EDDF;color:#3F5E2F}
.st-clos{background:#E8E5DE;color:#3D3A33}
.flag{
  display:inline-block;background:#F4E4EA;color:#7C3F54;
  padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;margin-right:2px
}

/* ── Heures dépassé/ok ── */
.h-over{color:#C0392B;font-weight:700}
.h-ok{color:#27AE60;font-weight:700}
.h-neu{color:#9A9387}

/* ── Vide / null ── */
.nd{color:#C5BFB5;font-style:italic}
.empty{color:#9A9387;font-style:italic;padding:16px 8px;font-size:11px}

/* ── Cartes stats ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{border:1px solid #E8E2D5;border-radius:6px;padding:10px 12px}
.stat-val{font-size:24px;font-weight:700;line-height:1;margin-bottom:4px}
.stat-lbl{font-size:9px;color:#6B6557;text-transform:uppercase;letter-spacing:.05em}

/* ── Pied de page ── */
@media print{
  @page{
    @bottom-center{
      content:"Page " counter(page) " / " counter(pages);
      font-size:8px;color:#9A9387
    }
  }
}
.footer{
  margin-top:24px;padding-top:8px;
  border-top:1px solid #E8E2D5;
  font-size:9px;color:#9A9387;
  display:flex;justify-content:space-between
}
</style>
</head>
<body>
<div class="toolbar">
  <span class="toolbar-title">Atelier <span>Stéphan Hamache</span> · ${title}</span>
  <button class="btn-print" onclick="window.print()">🖨&nbsp; Imprimer / Enregistrer en PDF</button>
</div>
<div class="doc-header">
  <div>
    <div class="doc-brand">Atelier Stéphan Hamache</div>
    <div class="doc-title">${title}</div>
  </div>
  <div class="doc-meta">
    Exporté le ${dateStr}<br>
    atelier.db
  </div>
</div>
${body}
<div class="footer">
  <span>Atelier Stéphan Hamache — usage interne</span>
  <span>${dateStr}</span>
</div>
</body>
</html>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function sectionDossiers(db) {
  const rows = db.prepare(`
    SELECT nom_dossier, client_nom, statut, flags, type_intervention,
           date_ouverture, telephone, adresse,
           heures_a_realiser,
           etape_devis, etape_cmde, etape_atelier, etape_print, etape_realise,
           lien_dossier_externe, commentaires
    FROM dossiers
    WHERE statut != 'Clos'
    ORDER BY
      CASE statut
        WHEN 'En atelier'   THEN 1
        WHEN 'Prêt à poser' THEN 2
        WHEN 'Validé'       THEN 3
        WHEN 'Devis envoyé' THEN 4
        ELSE 5
      END, date_ouverture DESC
  `).all();

  const archived = db.prepare(`SELECT COUNT(*) as n FROM dossiers WHERE statut='Clos'`).get().n;

  // Stats rapides
  const byStatut = db.prepare(`SELECT statut, COUNT(*) as n FROM dossiers WHERE statut!='Clos' GROUP BY statut`).all();
  const totH = db.prepare(`SELECT ROUND(SUM(heures_a_realiser),1) as t FROM dossiers WHERE statut!='Clos'`).get().t || 0;

  const statsHtml = `<div class="stats-grid">
    ${statCard('Dossiers actifs', rows.length, '#1A1814')}
    ${statCard('En atelier', byStatut.find(r=>r.statut==='En atelier')?.n || 0, '#B8702F')}
    ${statCard('Prêts à poser', byStatut.find(r=>r.statut==='Prêt à poser')?.n || 0, '#5C7A4D')}
    ${statCard('Heures prévues', totH + 'h', '#9B5E2A')}
  </div>`;

  const etapeDots = r => {
    const steps = [
      { k: 'etape_devis', t: 'Devis' }, { k: 'etape_cmde', t: 'Cde' },
      { k: 'etape_atelier', t: 'Fiche' }, { k: 'etape_print', t: 'Print' },
      { k: 'etape_realise', t: 'Réalisé' },
    ];
    return steps.map(s =>
      `<span title="${s.t}" style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:2px;background:${r[s.k] ? '#9B5E2A' : '#E8E2D5'};border:1px solid ${r[s.k] ? '#9B5E2A' : '#D9D0C5'}"></span>`
    ).join('');
  };

  const cols = [
    { label: 'Dossier / Client', render: r => `<b>${esc(r.nom_dossier)}</b>${r.client_nom !== r.nom_dossier ? `<br><span style="color:#9A9387;font-size:9px">${esc(r.client_nom)}</span>` : ''}` },
    { label: 'Statut', render: r => badge(r.statut) },
    { label: 'Type', render: r => esc(r.type_intervention) },
    { label: 'H.prévues', render: r => fmtH(r.heures_a_realiser), num: true },
    { label: 'Date', render: r => fmtDate(r.date_ouverture) },
    { label: 'Téléphone', render: r => esc(r.telephone) },
    { label: 'Avancement', render: r => etapeDots(r) },
    { label: 'Flags', render: r => flagBadges(r.flags) },
  ];

  return `${statsHtml}
  <div class="section-title">Dossiers actifs <span class="section-count">${rows.length} dossiers · ${archived} archivé(s)</span></div>
  ${tableHtml(cols, rows, 'Aucun dossier actif')}`;
}

function sectionCommandes(db) {
  const rows = db.prepare(`
    SELECT fournisseur, client, designation, reference, coloris,
           qte, qte_note, unite, date_cde, qte_livree, commentaires
    FROM commandes
    ORDER BY fournisseur, client
  `).all();

  const livrees = rows.filter(r => r.qte_livree > 0).length;
  const totalMl = rows.reduce((s, r) => s + (r.qte || 0), 0);

  const statsHtml = `<div class="stats-grid">
    ${statCard('Total commandes', rows.length)}
    ${statCard('En attente livraison', rows.length - livrees, '#B8702F')}
    ${statCard('Livrées', livrees, '#5C7A4D')}
    ${statCard('Volume total', Math.round(totalMl * 10) / 10 + ' ml', '#9B5E2A')}
  </div>`;

  const cols = [
    { label: 'Fournisseur', render: r => `<b>${esc(r.fournisseur)}</b>` },
    { label: 'Client', render: r => esc(r.client) },
    { label: 'Désignation', render: r => esc(r.designation) },
    { label: 'Référence', render: r => `<span style="font-family:monospace;font-size:9px">${esc(r.reference)}</span>` },
    { label: 'Coloris', render: r => esc(r.coloris) },
    { label: 'Quantité', render: r => r.qte ? `${r.qte} ${r.unite || 'ml'}` : esc(r.qte_note), num: true },
    { label: 'Date cde', render: r => fmtDate(r.date_cde) },
    { label: 'Livraison', render: r => r.qte_livree > 0
        ? `<span class="badge st-pret">${r.qte_livree} ml</span>`
        : `<span class="badge st-atelier">En attente</span>` },
  ];

  return `${statsHtml}
  <div class="section-title">Commandes tissu <span class="section-count">${rows.length} lignes</span></div>
  ${tableHtml(cols, rows, 'Aucune commande')}`;
}

function sectionHeures(db) {
  // Table heures peut ne pas exister encore
  try {
    const rows = db.prepare(`
      SELECT h.date, h.operateur, d.nom_dossier, d.client_nom,
             h.heures_passees, h.type_travail, h.description,
             d.heures_a_realiser as prevues
      FROM heures h
      LEFT JOIN dossiers d ON h.dossier_id = d.id
      ORDER BY h.date DESC, h.created_at DESC
    `).all();

    if (!rows.length) return `<div class="section-title">Heures</div><p class="empty">Aucune saisie d'heures enregistrée.</p>`;

    const totalH = rows.reduce((s, r) => s + (r.heures_passees || 0), 0);
    const ops = [...new Set(rows.map(r => r.operateur))];

    const statsHtml = `<div class="stats-grid">
      ${statCard('Total heures', Math.round(totalH * 10) / 10 + 'h', '#9B5E2A')}
      ${statCard('Saisies', rows.length)}
      ${statCard('Opérateurs', ops.length)}
      ${statCard('Dossiers concernés', new Set(rows.map(r => r.nom_dossier)).size)}
    </div>`;

    const cols = [
      { label: 'Date', render: r => fmtDate(r.date) },
      { label: 'Opérateur', render: r => `<b>${esc(r.operateur)}</b>` },
      { label: 'Dossier / Client', render: r => `${esc(r.nom_dossier)}${r.client_nom !== r.nom_dossier ? `<br><span style="color:#9A9387;font-size:9px">${esc(r.client_nom)}</span>` : ''}` },
      { label: 'H.prévues', render: r => fmtH(r.prevues), num: true },
      { label: 'H.passées', render: r => `<b>${esc(r.heures_passees)}h</b>`, num: true },
      { label: 'Type', render: r => esc(r.type_travail) },
      { label: 'Description', render: r => esc(r.description) },
    ];

    return `${statsHtml}
    <div class="section-title">Saisies d'heures <span class="section-count">${rows.length} entrées · ${Math.round(totalH * 10) / 10}h au total</span></div>
    ${tableHtml(cols, rows)}`;
  } catch {
    return `<div class="section-title">Heures</div><p class="empty">Table heures non initialisée. Effectuez un premier import de fiche atelier.</p>`;
  }
}

function sectionRapport(db) {
  // Heures prévues vs réelles par dossier
  let heuresRows = [];
  try {
    heuresRows = db.prepare(`
      SELECT d.nom_dossier, d.client_nom, d.statut,
             COALESCE(d.heures_a_realiser, 0) as prevues,
             ROUND(COALESCE(SUM(h.heures_passees), 0), 1) as reelles
      FROM dossiers d
      LEFT JOIN heures h ON h.dossier_id = d.id
      WHERE d.statut != 'Clos'
      GROUP BY d.id
      HAVING prevues > 0 OR reelles > 0
      ORDER BY (reelles - prevues) DESC
    `).all().map(r => ({
      ...r,
      ecart:    Math.round((r.reelles - r.prevues) * 10) / 10,
      ca_prevu: Math.round(r.prevues  * TAUX_HORAIRE),
      ca_reel:  Math.round(r.reelles  * TAUX_HORAIRE),
    }));
  } catch {}

  // Par opérateur
  let opsRows = [];
  try {
    opsRows = db.prepare(`
      SELECT operateur,
             ROUND(SUM(heures_passees), 1) as total,
             COUNT(*) as nb_saisies,
             COUNT(DISTINCT dossier_id) as nb_dossiers
      FROM heures
      GROUP BY operateur
      ORDER BY total DESC
    `).all();
  } catch {}

  // Par statut
  const statutRows = db.prepare(`
    SELECT statut, COUNT(*) as nb,
           ROUND(COALESCE(SUM(heures_a_realiser), 0), 1) as h_prevues
    FROM dossiers
    GROUP BY statut
    ORDER BY nb DESC
  `).all();

  const fmtEur = v => v > 0 ? v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '<span class="nd">—</span>';

  const heuresCols = [
    { label: 'Dossier', render: r => esc(r.nom_dossier) },
    { label: 'Statut', render: r => badge(r.statut) },
    { label: 'H.prévues', render: r => fmtH(r.prevues), num: true },
    { label: `CA prévu (${TAUX_HORAIRE}€/h)`, render: r => fmtEur(r.ca_prevu), num: true },
    { label: 'H.réelles', render: r => r.reelles > 0 ? `<b>${r.reelles}h</b>` : '<span class="nd">—</span>', num: true },
    { label: 'CA réel', render: r => r.ca_reel > 0 ? `<b style="color:#27AE60">${fmtEur(r.ca_reel)}</b>` : '<span class="nd">—</span>', num: true },
    { label: 'Écart', render: r => {
      if (!r.prevues) return '<span class="nd">—</span>';
      const cls = r.ecart > 0 ? 'h-over' : r.ecart < 0 ? 'h-ok' : 'h-neu';
      const sign = r.ecart > 0 ? '+' : '';
      return `<span class="${cls}">${sign}${r.ecart}h</span>`;
    }, num: true },
  ];

  const opsCols = [
    { label: 'Opérateur', render: r => `<b>${esc(r.operateur)}</b>` },
    { label: 'Total heures', render: r => `<b>${r.total}h</b>`, num: true },
    { label: 'Nb saisies', render: r => esc(r.nb_saisies), num: true },
    { label: 'Nb dossiers', render: r => esc(r.nb_dossiers), num: true },
  ];

  const statutCols = [
    { label: 'Statut', render: r => badge(r.statut) },
    { label: 'Nb dossiers', render: r => esc(r.nb), num: true },
    { label: 'H.prévues total', render: r => fmtH(r.h_prevues), num: true },
  ];

  return `
  <div class="section-title">Heures prévues vs réelles <span class="section-count">dossiers actifs avec saisies</span></div>
  ${heuresRows.length ? tableHtml(heuresCols, heuresRows) : '<p class="empty">Aucune donnée de comparaison disponible.</p>'}

  <div class="section-title">Par opérateur</div>
  ${opsRows.length ? tableHtml(opsCols, opsRows) : '<p class="empty">Aucune saisie d\'heures enregistrée.</p>'}

  <div class="section-title">Répartition par statut</div>
  ${tableHtml(statutCols, statutRows)}`;
}

function sectionRideaux(db) {
  let rows = [];
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS interventions_rideaux (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client TEXT, telephone TEXT, adresse TEXT, date TEXT,
        pieces_json TEXT DEFAULT '[]', tissu TEXT, ref_tissu TEXT,
        coloris TEXT, metrage TEXT, type_tete TEXT, heures TEXT, notes TEXT,
        created_at TEXT, updated_at TEXT, dossier_id INTEGER, materiaux_json TEXT DEFAULT '[]'
      )
    `).run();
    rows = db.prepare(`
      SELECT id, client, telephone, adresse, date,
             pieces_json, tissu, ref_tissu, coloris, metrage,
             type_tete, heures, notes, materiaux_json
      FROM interventions_rideaux
      ORDER BY date DESC, created_at DESC
    `).all();
  } catch { return `<div class="section-title">Atelier COUT</div><p class="empty">Table interventions_rideaux non disponible.</p>`; }

  if (!rows.length) return `<div class="section-title">Atelier COUT — Rideaux</div><p class="empty">Aucune fiche rideaux enregistrée.</p>`;

  const statsHtml = `<div class="stats-grid">
    ${statCard('Fiches rideaux', rows.length)}
    ${statCard('Avec tissu renseigné', rows.filter(r => r.tissu || r.ref_tissu).length, '#5C7A4D')}
    ${statCard('Avec heures', rows.filter(r => r.heures && parseFloat(r.heures) > 0).length, '#9B5E2A')}
    ${statCard('Total heures', Math.round(rows.reduce((s, r) => s + (parseFloat(r.heures) || 0), 0) * 10) / 10 + 'h', '#B8702F')}
  </div>`;

  const cols = [
    { label: 'Client', render: r => `<b>${esc(r.client)}</b>${r.adresse ? `<br><span style="color:#9A9387;font-size:9px">${esc(r.adresse)}</span>` : ''}` },
    { label: 'Date', render: r => fmtDate(r.date) },
    { label: 'Tissu / Réf', render: r => [r.tissu, r.ref_tissu].filter(Boolean).map(v => esc(v)).join('<br>') || '<span class="nd">—</span>' },
    { label: 'Coloris', render: r => esc(r.coloris) },
    { label: 'Métrage', render: r => esc(r.metrage) },
    { label: 'Tête', render: r => esc(r.type_tete) },
    { label: 'H.estimées', render: r => r.heures ? `<b>${esc(r.heures)}h</b>` : '<span class="nd">—</span>', num: true },
    { label: 'Notes', render: r => r.notes ? `<span style="font-size:9px">${esc(r.notes).substring(0, 60)}${r.notes.length > 60 ? '…' : ''}</span>` : '<span class="nd">—</span>' },
  ];

  return `${statsHtml}
  <div class="section-title">Atelier COUT — Fiches rideaux <span class="section-count">${rows.length} fiches</span></div>
  ${tableHtml(cols, rows, 'Aucune fiche rideaux')}`;
}

// ── GET /api/export?type=dossiers|commandes|heures|rideaux|rapport|complet ────
export async function GET(request) {
  const db = getDb();
  try {
    const type = new URL(request.url).searchParams.get('type') || 'complet';

    let title, body, landscape;

    if (type === 'dossiers') {
      title = 'Atelier TAP — Dossiers actifs';
      body = sectionDossiers(db);
      landscape = true;
    } else if (type === 'rideaux') {
      title = 'Atelier COUT — Fiches rideaux';
      body = sectionRideaux(db);
      landscape = true;
    } else if (type === 'commandes') {
      title = 'Commandes tissu';
      body = sectionCommandes(db);
      landscape = true;
    } else if (type === 'heures') {
      title = 'Saisies d\'heures';
      body = sectionHeures(db);
      landscape = false;
    } else if (type === 'rapport') {
      title = 'Rapport de synthèse';
      body = sectionRapport(db);
      landscape = false;
    } else {
      // complet
      title = 'Export complet';
      body = `
        ${sectionDossiers(db)}
        <div class="page-break"></div>
        ${sectionRideaux(db)}
        <div class="page-break"></div>
        ${sectionCommandes(db)}
        <div class="page-break"></div>
        ${sectionHeures(db)}
        <div class="page-break"></div>
        <div class="section-title" style="margin-top:0">Rapport de synthèse</div>
        ${sectionRapport(db)}
      `;
      landscape = true;
    }

    const html = htmlDoc(title, body, landscape);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    db.close();
  }
}
