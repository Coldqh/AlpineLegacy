import { describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  applyEquipmentPreset,
  availableExpeditionOffers,
  beginDescent,
  chooseRouteDecision,
  createCareer,
  establishCamp,
  expeditionReadiness,
  fixRope,
  getCurrentRouteDecision,
  getSelectedRoute,
  issueClimbOrder,
  leaveCache,
  meltSnow,
  preparationInsights,
  previewClimbAction,
  resolveClimbStep,
  selectMountain,
  startPlannedClimb,
  updateExpeditionPlan,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import type { CareerState, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'ALPINE-1907', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };

function organizationCareer() {
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Test Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offer = availableExpeditionOffers(world, career)[0]!;
  career = acceptExpeditionOffer(world, career, offer.id);
  return { world, career };
}

function commandCareer() {
  const world = generateWorld(config);
  let career = createCareer(world, { name: 'Test Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT', organizationId: null });
  career = updateExpeditionPlan(career, {
    teamMemberIds: career.teamRoster.slice(0, 3).map(member => member.id),
    playerRole: 'LEADER',
    authorityMode: 'COMMAND',
  });
  return { world, career };
}

function advanceExpedition(career: CareerState) {
  for (let guard = 0; guard < 80; guard += 1) {
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

function moveUntilDecision(career: CareerState) {
  for (let guard = 0; guard < 8; guard += 1) {
    const decision = getCurrentRouteDecision(career);
    if (decision) return { career, decision };
    if (!career.activeClimb || career.activeClimb.phase !== 'ASCENT') break;
    career = resolveClimbStep(career, 'CAUTIOUS').career;
  }
  return { career, decision: getCurrentRouteDecision(career) };
}

describe('career and expedition module', () => {
  it('creates a normalized novice career without a private team', () => {
    const world = generateWorld(config);
    const organization = getEntryOrganizations(world)[0]!;
    const career = createCareer(world, { name: 'Test Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
    expect(career.worldId).toBe(world.id);
    expect(career.schemaVersion).toBe(11);
    expect(career.membership.rank).toBe('NOVICE');
    expect(career.membership.permissions.canChooseRoute).toBe(false);
    expect(career.expeditionPlan.teamMemberIds).toEqual([]);
    expect(career.routes).toHaveLength(world.region.mountains.length * 3);
    expect(career.teamRoster.length).toBeGreaterThanOrEqual(10);
    expect(career.weatherWindows).toHaveLength(3);
    expect(career.livingWorld.athletes.length).toBe(world.ecosystem.content.npcs.allIds.length);
  });

  it('lets an independent climber choose any generated mountain', () => {
    const { world, career } = commandCareer();
    const target = world.region.mountains.at(-1)!;
    const changed = selectMountain(career, target.id);
    expect(getSelectedRoute(changed).mountainId).toBe(target.id);
    expect(changed.routes.filter(route => route.mountainId === target.id)).toHaveLength(3);
  });

  it('makes a novice accept an NPC-led expedition before launch', () => {
    const { career } = organizationCareer();
    const readiness = expeditionReadiness(career);
    expect(career.selectedOfferId).toBeTruthy();
    expect(career.expeditionPlan.leaderNpcId).toBeTruthy();
    expect(career.expeditionPlan.authorityMode).toBe('PARTICIPANT');
    expect(readiness.blockers).toEqual([]);
    expect(readiness.total).toBeGreaterThanOrEqual(54);
  });

  it('builds a valid equipment preset for the selected route', () => {
    const { career } = organizationCareer();
    const packed = applyEquipmentPreset(career, 'RECOMMENDED');
    expect(expeditionReadiness(packed).blockers.some(item => item.includes('снаряжения'))).toBe(false);
  });

  it('keeps the same action reproducible for equal state and pace', () => {
    const { career } = organizationCareer();
    const started = startPlannedClimb(career);
    const first = resolveClimbStep(started, 'STEADY');
    const second = resolveClimbStep(started, 'STEADY');
    expect(first.career.activeClimb).toEqual(second.career.activeClimb);
  });

  it('requires a descent after reaching the summit', () => {
    let { career } = organizationCareer();
    career = startPlannedClimb(career);
    for (let step = 0; step < 40 && career.activeClimb?.phase === 'ASCENT'; step += 1) {
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

  it('can complete a prepared NPC-led expedition', () => {
    const { career } = organizationCareer();
    const finished = advanceExpedition(startPlannedClimb(career));
    expect(['COMPLETE', 'FAILED']).toContain(finished.activeClimb?.phase);
    expect(finished.activeClimb?.moveCount).toBeGreaterThan(0);
  });

  it('previews time, resource cost and risk before a climb action', () => {
    const { career } = organizationCareer();
    const started = startPlannedClimb(career);
    const cautious = previewClimbAction(started, 'CAUTIOUS')!;
    const fast = previewClimbAction(started, 'FAST')!;
    expect(cautious.durationMinutes).toBeGreaterThan(fast.durationMinutes);
    expect(cautious.incidentRisk).toBeLessThan(fast.incidentRisk);
    expect(fast.energyCost).toBeGreaterThan(cautious.energyCost);
  });

  it('explains the selected mountain character in preparation', () => {
    const { career } = organizationCareer();
    const insights = preparationInsights(career);
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights[0]?.title).toContain('гора');
  });

  it('creates organization contacts with personality, relationships and memory', () => {
    const { career } = organizationCareer();
    const member = career.teamRoster[0]!;
    expect(member.personality.discipline).toBeGreaterThan(0);
    expect(member.relationship.trust).toBe(member.trust);
    expect(member.memories[0]?.type).toBe('FIRST_MEETING');
  });

  it('blocks group orders for an ordinary participant', () => {
    const { career } = organizationCareer();
    const started = startPlannedClimb(career);
    const result = issueClimbOrder(started, 'SLOW_DOWN');
    expect(result.headline).toBe('Ты не руководитель');
    expect(result.career.activeClimb?.decisions).toEqual([]);
  });

  it('keeps the command engine available to a leader', () => {
    const { career } = commandCareer();
    const started = startPlannedClimb(career);
    const result = issueClimbOrder(started, 'SLOW_DOWN');
    expect(result.career.activeClimb?.decisions).toHaveLength(1);
    expect(result.career.activeClimb?.elapsedMinutes).toBeGreaterThan(0);
  });

  it('gives routes a graph, route choices and a separate descent line', () => {
    const { career } = commandCareer();
    const route = getSelectedRoute(career);
    expect(route.graph?.nodes.length).toBeGreaterThan(route.segments.length);
    expect(route.expectedPlayMinutes).toBeGreaterThanOrEqual(20);
    expect(route.decisions?.length).toBeGreaterThanOrEqual(2);
    expect(route.descentSegments).toBeDefined();
    expect(route.descentSegments).not.toEqual(route.segments);
  });

  it('records a route choice and can leave a cache for descent', () => {
    let { career } = commandCareer();
    career = startPlannedClimb(career);
    expect(career.activeClimb!.route[0]!.campPossible).toBe(true);
    career = leaveCache(career).career;
    expect(career.activeClimb?.caches).toHaveLength(1);
    const moved = moveUntilDecision(career);
    expect(moved.decision).toBeTruthy();
    career = chooseRouteDecision(moved.career, moved.decision!.options[0]!.id).career;
    expect(career.activeClimb?.routeChoices).toHaveLength(1);
  });

  it('can spend rope to protect a technical segment', () => {
    let { career } = commandCareer();
    career = startPlannedClimb(career);
    const moved = moveUntilDecision(career);
    if (moved.decision) career = chooseRouteDecision(moved.career, moved.decision.options[0]!.id).career;
    for (let guard = 0; guard < 4 && career.activeClimb?.phase === 'ASCENT'; guard += 1) {
      const segment = career.activeClimb.route[career.activeClimb.segmentIndex]!;
      if (segment.exposure >= 38 || segment.difficulty >= 48) break;
      career = resolveClimbStep(career, 'CAUTIOUS').career;
    }
    const before = career.activeClimb!.ropeMetersRemaining;
    const result = fixRope(career);
    if (result.severity === 'SUCCESS') expect(result.career.activeClimb!.ropeMetersRemaining).toBe(before - 20);
    else expect(['Закрепление не требуется', 'Верёвка недоступна']).toContain(result.headline);
  });

  it('writes a playtest snapshot after a finished expedition', () => {
    const { career } = organizationCareer();
    const finished = advanceExpedition(startPlannedClimb(career));
    if (finished.reports.length) {
      const report = finished.reports.at(-1)!;
      expect(report.playtest?.seed).toBe(config.seed);
      expect(report.playtest?.difficulty).toBe(config.difficulty);
      expect(report.playtest?.actionCount).toBeGreaterThan(0);
      expect(report.playtest?.teamSize).toBeGreaterThanOrEqual(1);
    }
  });
});
