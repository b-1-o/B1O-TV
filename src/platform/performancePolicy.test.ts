import { describe, expect, it } from 'vitest';
import { getViewMotionTiming } from './performancePolicy';

describe('getViewMotionTiming', () => {
  it('disables view transitions when reduced motion is enabled', () => {
    expect(getViewMotionTiming(true, true)).toBeNull();
    expect(getViewMotionTiming(true, false)).toBeNull();
  });

  it('uses short transitions on TV to keep remote navigation responsive', () => {
    expect(getViewMotionTiming(false, true)).toEqual({ exitMs: 90, enterMs: 190 });
  });

  it('keeps the richer desktop preview timing', () => {
    expect(getViewMotionTiming(false, false)).toEqual({ exitMs: 170, enterMs: 430 });
  });
});
