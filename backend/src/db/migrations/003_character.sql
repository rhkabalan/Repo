-- The playable character each player picked (null until they choose).
ALTER TABLE users ADD COLUMN character_id text;
