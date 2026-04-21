import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT id, nom, url_site as url FROM fournisseurs ORDER BY nom').all();
  return NextResponse.json(rows);
}
