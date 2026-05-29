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
import { parseSummarizedActivitiesJson, dedupeById } from './garmin-parse';
import { parseFiles } from './garmin-parse';

describe('unit conversions', () => {
  it('cmToM: 834424 cm → 8344.24 m', () => {
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

describe('parseSummarizedActivitiesJson', () => {
  const TS = 1336521600000;
  const raw = (id: number) => ({ activityId: id, beginTimestamp: TS });

  it('parses array-wrapped root', () => {
    const json = JSON.stringify([{ summarizedActivitiesExport: [raw(1), raw(2)] }]);
    expect(parseSummarizedActivitiesJson(json)).toEqual([raw(1), raw(2)]);
  });

  it('parses bare-object root', () => {
    const json = JSON.stringify({ summarizedActivitiesExport: [raw(3)] });
    expect(parseSummarizedActivitiesJson(json)).toEqual([raw(3)]);
  });

  it('returns empty array when summarizedActivitiesExport is missing', () => {
    expect(parseSummarizedActivitiesJson('{}')).toEqual([]);
    expect(parseSummarizedActivitiesJson('[]')).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSummarizedActivitiesJson('not json')).toThrow();
  });
});

describe('dedupeById', () => {
  it('keeps the first occurrence of each id', () => {
    const TS = 1336521600000;
    const a1 = { activityId: 1, beginTimestamp: TS, name: 'first' };
    const a2 = { activityId: 1, beginTimestamp: TS, name: 'second' };
    const a3 = { activityId: 2, beginTimestamp: TS, name: 'other' };
    expect(dedupeById([a1, a2, a3])).toEqual([a1, a3]);
  });

  it('returns empty for empty input', () => {
    expect(dedupeById([])).toEqual([]);
  });
});

describe('parseFiles', () => {
  const TS = 1336521600000;

  it('parses, dedupes across files, and normalizes', () => {
    const fileA = JSON.stringify({
      summarizedActivitiesExport: [
        { activityId: 1, beginTimestamp: TS, name: 'A1' },
        { activityId: 2, beginTimestamp: TS, name: 'A2' },
      ],
    });
    const fileB = JSON.stringify([
      {
        summarizedActivitiesExport: [
          { activityId: 2, beginTimestamp: TS, name: 'B2 dup' }, // dup of A2
          { activityId: 3, beginTimestamp: TS, name: 'B3' },
        ],
      },
    ]);
    const result = parseFiles([fileA, fileB]);
    expect(result.activities).toHaveLength(3);
    expect(result.activities.map((a) => a.id).sort()).toEqual([1, 2, 3]);
    // First occurrence wins — A2 came from fileA
    expect(result.activities.find((a) => a.id === 2)!.name).toBe('A2');
    expect(result.skippedNoTimestamp).toBe(0);
  });

  it('counts activities skipped for missing beginTimestamp', () => {
    const file = JSON.stringify({
      summarizedActivitiesExport: [
        { activityId: 1, beginTimestamp: TS },
        { activityId: 2 }, // no timestamp
        { activityId: 3, beginTimestamp: null },
      ],
    });
    const result = parseFiles([file]);
    expect(result.activities).toHaveLength(1);
    expect(result.skippedNoTimestamp).toBe(2);
  });
});
