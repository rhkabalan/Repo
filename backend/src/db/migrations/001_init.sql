CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text        NOT NULL,
  avatar_url    text,
  is_guest      boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

-- External sign-in identities (Google today; Apple/Discord/etc. can be added later).
CREATE TABLE auth_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          text        NOT NULL,
  provider_subject  text        NOT NULL,
  email             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);
CREATE INDEX auth_identities_user_idx ON auth_identities(user_id);

-- Rotating refresh tokens. Only a SHA-256 hash is stored. Tokens issued from the
-- same sign-in share a family so that reuse of a rotated token revokes them all.
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid        NOT NULL,
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens(family_id);

CREATE TABLE player_stats (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp            bigint NOT NULL DEFAULT 0,
  games_played  integer NOT NULL DEFAULT 0,
  wins          integer NOT NULL DEFAULT 0,
  losses        integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Cloud saves: arbitrary JSON per named slot, with a version for optimistic concurrency.
CREATE TABLE save_slots (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        text        NOT NULL,
  data        jsonb       NOT NULL,
  version     integer     NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

CREATE TABLE matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     text        NOT NULL,
  mode        text        NOT NULL CHECK (mode IN ('solo', 'multiplayer')),
  status      text        NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  result      jsonb
);
CREATE INDEX matches_game_idx ON matches(game_id, started_at DESC);

CREATE TABLE match_players (
  match_id   uuid    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id    uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      bigint  NOT NULL DEFAULT 0,
  placement  integer,
  PRIMARY KEY (match_id, user_id)
);
CREATE INDEX match_players_user_idx ON match_players(user_id);

-- Durable best score per player per board. Redis holds the ranked copy for fast reads.
CREATE TABLE leaderboard_entries (
  game_id     text        NOT NULL,
  board       text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  best_score  bigint      NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, board, user_id)
);
CREATE INDEX leaderboard_rank_idx ON leaderboard_entries(game_id, board, best_score DESC);
