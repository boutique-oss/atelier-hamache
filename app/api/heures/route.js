import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');
  const operateur = searchParams.get('operateur');

  let heuresRows;
  if (dossierId && operateur) {
    ({ rows: heuresRows } = await sql`
      SELECT h.*, d.client_nom, d.nom_dossier, d.heures_a_realiser AS prevues, d.statut
      FROM heures h LEFT JOIN dossiers d ON d.id = h.dossier_id
      WHERE h.dossier_id = ${dossierId} AND h.operateur = ${operateur}
      ORDER BY h.date DESC, h.created_at DESC`);
  } else if (dossierId) {
    ({ rows: heuresRows } = await sql`
      SELECT h.*, d.client_nom, d.nom_dossier, d.heures_a_realiser AS prevues, d.statut
      FROM heures h LEFT JOIN dossiers d ON d.id = h.dossier_id
      WHERE h.dossier_id = ${dossierId}
      ORDER BY h.date DESC, h.created_at DESC`);
  } else if (operateur) {
    ({ rows: heuresRows } = await sql`
      SELECT h.*, d.client_nom, d.nom_dossier, d.heures_a_realiser AS prevues, d.statut
      FROM heures h LEFT JOIN dossiers d ON d.id = h.dossier_id
      WHERE h.operateur = ${operateur}
      ORDER BY h.date DESC, h.created_at DESC`);
  } else {
    ({ rows: heuresRows } = await sql`
      SELECT h.*, d.client_nom, d.nom_dossier, d.heures_a_realiser AS prevues, d.statut
      FROM heures h LEFT JOIN dossiers d ON d.id = h.dossier_id
      ORDER BY h.date DESC, h.created_at DESC`);
  }

  const heures = heuresRows.map(h => ({
    ...h,
    nom_client: h.client_nom,
    ref_dossier: h.nom_dossier,
    prevues: h.prevues || 0,
    client_nom: undefined,
    nom_dossier: undefined,
  }));

  const statsMap = {};
  heures.forEach(h => {
    const op = h.operateur;
    if (!statsMap[op]) statsMap[op] = { operateur: op, total_heures: 0, nb_saisies: 0, nb_dossiers: new Set() };
    statsMap[op].total_heures += h.heures_passees || 0;
    statsMap[op].nb_saisies++;
    if (h.dossier_id) statsMap[op].nb_dossiers.add(h.dossier_id);
  });
  const stats = Object.values(statsMap).map(s => ({
    operateur: s.operateur,
    total_heures: Math.round(s.total_heures * 100) / 100,
    nb_saisies: s.nb_saisies,
    nb_dossiers: s.nb_dossiers.size,
  })).sort((a, b) => b.total_heures - a.total_heures);

  let synthese = null;
  if (dossierId) {
    const { rows: [dossier] } = await sql`SELECT heures_a_realiser FROM dossiers WHERE id = ${dossierId}`;
    const prevues = dossier?.heures_a_realiser || 0;
    const reelles = Math.round(heures.reduce((s, h) => s + (h.heures_passees || 0), 0) * 100) / 100;
    synthese = { prevues, reelles, ecart: Math.round((reelles - prevues) * 100) / 100 };
  }

  return NextResponse.json({ heures, stats, synthese });
}

export async function POST(request) {
  const { dossier_id, operateur, date, heures_passees, type_travail, description } = await request.json();
  if (!dossier_id || !operateur || !date || !heures_passees) {
    return NextResponse.json({ error: 'Champs requis : dossier_id, operateur, date, heures_passees' }, { status: 400 });
  }
  const { rows } = await sql`
    INSERT INTO heures (dossier_id, operateur, date, heures_passees, type_travail, description)
    VALUES (${dossier_id}, ${operateur}, ${date}, ${parseFloat(heures_passees)}, ${type_travail || 'Atelier'}, ${description || ''})
    RETURNING id`;
  return NextResponse.json({ id: rows[0].id });
}

export async function PUT(request) {
  const { id, operateur, date, heures_passees, type_travail, description } = await request.json();
  await sql`
    UPDATE heures SET operateur = ${operateur}, date = ${date},
      heures_passees = ${parseFloat(heures_passees)}, type_travail = ${type_travail}, description = ${description}
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id');
  await sql`DELETE FROM heures WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
