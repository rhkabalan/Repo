# Game Backend

The authoritative server for the game: player accounts, cloud saves, leaderboards,
matchmaking, and real-time multiplayer. It's engine-agnostic: any client (iOS, Android,
web, desktop, consoles) talks to it over HTTPS + WebSocket.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 22, TypeScript (strict) |
| HTTP / WebSocket | Fastify 5, `@fastify/websocket` |
| Database | PostgreSQL 16 (accounts, saves, match history, durable scores) |
| Cache / ranks | Redis 7 (leaderboard sorted sets, solo sessions, rate limiting) |
| Auth | Google Sign-In ID tokens + guest accounts; JWT access tokens + rotating refresh tokens |
| Validation | zod on every request body and socket message |
| Tests | Vitest, against real Postgres and Redis |

## Features

- **Sign-in:** play instantly as a guest, or with Google (Web, Android and iOS client IDs
  are all accepted). Guests can link Google later and keep all their progress.
- **Sessions:** 15-minute access tokens; 60-day refresh tokens that rotate on every use.
  Replaying an old refresh token revokes that whole session (stolen-token protection).
- **Profiles and progression:** display names, avatars, XP, levels, wins/losses, match history.
- **Cloud saves:** up to 20 JSON slots per player (256 KB each). Saves are versioned, so
  writes from two devices can't silently overwrite each other.
- **Leaderboards:** all-time, weekly and daily boards per game. Rank lookups are fast and
  "my rank and neighbours" queries are supported.
- **Single-player:** either authoritative solo rooms, or client-simulated runs (work
  offline) with server-side sanity checks and single-use sessions.
- **Real-time multiplayer:** quick-match queue, private rooms with invite codes, ready
  checks, host start, in-room chat. A fixed-tick authoritative simulation acknowledges
  inputs (for client prediction), and players can reconnect mid-match.
- **Pluggable games:** game rules live behind a `GameDefinition` interface
  (`src/games/types.ts`). *Orb Rush* (`src/games/orb-rush`) is a reference implementation
  until the real game is designed.
- **Production basics:** Helmet headers, CORS, per-IP rate limits backed by Redis,
  structured logs, `/health` and `/ready` probes, graceful shutdown, Docker image, CI.

## Running locally

```bash
cd backend
docker compose up --build        # API on http://localhost:8080 (+ Postgres + Redis)
```

Or without Docker for the API (still needs Postgres and Redis running):

```bash
cp .env.example .env              # then edit values
npm install
npm run dev                       # migrations run automatically on startup
```

### Tests

```bash
# needs Postgres and Redis; defaults below, override with TEST_DATABASE_URL / TEST_REDIS_URL
#   postgres://game:game@localhost:5432/game_test   redis://localhost:6379/15
npm test
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | ≥ 32 chars, required; `openssl rand -base64 48` |
| `GOOGLE_CLIENT_IDS` | empty | Comma-separated OAuth client IDs (Web, Android, iOS) |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `60` | Refresh-token lifetime |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per-IP sign-in / refresh attempts |
| `CORS_ORIGINS` | `*` | Allowed browser origins |
| `PORT`, `HOST`, `LOG_LEVEL`, `NODE_ENV` | `8080`, `0.0.0.0`, `info`, `development` | |

### Setting up Google Sign-In

1. In Google Cloud Console → *APIs & Services → Credentials*, create OAuth client IDs for
   each platform you ship (Web application, Android, iOS) in the same project.
2. Put all of them in `GOOGLE_CLIENT_IDS`.
3. In the client, use the platform's Google Sign-In SDK to get an **ID token**, then
   `POST /v1/auth/google { "idToken": "..." }`.

## REST API

All endpoints return JSON. Errors look like
`{ "error": { "code": "version_conflict", "message": "...", "details": {...} } }`.
Authenticated endpoints need `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health`, `/ready` | | Liveness / readiness probes |
| GET | `/v1/games` | | Available games and their modes |
| POST | `/v1/auth/guest` | | `{displayName?}` → new guest session |
| POST | `/v1/auth/google` | | `{idToken}` → session (creates the account on first sign-in) |
| POST | `/v1/auth/refresh` | | `{refreshToken}` → new token pair (rotates) |
| POST | `/v1/auth/logout` | | `{refreshToken}` → revokes the session |
| POST | `/v1/auth/link/google` | ✓ | `{idToken}` → upgrades a guest, keeping progress |
| GET | `/v1/me` | ✓ | Profile and stats (xp, level, wins, losses) |
| PATCH | `/v1/me` | ✓ | `{displayName?, avatarUrl?}` |
| GET | `/v1/me/matches?limit=` | ✓ | Recent match history |
| GET | `/v1/users/:id` | ✓ | Public profile and stats |
| GET | `/v1/saves` | ✓ | List save slots (metadata only) |
| GET | `/v1/saves/:slot` | ✓ | Read a slot |
| PUT | `/v1/saves/:slot` | ✓ | `{data, expectedVersion?}`; `0` = create-only, mismatch → 409 |
| DELETE | `/v1/saves/:slot` | ✓ | Delete a slot |
| GET | `/v1/leaderboards/:gameId/:period?limit=&offset=` | ✓ | `period` = `all-time` \| `weekly` \| `daily` |
| GET | `/v1/leaderboards/:gameId/:period/me?radius=` | ✓ | Your rank and neighbours |
| POST | `/v1/solo/sessions` | ✓ | `{gameId}` → start a client-simulated run |
| POST | `/v1/solo/sessions/:id/finish` | ✓ | `{result}` → validated, recorded, XP awarded |

Session responses look like
`{ user, tokens: { accessToken, accessTokenExpiresIn, refreshToken, refreshTokenExpiresAt }, isNewUser }`.
Store the refresh token in secure storage (Keychain / Android Keystore). For guests it's
their only credential.

**WebSocket:** `GET /v1/realtime`. See [docs/REALTIME.md](docs/REALTIME.md).

## Adding the real game

1. Create `src/games/<your-game>/index.ts` implementing `GameDefinition`: state, input
   schema, `tick`, `snapshot` (per-viewer, so information can be hidden), results and XP.
2. Register it in `src/games/registry.ts`.

Matchmaking, rooms, reconnects, persistence, XP and leaderboards then work for it
automatically.

## Layout

```
src/
  index.ts            entry point + graceful shutdown
  server.ts           app assembly (services, plugins, routes)
  config.ts           validated environment config
  auth/               guest + Google sign-in, JWT, refresh-token rotation
  users/              profiles, stats, levels
  saves/              versioned cloud saves
  leaderboards/       Postgres + Redis ranked boards
  matches/            match recording (history, XP, scores)
  solo/               client-simulated solo sessions
  games/              GameDefinition interface, registry, Orb Rush reference game
  realtime/           protocol, hub (sockets), matchmaker, rooms
  db/                 pool, migrations
test/                 integration tests (HTTP + real WebSocket matches)
```

## Scaling notes

The API is stateless and scales horizontally behind a load balancer. Live rooms currently
run in-process: with several instances, use sticky sessions for `/v1/realtime` or a single
realtime node. The next step at scale is to move the matchmaking queue to Redis and route
players to dedicated room servers.
