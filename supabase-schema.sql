-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new

-- Activities table (one row per Garmin activity)
CREATE TABLE activities (
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
  tss           REAL,                  -- trainingStressScore
  start_lat     REAL,
  start_lon     REAL,
  location_name TEXT,
  description   TEXT
);

CREATE INDEX idx_activities_date ON activities(date DESC);

-- Diary entries table (future: manual notes per day)
CREATE TABLE diary_entries (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  content    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_diary_date ON diary_entries(date DESC);

-- Optional: allow public read access (fine for a personal app)
-- Comment out if you want to restrict access
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON activities FOR SELECT USING (true);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON diary_entries FOR SELECT USING (true);
CREATE POLICY "Allow anon insert" ON diary_entries FOR INSERT WITH CHECK (true);
