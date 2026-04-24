import { getDb, row2dossier } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';

const clients = new Set();

export const dynamic = 'force-dynamic';

function getDatabase() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

function fetchHeuresSynthese() {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT
      ROUND(SUM(CASE WHEN d.statut != 'Clos' THEN COALESCE(d.heures_a_realiser, 0) ELSE 0 END), 2) as prevues,
      ROUND(SUM(h.heures_passees), 2) as reelles
    FROM dossiers d
    LEFT JOIN heures h ON d.id = h.dossier_id
  `).get();
  db.close();
  return result || { prevues: 0, reelles: 0 };
}

function fetchAllDossiers() {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM dossiers WHERE statut != ? ORDER BY date_ouverture DESC').all('Clos');
  db.close();
  return rows.map(row2dossier);
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'subscribe') {
    // Récupère et envoie les données actuelles d'abord
    const dossiers = fetchAllDossiers();
    const synthese = fetchHeuresSynthese();

    const initialData = { dossiers, synthese };

    const stream = new ReadableStream({
      start(controller) {
        // Envoie les données initiales
        controller.enqueue(`event: initial\ndata: ${JSON.stringify(initialData)}\n\n`);

        // Crée un client
        const client = {
          id: Math.random(),
          send: (data) => {
            try {
              controller.enqueue(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              // Connexion fermée
            }
          },
        };

        clients.add(client);

        // Heartbeat pour garder la connexion alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(`:heartbeat\n\n`);
          } catch (e) {
            clearInterval(heartbeat);
            clients.delete(client);
          }
        }, 30000);

        // Cleanup
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          clients.delete(client);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Action: broadcast une mise à jour à tous les clients
  if (action === 'broadcast') {
    const dossiers = fetchAllDossiers();
    const synthese = fetchHeuresSynthese();

    const data = { dossiers, synthese };

    clients.forEach(client => client.send(data));

    return Response.json({ broadcasted: clients.size });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
