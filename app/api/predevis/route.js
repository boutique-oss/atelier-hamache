import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM predevis ORDER BY created_at DESC').all();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const db = getDb();
  const body = await request.json();

  const count = db.prepare("SELECT COUNT(*) as n FROM predevis WHERE reference LIKE 'PD-' || strftime('%Y', 'now') || '-%'").get();
  const num = String(count.n + 1).padStart(3, '0');
  const reference = `PD-${new Date().getFullYear()}-${num}`;

  const r = db.prepare(`
    INSERT INTO predevis (
      reference, statut, dossier_id, client_nom, client_tel, client_email, client_adresse,
      description, type_intervention, tapisserie_ops, urgent,
      tissus, fournitures, heures_estimees, taux_horaire, forfait_pose,
      km_deplacement, tarif_km, taux_tva, notes, total_ht, total_ttc
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    reference,
    body.statut || 'brouillon',
    body.dossier_id || null,
    body.client_nom || '',
    body.client_tel || '',
    body.client_email || '',
    body.client_adresse || '',
    body.description || '',
    body.type_intervention || 'Tapisserie',
    body.tapisserie_ops ? JSON.stringify(body.tapisserie_ops) : null,
    body.urgent ? 1 : 0,
    body.tissus ? JSON.stringify(body.tissus) : null,
    body.fournitures ? JSON.stringify(body.fournitures) : null,
    parseFloat(body.heures_estimees) || 0,
    parseFloat(body.taux_horaire) || 55,
    parseFloat(body.forfait_pose) || 0,
    parseFloat(body.km_deplacement) || 0,
    parseFloat(body.tarif_km) || 0.5,
    parseFloat(body.taux_tva) || 0.20,
    body.notes || '',
    parseFloat(body.total_ht) || 0,
    parseFloat(body.total_ttc) || 0,
  );

  return NextResponse.json({ id: r.lastInsertRowid, reference });
}
