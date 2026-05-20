import { createClient } from '@/lib/supabase/server';
import { row2dossier } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function fetchAllDossiers(supabase) {
  const { data } = await supabase
    .from('dossiers').select('*').neq('statut', 'Clos').order('date_ouverture', { ascending: false });
  return (data || []).map(row2dossier);
}

async function fetchHeuresSynthese(supabase) {
  const [{ data: dossiers }, { data: heures }] = await Promise.all([
    supabase.from('dossiers').select('statut, heures_a_realiser').neq('statut', 'Clos'),
    supabase.from('heures').select('heures_passees'),
  ]);
  const prevues = (dossiers || []).reduce((s, d) => s + (d.heures_a_realiser || 0), 0);
  const reelles = (heures || []).reduce((s, h) => s + (h.heures_passees || 0), 0);
  return { prevues: Math.round(prevues * 100) / 100, reelles: Math.round(reelles * 100) / 100 };
}

export async function GET(request) {
  const supabase = createClient();
  const action = new URL(request.url).searchParams.get('action');

  if (action === 'broadcast') {
    return Response.json({ broadcasted: 0 });
  }

  if (action === 'subscribe') {
    const [dossiers, synthese] = await Promise.all([
      fetchAllDossiers(supabase),
      fetchHeuresSynthese(supabase),
    ]);
    const data = JSON.stringify({ dossiers, synthese });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(`event: initial\ndata: ${data}\n\n`);
        // Heartbeat unique puis fermeture (Vercel serverless)
        setTimeout(() => {
          try { controller.enqueue(':heartbeat\n\n'); controller.close(); } catch {}
        }, 100);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
