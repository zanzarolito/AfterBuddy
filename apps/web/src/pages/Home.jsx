import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api/client.js';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const session = await createSession();
      navigate(`/session/${session.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-zinc-950 to-zinc-900">
      {/* Logo / hero */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
          After<span className="text-brand-500">Buddy</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-sm mx-auto">
          Trouvez le point de rencontre parfait entre amis à Paris, basé sur
          vos stations de métro.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-2xl w-full">
        {[
          { icon: '🔗', title: 'Créez un groupe', desc: 'Partagez le lien avec vos amis' },
          { icon: '📍', title: 'Choisissez votre station', desc: 'Pas besoin de GPS — juste le métro' },
          { icon: '🍻', title: 'Trouvez l\'endroit', desc: 'L\'IA calcule le meilleur spot' },
        ].map((step) => (
          <div key={step.title} className="card text-center">
            <div className="text-3xl mb-2">{step.icon}</div>
            <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
            <p className="text-zinc-400 text-xs">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="btn-primary text-lg px-8 py-4 shadow-2xl shadow-brand-500/30"
      >
        {loading ? 'Création…' : 'Créer un groupe'}
      </button>

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}

      <p className="mt-8 text-zinc-600 text-xs text-center max-w-xs">
        Sans inscription · Données anonymes · Lien valide 24h
      </p>
    </main>
  );
}
