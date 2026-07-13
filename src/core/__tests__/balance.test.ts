import { describe, expect, it } from 'vitest';
import { beginDescent, createCareer, resolveClimbStep, startQualificationClimb } from '../career';
import { generateWorld } from '../generator';
import type { ClimbPace, OriginId } from '../types';

function simulate(seed: string, originId: OriginId, pace: ClimbPace) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  let career = startQualificationClimb(createCareer(world, { name: 'Balance Test', age: 20, originId }), world);
  for (let guard = 0; guard < 24; guard += 1) {
    const phase = career.activeClimb?.phase;
    if (phase === 'SUMMIT') {
      career = beginDescent(career);
      continue;
    }
    if (phase === 'COMPLETE' || phase === 'FAILED' || phase === 'RETREATED') return phase;
    career = resolveClimbStep(career, pace).career;
  }
  return career.activeClimb?.phase;
}

describe('qualification balance', () => {
  it('keeps cautious preparation viable across many seeds', () => {
    const origins: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];
    const outcomes = Array.from({ length: 20 }, (_, index) => `BALANCE-${index + 1}`)
      .flatMap(seed => origins.map(origin => simulate(seed, origin, 'CAUTIOUS')));
    const successRate = outcomes.filter(outcome => outcome === 'COMPLETE').length / outcomes.length;

    expect(successRate).toBeGreaterThanOrEqual(.65);
  });
});
