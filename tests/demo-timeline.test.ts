import { describe, expect, it } from 'vitest';
import { getDemoFrame } from '@/components/landing/demo-timeline';

describe('landing measurement demo timeline', () => {
  it('synchronizes the four stages with mannequin orientation', () => {
    expect(getDemoFrame(0)).toMatchObject({
      stage: 'front',
      stageIndex: 0,
      rotation: 0,
    });
    expect(getDemoFrame(4)).toMatchObject({
      stage: 'side',
      stageIndex: 1,
      rotation: 0,
    });
    expect(getDemoFrame(6).rotation).toBeCloseTo(Math.PI / 4);
    expect(getDemoFrame(8)).toMatchObject({
      stage: 'review',
      stageIndex: 2,
    });
    expect(getDemoFrame(8).rotation).toBeCloseTo(Math.PI / 2);
    expect(getDemoFrame(12)).toMatchObject({
      stage: 'results',
      stageIndex: 3,
    });
    expect(getDemoFrame(12).rotation).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('holds a three-quarter view before returning to front seamlessly', () => {
    const threeQuarter = getDemoFrame(14).rotation;
    expect(threeQuarter).toBeCloseTo((Math.PI * 11) / 6);
    expect(getDemoFrame(15.5).rotation).toBeGreaterThan(threeQuarter);
    expect(getDemoFrame(15.5).rotation).toBeLessThan(Math.PI * 2);
    expect(getDemoFrame(16)).toMatchObject({
      stage: 'front',
      rotation: 0,
    });
  });

  it('wraps elapsed time safely at the cycle boundary', () => {
    expect(getDemoFrame(17).elapsedSeconds).toBe(1);
    expect(getDemoFrame(Number.NaN).stage).toBe('front');
  });
});
