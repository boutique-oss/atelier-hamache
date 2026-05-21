import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const supabase = createClient();
  const { type_intervention, contenu_json, notes_libres } = await request.json();
  const { error } = await supabase.from('fiches_atelier').update({
    type_intervention,
    contenu_json: JSON.stringify(contenu_json || {}),
    notes_libres: notes_libres || '',
    updated_at: new Date().toISOString(),
  }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const { error } = await supabase.from('fiches_atelier').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request, { params }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fiches_atelier').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
