/**
 * Participant routes
 *
 * POST /api/sessions/:id/participants   → Join a session
 * GET  /api/sessions/:id/participants   → List participants
 */
export default async function participantRoutes(fastify) {
  // ── POST /api/sessions/:id/participants ────────────────────────────────
  fastify.post(
    '/api/sessions/:id/participants',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nom', 'stationId'],
          properties: {
            nom: { type: 'string', minLength: 1, maxLength: 60 },
            stationId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { nom, stationId } = request.body;

      // Session must exist and be open.
      const { rows: sessionRows } = await fastify.db.query(
        `SELECT id, status, expires_at FROM sessions WHERE id = $1`,
        [sessionId],
      );
      if (sessionRows.length === 0) {
        return reply.notFound('Session not found');
      }
      if (sessionRows[0].status !== 'open') {
        return reply.badRequest('Session is not accepting new participants');
      }
      if (new Date(sessionRows[0].expires_at) < new Date()) {
        return reply.gone('Session has expired');
      }

      // Station must exist.
      const { rows: stationRows } = await fastify.db.query(
        `SELECT id, nom, ligne, ST_X(geom) AS lng, ST_Y(geom) AS lat
         FROM stations WHERE id = $1`,
        [stationId],
      );
      if (stationRows.length === 0) {
        return reply.badRequest('Station not found');
      }
      const station = stationRows[0];

      // Persist participant.
      const { rows } = await fastify.db.query(
        `INSERT INTO participants (session_id, nom, station_id, geom)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
         RETURNING id, nom, joined_at`,
        [sessionId, nom, stationId, station.lng, station.lat],
      );
      const participant = rows[0];

      // Publish update to SSE subscribers via Redis pub/sub.
      await fastify.redis.publish(
        `session:${sessionId}:events`,
        JSON.stringify({
          type: 'participant_joined',
          participant: {
            id: participant.id,
            nom: participant.nom,
            station: { id: stationId, nom: station.nom, ligne: station.ligne },
          },
        }),
      );

      reply.code(201).send({
        id: participant.id,
        nom: participant.nom,
        station: { id: stationId, nom: station.nom, ligne: station.ligne },
        joinedAt: participant.joined_at,
      });
    },
  );

  // ── GET /api/sessions/:id/participants ────────────────────────────────
  fastify.get('/api/sessions/:id/participants', async (request, reply) => {
    const { id: sessionId } = request.params;

    const { rows } = await fastify.db.query(
      `SELECT p.id, p.nom, p.joined_at,
              s.id AS station_id, s.nom AS station_nom, s.ligne
       FROM participants p
       JOIN stations s ON s.id = p.station_id
       WHERE p.session_id = $1
       ORDER BY p.joined_at`,
      [sessionId],
    );

    return rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      joinedAt: r.joined_at,
      station: { id: r.station_id, nom: r.station_nom, ligne: r.ligne },
    }));
  });
}
