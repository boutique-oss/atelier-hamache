import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { row2dossier } from '@/lib/db';

export async function PUT(request, { params }) {
  const supabase = createClient();
  const id = parseInt(params.id);
  const body = await request.json();

  const { data: existing, error: fetchErr } = await supabase
    .from('dossiers').select('*').eq('id', id).single();
  if (fetchErr) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const merged = { ...existing, ...body };
  const e = merged.etapes || {};

  const { data, error } = await supabase
    .from('dossiers')
    .update({
      nom_dossier: merged.nom_dossier,
      client_nom: merged.client_nom || merged.nom_dossier,
      statut: merged.statut,
      flags: typeof merged.flags === 'string' ? merged.flags : JSON.stringify(merged.flags || []),
      type_intervention: merged.type_intervention || 'Autre',
      date_ouverture: merged.date_ouverture || null,
      etape_devis: e.devis !== undefined ? !!e.devis : !!merged.etape_devis,
      etape_cmde: e.cmde !== undefined ? !!e.cmde : !!merged.etape_cmde,
      etape_atelier: e.atelier !== undefined ? !!e.atelier : !!merged.etape_atelier,
      etape_print: e.print !== undefined ? !!e.print : !!merged.etape_print,
      etape_realise: e.realise !== undefined ? !!e.realise : !!merged.etape_realise,
      lien_dossier_externe: merged.lien || merged.lien_dossier_externe || '',
      commentaires: merged.comm || merged.commentaires || '',
      adresse: merged.adresse || '',
      telephone: merged.telephone || '',
      email: merged.email || '',
      heures_a_realiser: parseFloat(merged.heures_a_realiser) || 0,
      date_planifiee: 'date_planifiee' in body ? body.date_planifiee : existing.date_planifiee,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(row2dossier(data));
}

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const id = parseInt(params.id);

  // heures supprimés par CASCADE dans Supabase (ON DELETE CASCADE)
  const { error } = await supabase.from('dossiers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
