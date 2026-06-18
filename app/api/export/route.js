import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const TAUX_HORAIRE = 55;

function esc(v) {
  if (v === null || v === undefined || v === '') return '<span class="nd">—</span>';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(d) {
  if (!d) return '<span class="nd">—</span>';
  const [y,m,day] = String(d).split('-');
  if (!y||!m||!day) return esc(d);
  return `${day}/${m}/${y}`;
}
function fmtH(v) { const n=parseFloat(v)||0; return n>0?`${n}h`:'<span class="nd">—</span>'; }
const STATUT_CLS = { 'Nouveau':'st-nouveau','Devis envoyé':'st-devis','Validé':'st-valide','En atelier':'st-atelier','Prêt à poser':'st-pret','Clos':'st-clos' };
function badge(s) { return `<span class="badge ${STATUT_CLS[s]||'st-nouveau'}">${esc(s)}</span>`; }
function flagBadges(f) { try { const arr=JSON.parse(f||'[]'); return arr.length?arr.map(x=>`<span class="flag">${esc(x)}</span>`).join(' '):'<span class="nd">—</span>'; } catch { return '<span class="nd">—</span>'; } }
function tableHtml(cols,rows,emptyMsg='Aucune donnée') {
  if(!rows.length) return `<p class="empty">${emptyMsg}</p>`;
  const head=cols.map(c=>`<th>${c.label}</th>`).join('');
  const body=rows.map((r,i)=>`<tr class="${i%2===1?'alt':''}">${cols.map(c=>`<td${c.num?' class="num"':''}>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function statCard(label,value,color='#1A1814') { return `<div class="stat-card"><div class="stat-val" style="color:${color}">${value}</div><div class="stat-lbl">${label}</div></div>`; }

function htmlDoc(title,body,landscape=false) {
  const dateStr = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>ASH · ${title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4${landscape?' landscape':''};margin:14mm 16mm}
@media print{.toolbar{display:none!important}.page-break{page-break-before:always}tr{page-break-inside:avoid}}
body{font-family:Arial,sans-serif;font-size:10.5px;color:#1A1814;background:#fff;line-height:1.45}
.toolbar{position:sticky;top:0;z-index:100;background:#1A1814;color:#FAF7F2;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.toolbar-title{font-size:13px;font-weight:600}.toolbar-title span{color:#9B5E2A}
.btn-print{background:#9B5E2A;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:700}
.doc-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #9B5E2A;padding-bottom:10px;margin-bottom:20px}
.doc-brand{font-size:9px;color:#9B5E2A;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px}
.doc-title{font-size:22px;font-weight:700;color:#1A1814}
.doc-meta{font-size:9px;color:#9A9387;text-align:right;line-height:1.6}
.section-title{font-size:12px;font-weight:700;color:#1A1814;border-left:3px solid #9B5E2A;padding-left:9px;margin:22px 0 10px}
.section-count{font-size:9px;color:#9A9387;font-weight:400;margin-left:6px}
table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:10px}
thead tr{background:#FAF7F2}
th{color:#6B6557;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border-bottom:1.5px solid #E8E2D5;text-align:left;white-space:nowrap}
td{padding:5px 8px;border-bottom:1px solid #F0EBDF;vertical-align:top}
tr.alt td{background:#FAF7F2}
td.num{text-align:right}
.badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;white-space:nowrap}
.st-nouveau{background:#F1EEE6;color:#5F5950}.st-devis{background:#E5EDF3;color:#2D5F7C}.st-valide{background:#EDE6EF;color:#5C3D5E}.st-atelier{background:#F5E9DC;color:#8C5219}.st-pret{background:#E5EDDF;color:#3F5E2F}.st-clos{background:#E8E5DE;color:#3D3A33}
.flag{display:inline-block;background:#F4E4EA;color:#7C3F54;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;margin-right:2px}
.nd{color:#C5BFB5;font-style:italic}.empty{color:#9A9387;font-style:italic;padding:16px 8px;font-size:11px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{border:1px solid #E8E2D5;border-radius:6px;padding:10px 12px}
.stat-val{font-size:24px;font-weight:700;line-height:1;margin-bottom:4px}
.stat-lbl{font-size:9px;color:#6B6557;text-transform:uppercase;letter-spacing:.05em}
.footer{margin-top:24px;padding-top:8px;border-top:1px solid #E8E2D5;font-size:9px;color:#9A9387;display:flex;justify-content:space-between}
</style></head><body>
<div class="toolbar"><span class="toolbar-title">Atelier <span>Stéphan Hamache</span> · ${title}</span><button class="btn-print" onclick="window.print()">🖨&nbsp; Imprimer</button></div>
<div class="doc-header"><div><div class="doc-brand">Atelier Stéphan Hamache</div><div class="doc-title">${title}</div></div><div class="doc-meta">Exporté le ${dateStr}<br>Supabase</div></div>
${body}
<div class="footer"><span>Atelier Stéphan Hamache — usage interne</span><span>${dateStr}</span></div>
</body></html>`;
}

function sectionDossiers(dossiers, interventions) {
  const tap = dossiers.filter(d => d.statut !== 'Clos').sort((a,b) => {
    const o = {'En atelier':1,'Prêt à poser':2,'Validé':3,'Devis envoyé':4};
    return (o[a.statut]||5)-(o[b.statut]||5);
  });
  const cout = interventions;
  const archived = dossiers.filter(d => d.statut==='Clos').length;
  const byStatut = {};
  tap.forEach(d => { byStatut[d.statut]=(byStatut[d.statut]||0)+1; });
  const hTap  = tap.reduce((s,r)=>s+(parseFloat(r.heures_a_realiser)||0),0);
  const hCout = cout.reduce((s,r)=>s+(parseFloat(r.heures)||0),0);

  const statsHtml=`<div class="stats-grid">${statCard('Atelier TAP',tap.length+' dossiers','#9B5E2A')}${statCard('Atelier COUT',cout.length+' fiches','#2D5F7C')}${statCard('En atelier',byStatut['En atelier']||0,'#B8702F')}${statCard('Archivés',archived,'#9A9387')}</div>`;

  const etapeDots=r=>[{k:'etape_devis',t:'Devis'},{k:'etape_cmde',t:'Cde'},{k:'etape_atelier',t:'Fiche'},{k:'etape_print',t:'Print'},{k:'etape_realise',t:'Réalisé'}].map(s=>`<span title="${s.t}" style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:2px;background:${r[s.k]?'#9B5E2A':'#E8E2D5'};border:1px solid ${r[s.k]?'#9B5E2A':'#D9D0C5'}"></span>`).join('');

  const colsTap=[
    {label:'Dossier / Client',render:r=>`<b>${esc(r.nom_dossier)}</b>${r.client_nom&&r.client_nom!==r.nom_dossier?`<br><span style="color:#9A9387;font-size:9px">${esc(r.client_nom)}</span>`:''}`},
    {label:'Statut',render:r=>badge(r.statut)},{label:'Type',render:r=>esc(r.type_intervention)},
    {label:'H.prévues',render:r=>fmtH(r.heures_a_realiser),num:true},{label:'Date',render:r=>fmtDate(r.date_ouverture)},
    {label:'Téléphone',render:r=>esc(r.telephone)},{label:'Avancement',render:r=>etapeDots(r)},{label:'Flags',render:r=>flagBadges(r.flags)},
  ];
  const colsCout=[
    {label:'Client',render:r=>`<b>${esc(r.client)}</b>`},{label:'Type de tête',render:r=>esc(r.type_tete)},
    {label:'H.estimées',render:r=>fmtH(r.heures),num:true},{label:'Métrage',render:r=>r.metrage?`${esc(r.metrage)} ml`:'<span class="nd">—</span>',num:true},
    {label:'Tissu / Réf.',render:r=>[r.ref_tissu,r.coloris].filter(Boolean).map(esc).join(' · ')||'<span class="nd">—</span>'},
    {label:'Date',render:r=>fmtDate(r.date)},{label:'Téléphone',render:r=>esc(r.telephone)},
  ];

  const banTap=`<div style="background:#F5E9DC;border-left:4px solid #9B5E2A;padding:8px 12px;margin-bottom:6px"><b style="color:#9B5E2A">— ATELIER TAP —</b> ${tap.length} dossiers · ${Math.round(hTap*10)/10}h prévues</div>`;
  const banCout=`<div style="background:#E5EDF3;border-left:4px solid #2D5F7C;padding:8px 12px;margin-bottom:6px"><b style="color:#2D5F7C">— ATELIER COUT —</b> ${cout.length} fiches · ${Math.round(hCout*10)/10}h estimées</div>`;

  return `${statsHtml}<div class="section-title">Compilation dossiers actifs <span class="section-count">${tap.length} TAP · ${cout.length} COUT · ${archived} archivé(s)</span></div>${banTap}${tableHtml(colsTap,tap,'Aucun dossier en cours')}${banCout}${tableHtml(colsCout,cout,'Aucune fiche COUT')}`;
}

function sectionCommandes(commandes) {
  const livrees=commandes.filter(r=>r.qte_livree>0).length;
  const totalMl=commandes.reduce((s,r)=>s+(r.qte||0),0);
  const statsHtml=`<div class="stats-grid">${statCard('Total commandes',commandes.length)}${statCard('En attente',commandes.length-livrees,'#B8702F')}${statCard('Livrées',livrees,'#5C7A4D')}${statCard('Volume total',Math.round(totalMl*10)/10+' ml','#9B5E2A')}</div>`;
  const cols=[
    {label:'Fournisseur',render:r=>`<b>${esc(r.fournisseur)}</b>`},{label:'Client',render:r=>esc(r.client)},
    {label:'Désignation',render:r=>esc(r.designation)},{label:'Référence',render:r=>`<span style="font-family:monospace;font-size:9px">${esc(r.reference)}</span>`},
    {label:'Coloris',render:r=>esc(r.coloris)},{label:'Quantité',render:r=>r.qte?`${r.qte} ${r.unite||'ml'}`:esc(r.qte_note),num:true},
    {label:'Date cde',render:r=>fmtDate(r.date_cde)},{label:'Livraison',render:r=>r.qte_livree>0?`<span class="badge st-pret">${r.qte_livree} ml</span>`:`<span class="badge st-atelier">En attente</span>`},
  ];
  return `${statsHtml}<div class="section-title">Commandes tissu <span class="section-count">${commandes.length} lignes</span></div>${tableHtml(cols,commandes,'Aucune commande')}`;
}

function sectionHeures(heures, dossiers) {
  if(!heures.length) return `<div class="section-title">Heures</div><p class="empty">Aucune saisie d'heures.</p>`;
  const dossierMap={};
  dossiers.forEach(d=>{dossierMap[d.id]={nom:d.nom_dossier,client:d.client_nom,prevues:d.heures_a_realiser};});
  const rows=heures.map(h=>({...h,...(dossierMap[h.dossier_id]||{})}));
  const totalH=rows.reduce((s,r)=>s+(r.heures_passees||0),0);
  const ops=[...new Set(rows.map(r=>r.operateur))];
  const statsHtml=`<div class="stats-grid">${statCard('Total heures',Math.round(totalH*10)/10+'h','#9B5E2A')}${statCard('Saisies',rows.length)}${statCard('Opérateurs',ops.length)}${statCard('Dossiers',new Set(rows.map(r=>r.dossier_id)).size)}</div>`;
  const cols=[
    {label:'Date',render:r=>fmtDate(r.date)},{label:'Opérateur',render:r=>`<b>${esc(r.operateur)}</b>`},
    {label:'Dossier',render:r=>esc(r.nom)},{label:'H.prévues',render:r=>fmtH(r.prevues),num:true},
    {label:'H.passées',render:r=>`<b>${esc(r.heures_passees)}h</b>`,num:true},{label:'Type',render:r=>esc(r.type_travail)},
    {label:'Description',render:r=>esc(r.description)},
  ];
  return `${statsHtml}<div class="section-title">Saisies d'heures <span class="section-count">${rows.length} entrées · ${Math.round(totalH*10)/10}h</span></div>${tableHtml(cols,rows)}`;
}

function sectionTasks(tasks) {
  if(!tasks.length) return `<div class="section-title">À faire</div><p class="empty">Aucune tâche.</p>`;
  const pending=tasks.filter(r=>r.statut==='pending');
  const done=tasks.filter(r=>r.statut==='done');
  const statsHtml=`<div class="stats-grid">${statCard('Total',tasks.length)}${statCard('En attente',pending.length,'#B8702F')}${statCard('Terminées',done.length,'#5C7A4D')}${statCard('Types',new Set(tasks.map(r=>r.type)).size)}</div>`;
  const cols=[
    {label:'Statut',render:r=>r.statut==='done'?'<span class="badge st-pret">✓ Terminée</span>':'<span class="badge st-atelier">En attente</span>'},
    {label:'Tâche',render:r=>`<b${r.statut==='done'?' style="text-decoration:line-through;color:#9A9387"':''}>${esc(r.titre)}</b>`},
    {label:'Type',render:r=>`<span class="badge st-devis">${esc(r.type)}</span>`},{label:'Notes',render:r=>esc(r.notes)},
    {label:'Créée le',render:r=>fmtDate((r.created_at||'').slice(0,10))},
  ];
  return `${statsHtml}<div class="section-title">Tâches <span class="section-count">${pending.length} en attente</span></div>${tableHtml(cols,tasks)}`;
}

export async function GET(request) {
  const type = new URL(request.url).searchParams.get('type') || 'complet';

  const [
    { rows: dossiers },
    { rows: interventions },
    { rows: commandes },
    { rows: heures },
    { rows: tasks },
  ] = await Promise.all([
    sql`SELECT * FROM dossiers ORDER BY statut, date_ouverture DESC`,
    sql`SELECT * FROM interventions_rideaux ORDER BY date DESC`,
    sql`SELECT * FROM commandes ORDER BY fournisseur, client`,
    sql`SELECT * FROM heures ORDER BY date DESC`,
    sql`SELECT * FROM tasks ORDER BY statut, created_at DESC`,
  ]);

  const d = dossiers, ir = interventions, c = commandes, h = heures, t = tasks;

  let title, body, landscape;

  if (type === 'dossiers') {
    title = 'Dossiers actifs'; body = sectionDossiers(d, ir); landscape = true;
  } else if (type === 'commandes') {
    title = 'Commandes tissu'; body = sectionCommandes(c); landscape = true;
  } else if (type === 'heures') {
    title = 'Saisies d\'heures'; body = sectionHeures(h, d); landscape = false;
  } else if (type === 'tasks') {
    title = 'À faire'; body = sectionTasks(t); landscape = false;
  } else {
    title = 'Export complet';
    body = `${sectionDossiers(d,ir)}<div class="page-break"></div>${sectionCommandes(c)}<div class="page-break"></div>${sectionHeures(h,d)}`;
    landscape = true;
  }

  return new Response(htmlDoc(title, body, landscape), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
