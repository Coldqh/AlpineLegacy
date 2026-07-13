import { describe, expect, it } from 'vitest';
import { beginDescent, createCareer, resolveClimbStep, startQualificationClimb } from '../career';
import { generateWorld } from '../generator';
import type { CareerDraft, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = {
  seed: 'ALPINE-1907',
  eraId: 'EXPEDITION',
  startYear: 1968,
  difficulty: 'CLIMBER',
};

const draft: CareerDraft = {
  name: 'Test Climber',
  age: 20,
  originId: 'CLUB_SCHOOL',
};

describe('career module', () => {
  it('creates a career bound to the generated world', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);

    expect(career.worldId).toBe(world.id);
    expect(career.hero.skills.ENDURANCE).toBe(4);
    expect(career.club.foundedYear).toBeLessThan(config.startYear);
  });

  it('keeps a qualification climb reproducible for equal state and pace', () => {
    const world = generateWorld(config);
    const career = startQualificationClimb(createCareer(world, draft), world);

    const first = resolveClimbStep(career, 'STEADY');
    const second = resolveClimbStep(career, 'STEADY');

    expect(first.career.activeClimb).toEqual(second.career.activeClimb);
  });

  it('requires a descent after reaching the summit', () => {
    const world = generateWorld(config);
    let career = startQualificationClimb(createCareer(world, draft), world);

    for (let step = 0; step < 5; step += 1) {
      career = resolveClimbStep(career, 'CAUTIOUS').career;
      if (career.activeClimb?.phase === 'FAILED') break;
    }

    if (career.activeClimb?.phase === 'SUMMIT') {
      career = beginDescent(career);
      expect(career.activeClimb?.phase).toBe('DESCENT');
      expect(career.completedClimbs).toBe(0);
    }
  });

  it('can complete the full qualification route including descent', () => {
    const world = generateWorld(config);
    let career = startQualificationClimb(createCareer(world, draft), world);

    for (let guard = 0; guard < 20; guard += 1) {
      const phase = career.activeClimb?.phase;
      if (phase === 'SUMMIT') {
        career = beginDescent(career);
        continue;
      }
      if (phase === 'COMPLETE' || phase === 'FAILED' || phase === 'RETREATED') break;
      career = resolveClimbStep(career, 'CAUTIOUS').career;
    }

    expect(career.activeClimb?.phase).toBe('COMPLETE');
    expect(career.completedClimbs).toBe(1);
    expect(career.highestElevation).toBe(career.activeClimb?.summitElevation);
  });

});
