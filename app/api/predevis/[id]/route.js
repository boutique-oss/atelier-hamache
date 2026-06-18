import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { rows } = await sql`SELECT * FROM predevis WHERE id = ${parseInt(params.id)}`;
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const body = await request.json();
  await sql`
    UPDATE predevis SET
      statut            = ${body.statut || 'brouillon'},
      dossier_id        = ${body.dossier_id || null},
      client_nom        = ${body.client_nom || ''},
      client_tel        = ${body.client_tel || ''},
      client_email      = ${body.client_email || ''},
      client_adresse    = ${body.client_adresse || ''},
      description       = ${body.description || ''},
      type_intervention = ${body.type_intervention || 'Tapisserie'},
      tapisserie_ops    = ${body.tapisserie_ops ? JSON.stringify(body.tapisserie_ops) : null},
      urgent            = ${!!body.urgent},
      tissus            = ${body.tissus ? JSON.stringify(body.tissus) : null},
      fournitures       = ${body.fournitures ? JSON.stringify(body.fournitures) : null},
      heures_estimees   = ${parseFloat(body.heures_estimees) || 0},
      taux_horaire      = ${parseFloat(body.taux_horaire) || 55},
      forfait_pose      = ${parseFloat(body.forfait_pose) || 0},
      km_deplacement    = ${parseFloat(body.km_deplacement) || 0},
      tarif_km          = ${parseFloat(body.tarif_km) || 0.5},
      taux_tva          = ${parseFloat(body.taux_tva) || 0.20},
      notes             = ${body.notes || ''},
      total_ht          = ${parseFloat(body.total_ht) || 0},
      total_ttc         = ${parseFloat(body.total_ttc) || 0},
      updated_at        = NOW()
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  await sql`DELETE FROM predevis WHERE id = ${parseInt(params.id)}`;
  return NextResponse.json({ ok: true });
}
