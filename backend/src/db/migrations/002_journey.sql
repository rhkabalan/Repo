-- ATHAR journey progress: one document per player, plus an append-only event log.
CREATE TABLE journey_progress (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state       jsonb       NOT NULL,
  version     integer     NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Audit/analytics trail: which puzzles players struggle with, where they drop off, etc.
CREATE TABLE journey_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id  text        NOT NULL,
  type        text        NOT NULL,
  payload     jsonb       NOT NULL,
  xp_awarded  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_events_user_idx ON journey_events(user_id, created_at DESC);
CREATE INDEX journey_events_type_idx ON journey_events(chapter_id, type);
