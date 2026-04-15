import { useState, useRef, useEffect } from 'react';
import { useStations } from '../hooks/useStations.js';

/**
 * Station autocomplete input component.
 *
 * Props:
 *  - value: { id, nom, ligne } | null
 *  - onChange: (station) => void
 *  - placeholder: string
 */
export default function StationSearch({ value, onChange, placeholder = 'Votre station de métro…' }) {
  const { search, loading } = useStations();
  const [query, setQuery] = useState(value?.nom ?? '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Update text when controlled value changes.
  useEffect(() => {
    if (value) setQuery(value.nom);
  }, [value]);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.length >= 2) {
      setResults(search(q));
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
    if (value) onChange(null); // Reset selection on manual edit.
  }

  function handleSelect(station) {
    onChange(station);
    setQuery(station.nom);
    setOpen(false);
    setResults([]);
  }

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => query.length >= 2 && setOpen(true)}
        placeholder={loading ? 'Chargement des stations…' : placeholder}
        disabled={loading}
        className="input-field"
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {results.map((station) => (
            <li key={station.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                onMouseDown={() => handleSelect(station)}
              >
                <span className="text-xs font-bold bg-brand-600 text-white rounded px-1.5 py-0.5 shrink-0">
                  M{station.ligne}
                </span>
                <span className="text-sm text-white truncate">{station.nom}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-400 text-sm">
          Aucune station trouvée
        </div>
      )}
    </div>
  );
}
