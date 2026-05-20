import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const MAP_DOSSIERS = {
  'Nom client': 'nom_client', 'Client': 'nom_client', 'NOM CLIENT': 'nom_client',
  'Référence': 'ref_dossier', 'Ref': 'ref_dossier',
  'Type': 'type_intervention', "Type d'intervention": 'type_intervention',
  'Statut': 'statut',
  'Téléphone': 'telephone', 'Tel': 'telephone', 'Tél': 'telephone',
  'Email': 'email', 'Mail': 'email',
  'Adresse': 'adresse',
  'Heures prévues': 'heures_a_realiser', 'Heures à réaliser': 'heures_a_realiser',
  'Notes': 'notes', 'Commentaires': 'notes',
  'Urgent': 'flag_urgent', 'SAV': 'flag_sav', 'Standby': 'flag_standby',
};

const MAP_COMMANDES = {
  'Fournisseur': 'fournisseur', 'FOURNISSEUR': 'fournisseur',
  'Tissu': 'designation', 'Désignation': 'designation',
  'Coloris': 'coloris', 'Couleur': 'coloris',
  'Quantité': 'qte', 'Qté': 'qte', 'ML': 'qte',
  'Prix HT': 'montant', 'PU HT': 'montant',
  'Notes': 'commentaires',
};

function mapRow(row, mapping) {
  const result = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (row[col] !== undefined && row[col] !== null && row[col] !== '') result[field] = row[col];
  }
  return result;
}

const OPERATEURS_CONNUS = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];
function normaliserOperateur(nom) {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const match = OPERATEURS_CONNUS.find(o =>
    o.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === n
  );
  return match || nom.trim();
}

function parseFicheAtelier(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const clientNom = String(rows[2]?.[1] || '').trim();
  const heuresEstimees = parseFloat(String(rows[2]?.[0] || '').replace(/[Hh\s]/g, '')) || 0;
  const typeTravaux = String(rows[1]?.[1] || '').trim();
  const adresse = [String(rows[5]?.[2] || ''), String(rows[5]?.[1] || '')].filter(Boolean).join(' ').trim();
  const telephone = String(rows[6]?.[1] || '').trim();

  let heuresStartRow = 18;
  for (let i = 14; i < Math.min(rows.length, 22); i++) {
    if (String(rows[i]?.[0] || '').toUpperCase().trim() === 'NOM') { heuresStartRow = i + 1; break; }
  }
  const heuresReelles = [];
  for (let i = heuresStartRow; i < Math.min(heuresStartRow + 5, rows.length); i++) {
    const nom = String(rows[i]?.[0] || '').trim();
    const h = parseFloat(String(rows[i]?.[1] || '').replace(/[Hh\s]/g, '')) || 0;
    if (nom && h > 0) heuresReelles.push({ operateur: normaliserOperateur(nom), heures: h });
  }
  return { clientNom, heuresEstimees, typeTravaux, adresse, telephone, heuresReelles };
}

export async function POST(request) {
  const supabase = createClient();
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type');

    if (!file) return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });
    if (!['dossiers', 'commandes', 'fiche_atelier'].includes(type)) {
      return NextResponse.json({ error: 'type invalide' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (type === 'fiche_atelier') {
      const { clientNom, heuresEstimees, typeTravaux, heuresReelles } = parseFicheAtelier(wb);
      if (!clientNom) return NextResponse.json({ error: 'Nom client introuvable (cellule B3)' }, { status: 400 });

      const { data: dossiers } = await supabase
        .from('dossiers').select('id, nom_dossier')
        .or(`nom_dossier.ilike.${clientNom},client_nom.ilike.${clientNom}`);

      const dossier = dossiers?.[0];
      if (!dossier) return NextResponse.json({
        ok: false, error: `Aucun dossier pour "${clientNom}"`, client: clientNom,
      }, { status: 404 });

      if (heuresEstimees > 0) {
        await supabase.from('dossiers')
          .update({ heures_a_realiser: heuresEstimees, updated_at: new Date().toISOString() })
          .eq('id', dossier.id);
      }

      const today = new Date().toISOString().slice(0, 10);
      for (const h of heuresReelles) {
        await supabase.from('heures').insert({
          dossier_id: dossier.id, operateur: h.operateur,
          date: today, heures_passees: h.heures, type_travail: typeTravaux || 'Atelier', description: '',
        });
      }

      const totalReel = heuresReelles.reduce((s, h) => s + h.heures, 0);
      const detail = heuresReelles.map(h => `${h.operateur} ${h.heures}h`).join(' + ') || 'aucune heure';
      return NextResponse.json({
        ok: true, client: clientNom, dossier_nom: dossier.nom_dossier,
        heures_estimees: heuresEstimees, heures_reelles: heuresReelles,
        total_reel: totalReel, message: `${dossier.nom_dossier} · Devis : ${heuresEstimees}h · Réel : ${detail}`,
      });
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (type === 'dossiers') {
      for (const row of rows) {
        const m = mapRow(row, MAP_DOSSIERS);
        if (!m.nom_client) { results.skipped++; continue; }
        try {
          const flags = [];
          if (m.flag_urgent) flags.push('Urgent');
          if (m.flag_sav) flags.push('SAV');
          if (m.flag_standby) flags.push('Standby');
          const { error } = await supabase.from('dossiers').insert({
            nom_dossier: String(m.nom_client),
            client_nom: String(m.nom_client),
            type_intervention: m.type_intervention || 'Tapisserie',
            statut: m.statut || 'Nouveau',
            telephone: String(m.telephone || ''),
            email: String(m.email || ''),
            adresse: String(m.adresse || ''),
            heures_a_realiser: parseFloat(m.heures_a_realiser) || 0,
            commentaires: String(m.notes || ''),
            flags: JSON.stringify(flags),
          });
          if (error) { results.errors.push(`"${m.nom_client}" : ${error.message}`); }
          else results.created++;
        } catch (e) { results.errors.push(e.message); }
      }
    } else if (type === 'commandes') {
      for (const row of rows) {
        const m = mapRow(row, MAP_COMMANDES);
        if (!m.fournisseur && !m.designation) { results.skipped++; continue; }
        try {
          const { error } = await supabase.from('commandes').insert({
            fournisseur: String(m.fournisseur || ''),
            designation: String(m.designation || ''),
            coloris: String(m.coloris || ''),
            qte: parseFloat(m.qte) || null,
            montant: parseFloat(m.montant) || null,
            commentaires: String(m.commentaires || ''),
          });
          if (error) results.errors.push(error.message);
          else results.created++;
        } catch (e) { results.errors.push(e.message); }
      }
    }

    return NextResponse.json({
      ok: true, ...results,
      message: `Import ${type} : ${results.created} créés, ${results.skipped} ignorés${results.errors.length ? `, ${results.errors.length} erreurs` : ''}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
