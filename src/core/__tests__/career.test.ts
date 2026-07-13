import { describe, expect, it } from 'vitest';
import {
  applyEquipmentPreset,
  beginDescent,
  chooseRouteDecision,
  createCareer,
  establishCamp,
  expeditionReadiness,
  fixRope,
  issueClimbOrder,
  meltSnow,
  resolveClimbStep,
  startPlannedClimb,
  selectMountain,
  getCurrentRouteDecision,
  getSelectedRoute,
  leaveCache,
  previewClimbAction,
  preparationInsights,
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
    const decision = getCurrentRouteDecision(career);
    if (decision) {
      const choice = decision.options.find(option => option.tone === 'SAFE' && (!option.requiresRopeMeters || climb.ropeMetersRemaining >= option.requiresRopeMeters)) ?? decision.options[0]!;
      career = chooseRouteDecision(career, choice.id).career;
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
    expect(career.schemaVersion).toBe(8);
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
    for (let step = 0; step < 24 && career.activeClimb?.phase === 'ASCENT'; step += 1) {
      const decision = getCurrentRouteDecision(career);
      if (decision) career = chooseRouteDecision(career, decision.options.find(option => option.tone === 'SAFE')?.id ?? decision.options[0]!.id).career;
      else career = resolveClimbStep(career, 'CAUTIOUS').career;
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


  it('previews time, resource cost and risk before a climb action', () => {
    const world = generateWorld(config);
    const career = startPlannedClimb(createCareer(world, draft));
    const cautious = previewClimbAction(career, 'CAUTIOUS')!;
    const fast = previewClimbAction(career, 'FAST')!;
    expect(cautious.durationMinutes).toBeGreaterThan(fast.durationMinutes);
    expect(cautious.incidentRisk).toBeLessThan(fast.incidentRisk);
    expect(fast.energyCost).toBeGreaterThan(cautious.energyCost);
  });

  it('explains the selected mountain character in preparation', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const insights = preparationInsights(career);
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights[0]?.title).toContain('гора');
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

  it('gives the signature mountain route choices and a separate descent line', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const route = getSelectedRoute(career);
    expect(route.isSignature).toBe(true);
    expect(route.decisions?.length).toBeGreaterThanOrEqual(2);
    expect(route.descentSegments).toBeDefined();
    expect(route.descentSegments).not.toEqual(route.segments);
  });

  it('records a route choice and can leave a cache for descent', () => {
    const world = generateWorld(config);
    let career = startPlannedClimb(createCareer(world, draft));
    const firstSegment = career.activeClimb!.route[0]!;
    expect(firstSegment.campPossible).toBe(true);
    career = leaveCache(career).career;
    expect(career.activeClimb?.caches).toHaveLength(1);
    career = resolveClimbStep(career, 'CAUTIOUS').career;
    const decision = getCurrentRouteDecision(career)!;
    career = chooseRouteDecision(career, decision.options[0]!.id).career;
    expect(career.activeClimb?.routeChoices).toHaveLength(1);
    expect(career.activeClimb?.segmentChoices[decision.id]).toBe(decision.options[0]!.id);
  });

  it('recovers a field cache during the separate descent', () => {
    const world = generateWorld(config);
    let career = startPlannedClimb(createCareer(world, draft));
    career = leaveCache(career).career;
    career = advanceExpedition(career);
    expect(career.activeClimb?.phase).toBe('COMPLETE');
    expect(career.activeClimb?.caches[0]?.recovered).toBe(true);
  });

  it('spends rope to protect a technical segment', () => {
    const world = generateWorld(config);
    let career = startPlannedClimb(createCareer(world, draft));
    career = resolveClimbStep(career, 'CAUTIOUS').career;
    const decision = getCurrentRouteDecision(career)!;
    career = chooseRouteDecision(career, decision.options[0]!.id).career;
    career = resolveClimbStep(career, 'CAUTIOUS').career;
    const before = career.activeClimb!.ropeMetersRemaining;
    const result = fixRope(career);
    if (result.severity === 'SUCCESS') {
      expect(result.career.activeClimb!.ropeMetersRemaining).toBe(before - 20);
      expect(result.career.activeClimb!.fixedRopeSegmentIds.length).toBeGreaterThan(0);
    } else {
      expect(result.headline).toContain('не требуется');
    }
  });

});
