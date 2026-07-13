import { describe, expect, it } from 'vitest';
import { runBalanceSample } from '../playtest';

describe('playtest harness', () => {
  it('produces deterministic aggregate balance data', () => {
    const first = runBalanceSample('HARDENING', 4, 'CLIMBER');
    const second = runBalanceSample('HARDENING', 4, 'CLIMBER');
    expect(first).toEqual(second);
    expect(first.sampleSize).toBe(12);
    expect(first.successRate).toBeGreaterThanOrEqual(.5);
    expect(first.averageMoves).toBeGreaterThan(0);
  });
});
