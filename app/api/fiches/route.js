import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const SCHEMAS = {
  Tapisserie: [
    { key: 'meuble',           label: 'Type de meuble',         type: 'text' },
    { key: 'epoque',           label: 'Époque / style',          type: 'text' },
    { key: 'nb_places',        label: 'Nb de places',            type: 'number' },
    { key: 'tissu_ref',        label: 'Référence tissu',         type: 'text' },
    { key: 'tissu_coloris',    label: 'Coloris',                 type: 'text' },
    { key: 'tissu_fournisseur',label: 'Fournisseur tissu',       type: 'text' },
    { key: 'ml_tissu',         label: 'ML tissu prévu',          type: 'number', unit: 'm' },
    { key: 'garnissage',       label: 'Garnissage',              type: 'select', options: ['Ressorts', 'Mousse', 'Crin', 'Plumes', 'Mixte'] },
    { key: 'piquure_finition', label: 'Piqûre / finition',       type: 'select', options: ['Simple', 'Capitonnage', 'Passepoil', 'Clous déco', 'Sobafix', 'Autre'] },
    { key: 'cotes_largeur',    label: 'Largeur assise (cm)',     type: 'number', unit: 'cm' },
    { key: 'cotes_profondeur', label: 'Profondeur assise (cm)', type: 'number', unit: 'cm' },
    { key: 'etat_structure',   label: 'État structure',          type: 'select', options: ['Bon', 'Moyen', 'À consolider', 'À refaire'] },
    { key: 'depose_necessaire',label: 'Dépose nécessaire',       type: 'select', options: ['Non', 'Partielle', 'Complète'] },
    { key: 'croquis',          label: 'Croquis / schéma',        type: 'textarea', hint: 'Décris la forme ou colle une note' },
    { key: 'observations',     label: 'Observations atelier',    type: 'textarea' },
  ],
  Rideaux: [
    { key: 'piece',            label: 'Pièce / espace',          type: 'text' },
    { key: 'nb_panneaux',      label: 'Nb de panneaux',          type: 'number' },
    { key: 'hauteur_fini',     label: 'Hauteur finie (cm)',       type: 'number', unit: 'cm' },
    { key: 'largeur_fini',     label: 'Largeur finie / panneau (cm)', type: 'number', unit: 'cm' },
    { key: 'coeff_fonce',      label: 'Coefficient de foncé',    type: 'select', options: ['1.5', '2', '2.5', '3'] },
    { key: 'ml_tissu',         label: 'ML tissu calculé',        type: 'number', unit: 'm' },
    { key: 'tissu_ref',        label: 'Référence tissu',         type: 'text' },
    { key: 'tissu_rapport',    label: 'Rapport de tissu (cm)',   type: 'number', unit: 'cm' },
    { key: 'type_tete',        label: 'Type de tête',            type: 'select', options: ['Pince simple', 'Pince triple', 'Œillets', 'Ruban fronceur', 'Accordéon', 'Passants'] },
    { key: 'doublure',         label: 'Doublure / entoilage',    type: 'select', options: ['Non', 'Simple', 'Thermique', 'Obscurcissante', 'Thermique + obscurcissante'] },
    { key: 'type_pose',        label: 'Tringle / rail',          type: 'select', options: ['Tringle', 'Rail', 'Motorisé', 'Tringle + embrasses'] },
    { key: 'ref_tringle',      label: 'Réf. tringle / rail',     type: 'text' },
    { key: 'fournitures',      label: 'Fournitures diverses',    type: 'textarea' },
    { key: 'observations',     label: 'Observations atelier',    type: 'textarea' },
  ],
  Stores: [
    { key: 'type_store',  label: 'Type de store', type: 'select', options: ['Store bateau', 'Store enrouleur', 'Store vénitien', 'Store plissé', 'Store californien'] },
    { key: 'piece',       label: 'Pièce', type: 'text' },
    { key: 'nb_stores',   label: 'Nb de stores', type: 'number' },
    { key: 'largeur',     label: 'Largeur (cm)', type: 'number', unit: 'cm' },
    { key: 'hauteur',     label: 'Hauteur (cm)', type: 'number', unit: 'cm' },
    { key: 'tissu_ref',   label: 'Référence tissu', type: 'text' },
    { key: 'ml_tissu',    label: 'ML tissu prévu', type: 'number', unit: 'm' },
    { key: 'motorisation',label: 'Motorisation', type: 'select', options: ['Non', 'Oui - filaire', 'Oui - radio'] },
    { key: 'pose_incluse',label: 'Pose incluse', type: 'select', options: ['Oui', 'Non'] },
    { key: 'observations',label: 'Observations atelier', type: 'textarea' },
  ],
  'Tête de lit': [
    { key: 'largeur',          label: 'Largeur (cm)', type: 'number', unit: 'cm' },
    { key: 'hauteur',          label: 'Hauteur (cm)', type: 'number', unit: 'cm' },
    { key: 'forme',            label: 'Forme', type: 'select', options: ['Droite', 'Cintrée', 'Capitonnée', 'Avec oreilles'] },
    { key: 'tissu_ref',        label: 'Référence tissu', type: 'text' },
    { key: 'ml_tissu',         label: 'ML tissu prévu', type: 'number', unit: 'm' },
    { key: 'garnissage',       label: 'Garnissage', type: 'select', options: ['Mousse', 'Mousse + ouate', 'Capitons'] },
    { key: 'epaisseur_mousse', label: 'Épaisseur mousse (cm)', type: 'number', unit: 'cm' },
    { key: 'fixation',         label: 'Fixation mur', type: 'select', options: ['Pattes de fixation', 'Pieds', 'Suspendu'] },
    { key: 'observations',     label: 'Observations atelier', type: 'textarea' },
  ],
  'Habillage de lit': [
    { key: 'dimensions_lit',label: 'Dimensions lit (cm)', type: 'text' },
    { key: 'elements',      label: 'Éléments à réaliser', type: 'textarea' },
    { key: 'tissu_ref',     label: 'Référence tissu', type: 'text' },
    { key: 'ml_tissu',      label: 'ML tissu prévu', type: 'number', unit: 'm' },
    { key: 'ciel_de_lit',   label: 'Ciel de lit', type: 'select', options: ['Non', 'Plat', 'Drapé', 'Couronne'] },
    { key: 'observations',  label: 'Observations atelier', type: 'textarea' },
  ],
  Coussins: [
    { key: 'nb_coussins', label: 'Nombre de coussins', type: 'number' },
    { key: 'dimensions',  label: 'Dimensions (cm)', type: 'text' },
    { key: 'forme',       label: 'Forme', type: 'select', options: ['Carré', 'Rectangulaire', 'Rond', 'Cylindrique', 'Autre'] },
    { key: 'tissu_ref',   label: 'Référence tissu', type: 'text' },
    { key: 'garnissage',  label: 'Garnissage', type: 'select', options: ['Plumes', 'Fibres', 'Mousse', 'Kapok'] },
    { key: 'fermeture',   label: 'Fermeture', type: 'select', options: ['Couture', 'Zip invisible', 'Boutons', 'Rabat'] },
    { key: 'observations',label: 'Observations atelier', type: 'textarea' },
  ],
  'Pose seule': [
    { key: 'adresse_pose',      label: 'Adresse de pose', type: 'text' },
    { key: 'type_pose',         label: 'Type de pose', type: 'text' },
    { key: 'fournitures_client',label: 'Fournitures apportées par client', type: 'select', options: ['Oui - complètes', 'Oui - partielles', 'Non'] },
    { key: 'nb_points_pose',    label: "Nb de points d'accroche", type: 'number' },
    { key: 'contraintes',       label: 'Contraintes particulières', type: 'textarea' },
    { key: 'observations',      label: 'Observations', type: 'textarea' },
  ],
  Autre: [
    { key: 'description', label: 'Description du travail', type: 'textarea' },
    { key: 'fournitures', label: 'Fournitures prévues', type: 'textarea' },
    { key: 'observations',label: 'Observations atelier', type: 'textarea' },
  ],
};

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');
  const schemaOnly = searchParams.get('schemas');

  if (schemaOnly === '1') return NextResponse.json({ schemas: SCHEMAS });

  if (!dossierId) {
    const { data, error } = await supabase
      .from('fiches_atelier')
      .select('*, dossiers(client_nom, id)')
      .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data.map(f => ({
      ...f,
      nom_client: f.dossiers?.client_nom,
      ref_dossier: f.dossiers?.id ? `DE${String(f.dossiers.id).padStart(8, '0')}` : null,
      dossiers: undefined,
    })));
  }

  const { data: fiche } = await supabase
    .from('fiches_atelier')
    .select('*, dossiers(client_nom, id, type_intervention, statut, heures_a_realiser)')
    .eq('dossier_id', dossierId)
    .maybeSingle();

  if (!fiche) return NextResponse.json({ fiche: null, schema: SCHEMAS });

  return NextResponse.json({
    fiche: {
      ...fiche,
      nom_client: fiche.dossiers?.client_nom,
      ref_dossier: fiche.dossiers?.id ? `DE${String(fiche.dossiers.id).padStart(8, '0')}` : null,
      type_intervention: fiche.dossiers?.type_intervention,
      statut: fiche.dossiers?.statut,
      heures_a_realiser: fiche.dossiers?.heures_a_realiser,
      dossiers: undefined,
    },
    schema: SCHEMAS,
  });
}

export async function POST(request) {
  const supabase = createClient();
  const { dossier_id, type_intervention, contenu_json, notes_libres } = await request.json();
  if (!type_intervention) {
    return NextResponse.json({ error: 'type_intervention requis' }, { status: 400 });
  }

  const { data, error } = await supabase.from('fiches_atelier').insert({
    dossier_id: dossier_id || null,
    type_intervention,
    contenu_json: JSON.stringify(contenu_json || {}),
    notes_libres: notes_libres || '',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(request) {
  const supabase = createClient();
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  const { error } = await supabase.from('fiches_atelier').delete().eq('dossier_id', dossierId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
