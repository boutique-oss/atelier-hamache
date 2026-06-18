import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { SCHEMAS } from '@/lib/fiches-schemas';

export const dynamic = 'force-dynamic';
export { SCHEMAS };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');
  const schemaOnly = searchParams.get('schemas');

  if (schemaOnly === '1') return NextResponse.json({ schemas: SCHEMAS });

  if (!dossierId) {
    const { rows } = await sql`
      SELECT f.*, d.client_nom, d.id AS dossier_db_id
      FROM fiches_atelier f LEFT JOIN dossiers d ON d.id = f.dossier_id
      ORDER BY f.updated_at DESC`;
    return NextResponse.json(rows.map(f => ({
      ...f,
      nom_client: f.client_nom,
      ref_dossier: f.dossier_db_id ? `DE${String(f.dossier_db_id).padStart(8, '0')}` : null,
      client_nom: undefined, dossier_db_id: undefined,
    })));
  }

  const { rows } = await sql`
    SELECT f.*, d.client_nom, d.id AS dossier_db_id, d.type_intervention AS dossier_type,
           d.statut, d.heures_a_realiser
    FROM fiches_atelier f LEFT JOIN dossiers d ON d.id = f.dossier_id
    WHERE f.dossier_id = ${dossierId} LIMIT 1`;

  if (!rows.length) return NextResponse.json({ fiche: null, schema: SCHEMAS });

  const f = rows[0];
  return NextResponse.json({
    fiche: {
      ...f,
      nom_client: f.client_nom,
      ref_dossier: f.dossier_db_id ? `DE${String(f.dossier_db_id).padStart(8, '0')}` : null,
      type_intervention: f.type_intervention || f.dossier_type,
      statut: f.statut,
      heures_a_realiser: f.heures_a_realiser,
      client_nom: undefined, dossier_db_id: undefined, dossier_type: undefined,
    },
    schema: SCHEMAS,
  });
}

export async function POST(request) {
  const { dossier_id, type_intervention, contenu_json, notes_libres } = await request.json();
  if (!type_intervention) return NextResponse.json({ error: 'type_intervention requis' }, { status: 400 });
  const { rows } = await sql`
    INSERT INTO fiches_atelier (dossier_id, type_intervention, contenu_json, notes_libres)
    VALUES (${dossier_id || null}, ${type_intervention}, ${JSON.stringify(contenu_json || {})}, ${notes_libres || ''})
    RETURNING id`;
  return NextResponse.json({ id: rows[0].id });
}

export async function DELETE(request) {
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  await sql`DELETE FROM fiches_atelier WHERE dossier_id = ${dossierId}`;
  return NextResponse.json({ ok: true });
}
