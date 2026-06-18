import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const body = await request.json();
  await sql`
    UPDATE commandes SET
      fournisseur    = COALESCE(${body.fournisseur ?? null}, fournisseur),
      client         = COALESCE(${body.client ?? null}, client),
      designation    = COALESCE(${body.designation ?? null}, designation),
      reference      = COALESCE(${body.reference ?? null}, reference),
      coloris        = COALESCE(${body.coloris ?? null}, coloris),
      qte            = COALESCE(${body.qte != null ? parseFloat(body.qte) : null}, qte),
      qte_note       = COALESCE(${body.qte_note ?? null}, qte_note),
      unite          = COALESCE(${body.unite ?? null}, unite),
      montant        = COALESCE(${body.montant != null ? parseFloat(body.montant) : null}, montant),
      qte_livree     = COALESCE(${body.qte_livree != null ? parseFloat(body.qte_livree) : null}, qte_livree),
      controle       = COALESCE(${body.controle ?? null}, controle),
      commentaires   = COALESCE(${body.commentaires ?? null}, commentaires),
      date_cde       = COALESCE(${body.date_cde ?? null}, date_cde),
      date_livraison = COALESCE(${body.date_livraison ?? null}, date_livraison)
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  await sql`DELETE FROM commandes WHERE id = ${parseInt(params.id)}`;
  return NextResponse.json({ ok: true });
}
