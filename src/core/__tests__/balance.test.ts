import { describe, expect, it } from 'vitest';
import { beginDescent, createCareer, establishCamp, meltSnow, resolveClimbStep, startPlannedClimb } from '../career';
import { generateWorld } from '../generator';
import type { CareerState, OriginId } from '../types';

function simulate(seed: string, originId: OriginId) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  let career: CareerState = startPlannedClimb(createCareer(world, { name: 'Balance Test', age: 20, originId }));
  for (let guard = 0; guard < 40; guard += 1) {
    const climb = career.activeClimb;
    if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) return climb?.phase;
    if (climb.phase === 'SUMMIT') { career = beginDescent(career); continue; }
    const segment = climb.route[climb.segmentIndex]!;
    if (segment.campPossible && climb.hoursAwake > 6 && climb.supplies.fuelUnits > 0 && climb.supplies.foodUnits > 0) {
      career = establishCamp(career).career;
      continue;
    }
    if (climb.supplies.waterUnits < 4 && climb.supplies.fuelUnits > 0) {
      career = meltSnow(career).career;
      continue;
    }
    career = resolveClimbStep(career, 'CAUTIOUS').career;
  }
  return career.activeClimb?.phase;
}

describe('expedition balance', () => {
  it('keeps a prepared cautious expedition viable across many seeds', () => {
    const origins: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];
    const outcomes = Array.from({ length: 20 }, (_, index) => `BALANCE-${index + 1}`)
      .flatMap(seed => origins.map(origin => simulate(seed, origin)));
    const successRate = outcomes.filter(outcome => outcome === 'COMPLETE').length / outcomes.length;
    expect(successRate).toBeGreaterThanOrEqual(.55);
  });
});
