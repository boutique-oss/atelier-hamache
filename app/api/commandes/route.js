import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM commandes ORDER BY id').all();
  return NextResponse.json(rows);
}
