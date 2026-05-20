/**
 * Script de migration : SQLite → Supabase
 * Lance : node scripts/migrate-to-supabase.mjs
 *
 * Importe toutes les données de data/atelier.db vers Supabase.
 * À exécuter UNE SEULE FOIS après avoir créé le schéma dans Supabase.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge .env.local manuellement (pas de dotenv installé)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gqgqxvyhnljhogrrlhhe.supabase.co';
// Lit depuis .env.local : SUPABASE_SERVICE_ROLE_KEY=<ta clé service_role>
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'REMPLACE_PAR_SERVICE_ROLE_KEY') {
  console.error('ERREUR : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', 'data', 'atelier.db');

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const db = new Database(dbPath);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('─── Migration SQLite → Supabase ───');

  // ── Fournisseurs ────────────────────────────────────────────────────────────
  const fournisseurs = db.prepare('SELECT * FROM fournisseurs').all();
  if (fournisseurs.length) {
    const { error } = await supabase.from('fournisseurs').upsert(
      fournisseurs.map(f => ({ nom: f.nom, url_site: f.url_site || '', contact: f.contact || '', commentaires: f.commentaires || '' })),
      { onConflict: 'nom' }
    );
    if (error) console.error('Fournisseurs:', error.message);
    else console.log(`✓ Fournisseurs : ${fournisseurs.length}`);
  }

  // ── Dossiers ────────────────────────────────────────────────────────────────
  const dossiers = db.prepare('SELECT * FROM dossiers').all();
  const dossierIdMap = {}; // ancien id SQLite → nouveau id Supabase

  for (const d of dossiers) {
    const { data, error } = await supabase.from('dossiers').insert({
      nom_dossier: d.nom_dossier,
      client_nom: d.client_nom || d.nom_dossier,
      adresse: d.adresse || '',
      telephone: d.telephone || '',
      email: d.email || '',
      statut: d.statut,
      flags: d.flags || '[]',
      type_intervention: d.type_intervention || 'Autre',
      date_ouverture: d.date_ouverture || null,
      etape_devis: !!d.etape_devis,
      etape_cmde: !!d.etape_cmde,
      etape_atelier: !!d.etape_atelier,
      etape_print: !!d.etape_print,
      etape_realise: !!d.etape_realise,
      lien_dossier_externe: d.lien_dossier_externe || '',
      commentaires: d.commentaires || '',
      heures_a_realiser: d.heures_a_realiser || 0,
      date_planifiee: d.date_planifiee || null,
      fiche_pdf: null, // les PDFs ne migrent pas automatiquement
    }).select('id').single();

    if (error) { console.error(`Dossier "${d.nom_dossier}":`, error.message); }
    else { dossierIdMap[d.id] = data.id; }
  }
  console.log(`✓ Dossiers : ${Object.keys(dossierIdMap).length} / ${dossiers.length}`);

  // ── Commandes ───────────────────────────────────────────────────────────────
  const commandes = db.prepare('SELECT * FROM commandes').all();
  if (commandes.length) {
    const { error } = await supabase.from('commandes').insert(
      commandes.map(c => ({
        fournisseur: c.fournisseur || '', client: c.client || '',
        designation: c.designation || '', reference: c.reference || '',
        coloris: c.coloris || '', date_cde: c.date_cde || null,
        qte: c.qte, qte_note: c.qte_note || '', unite: c.unite || 'ml',
        montant: c.montant, qte_livree: c.qte_livree,
        date_livraison: c.date_livraison || null,
        controle: c.controle || '', commentaires: c.commentaires || '',
      }))
    );
    if (error) console.error('Commandes:', error.message);
    else console.log(`✓ Commandes : ${commandes.length}`);
  }

  // ── Heures ──────────────────────────────────────────────────────────────────
  try {
    const heures = db.prepare('SELECT * FROM heures').all();
    const heuresValides = heures.filter(h => dossierIdMap[h.dossier_id]);
    if (heuresValides.length) {
      const { error } = await supabase.from('heures').insert(
        heuresValides.map(h => ({
          dossier_id: dossierIdMap[h.dossier_id],
          operateur: h.operateur, date: h.date,
          heures_passees: h.heures_passees,
          type_travail: h.type_travail || 'Atelier',
          description: h.description || '',
        }))
      );
      if (error) console.error('Heures:', error.message);
      else console.log(`✓ Heures : ${heuresValides.length}`);
    }
  } catch { console.log('  (table heures vide ou absente)'); }

  // ── Fiches atelier ──────────────────────────────────────────────────────────
  try {
    const fiches = db.prepare('SELECT * FROM fiches_atelier').all();
    const fichesValides = fiches.filter(f => dossierIdMap[f.dossier_id]);
    if (fichesValides.length) {
      const { error } = await supabase.from('fiches_atelier').insert(
        fichesValides.map(f => ({
          dossier_id: dossierIdMap[f.dossier_id],
          type_intervention: f.type_intervention,
          contenu_json: f.contenu_json || '{}',
          notes_libres: f.notes_libres || '',
        }))
      );
      if (error) console.error('Fiches:', error.message);
      else console.log(`✓ Fiches atelier : ${fichesValides.length}`);
    }
  } catch { console.log('  (table fiches_atelier vide)'); }

  // ── Tasks ───────────────────────────────────────────────────────────────────
  try {
    const tasks = db.prepare('SELECT * FROM tasks').all();
    if (tasks.length) {
      const { error } = await supabase.from('tasks').insert(
        tasks.map(t => ({ titre: t.titre, type: t.type || 'dossiers', statut: t.statut || 'pending', notes: t.notes || '' }))
      );
      if (error) console.error('Tasks:', error.message);
      else console.log(`✓ Tasks : ${tasks.length}`);
    }
  } catch { console.log('  (table tasks vide)'); }

  // ── Interventions rideaux ───────────────────────────────────────────────────
  try {
    const ir = db.prepare('SELECT * FROM interventions_rideaux').all();
    if (ir.length) {
      const { error } = await supabase.from('interventions_rideaux').insert(
        ir.map(r => ({
          client: r.client, telephone: r.telephone || '', adresse: r.adresse || '',
          date: r.date || '', pieces_json: r.pieces_json || '[]',
          tissu: r.tissu || '', ref_tissu: r.ref_tissu || '', coloris: r.coloris || '',
          metrage: r.metrage || '', type_tete: r.type_tete || '', heures: r.heures || '',
          notes: r.notes || '', materiaux_json: r.materiaux_json || '[]',
          dossier_id: r.dossier_id ? (dossierIdMap[r.dossier_id] || null) : null,
        }))
      );
      if (error) console.error('Interventions rideaux:', error.message);
      else console.log(`✓ Interventions rideaux : ${ir.length}`);
    }
  } catch { console.log('  (table interventions_rideaux vide)'); }

  // ── Prédevis ────────────────────────────────────────────────────────────────
  try {
    const predevis = db.prepare('SELECT * FROM predevis').all();
    if (predevis.length) {
      const { error } = await supabase.from('predevis').insert(
        predevis.map(p => ({
          reference: p.reference, statut: p.statut || 'brouillon',
          dossier_id: p.dossier_id ? (dossierIdMap[p.dossier_id] || null) : null,
          client_nom: p.client_nom || '', client_tel: p.client_tel || '',
          client_email: p.client_email || '', client_adresse: p.client_adresse || '',
          description: p.description || '', type_intervention: p.type_intervention || 'Tapisserie',
          tapisserie_ops: p.tapisserie_ops, urgent: !!p.urgent,
          tissus: p.tissus, fournitures: p.fournitures,
          heures_estimees: p.heures_estimees || 0, taux_horaire: p.taux_horaire || 55,
          forfait_pose: p.forfait_pose || 0, km_deplacement: p.km_deplacement || 0,
          tarif_km: p.tarif_km || 0.5, taux_tva: p.taux_tva || 0.20,
          notes: p.notes || '', total_ht: p.total_ht || 0, total_ttc: p.total_ttc || 0,
        }))
      );
      if (error) console.error('Prédevis:', error.message);
      else console.log(`✓ Prédevis : ${predevis.length}`);
    }
  } catch { console.log('  (table predevis vide)'); }

  console.log('─── Migration terminée ───');
  db.close();
}

main().catch(console.error);
