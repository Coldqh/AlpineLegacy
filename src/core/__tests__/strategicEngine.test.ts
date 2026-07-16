import { describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  availableExpeditionOffers,
  beginDescent,
  createCareer,
  hydrateCareerFoundation,
  resolveStrategicRestChoice,
  resolveStrategicSectorPlan,
  startPlannedClimb,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { currentStrategicSector, defaultStrategicPlan, previewStrategicPlan } from '../strategicEngine';
import type { CareerState, StrategicSectorPlan, WorldSeedConfig, WorldState } from '../types';

function startedFixture(seed = 'THINK-1907', lowestOffer = false) {
  const config: WorldSeedConfig = { seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Planner', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offers = availableExpeditionOffers(world, career);
  const offer = lowestOffer
    ? [...offers].sort((a, b) => world.ecosystem.content.routes.byId[a.routeId]!.summitElevation - world.ecosystem.content.routes.byId[b.routeId]!.summitElevation)[0]!
    : offers[0]!;
  career = acceptExpeditionOffer(world, career, offer.id);
  return { world, career: startPlannedClimb(career) };
}

function thoughtfulPlan(career: CareerState): StrategicSectorPlan {
  const sector = currentStrategicSector(career)!;
  const plan = defaultStrategicPlan();
  plan.line = career.activeClimb!.windKmh >= 48 || sector.exposure >= 68
    ? 'SHELTERED'
    : ['CREVASSE_FIELD', 'SNOW_SLOPE', 'ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId)
      ? 'TECHNICAL'
      : sector.terrainModuleId === 'ICEFALL' ? 'DIRECT' : sector.difficulty >= 52 ? 'TECHNICAL' : 'DIRECT';
  plan.pace = career.activeClimb!.energy < 45 || career.activeClimb!.hoursAwake >= 10
    ? 'CONSERVE'
    : sector.terrainModuleId === 'ICEFALL' ? 'PUSH' : 'WORK';
  plan.protection = sector.difficulty >= 62 || sector.exposure >= 65 || ['ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId)
    ? 'FULL'
    : sector.difficulty >= 38 || sector.exposure >= 36 ? 'STANDARD' : 'LIGHT';
  plan.formation = ['SNOW_SLOPE', 'CREVASSE_FIELD'].includes(sector.terrainModuleId)
    ? 'SPREAD'
    : career.activeClimb!.visibility < 42 || ['RIDGE', 'ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId) ? 'COMPACT' : 'BALANCED';
  plan.position = career.activeClimb!.playerRole === 'ROPE_LEAD' || career.activeClimb!.playerRole === 'NAVIGATOR'
    ? 'FRONT'
    : career.activeClimb!.playerRole === 'MEDIC' ? 'MIDDLE' : 'REAR';
  const warnings = previewStrategicPlan(career, plan).warnings;
  plan.focus = warnings.length >= 2 ? 'CHALLENGE' : warnings.length ? 'VERIFY' : 'FOLLOW';
  return plan;
}

function firstVisiblePlan(): StrategicSectorPlan {
  return {
    line: 'DIRECT',
    pace: 'CONSERVE',
    protection: 'LIGHT',
    formation: 'COMPACT',
    focus: 'FOLLOW',
    position: 'FRONT',
  };
}

function finishStrategic(career: CareerState, firstButtonPolicy = false) {
  let current = career;
  for (let turn = 0; turn < 80 && current.activeClimb && !['COMPLETE', 'RETREATED', 'FAILED'].includes(current.activeClimb.phase); turn += 1) {
    const strategic = current.activeClimb.strategic!;
    if (strategic.status === 'REST_REQUIRED') {
      current = resolveStrategicRestChoice(current, current.activeClimb.supplies.fuelUnits >= 2 ? 'CAMP' : 'BIVY').career;
      continue;
    }
    if (strategic.status === 'SUMMIT') {
      current = beginDescent(current);
      continue;
    }
    current = resolveStrategicSectorPlan(current, firstButtonPolicy ? firstVisiblePlan() : thoughtfulPlan(current)).career;
  }
  return current;
}

describe('strategic expedition engine', () => {
  it('uses major route sectors instead of dozens of repeated movement actions', () => {
    const { career } = startedFixture();
    const strategic = career.activeClimb!.strategic!;
    expect(strategic.ascentSectors.length).toBeGreaterThanOrEqual(5);
    expect(strategic.ascentSectors.length).toBeLessThanOrEqual(8);
    expect(strategic.descentSectors.length).toBeLessThanOrEqual(4);
    expect(strategic.baselineMinutes).toBeLessThan(60 * 60);
  });

  it('finishes a thoughtful expedition near its physical time plan', () => {
    const { career: started } = startedFixture();
    const finished = finishStrategic(started);
    expect(['COMPLETE', 'RETREATED']).toContain(finished.activeClimb?.phase);
    expect(finished.activeClimb!.strategic!.history.length).toBeGreaterThanOrEqual(3);
    expect(finished.activeClimb!.elapsedMinutes).toBeLessThan(started.activeClimb!.strategic!.baselineMinutes * 2.1);
    expect(finished.activeClimb!.elapsedMinutes).toBeLessThan(72 * 60);
  });

  it('keeps the easiest real alpine objective out of the old 94-hour range', () => {
    const { career: started } = startedFixture('LOW-14', true);
    expect(started.activeClimb!.summitElevation).toBeGreaterThanOrEqual(3500);
    expect(started.activeClimb!.summitElevation).toBeLessThan(5000);
    const finished = finishStrategic(started);
    expect(['COMPLETE', 'RETREATED']).toContain(finished.activeClimb!.phase);
    expect(finished.activeClimb!.elapsedMinutes).toBeLessThan(60 * 60);
  });

  it('makes clicking the first visible option materially worse than reading the sector', () => {
    const thoughtful = finishStrategic(startedFixture().career);
    const firstButtons = finishStrategic(startedFixture().career, true);
    const thoughtfulFailures = thoughtful.activeClimb!.strategic!.randomPlanFailures;
    const blindFailures = firstButtons.activeClimb!.strategic!.randomPlanFailures;
    const thoughtfulCondition = thoughtful.activeClimb!.condition + thoughtful.activeClimb!.teamCondition;
    const blindCondition = firstButtons.activeClimb!.condition + firstButtons.activeClimb!.teamCondition;
    expect(
      blindFailures > thoughtfulFailures
      || firstButtons.activeClimb!.phase === 'RETREATED'
      || blindCondition < thoughtfulCondition,
    ).toBe(true);
  });

  it('preserves strategic altitude and sector after a save reload', () => {
    const { world, career: started } = startedFixture();
    const moved = resolveStrategicSectorPlan(started, thoughtfulPlan(started)).career;
    const altitude = moved.activeClimb!.currentElevation;
    const sectorIndex = moved.activeClimb!.strategic!.sectorIndex;
    const restored = hydrateCareerFoundation(JSON.parse(JSON.stringify(moved)), world as WorldState, false);
    expect(restored.activeClimb!.currentElevation).toBe(altitude);
    expect(restored.activeClimb!.strategic!.sectorIndex).toBe(sectorIndex);
  });
});
