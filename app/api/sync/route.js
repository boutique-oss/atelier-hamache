import { sql } from '@/lib/postgres';
import { row2dossier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const action = new URL(request.url).searchParams.get('action');

  if (action === 'broadcast') return Response.json({ broadcasted: 0 });

  if (action === 'subscribe') {
    const [{ rows: dossierRows }, { rows: heures }] = await Promise.all([
      sql`SELECT * FROM dossiers WHERE statut != 'Clos' ORDER BY date_ouverture DESC`,
      sql`SELECT heures_passees FROM heures`,
    ]);
    const dossiers = dossierRows.map(row2dossier);
    const prevues = dossierRows.reduce((s, d) => s + (d.heures_a_realiser || 0), 0);
    const reelles = heures.reduce((s, h) => s + (h.heures_passees || 0), 0);
    const synthese = { prevues: Math.round(prevues * 100) / 100, reelles: Math.round(reelles * 100) / 100 };
    const data = JSON.stringify({ dossiers, synthese });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(`event: initial\ndata: ${data}\n\n`);
        setTimeout(() => { try { controller.enqueue(':heartbeat\n\n'); controller.close(); } catch {} }, 100);
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
