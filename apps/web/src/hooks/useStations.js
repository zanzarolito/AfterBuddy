import { useState, useEffect } from 'react';
import { getStations } from '../api/client.js';

/**
 * Loads all metro stations once on mount and exposes a search function.
 */
export function useStations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStations()
      .then(setStations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /**
   * Filter stations client-side for instant autocomplete.
   * @param {string} query
   * @returns {Array}
   */
  function search(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return stations
      .filter((s) => {
        const nom = s.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nom.includes(q);
      })
      .slice(0, 8);
  }

  return { stations, loading, search };
}
