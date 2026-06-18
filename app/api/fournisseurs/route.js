import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await sql`SELECT id, nom, url_site FROM fournisseurs ORDER BY nom`;
  return NextResponse.json(rows.map(r => ({ ...r, url: r.url_site })));
}
