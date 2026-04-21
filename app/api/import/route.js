import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

// ── Mapping colonnes Excel → champs DB ──────────────────────────────────
// Ajoute ici les en-têtes de tes propres Excel si elles diffèrent
const MAP_DOSSIERS = {
  'Nom client': 'nom_client', 'Client': 'nom_client', 'NOM CLIENT': 'nom_client',
  'Référence': 'ref_dossier', 'Ref': 'ref_dossier', 'REF': 'ref_dossier',
  'Type': 'type_intervention', "Type d'intervention": 'type_intervention',
  'Statut': 'statut', 'STATUT': 'statut',
  'Téléphone': 'telephone', 'Tel': 'telephone', 'Tél': 'telephone',
  'Email': 'email', 'Mail': 'email',
  'Adresse': 'adresse',
  'Montant HT': 'montant_ht', 'Montant devis HT': 'montant_ht', 'Devis HT': 'montant_ht',
  'Heures prévues': 'heures_a_realiser', 'Heures à réaliser': 'heures_a_realiser', 'H prévues': 'heures_a_realiser',
  'Notes': 'notes', 'Commentaires': 'notes', 'Observations': 'notes',
  'Urgent': 'flag_urgent', 'SAV': 'flag_sav', 'Standby': 'flag_standby',
};

const MAP_COMMANDES = {
  'Référence': 'ref_commande', 'Ref': 'ref_commande', 'N°': 'ref_commande',
  'Fournisseur': 'fournisseur', 'FOURNISSEUR': 'fournisseur',
  'Tissu': 'designation', 'Désignation': 'designation', 'Libellé': 'designation',
  'Coloris': 'coloris', 'Couleur': 'coloris',
  'Quantité': 'quantite', 'Qté': 'quantite', 'ML': 'quantite',
  'Statut': 'statut',
  'Prix HT': 'prix_ht', 'PU HT': 'prix_ht', 'Prix': 'prix_ht',
  'Dossier lié': 'ref_dossier_lie', 'Dossier': 'ref_dossier_lie',
  'Notes': 'notes', 'Commentaires': 'notes',
};

function mapRow(row, mapping) {
  const result = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
      result[field] = row[col];
    }
  }
  return result;
}

