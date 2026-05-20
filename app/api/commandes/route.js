import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commandes')
    .select('*')
    .order('id', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();
  if (!body.fournisseur) return NextResponse.json({ error: 'fournisseur requis' }, { status: 400 });

  const fields = ['fournisseur','client','designation','reference','coloris','qte','qte_note','unite','montant','qte_livree','commentaires','date_cde','date_livraison'];
  const row = {};
  fields.forEach(f => { if (body[f] !== undefined && body[f] !== null && body[f] !== '') row[f] = body[f]; });

  const { data, error } = await supabase.from('commandes').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
