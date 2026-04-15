/**
 * Suggestions routes
 *
 * POST /api/sessions/:id/suggestions   → Trigger GeoEngine computation
 * GET  /api/sessions/:id/suggestions   → Retrieve suggestions
 */
import { computeMeetingPoint } from '../services/geoEngine.js';

export default async function suggestionRoutes(fastify) {
  // ── POST /api/sessions/:id/suggestions ───────────────────────────────
  fastify.post('/api/sessions/:id/suggestions', async (request, reply) => {
    const { id: sessionId } = request.params;

    // Verify session exists.
    const { rows: sessionRows } = await fastify.db.query(
      `SELECT id, status FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (sessionRows.length === 0) {
      return reply.notFound('Session not found');
    }

    // Run GeoEngine.
    let result;
    try {
      result = await computeMeetingPoint(fastify.db, sessionId);
    } catch (err) {
      if (err.message === 'No participants in session') {
        return reply.badRequest('Need at least one participant to compute suggestions');
      }
      throw err;
    }

    // Persist suggestions.
    await fastify.db.query(
      `UPDATE sessions SET status = 'voting' WHERE id = $1`,
      [sessionId],
    );

    const insertedSuggestions = [];
    for (const s of result.suggestions) {
      const { rows } = await fastify.db.query(
        `INSERT INTO suggestions (session_id, nom, type, address, geom)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
         ON CONFLICT DO NOTHING
         RETURNING id, nom, type, address`,
        [
          sessionId,
          s.nom,
          s.type,
          s.zone,
          result.centroid.lng,
          result.centroid.lat,
        ],
      );
      if (rows.length > 0) {
        insertedSuggestions.push({ ...rows[0], osmLink: s.osmLink, rank: s.rank });
      }
    }

    // Notify SSE subscribers.
    await fastify.redis.publish(
      `session:${sessionId}:events`,
      JSON.stringify({
        type: 'suggestions_ready',
        centroid: result.centroid,
        vibeZone: result.vibeZone,
        outlierCount: result.outlierCount,
        suggestions: insertedSuggestions,
      }),
    );

    return {
      centroid: result.centroid,
      vibeZone: result.vibeZone,
      outlierCount: result.outlierCount,
      suggestions: insertedSuggestions,
    };
  });

  // ── GET /api/sessions/:id/suggestions ───────────────────────────────
  fastify.get('/api/sessions/:id/suggestions', async (request, reply) => {
    const { id: sessionId } = request.params;

    const { rows } = await fastify.db.query(
      `SELECT s.id, s.nom, s.type, s.address, s.votes,
              ST_X(s.geom) AS lng, ST_Y(s.geom) AS lat
       FROM suggestions s
       WHERE s.session_id = $1
       ORDER BY s.votes DESC, s.created_at ASC`,
      [sessionId],
    );

    return rows;
  });
}