// ── POST /api/import ─────────────────────────────────────────────────────
export async function POST(request) {
  const db = getDb();
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type');

    if (!file) return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });
    if (!['dossiers', 'commandes', 'fiche_atelier'].includes(type)) {
      return NextResponse.json({ error: 'type doit être dossiers, commandes ou fiche_atelier' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (type === 'fiche_atelier') {
      return await importFicheAtelier(db, wb);
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (type === 'dossiers') {
      const chk = db.prepare('SELECT id FROM dossiers WHERE ref_dossier = ?');
      const ins = db.prepare(`
        INSERT INTO dossiers
          (nom_client, ref_dossier, type_intervention, statut, telephone, email,
           adresse, montant_ht, heures_a_realiser, notes, flag_urgent, flag_sav, flag_standby)
        VALUES
          (@nom_client, @ref_dossier, @type_intervention, @statut, @telephone, @email,
           @adresse, @montant_ht, @heures_a_realiser, @notes, @flag_urgent, @flag_sav, @flag_standby)
      `);
      const upd = db.prepare(`
        UPDATE dossiers SET
          nom_client=@nom_client, type_intervention=@type_intervention, statut=@statut,
          telephone=@telephone, email=@email, adresse=@adresse,
          montant_ht=@montant_ht, heures_a_realiser=@heures_a_realiser, notes=@notes,
          flag_urgent=@flag_urgent, flag_sav=@flag_sav, flag_standby=@flag_standby,
          date_modif=datetime('now')
        WHERE ref_dossier=@ref_dossier
      `);

      db.transaction(() => {
        for (const row of rows) {
          const m = mapRow(row, MAP_DOSSIERS);
          if (!m.nom_client) { results.skipped++; continue; }

          const d = {
            nom_client:        String(m.nom_client || ''),
            ref_dossier:       String(m.ref_dossier || `IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`),
            type_intervention: m.type_intervention || 'Tapisserie',
            statut:            m.statut || 'Nouveau',
            telephone:         String(m.telephone || ''),
            email:             String(m.email || ''),
            adresse:           String(m.adresse || ''),
            montant_ht:        parseFloat(m.montant_ht) || 0,
            heures_a_realiser: parseFloat(m.heures_a_realiser) || 0,
            notes:             String(m.notes || ''),
            flag_urgent:       m.flag_urgent ? 1 : 0,
            flag_sav:          m.flag_sav    ? 1 : 0,
            flag_standby:      m.flag_standby ? 1 : 0,
          };

          try {
            const existing = chk.get(d.ref_dossier);
            if (existing) { upd.run(d); results.updated++; }
            else           { ins.run(d); results.created++; }
          } catch(e) {
            results.errors.push(`Ligne "${d.nom_client}" : ${e.message}`);
          }
        }
      })();

    } else if (type === 'commandes') {
      const chk = db.prepare('SELECT id FROM commandes WHERE ref_commande = ?');
      const ins = db.prepare(`
        INSERT INTO commandes (ref_commande, fournisseur, designation, coloris, quantite, statut, prix_ht, notes)
        VALUES (@ref_commande, @fournisseur, @designation, @coloris, @quantite, @statut, @prix_ht, @notes)
      `);

      db.transaction(() => {
        for (const row of rows) {
          const m = mapRow(row, MAP_COMMANDES);
          if (!m.fournisseur && !m.designation) { results.skipped++; continue; }

          const c = {
            ref_commande: String(m.ref_commande || `CMD-${Date.now()}-${Math.random().toString(36).slice(2,5)}`),
            fournisseur:  String(m.fournisseur  || ''),
            designation:  String(m.designation  || ''),
            coloris:      String(m.coloris      || ''),
            quantite:     parseFloat(m.quantite) || 0,
            statut:       m.statut || 'En attente',
            prix_ht:      parseFloat(m.prix_ht) || 0,
            notes:        String(m.notes || ''),
          };

          try {
            const existing = chk.get(c.ref_commande);
            if (!existing) { ins.run(c); results.created++; }
            else            { results.skipped++; } // commandes = pas d'overwrite auto
          } catch(e) {
            results.errors.push(`Ligne "${c.ref_commande}" : ${e.message}`);
          }
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      ...results,
      message: `Import ${type} : ${results.created} créés, ${results.updated} mis à jour, ${results.skipped} ignorés${results.errors.length ? `, ${results.errors.length} erreurs` : ''}`,
    });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    db.close();
  }
}

// ── Normalisation des noms d'opérateurs ──────────────────────────────────────
const OPERATEURS_CONNUS = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];

function normaliserOperateur(nom) {
  const n = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const match = OPERATEURS_CONNUS.find(o =>
    o.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === n
  );
  return match || nom.trim();
}

// ── Parsing fiche atelier ────────────────────────────────────────────────────
function parseFicheAtelier(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const clientNom      = String(rows[2]?.[1] || '').trim();
  const heuresEstimees = parseFloat(String(rows[2]?.[0] || '').replace(/[Hh\s]/g, '')) || 0;
  const typeTravaux    = String(rows[1]?.[1] || '').trim();
  const adresse        = [String(rows[5]?.[2] || ''), String(rows[5]?.[1] || '')].filter(Boolean).join(' ').trim();
  const telephone      = String(rows[6]?.[1] || '').trim();

  // Trouver la ligne d'en-tête NOM/HEURES pour localiser les heures réelles
  let heuresStartRow = 18;
  for (let i = 14; i < Math.min(rows.length, 22); i++) {
    if (String(rows[i]?.[0] || '').toUpperCase().trim() === 'NOM') {
      heuresStartRow = i + 1;
      break;
    }
  }

  const heuresReelles = [];
  for (let i = heuresStartRow; i < Math.min(heuresStartRow + 5, rows.length); i++) {
    const nom = String(rows[i]?.[0] || '').trim();
    const h   = parseFloat(String(rows[i]?.[1] || '').replace(/[Hh\s]/g, '')) || 0;
    const termine = rows[i]?.[2] === true || String(rows[i]?.[2] || '').toLowerCase() === 'true';
    if (nom && h > 0) heuresReelles.push({ operateur: normaliserOperateur(nom), heures: h, termine });
  }

  return { clientNom, heuresEstimees, typeTravaux, adresse, telephone, heuresReelles };
}

async function importFicheAtelier(db, wb) {
  // Migrations inline si pas encore faites
  try { db.exec('ALTER TABLE dossiers ADD COLUMN heures_a_realiser REAL DEFAULT 0'); } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS heures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_id INTEGER NOT NULL,
    operateur TEXT NOT NULL,
    date TEXT NOT NULL,
    heures_passees REAL NOT NULL,
    type_travail TEXT DEFAULT 'Atelier',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  const { clientNom, heuresEstimees, typeTravaux, adresse, telephone, heuresReelles } = parseFicheAtelier(wb);

  if (!clientNom) {
    return NextResponse.json({ error: 'Nom client introuvable (cellule B3 de la fiche)' }, { status: 400 });
  }

  const dossier = db.prepare(`
    SELECT id, nom_dossier FROM dossiers
    WHERE UPPER(TRIM(nom_dossier)) = UPPER(?) OR UPPER(TRIM(client_nom)) = UPPER(?)
    LIMIT 1
  `).get(clientNom, clientNom);

  if (!dossier) {
    return NextResponse.json({
      ok: false,
      error: `Aucun dossier trouvé pour "${clientNom}". Créez d'abord le dossier dans l'ERP.`,
      client: clientNom,
    }, { status: 404 });
  }

  db.transaction(() => {
    if (heuresEstimees > 0) {
      db.prepare(`UPDATE dossiers SET heures_a_realiser = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(heuresEstimees, dossier.id);
    }
    for (const h of heuresReelles) {
      db.prepare(`
        INSERT INTO heures (dossier_id, operateur, date, heures_passees, type_travail, description)
        VALUES (?, ?, date('now'), ?, 'Atelier', ?)
      `).run(dossier.id, h.operateur, h.heures, typeTravaux || 'Atelier');
    }
  })();

  const totalReel = heuresReelles.reduce((s, h) => s + h.heures, 0);
  const detailReel = heuresReelles.length > 0
    ? heuresReelles.map(h => `${h.operateur} ${h.heures}h`).join(' + ')
    : 'aucune heure réelle saisie';

  return NextResponse.json({
    ok: true,
    client: clientNom,
    dossier_nom: dossier.nom_dossier,
    heures_estimees: heuresEstimees,
    heures_reelles: heuresReelles,
    total_reel: totalReel,
    message: `${dossier.nom_dossier} · ⏱ Devis : ${heuresEstimees}h · Réel : ${detailReel}`,
  });
}
