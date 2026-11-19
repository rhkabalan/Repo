# ATHAR Backend

The server for **ATHAR — Abu Dharr al-Ghifari and the Interactive Historical Journey**:
player accounts, the bilingual (Arabic / English) chapter content, server-side journey
progress that syncs across devices, achievements and the journal, plus cloud saves,
leaderboards and real-time multiplayer infrastructure. It's engine-agnostic: any client
(browser, iOS, Android, desktop) talks to it over HTTPS + WebSocket.

## The journey (ATHAR gameplay)

The story content lives in `src/journey/content/catalog.ts`: five chapters in order
(Mecca, Medina, Road to Tabuk, Al-Sham, Al-Rabadhah). Every string is in Arabic and English,
and every item is tagged with:

- **certainty:** `sourced`, `uncertain` or `fictional`, so gameplay inventions are never
  presented as history;
- **review status:** `draft`, `in_review` or `approved`, for the scholarly and Arabic-language
  review.

**Mecca** is modelled in full from the progress report:

| Step | Rule | XP |
|---|---|---|
| Guide conversation | Route-board clue or spoken clue (feeds Observation / Memory) | |
| Account: Ali's hospitality | In Hospitality Lane | 20 |
| Passage puzzle | Sun → Shelter → Water; wrong answers get feedback and retries; opens the Meeting Courtyard | 20 |
| Account: the public declaration | In the Meeting Courtyard (needs the passage) | 20 |
| Water for the traveler (optional) | 3 deliveries; awards the Compassion badge | 20 |
| Story-order puzzle | Needs both accounts | |
| Journal emphasis | Required before completion | |
| Mission complete | Mecca badge; unlocks Medina | 40 |
| **Maximum** | | **120** |

The server enforces the rules. Puzzle answers are checked on the server and solutions are
never sent to clients. Areas, puzzles and chapters unlock only when their prerequisites
are met. Each reward pays out at most once, so retries, replays and simultaneous requests
from two devices can't inflate XP. Replaying a chapter resets the run so the player can
choose differently; the journal and skills follow the choices from the latest completion.

### Single player, two players or three players

Every chapter can be played alone or as a party of **2 or 3** (real-time co-op):

- **Solo:** through the REST journey API, or a one-seat room (`partySize: 1`, starts at once).
- **Party:** the host creates a room with `partySize` 2 or 3 and a `chapterId`, and shares
  the 6-character code. Friends join and press ready; the host starts once every seat is filled.
- **Shared world:** when anyone finds an account, solves a puzzle (any member can attempt it)
  or delivers water, it counts for the whole party, and areas open for everyone together.
  Players see each other move in real time.
- **Personal choices:** each player makes their own guide and journal choices. The party
  can complete the mission once every member has chosen.
- **Credit for everyone:** each accepted action is saved to every member's own journey
  right away, so XP, badges and unlocks land on all accounts, and nothing is lost if
  someone leaves early.
- A party can play a chapter only when every member has unlocked it. Members who already
  completed it start a replay run (no double XP).
- Co-op is played with friends (invite codes), not the quick-match queue.

Medina, Tabuk, Al-Sham and Al-Rabadhah are shells (`format: 'legacy'`) until their clues
and choices are ported from the prototype.

> **Before release:** the discovery `sources` arrays are intentionally empty. Copy in the
> references used by the prototype's discovery panels; nothing has been invented. All Arabic
> and English text is a draft for language and scholarly review.

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
- **Pluggable real-time games:** multiplayer rules live behind a `GameDefinition` interface
  (`src/games/types.ts`). None is registered by default. *Orb Rush* (`src/games/orb-rush`)
  is the reference implementation and test fixture for a future multiplayer mode.
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
| GET | `/v1/journey/content?lang=ar\|en` | | Chapter catalog in one language (also reads `Accept-Language`) |
| GET | `/v1/journey?lang=` | ✓ | Player's progress, achievements (XP, badges, skills, counts) and journal |
| POST | `/v1/journey/events?lang=` | ✓ | Apply a player action (see below) → `{result, awards, journey}` |
| GET | `/v1/games` | | Registered real-time games and their modes |
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

**Journey events** (`POST /v1/journey/events`), each with a `chapterId`:

| `type` | Extra fields | Result |
|---|---|---|
| `chapter.start` | | |
| `discovery.find` | `discoveryId` | XP on first discovery; added to the journal |
| `puzzle.attempt` | `puzzleId`, `answer: string[]` | `{correct, attempts, correctPrefix?, openedAreas?}` |
| `choice.make` | `choiceId`, `optionId` | |
| `task.progress` | `taskId`, `amount` | `{count, goal, complete}` |
| `mission.complete` | | 409 `prerequisites_missing` lists what's left |
| `chapter.replay` | | Only for completed chapters |

**WebSocket:** `GET /v1/realtime`. See [docs/REALTIME.md](docs/REALTIME.md).

## Editing content

Edit `src/journey/content/catalog.ts`. `npm test` checks the content: every reference
resolves, every string has both languages, and Mecca still totals 120 XP. When a release
adds chapters, bump `catalog.version`; existing players' progress is upgraded automatically.

## Adding a real-time game mode

1. Create `src/games/<mode>/index.ts` implementing `GameDefinition`: state, input
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
  journey/            ATHAR chapters: bilingual content, rules engine, progress, journal
  games/              real-time GameDefinition interface, registry, Orb Rush reference
  realtime/           protocol, hub (sockets), matchmaker, rooms
  db/                 pool, migrations
test/                 integration tests (HTTP + real WebSocket matches)
```

## Scaling notes

The API is stateless and scales horizontally behind a load balancer. Live rooms currently
run in-process: with several instances, use sticky sessions for `/v1/realtime` or a single
realtime node. The next step at scale is to move the matchmaking queue to Redis and route
players to dedicated room servers.
