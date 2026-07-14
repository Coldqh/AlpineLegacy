import { describe, expect, it } from 'vitest';
import { runBalanceSample } from '../playtest';

describe('playtest harness', () => {
  it('produces deterministic aggregate data for the physical expedition engine', () => {
    const first = runBalanceSample('PLAYTEST', 4, 'CLIMBER');
    const second = runBalanceSample('PLAYTEST', 4, 'CLIMBER');
    expect(first).toEqual(second);
    expect(first.sampleSize).toBe(12);
    expect(first.successRate + first.retreatRate + first.failureRate).toBe(1);
    expect(first.successRate).toBeGreaterThanOrEqual(.2);
    expect(first.averageMoves).toBeGreaterThan(80);
  });
});
