import { describe, it, expect } from 'vitest';
import {
  cmToM,
  msToSec,
  cmPerMsToKmh,
  msToDate,
  round,
  toInt,
} from './garmin-parse';
import { normalizeActivity } from './garmin-parse';

describe('unit conversions', () => {
  it('cmToM: 834424 cm → 8344.24 m, rounded to 1 decimal', () => {
    expect(cmToM(834424)).toBe(8344.24);
  });

  it('cmToM: returns null for null / NaN', () => {
    expect(cmToM(null)).toBeNull();
    expect(cmToM(NaN)).toBeNull();
  });

  it('msToSec: 2945123 ms → 2945 s', () => {
    expect(msToSec(2945123)).toBe(2945);
  });

  it('cmPerMsToKmh: 1 cm/ms → 36 km/h', () => {
    expect(cmPerMsToKmh(1)).toBe(36);
  });

  it('msToDate: returns YYYY-MM-DD UTC slice', () => {
    expect(msToDate(1336521600000)).toBe('2012-05-09');
  });

  it('msToDate: returns null for null', () => {
    expect(msToDate(null)).toBeNull();
  });

  it('round: rounds to N decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2345, 1)).toBe(1.2);
  });

  it('toInt: rounds to integer', () => {
    expect(toInt(12.7)).toBe(13);
    expect(toInt(null)).toBeNull();
  });
});

describe('normalizeActivity', () => {
  it('normalizes the canonical Prag run (id 178259890)', () => {
    const raw = {
      activityId: 178259890,
      beginTimestamp: 1336521600000, // 2012-05-09 UTC
      name: 'Prag',
      activityType: 'running',
      duration: 2945000,
      distance: 834424, // cm
      elevationGain: 5000, // cm
      avgSpeed: null,
      avgHr: 150,
      maxHr: 175,
      calories: 600,
    };
    const result = normalizeActivity(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(178259890);
    expect(result!.date).toBe('2012-05-09');
    expect(result!.distance_m).toBe(8344.24);
    expect(result!.duration_sec).toBe(2945);
    expect(result!.elevation_gain_m).toBe(50);
    expect(result!.avg_hr).toBe(150);
  });

  it('returns null when beginTimestamp is missing', () => {
    expect(normalizeActivity({ activityId: 1 })).toBeNull();
    expect(normalizeActivity({ activityId: 2, beginTimestamp: null })).toBeNull();
  });

  it('coerces missing optional fields to null', () => {
    const result = normalizeActivity({
      activityId: 99,
      beginTimestamp: 1336521600000,
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBeNull();
    expect(result!.activity_type).toBeNull();
    expect(result!.avg_hr).toBeNull();
    expect(result!.location_name).toBeNull();
  });
});
