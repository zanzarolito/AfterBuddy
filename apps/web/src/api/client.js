/**
 * API client — thin wrapper around fetch for AfterBuddy API calls.
 */
const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Sessions ────────────────────────────────────────────────────────────────

export const createSession = () =>
  request('/api/sessions', { method: 'POST' });

export const getSession = (id) => request(`/api/sessions/${id}`);

// ── Participants ─────────────────────────────────────────────────────────────

export const joinSession = (sessionId, nom, stationId) =>
  request(`/api/sessions/${sessionId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ nom, stationId }),
  });

export const getParticipants = (sessionId) =>
  request(`/api/sessions/${sessionId}/participants`);

// ── Stations ─────────────────────────────────────────────────────────────────

export const getStations = () => request('/api/stations');

export const searchStations = (q) => request(`/api/stations?q=${encodeURIComponent(q)}`);

// ── Suggestions ──────────────────────────────────────────────────────────────

export const computeSuggestions = (sessionId) =>
  request(`/api/sessions/${sessionId}/suggestions`, { method: 'POST' });

export const getSuggestions = (sessionId) =>
  request(`/api/sessions/${sessionId}/suggestions`);

// ── Votes ────────────────────────────────────────────────────────────────────

export const castVote = (sessionId, participantId, suggestionId) =>
  request(`/api/sessions/${sessionId}/votes`, {
    method: 'POST',
    body: JSON.stringify({ participantId, suggestionId }),
  });

// ── SSE ──────────────────────────────────────────────────────────────────────

/**
 * Subscribe to session events (Server-Sent Events).
 * @param {string} sessionId
 * @param {(event: object) => void} onEvent
 * @returns {() => void} unsubscribe function
 */
export function subscribeToSession(sessionId, onEvent) {
  const url = `${BASE}/api/sessions/${sessionId}/events`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // Ignore parse errors (e.g. heartbeat comments are filtered by browser).
    }
  };

  es.onerror = () => {
    // Browser will auto-reconnect; no action needed.
  };

  return () => es.close();
}
