/**
 * Server-Sent Events route
 *
 * GET /api/sessions/:id/events
 *
 * Each connected client subscribes to real-time updates for a session.
 * Events emitted:
 *   - participant_joined
 *   - suggestions_ready
 *   - vote_cast
 */
import Redis from 'ioredis';

export default async function eventsRoutes(fastify) {
  fastify.get('/api/sessions/:id/events', async (request, reply) => {
    const { id: sessionId } = request.params;

    // Verify session exists.
    const { rows } = await fastify.db.query(
      `SELECT id FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (rows.length === 0) {
      return reply.notFound('Session not found');
    }

    // Set SSE headers.
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering.
    });

    // Each SSE connection needs its own Redis subscriber.
    const subscriber = new Redis(process.env.REDIS_URL);
    const channel = `session:${sessionId}:events`;

    const sendEvent = (data) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    // Send a heartbeat every 25 seconds to keep connection alive.
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 25_000);

    subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        sendEvent(message);
      }
    });

    // Send initial state immediately on connect.
    const initialState = await fastify.db.query(
      `SELECT s.id, s.status,
              (SELECT json_agg(row_to_json(p)) FROM (
                SELECT p2.id, p2.nom, st.nom AS station_nom, st.ligne
                FROM participants p2
                JOIN stations st ON st.id = p2.station_id
                WHERE p2.session_id = s.id
              ) p) AS participants,
              (SELECT json_agg(row_to_json(sg)) FROM (
                SELECT id, nom, type, votes
                FROM suggestions
                WHERE session_id = s.id
                ORDER BY votes DESC
              ) sg) AS suggestions
       FROM sessions s WHERE s.id = $1`,
      [sessionId],
    );

    sendEvent(
      JSON.stringify({
        type: 'initial_state',
        session: initialState.rows[0],
      }),
    );

    // Cleanup on client disconnect.
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel);
      subscriber.quit();
    });
  });
}
