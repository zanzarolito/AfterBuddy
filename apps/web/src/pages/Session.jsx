import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinSession, computeSuggestions, getSession } from '../api/client.js';
import { useSessionEvents } from '../hooks/useSessionEvents.js';
import StationSearch from '../components/StationSearch.jsx';
import ParticipantList from '../components/ParticipantList.jsx';
import Map from '../components/Map.jsx';

export default function Session() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [nom, setNom] = useState('');
  const [station, setStation] = useState(null);
  const [me, setMe] = useState(null); // { id, nom }
  const [participants, setParticipants] = useState([]);
  const [sessionStatus, setSessionStatus] = useState('open');
  const [joining, setJoining] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load initial session state.
  useEffect(() => {
    getSession(sessionId)
      .then((s) => {
        setParticipants(s.participants ?? []);
        setSessionStatus(s.status);
      })
      .catch((err) => setError(err.message));
  }, [sessionId]);

  // Real-time updates via SSE.
  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'initial_state':
        setParticipants(event.session?.participants ?? []);
        setSessionStatus(event.session?.status ?? 'open');
        break;
      case 'participant_joined':
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === event.participant.id);
          return exists ? prev : [...prev, event.participant];
        });
        break;
      case 'suggestions_ready':
        navigate(`/session/${sessionId}/results`);
        break;
      default:
        break;
    }
  }, [sessionId, navigate]);

  useSessionEvents(sessionId, handleEvent);

  async function handleJoin(e) {
    e.preventDefault();
    if (!nom.trim() || !station) return;
    setJoining(true);
    setError(null);
    try {
      const participant = await joinSession(sessionId, nom.trim(), station.id);
      setMe(participant);
      // Persist in sessionStorage so page refresh keeps identity.
      sessionStorage.setItem(`afterbuddy_me_${sessionId}`, JSON.stringify(participant));
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function handleCompute() {
    setComputing(true);
    setError(null);
    try {
      await computeSuggestions(sessionId);
      // Navigation handled by SSE event.
    } catch (err) {
      setError(err.message);
      setComputing(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareUrl = window.location.href;

  // Map data — participants with geom
  const mapParticipants = participants
    .filter((p) => p.lng != null)
    .map((p) => ({
      ...p,
      station_nom: p.station?.nom ?? p.station_nom,
    }));

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="font-bold text-white">
          After<span className="text-brand-500">Buddy</span>
        </h1>
        <button
          type="button"
          onClick={handleCopyLink}
          className="btn-secondary text-sm px-3 py-1.5"
        >
          {copied ? '✓ Copié !' : '🔗 Partager'}
        </button>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-96 flex flex-col gap-4 p-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-800">
          {/* Join form */}
          {!me ? (
            <div className="card">
              <h2 className="font-semibold text-white mb-3">Rejoindre la session</h2>
              <form onSubmit={handleJoin} className="space-y-3">
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Votre prénom"
                  maxLength={60}
                  className="input-field"
                  required
                />
                <StationSearch value={station} onChange={setStation} />
                <button
                  type="submit"
                  disabled={joining || !nom.trim() || !station}
                  className="btn-primary w-full"
                >
                  {joining ? 'Connexion…' : 'Rejoindre'}
                </button>
              </form>
            </div>
          ) : (
            <div className="card border-brand-500">
              <p className="text-sm text-zinc-400">Vous participez en tant que</p>
              <p className="font-semibold text-white">{me.nom}</p>
              <p className="text-xs text-zinc-400">{me.station?.nom}</p>
            </div>
          )}

          {/* Share link */}
          <div className="card">
            <p className="text-xs text-zinc-400 mb-2">Lien de partage</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="input-field text-xs py-1.5 flex-1"
              />
            </div>
          </div>

          {/* Participants */}
          <div className="card flex-1">
            <h2 className="font-semibold text-white mb-3">
              Participants ({participants.length})
            </h2>
            <ParticipantList participants={participants} />
          </div>

          {/* Compute button — visible to anyone who joined */}
          {me && participants.length >= 2 && sessionStatus === 'open' && (
            <button
              type="button"
              onClick={handleCompute}
              disabled={computing}
              className="btn-primary w-full"
            >
              {computing ? 'Calcul en cours…' : '🔍 Trouver notre spot !'}
            </button>
          )}

          {me && participants.length < 2 && (
            <p className="text-center text-zinc-500 text-sm">
              En attente d'au moins 2 participants…
            </p>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </aside>

        {/* Map */}
        <main className="flex-1 min-h-64">
          <Map participants={mapParticipants} />
        </main>
      </div>
    </div>
  );
}
