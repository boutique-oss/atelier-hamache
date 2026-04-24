import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const db = getDb();
  const id = parseInt(params.id);
  const body = await request.json();
  const fields = ['date_livraison', 'fournisseur', 'client', 'designation', 'reference', 'coloris', 'qte', 'qte_note', 'unite', 'montant', 'qte_livree', 'controle', 'commentaires', 'date_cde'];
  const updates = fields.filter(f => f in body).map(f => `${f} = ?`).join(', ');
  const values = fields.filter(f => f in body).map(f => body[f]);
  if (!updates) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  db.prepare(`UPDATE commandes SET ${updates} WHERE id = ?`).run(...values, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const db = getDb();
  const id = parseInt(params.id);
  db.prepare('DELETE FROM commandes WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
