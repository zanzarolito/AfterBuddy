/**
 * Displays the list of participants who have joined the session.
 */
export default function ParticipantList({ participants = [] }) {
  if (participants.length === 0) {
    return (
      <p className="text-zinc-500 text-sm text-center py-4">
        Personne n'a encore rejoint la session.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {participants.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2">
          <span className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {p.nom?.[0]?.toUpperCase() ?? '?'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{p.nom}</p>
            <p className="text-xs text-zinc-400 truncate">
              <span className="font-semibold text-brand-400">M{p.station?.ligne ?? p.ligne}</span>
              {' '}
              {p.station?.nom ?? p.station_nom}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
