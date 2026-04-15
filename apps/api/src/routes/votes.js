/**
 * Vote routes
 *
 * POST /api/sessions/:id/votes   → Cast or change a vote
 * GET  /api/sessions/:id/votes   → Get vote tallies
 */
export default async function voteRoutes(fastify) {
  // ── POST /api/sessions/:id/votes ──────────────────────────────────────
  fastify.post(
    '/api/sessions/:id/votes',
    {
      schema: {
        body: {
          type: 'object',
          required: ['participantId', 'suggestionId'],
          properties: {
            participantId: { type: 'string', format: 'uuid' },
            suggestionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { participantId, suggestionId } = request.body;

      // Verify participant belongs to this session.
      const { rows: pRows } = await fastify.db.query(
        `SELECT id FROM participants WHERE id = $1 AND session_id = $2`,
        [participantId, sessionId],
      );
      if (pRows.length === 0) {
        return reply.badRequest('Participant not found in this session');
      }

      // Verify suggestion belongs to this session.
      const { rows: sRows } = await fastify.db.query(
        `SELECT id FROM suggestions WHERE id = $1 AND session_id = $2`,
        [suggestionId, sessionId],
      );
      if (sRows.length === 0) {
        return reply.badRequest('Suggestion not found in this session');
      }

      const client = await fastify.db.connect();
      try {
        await client.query('BEGIN');

        // Upsert vote (one vote per participant per session).
        const { rows: existingVote } = await client.query(
          `SELECT suggestion_id FROM votes
           WHERE session_id = $1 AND participant_id = $2`,
          [sessionId, participantId],
        );

        if (existingVote.length > 0) {
          // Decrement old suggestion.
          await client.query(
            `UPDATE suggestions SET votes = votes - 1
             WHERE id = $1`,
            [existingVote[0].suggestion_id],
          );
          await client.query(
            `UPDATE votes SET suggestion_id = $1, voted_at = NOW()
             WHERE session_id = $2 AND participant_id = $3`,
            [suggestionId, sessionId, participantId],
          );
        } else {
          await client.query(
            `INSERT INTO votes (session_id, participant_id, suggestion_id)
             VALUES ($1, $2, $3)`,
            [sessionId, participantId, suggestionId],
          );
        }

        // Increment new suggestion.
        const { rows: updated } = await client.query(
          `UPDATE suggestions SET votes = votes + 1
           WHERE id = $1
           RETURNING id, nom, votes`,
          [suggestionId],
        );

        await client.query('COMMIT');

        // Broadcast vote update.
        await fastify.redis.publish(
          `session:${sessionId}:events`,
          JSON.stringify({ type: 'vote_cast', suggestion: updated[0] }),
        );

        reply.code(201).send({ suggestion: updated[0] });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // ── GET /api/sessions/:id/votes ────────────────────────────────────────
  fastify.get('/api/sessions/:id/votes', async (request, reply) => {
    const { id: sessionId } = request.params;

    const { rows } = await fastify.db.query(
      `SELECT s.id, s.nom, s.votes
       FROM suggestions s
       WHERE s.session_id = $1
       ORDER BY s.votes DESC`,
      [sessionId],
    );

    return rows;
  });
}
