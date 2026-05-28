-- Schema for the Neon Postgres database.
-- Apply via psql or the Neon SQL editor.

CREATE TABLE IF NOT EXISTS activities (
  id            BIGINT PRIMARY KEY,    -- Garmin activityId
  date          DATE   NOT NULL,
  name          TEXT,
  activity_type TEXT,
  duration_sec  INTEGER,
  distance_m    REAL,
  elevation_gain_m REAL,
  avg_speed_kmh REAL,
  avg_hr        INTEGER,
  max_hr        INTEGER,
  calories      INTEGER,
  avg_power     INTEGER,
  tss           REAL,
  avg_temperature REAL,
  min_temperature REAL,
  max_temperature REAL,
  start_lat     REAL,
  start_lon     REAL,
  location_name TEXT,
  description   TEXT
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date DESC);

CREATE TABLE IF NOT EXISTS diary_entries (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  content    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date DESC);
