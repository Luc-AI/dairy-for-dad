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

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Centimeters → meters, rounded to 2 decimals. */
export function cmToM(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v) / 100;
}

/** Milliseconds → seconds, integer. */
export function msToSec(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v / 1000);
}

/** cm/ms → km/h. (cm/ms * 36 = km/h.) */
export function cmPerMsToKmh(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 36);
}

/** ms epoch → YYYY-MM-DD (UTC). */
export function msToDate(ms: number | null | undefined): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Round to N decimals. */
export function round(v: number | null | undefined, decimals = 1): number | null {
  if (v == null || Number.isNaN(v)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/** Round to integer. */
export function toInt(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v);
}
