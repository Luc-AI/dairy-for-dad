import type { Activity } from './db';

/** Raw Garmin "summarized activity" record. Only the fields we use are typed. */
export type RawSummarizedActivity = {
  activityId: number;
  beginTimestamp?: number | null;
  name?: string | null;
  activityType?: string | null;
  duration?: number | null;
  distance?: number | null;
  elevationGain?: number | null;
  avgSpeed?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  avgPower?: number | null;
  trainingStressScore?: number | null;
  avgTemperature?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  locationName?: string | null;
  description?: string | null;
};

export type ParseResult = {
  /** Successfully normalized activities, deduped by id (first occurrence wins). */
  activities: Activity[];
  /** Count of raw rows skipped due to missing beginTimestamp. */
  skippedNoTimestamp: number;
};
