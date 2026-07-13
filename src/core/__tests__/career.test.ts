import { describe, expect, it } from 'vitest';
import {
  applyEquipmentPreset,
  beginDescent,
  createCareer,
  establishCamp,
  expeditionReadiness,
  issueClimbOrder,
  meltSnow,
  resolveClimbStep,
  startPlannedClimb,
  selectMountain,
  getSelectedRoute,
} from '../career';
import { generateWorld } from '../generator';
import type { CareerDraft, CareerState, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'ALPINE-1907', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };
const draft: CareerDraft = { name: 'Test Climber', age: 20, originId: 'CLUB_SCHOOL' };

function advanceExpedition(career: CareerState) {
  for (let guard = 0; guard < 35; guard += 1) {
    const climb = career.activeClimb;
    if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) break;
    if (climb.phase === 'SUMMIT') {
      career = beginDescent(career);
      continue;
    }
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
  return career;
}

describe('career and expedition module', () => {
  it('creates a career with deterministic routes, team and weather', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    expect(career.worldId).toBe(world.id);
    expect(career.schemaVersion).toBe(6);
    expect(career.routes).toHaveLength(world.region.mountains.length * 3);
    expect(career.teamRoster.length).toBeGreaterThanOrEqual(5);
    expect(career.weatherWindows).toHaveLength(3);
    expect(career.livingWorld.athletes.length).toBeGreaterThanOrEqual(35);
    expect(career.livingWorld.clubs).toHaveLength(6);
  });


  it('lets the player choose any generated mountain', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const target = world.region.mountains.at(-1)!;
    const changed = selectMountain(career, target.id);
    expect(getSelectedRoute(changed).mountainId).toBe(target.id);
    expect(changed.routes.filter(route => route.mountainId === target.id)).toHaveLength(3);
  });

  it('builds a launchable default expedition plan', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const readiness = expeditionReadiness(career);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.total).toBeGreaterThanOrEqual(54);
  });


  it('builds a valid equipment preset for the selected route', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const packed = applyEquipmentPreset(career, 'RECOMMENDED');
    expect(expeditionReadiness(packed).blockers.some(item => item.includes('снаряжения'))).toBe(false);
  });

  it('keeps the same action reproducible for equal state and pace', () => {
    const world = generateWorld(config);
    const career = startPlannedClimb(createCareer(world, draft));
    const first = resolveClimbStep(career, 'STEADY');
    const second = resolveClimbStep(career, 'STEADY');
    expect(first.career.activeClimb).toEqual(second.career.activeClimb);
  });

  it('requires a descent after reaching the summit', () => {
    const world = generateWorld(config);
    let career = startPlannedClimb(createCareer(world, draft));
    for (let step = 0; step < 18 && career.activeClimb?.phase === 'ASCENT'; step += 1) {
      career = resolveClimbStep(career, 'CAUTIOUS').career;
    }
    if (career.activeClimb?.phase === 'SUMMIT') {
      expect(career.completedClimbs).toBe(0);
      career = beginDescent(career);
      expect(career.activeClimb?.phase).toBe('DESCENT');
    }
  });

  it('can complete a planned route with field management and descent', () => {
    const world = generateWorld(config);
    const career = advanceExpedition(startPlannedClimb(createCareer(world, draft)));
    expect(career.activeClimb?.phase).toBe('COMPLETE');
    expect(career.completedClimbs).toBe(1);
  });

  it('creates people with personality, relationships and memory', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const member = career.teamRoster[0]!;
    expect(member.personality.discipline).toBeGreaterThan(0);
    expect(member.relationship.trust).toBe(member.trust);
    expect(member.memories[0]?.type).toBe('FIRST_MEETING');
  });

  it('records team orders and their consequences during a climb', () => {
    const world = generateWorld(config);
    const career = startPlannedClimb(createCareer(world, draft));
    const result = issueClimbOrder(career, 'SLOW_DOWN');
    expect(result.career.activeClimb?.decisions).toHaveLength(1);
    expect(result.career.activeClimb?.elapsedMinutes).toBeGreaterThan(0);
    expect(result.career.teamRoster.some(member => member.memories.length > 1)).toBe(true);
  });

});
