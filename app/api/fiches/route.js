import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

// ── Schémas de champs par type d'intervention ─────────────────────────────
// Structure : tableau de { key, label, type: 'text'|'number'|'textarea'|'select', options?, unit? }
export const SCHEMAS = {
  Tapisserie: [
    { key: 'meuble',          label: 'Type de meuble',         type: 'text' },
    { key: 'epoque',          label: 'Époque / style',          type: 'text' },
    { key: 'nb_places',       label: 'Nb de places',            type: 'number' },
    { key: 'garnissage',      label: 'Garnissage',              type: 'select', options: ['Ressorts', 'Mousse', 'Crin', 'Plumes', 'Mixte'] },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'tissu_fournisseur', label: 'Fournisseur tissu',     type: 'text' },
    { key: 'ml_tissu',        label: 'ML tissu prévu',          type: 'number', unit: 'm' },
    { key: 'cotes_largeur',   label: 'Largeur assise (cm)',     type: 'number', unit: 'cm' },
    { key: 'cotes_profondeur', label: 'Profondeur assise (cm)', type: 'number', unit: 'cm' },
    { key: 'etat_structure',  label: 'État structure',          type: 'select', options: ['Bon', 'Moyen', 'À consolider', 'À refaire'] },
    { key: 'depose_necessaire', label: 'Dépose nécessaire',     type: 'select', options: ['Non', 'Partielle', 'Complète'] },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  Rideaux: [
    { key: 'piece',           label: 'Pièce / espace',          type: 'text' },
    { key: 'nb_panneaux',     label: 'Nb de panneaux',          type: 'number' },
    { key: 'hauteur_fini',    label: 'Hauteur finie (cm)',       type: 'number', unit: 'cm' },
    { key: 'largeur_fini',    label: 'Largeur finie / panneau (cm)', type: 'number', unit: 'cm' },
    { key: 'coeff_fonce',     label: 'Coefficient de foncé',    type: 'select', options: ['1.5', '2', '2.5', '3'] },
    { key: 'ml_tissu',        label: 'ML tissu calculé',        type: 'number', unit: 'm' },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'tissu_rapport',   label: 'Rapport de tissu (cm)',   type: 'number', unit: 'cm' },
    { key: 'type_tete',       label: 'Type de tête',            type: 'select', options: ['Pince simple', 'Pince triple', 'Œillets', 'Ruban fronceur', 'Accordéon', 'Passants'] },
    { key: 'type_pose',       label: 'Type de pose',            type: 'select', options: ['Tringle', 'Rail', 'Motorisé', 'Tringle + embrasses'] },
    { key: 'fournitures',     label: 'Fournitures diverses',    type: 'textarea' },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  Stores: [
    { key: 'type_store',      label: 'Type de store',           type: 'select', options: ['Store bateau', 'Store enrouleur', 'Store vénitien', 'Store plissé', 'Store californien'] },
    { key: 'piece',           label: 'Pièce',                   type: 'text' },
    { key: 'nb_stores',       label: 'Nb de stores',            type: 'number' },
    { key: 'largeur',         label: 'Largeur (cm)',            type: 'number', unit: 'cm' },
    { key: 'hauteur',         label: 'Hauteur (cm)',            type: 'number', unit: 'cm' },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'ml_tissu',        label: 'ML tissu prévu',          type: 'number', unit: 'm' },
    { key: 'motorisation',    label: 'Motorisation',            type: 'select', options: ['Non', 'Oui - filaire', 'Oui - radio'] },
    { key: 'pose_incluse',    label: 'Pose incluse',            type: 'select', options: ['Oui', 'Non'] },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  'Tête de lit': [
    { key: 'largeur',         label: 'Largeur (cm)',            type: 'number', unit: 'cm' },
    { key: 'hauteur',         label: 'Hauteur (cm)',            type: 'number', unit: 'cm' },
    { key: 'forme',           label: 'Forme',                   type: 'select', options: ['Droite', 'Cintrée', 'Capitonnée', 'Avec oreilles'] },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'ml_tissu',        label: 'ML tissu prévu',          type: 'number', unit: 'm' },
    { key: 'garnissage',      label: 'Garnissage',              type: 'select', options: ['Mousse', 'Mousse + ouate', 'Capitons'] },
    { key: 'epaisseur_mousse', label: 'Épaisseur mousse (cm)',  type: 'number', unit: 'cm' },
    { key: 'fixation',        label: 'Fixation mur',            type: 'select', options: ['Pattes de fixation', 'Pieds', 'Suspendu'] },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  'Habillage de lit': [
    { key: 'dimensions_lit',  label: 'Dimensions lit (cm)',     type: 'text' },
    { key: 'elements',        label: 'Éléments à réaliser',     type: 'textarea' },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'ml_tissu',        label: 'ML tissu prévu',          type: 'number', unit: 'm' },
    { key: 'ciel_de_lit',     label: 'Ciel de lit',             type: 'select', options: ['Non', 'Plat', 'Drapé', 'Couronne'] },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  Coussins: [
    { key: 'nb_coussins',     label: 'Nombre de coussins',      type: 'number' },
    { key: 'dimensions',      label: 'Dimensions (cm)',          type: 'text' },
    { key: 'forme',           label: 'Forme',                   type: 'select', options: ['Carré', 'Rectangulaire', 'Rond', 'Cylindrique', 'Autre'] },
    { key: 'tissu_ref',       label: 'Référence tissu',         type: 'text' },
    { key: 'garnissage',      label: 'Garnissage',              type: 'select', options: ['Plumes', 'Fibres', 'Mousse', 'Kapok'] },
    { key: 'fermeture',       label: 'Fermeture',               type: 'select', options: ['Couture', 'Zip invisible', 'Boutons', 'Rabat'] },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
  'Pose seule': [
    { key: 'type_pose',       label: 'Type de pose',            type: 'text' },
    { key: 'fournitures_client', label: 'Fournitures apportées par client', type: 'select', options: ['Oui - complètes', 'Oui - partielles', 'Non'] },
    { key: 'nb_points_pose',  label: "Nb de points d'accroche", type: 'number' },
    { key: 'contraintes',     label: 'Contraintes particulières', type: 'textarea' },
    { key: 'observations',    label: 'Observations',            type: 'textarea' },
  ],
  Autre: [
    { key: 'description',     label: 'Description du travail',  type: 'textarea' },
    { key: 'fournitures',     label: 'Fournitures prévues',     type: 'textarea' },
    { key: 'observations',    label: 'Observations atelier',    type: 'textarea' },
  ],
};

// ── GET /api/fiches?dossier_id=X ─────────────────────────────────────────
export async function GET(request) {
  const db = getDb();
  try {
    const dossierId = new URL(request.url).searchParams.get('dossier_id');
    const schemaOnly = new URL(request.url).searchParams.get('schemas');

    if (schemaOnly === '1') {
      return NextResponse.json({ schemas: SCHEMAS });
    }

    if (!dossierId) {
      const all = db.prepare(`
        SELECT f.*, d.nom_client, d.ref_dossier
        FROM fiches_atelier f
        LEFT JOIN dossiers d ON f.dossier_id = d.id
        ORDER BY f.updated_at DESC
      `).all();
      return NextResponse.json(all);
    }

    const fiche = db.prepare(`
      SELECT f.*, d.nom_client, d.ref_dossier, d.type_intervention, d.statut,
        d.heures_a_realiser, d.montant_ht
      FROM fiches_atelier f
      LEFT JOIN dossiers d ON f.dossier_id = d.id
      WHERE f.dossier_id = ?
    `).get(dossierId);

    return NextResponse.json({ fiche: fiche || null, schema: SCHEMAS });
  } finally {
    db.close();
  }
}

// ── POST /api/fiches ──────────────────────────────────────────────────────
export async function POST(request) {
  const db = getDb();
  try {
    const { dossier_id, type_intervention, contenu_json, notes_libres } = await request.json();
    if (!dossier_id || !type_intervention) {
      return NextResponse.json({ error: 'dossier_id et type_intervention requis' }, { status: 400 });
    }
    // Upsert : 1 fiche max par dossier
    const existing = db.prepare('SELECT id FROM fiches_atelier WHERE dossier_id = ?').get(dossier_id);
    if (existing) {
      db.prepare(`
        UPDATE fiches_atelier
        SET type_intervention=?, contenu_json=?, notes_libres=?, updated_at=datetime('now')
        WHERE dossier_id=?
      `).run(type_intervention, JSON.stringify(contenu_json), notes_libres || '', dossier_id);
      return NextResponse.json({ id: existing.id, updated: true });
    } else {
      const r = db.prepare(`
        INSERT INTO fiches_atelier (dossier_id, type_intervention, contenu_json, notes_libres)
        VALUES (?, ?, ?, ?)
      `).run(dossier_id, type_intervention, JSON.stringify(contenu_json), notes_libres || '');
      return NextResponse.json({ id: r.lastInsertRowid, updated: false });
    }
  } finally {
    db.close();
  }
}

// ── DELETE /api/fiches?dossier_id=X ──────────────────────────────────────
export async function DELETE(request) {
  const db = getDb();
  try {
    const dossierId = new URL(request.url).searchParams.get('dossier_id');
    db.prepare('DELETE FROM fiches_atelier WHERE dossier_id = ?').run(dossierId);
    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
