import { describe, it, expect } from 'vitest';
import {
  cmToM,
  msToSec,
  cmPerMsToKmh,
  msToDate,
  round,
  toInt,
} from './garmin-parse';

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
