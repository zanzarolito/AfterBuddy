import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';

/**
 * MapLibre GL JS map wrapper.
 *
 * Props:
 *  - participants: Array<{ nom, lng, lat, station_nom }>
 *  - centroid: { lng, lat } | null
 *  - suggestions: Array<{ nom, lng, lat }>
 *  - className: string
 */
export default function Map({ participants = [], centroid = null, suggestions = [], className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize map once.
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [2.3522, 48.8566], // Paris center
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Participant markers (purple pin).
    participants.forEach((p) => {
      const el = document.createElement('div');
      el.className =
        'w-8 h-8 rounded-full bg-brand-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer';
      el.textContent = p.nom?.[0]?.toUpperCase() ?? '?';
      el.title = `${p.nom} — ${p.station_nom}`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(
            `<strong>${p.nom}</strong><br/>${p.station_nom}`,
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Centroid marker (star).
    if (centroid) {
      const el = document.createElement('div');
      el.className =
        'w-10 h-10 rounded-full bg-yellow-400 border-2 border-white shadow-xl flex items-center justify-center text-lg';
      el.textContent = '★';
      el.title = 'Point de rencontre optimal';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([centroid.lng, centroid.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText('Point de rencontre optimal'))
        .addTo(map);

      markersRef.current.push(marker);
    }

    // Suggestion markers (numbered).
    suggestions.forEach((s, i) => {
      const el = document.createElement('div');
      el.className =
        'w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer';
      el.textContent = String(i + 1);
      el.title = s.nom;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng ?? centroid?.lng, s.lat ?? centroid?.lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setText(s.nom))
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds to all points.
    const allPoints = [
      ...participants.map((p) => [p.lng, p.lat]),
      ...(centroid ? [[centroid.lng, centroid.lat]] : []),
    ];

    if (allPoints.length > 0) {
      const bounds = allPoints.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(allPoints[0], allPoints[0]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [participants, centroid, suggestions]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}
