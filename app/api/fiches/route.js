import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SCHEMAS } from '@/lib/fiches-schemas';

export const dynamic = 'force-dynamic';
export { SCHEMAS };

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
      // Conserver le type_intervention de la fiche elle-même (pas du dossier)
      // Fallback sur le dossier si la fiche n'a pas de type (anciennes données)
      type_intervention: fiche.type_intervention || fiche.dossiers?.type_intervention,
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
