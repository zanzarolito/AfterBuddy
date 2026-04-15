/**
 * VotingPanel — shows suggestions and lets each participant vote for one.
 *
 * Props:
 *  - suggestions: Array<{ id, nom, type, votes, distanceMeters, osmLink }>
 *  - participantId: string | null
 *  - onVote: (suggestionId: string) => void
 *  - myVote: string | null  (suggestion id the current participant voted for)
 */
export default function VotingPanel({ suggestions = [], participantId, onVote, myVote }) {
  const totalVotes = suggestions.reduce((sum, s) => sum + (s.votes ?? 0), 0);

  if (suggestions.length === 0) {
    return (
      <p className="text-zinc-500 text-sm text-center py-4">
        Les suggestions arrivent…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s, idx) => {
        const pct = totalVotes > 0 ? Math.round(((s.votes ?? 0) / totalVotes) * 100) : 0;
        const isChosen = myVote === s.id;

        return (
          <div key={s.id} className={`card transition-all ${isChosen ? 'border-brand-500' : ''}`}>
            <div className="flex items-start gap-3">
              {/* Rank badge */}
              <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{s.nom}</p>
                <p className="text-xs text-zinc-400 mb-2">
                  {s.type === 'bar' ? '🍺 Bar' : '☕ Café'}
                  {s.distanceMeters != null && ` · ${s.distanceMeters} m`}
                </p>

                {/* Vote bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-8 text-right">
                    {s.votes ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              {participantId && (
                <button
                  type="button"
                  onClick={() => onVote(s.id)}
                  className={
                    isChosen
                      ? 'btn-primary text-xs px-3 py-1.5'
                      : 'btn-secondary text-xs px-3 py-1.5'
                  }
                >
                  {isChosen ? '✓ Mon choix' : 'Voter'}
                </button>
              )}

              {s.osmLink && (
                <a
                  href={s.osmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-brand-400 transition-colors ml-auto"
                >
                  Itinéraire →
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
