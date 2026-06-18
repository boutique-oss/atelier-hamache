import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { row2dossier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await sql`SELECT * FROM dossiers ORDER BY date_ouverture DESC`;
  return NextResponse.json(rows.map(row2dossier));
}

export async function POST(request) {
  const body = await request.json();
  const e = body.etapes || {};
  const { rows } = await sql`
    INSERT INTO dossiers (
      nom_dossier, client_nom, statut, flags, type_intervention, date_ouverture,
      etape_devis, etape_cmde, etape_atelier, etape_print, etape_realise,
      lien_dossier_externe, commentaires, adresse, telephone, email, heures_a_realiser
    ) VALUES (
      ${body.nom_dossier},
      ${body.client_nom || body.nom_dossier},
      ${body.statut || 'Nouveau'},
      ${JSON.stringify(body.flags || [])},
      ${body.type_intervention || 'Autre'},
      ${body.date_ouverture || null},
      ${!!e.devis}, ${!!e.cmde}, ${!!e.atelier}, ${!!e.print}, ${!!e.realise},
      ${body.lien || ''},
      ${body.comm || ''},
      ${body.adresse || ''},
      ${body.telephone || ''},
      ${body.email || ''},
      ${parseFloat(body.heures_a_realiser) || 0}
    ) RETURNING *`;
  return NextResponse.json(row2dossier(rows[0]), { status: 201 });
}
