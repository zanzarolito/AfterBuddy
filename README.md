# AfterBuddy

> Trouvez le point de rencontre optimal entre plusieurs amis à Paris, basé sur vos stations de métro.

**Stack :** Fastify · PostgreSQL 16 + PostGIS · Redis · React · MapLibre GL JS · Tailwind CSS · Docker · Caddy

---

## Démarrage rapide

### Prérequis

- Docker + Docker Compose v2
- (Optionnel) Node.js 20+ pour le développement local

### 1. Configurer l'environnement

```bash
cp .env.example .env
# Éditez .env si nécessaire (credentials DB, URL de l'API…)
```

### 2. Lancer avec Docker Compose

```bash
docker compose up --build
```

Le service `migrate` s'exécute automatiquement au premier démarrage pour :
1. Créer le schéma PostGIS (migrations SQL)
2. Importer les **302 stations de métro parisien** (`ratp_stations.json`)

L'application est disponible sur **http://localhost** (port 80 via Caddy).

### 3. Développement local (sans Docker)

```bash
# Démarrer Postgres + Redis via Docker
docker compose up postgres redis -d

# Installer les dépendances
npm install

# Migrer + seeder
npm run migrate
npm run seed

# Lancer API + Web en parallèle
npm run dev
```

- API : http://localhost:3000
- Web : http://localhost:5173

---

## Architecture

```
afterbuddy/
├── apps/
│   ├── api/                   # Backend Fastify
│   │   ├── src/
│   │   │   ├── index.js       # Point d'entrée
│   │   │   ├── plugins/       # Postgres + Redis Fastify plugins
│   │   │   ├── routes/        # REST endpoints + SSE
│   │   │   │   ├── sessions.js
│   │   │   │   ├── participants.js
│   │   │   │   ├── suggestions.js
│   │   │   │   ├── votes.js
│   │   │   │   ├── events.js  ← SSE temps réel
│   │   │   │   └── health.js
│   │   │   ├── services/
│   │   │   │   └── geoEngine.js  ← Moteur de calcul spatial
│   │   │   └── db/
│   │   │       ├── migrations/001_init.sql
│   │   │       ├── migrate.js
│   │   │       └── seed.js
│   │   └── data/
│   │       └── ratp_stations.json  ← 302 stations (lat/lng)
│   └── web/                   # Frontend React (PWA)
│       └── src/
│           ├── api/client.js  # Appels API + SSE
│           ├── components/
│           │   ├── Map.jsx         ← MapLibre GL JS
│           │   ├── StationSearch.jsx
│           │   ├── ParticipantList.jsx
│           │   └── VotingPanel.jsx
│           └── pages/
│               ├── Home.jsx    ← Création de session
│               ├── Session.jsx ← Saisie des stations
│               └── Results.jsx ← Vote + carte du résultat
├── docker/
│   └── Caddyfile              # Reverse proxy HTTPS
└── docker-compose.yml
```

---

## API Reference

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/sessions` | Créer une session |
| `GET`  | `/api/sessions/:id` | État de la session |
| `POST` | `/api/sessions/:id/participants` | Rejoindre (`nom`, `stationId`) |
| `GET`  | `/api/sessions/:id/participants` | Liste des participants |
| `POST` | `/api/sessions/:id/suggestions` | Déclencher le calcul GeoEngine |
| `GET`  | `/api/sessions/:id/suggestions` | Récupérer les suggestions |
| `POST` | `/api/sessions/:id/votes` | Voter (`participantId`, `suggestionId`) |
| `GET`  | `/api/sessions/:id/events` | **SSE** — flux temps réel |
| `GET`  | `/api/stations?q=châtelet` | Recherche de stations (autocomplete) |
| `GET`  | `/health` | Vérification Postgres + Redis |

---

## GeoEngine — Algorithme

1. **Centroïde** : `ST_Centroid(ST_Collect(geom))` sur les points des participants.
2. **Équité** : si un participant est à plus de `mean + 2σ` de distance, le centre est décalé de 20% vers lui.
3. **Vibe Snap** : le centroïde est blendé à 60% vers la zone de sortie (`vibe_zone`) la plus proche (Bastille, Oberkampf, Pigalle…).
4. **Suggestions** : les 5 zones de sortie les plus proches du point final, avec lien itinéraire OpenStreetMap.

---

## Production (HTTPS)

1. Éditer `docker/Caddyfile` : remplacer `afterbuddy.example.com` par votre domaine.
2. S'assurer que le domaine pointe vers votre serveur (DNS A record).
3. `docker compose up --build -d` — Caddy obtient automatiquement un certificat Let's Encrypt.

---

## Licence

MIT — 100% Open Source, 100% Self-hosted.
