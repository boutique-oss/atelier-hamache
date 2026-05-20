import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tasks').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = createClient();
  const { titre, type, notes } = await request.json();
  if (!titre) return NextResponse.json({ error: 'titre requis' }, { status: 400 });

  const { data, error } = await supabase
    .from('tasks').insert({ titre, type: type || 'dossiers', notes: notes || '' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PUT(request) {
  const supabase = createClient();
  const id = new URL(request.url).searchParams.get('id');
  const body = await request.json();

  const { data: existing, error: fetchErr } = await supabase
    .from('tasks').select('*').eq('id', id).single();
  if (fetchErr) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error } = await supabase.from('tasks').update({
    statut: body.statut ?? existing.statut,
    titre: body.titre ?? existing.titre,
    type: body.type ?? existing.type,
    notes: body.notes ?? existing.notes,
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const supabase = createClient();
  const id = new URL(request.url).searchParams.get('id');
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
