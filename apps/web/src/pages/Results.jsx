import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSuggestions, castVote } from '../api/client.js';
import { useSessionEvents } from '../hooks/useSessionEvents.js';
import VotingPanel from '../components/VotingPanel.jsx';
import Map from '../components/Map.jsx';

export default function Results() {
  const { id: sessionId } = useParams();

  const [suggestions, setSuggestions] = useState([]);
  const [centroid, setCentroid] = useState(null);
  const [vibeZone, setVibeZone] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [error, setError] = useState(null);

  // Retrieve my participant identity from sessionStorage.
  const me = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(`afterbuddy_me_${sessionId}`));
    } catch {
      return null;
    }
  })();

  // Load initial suggestions.
  useEffect(() => {
    getSuggestions(sessionId)
      .then(setSuggestions)
      .catch((err) => setError(err.message));
  }, [sessionId]);

  // Real-time vote updates.
  const handleEvent = useCallback((event) => {
    if (event.type === 'suggestions_ready') {
      setSuggestions(event.suggestions ?? []);
      setCentroid(event.centroid ?? null);
      setVibeZone(event.vibeZone ?? null);
    }
    if (event.type === 'vote_cast') {
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === event.suggestion.id
            ? { ...s, votes: event.suggestion.votes }
            : s,
        ),
      );
    }
  }, []);

  useSessionEvents(sessionId, handleEvent);

  async function handleVote(suggestionId) {
    if (!me) return;
    try {
      await castVote(sessionId, me.id, suggestionId);
      setMyVote(suggestionId);
    } catch (err) {
      setError(err.message);
    }
  }

  const winner = suggestions.reduce(
    (best, s) => (!best || (s.votes ?? 0) > (best.votes ?? 0) ? s : best),
    null,
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="font-bold text-white">
          After<span className="text-brand-500">Buddy</span>
          {vibeZone && (
            <span className="ml-2 text-sm font-normal text-zinc-400">
              → {vibeZone}
            </span>
          )}
        </h1>
        {winner && (
          <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-1 rounded-full">
            {winner.votes} vote{winner.votes !== 1 ? 's' : ''} pour "{winner.nom}"
          </span>
        )}
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-96 flex flex-col gap-4 p-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-800">
          {vibeZone && (
            <div className="card bg-brand-700/20 border-brand-600">
              <p className="text-xs text-brand-300 mb-1">Zone recommandée</p>
              <p className="font-bold text-white text-lg">{vibeZone}</p>
              <p className="text-xs text-zinc-400">
                Le barycentre de vos positions + la meilleure zone de sortie
              </p>
            </div>
          )}

          <div className="card flex-1">
            <h2 className="font-semibold text-white mb-3">
              Votez pour votre préférence
            </h2>
            {!me && (
              <p className="text-amber-400 text-xs mb-3">
                Retournez sur la session pour participer au vote.
              </p>
            )}
            <VotingPanel
              suggestions={suggestions}
              participantId={me?.id ?? null}
              onVote={handleVote}
              myVote={myVote}
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </aside>

        {/* Map */}
        <main className="flex-1 min-h-64">
          <Map
            centroid={centroid}
            suggestions={suggestions.map((s) => ({
              nom: s.nom,
              lng: s.lng ?? centroid?.lng,
              lat: s.lat ?? centroid?.lat,
            }))}
          />
        </main>
      </div>
    </div>
  );
}
