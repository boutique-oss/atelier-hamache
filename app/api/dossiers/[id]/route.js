import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { row2dossier } from '@/lib/db';

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const body = await request.json();

  const { rows: existing } = await sql`SELECT * FROM dossiers WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const merged = { ...existing[0], ...body };
  const e = merged.etapes || {};
  const flags = typeof merged.flags === 'string' ? merged.flags : JSON.stringify(merged.flags || []);
  const datePlanifiee = 'date_planifiee' in body ? body.date_planifiee : existing[0].date_planifiee;

  const { rows } = await sql`
    UPDATE dossiers SET
      nom_dossier          = ${merged.nom_dossier},
      client_nom           = ${merged.client_nom || merged.nom_dossier},
      statut               = ${merged.statut},
      flags                = ${flags},
      type_intervention    = ${merged.type_intervention || 'Autre'},
      date_ouverture       = ${merged.date_ouverture || null},
      etape_devis          = ${e.devis !== undefined ? !!e.devis : !!merged.etape_devis},
      etape_cmde           = ${e.cmde !== undefined ? !!e.cmde : !!merged.etape_cmde},
      etape_atelier        = ${e.atelier !== undefined ? !!e.atelier : !!merged.etape_atelier},
      etape_print          = ${e.print !== undefined ? !!e.print : !!merged.etape_print},
      etape_realise        = ${e.realise !== undefined ? !!e.realise : !!merged.etape_realise},
      lien_dossier_externe = ${merged.lien || merged.lien_dossier_externe || ''},
      commentaires         = ${merged.comm || merged.commentaires || ''},
      adresse              = ${merged.adresse || ''},
      telephone            = ${merged.telephone || ''},
      email                = ${merged.email || ''},
      heures_a_realiser    = ${parseFloat(merged.heures_a_realiser) || 0},
      date_planifiee       = ${datePlanifiee},
      updated_at           = NOW()
    WHERE id = ${id} RETURNING *`;
  return NextResponse.json(row2dossier(rows[0]));
}

export async function DELETE(request, { params }) {
  const id = parseInt(params.id);
  await sql`DELETE FROM dossiers WHERE id = ${id}`;
  return NextResponse.json({ deleted: id });
}
