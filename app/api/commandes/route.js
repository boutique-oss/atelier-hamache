import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM commandes ORDER BY id DESC').all();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const db = getDb();
  const body = await request.json();
  const fields = ['fournisseur', 'client', 'designation', 'reference', 'coloris', 'qte', 'qte_note', 'unite', 'montant', 'qte_livree', 'commentaires', 'date_cde', 'date_livraison'];
  const valid = fields.filter(f => body[f] !== undefined && body[f] !== null && body[f] !== '');
  if (!body.fournisseur) return NextResponse.json({ error: 'fournisseur requis' }, { status: 400 });
  const result = db.prepare(
    `INSERT INTO commandes (${valid.join(', ')}) VALUES (${valid.map(() => '?').join(', ')})`
  ).run(...valid.map(f => body[f]));
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}
