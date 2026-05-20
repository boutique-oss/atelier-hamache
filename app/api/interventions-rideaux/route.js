import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');

  if (dossierId) {
    const { data } = await supabase
      .from('interventions_rideaux')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ fiche: data || null });
  }

  const { data, error } = await supabase
    .from('interventions_rideaux')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();
  if (!body.client) return NextResponse.json({ error: 'client requis' }, { status: 400 });

  const { data, error } = await supabase.from('interventions_rideaux').insert({
    client: body.client,
    telephone: body.telephone || '',
    adresse: body.adresse || '',
    date: body.date || '',
    pieces_json: body.pieces_json || '[]',
    tissu: body.tissu || '',
    ref_tissu: body.ref_tissu || '',
    coloris: body.coloris || '',
    metrage: body.metrage || '',
    type_tete: body.type_tete || '',
    heures: body.heures || '',
    notes: body.notes || '',
    dossier_id: body.dossier_id || null,
    materiaux_json: body.materiaux_json || '[]',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PUT(request) {
  const supabase = createClient();
  const id = new URL(request.url).searchParams.get('id');
  const body = await request.json();

  const { error } = await supabase.from('interventions_rideaux').update({
    client: body.client,
    telephone: body.telephone || '',
    adresse: body.adresse || '',
    date: body.date || '',
    pieces_json: body.pieces_json || '[]',
    tissu: body.tissu || '',
    ref_tissu: body.ref_tissu || '',
    coloris: body.coloris || '',
    metrage: body.metrage || '',
    type_tete: body.type_tete || '',
    heures: body.heures || '',
    notes: body.notes || '',
    dossier_id: body.dossier_id || null,
    materiaux_json: body.materiaux_json || '[]',
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const supabase = createClient();
  const id = new URL(request.url).searchParams.get('id');
  const { error } = await supabase.from('interventions_rideaux').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
