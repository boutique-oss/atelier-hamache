import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const supabase = createClient();
  const id = parseInt(params.id);
  const body = await request.json();

  const fields = ['date_livraison','fournisseur','client','designation','reference','coloris','qte','qte_note','unite','montant','qte_livree','controle','commentaires','date_cde'];
  const updates = {};
  fields.forEach(f => { if (f in body) updates[f] = body[f]; });
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const { error } = await supabase.from('commandes').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const { error } = await supabase.from('commandes').delete().eq('id', parseInt(params.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
