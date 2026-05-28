import { neon, types } from '@neondatabase/serverless';

types.setTypeParser(types.builtins.INT8, (val: string) => Number(val));

export type Activity = {
  id: number;
  date: string;
  name: string | null;
  activity_type: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_speed_kmh: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  avg_power: number | null;
  tss: number | null;
  avg_temperature: number | null;
  min_temperature: number | null;
  max_temperature: number | null;
  start_lat: number | null;
  start_lon: number | null;
  location_name: string | null;
  description: string | null;
};

export type DiaryEntry = {
  id: number;
  date: string;
  content: string | null;
  created_at: string;
};

export const sql = neon(process.env.DATABASE_URL!);
