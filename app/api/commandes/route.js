import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await sql`SELECT * FROM commandes ORDER BY id DESC`;
  return NextResponse.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  if (!body.fournisseur) return NextResponse.json({ error: 'fournisseur requis' }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO commandes (fournisseur, client, designation, reference, coloris, qte, qte_note, unite, montant, qte_livree, commentaires, date_cde, date_livraison)
    VALUES (
      ${body.fournisseur || ''},
      ${body.client || ''},
      ${body.designation || ''},
      ${body.reference || ''},
      ${body.coloris || ''},
      ${body.qte != null && body.qte !== '' ? parseFloat(body.qte) : null},
      ${body.qte_note || ''},
      ${body.unite || 'ml'},
      ${body.montant != null && body.montant !== '' ? parseFloat(body.montant) : null},
      ${body.qte_livree != null && body.qte_livree !== '' ? parseFloat(body.qte_livree) : null},
      ${body.commentaires || ''},
      ${body.date_cde || null},
      ${body.date_livraison || null}
    ) RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}
