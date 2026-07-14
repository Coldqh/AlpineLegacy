import { describe, expect, it } from 'vitest';
import { runBalanceSample } from '../playtest';

describe('expedition balance', () => {
  it('finishes long physical expeditions across many deterministic seeds', () => {
    const sample = runBalanceSample('BALANCE', 20, 'CLIMBER');
    const terminalRate = sample.successRate + sample.retreatRate + sample.failureRate;
    expect(sample.sampleSize).toBe(60);
    expect(terminalRate).toBe(1);
    expect(sample.successRate).toBeGreaterThanOrEqual(.2);
    expect(sample.averageMoves).toBeGreaterThan(80);
  });
});
