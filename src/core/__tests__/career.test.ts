import { describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  applyEquipmentPreset,
  availableExpeditionOffers,
  beginDescent,
  chooseRouteDecision,
  createCareer,
  closeClimb,
  currentExpeditionStage,
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
  previewExpeditionActions,
  resolveClimbStep,
  resolveExpeditionFieldAction,
  selectMountain,
  startPlannedClimb,
  updateExpeditionPlan,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { autoplayExpedition } from '../playtest';
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
  return autoplayExpedition(career);
}


describe('career and expedition module', () => {
  it('creates a normalized novice career without a private team', () => {
    const world = generateWorld(config);
    const organization = getEntryOrganizations(world)[0]!;
    const career = createCareer(world, { name: 'Test Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
    expect(career.worldId).toBe(world.id);
    expect(career.schemaVersion).toBe(21);
    expect(career.membership.rank).toBe('NOVICE');
    expect(career.membership.permissions.canChooseRoute).toBe(false);
    expect(career.expeditionPlan.teamMemberIds).toEqual([]);
    expect(career.routes).toHaveLength(world.ecosystem.content.routes.allIds.length);
    expect(career.currentRegionId).toBe(world.ecosystem.content.primaryRegionId);
    expect(career.unlockedRegionIds).toContain(career.currentRegionId);
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

  it('requires a physical descent after reaching the summit', () => {
    let { career } = organizationCareer();
    career = startPlannedClimb(career);
    const climb = career.activeClimb!;
    const simulation = climb.simulation!;
    career = {
      ...career,
      activeClimb: {
        ...climb,
        phase: 'SUMMIT',
        summitReached: true,
        currentElevation: climb.summitElevation,
        simulation: {
          ...simulation,
          status: 'SUMMIT',
          stageIndex: simulation.ascentStages.length,
          relativeElevation: simulation.maxRelativeElevation,
          highestRelativeElevation: simulation.maxRelativeElevation,
        },
      },
    };
    expect(career.completedClimbs).toBe(0);
    career = beginDescent(career);
    expect(career.activeClimb?.phase).toBe('DESCENT');
    expect(career.activeClimb?.simulation?.direction).toBe('DESCENT');
  });

  it('can complete a prepared NPC-led expedition', () => {
    const { career } = organizationCareer();
    const finished = advanceExpedition(startPlannedClimb(career));
    expect(['COMPLETE', 'RETREATED', 'FAILED']).toContain(finished.activeClimb?.phase);
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

  it('uses preparation actions before physical movement', () => {
    let { career } = organizationCareer();
    career = startPlannedClimb(career);
    const before = currentExpeditionStage(career)!;
    career = resolveExpeditionFieldAction(career, 'SCOUT_LINE').career;
    const prepared = currentExpeditionStage(career)!;
    expect(prepared.preparation).toBeGreaterThan(before.preparation);
    const progressBefore = prepared.progress;
    career = resolveExpeditionFieldAction(career, 'MOVE_CAUTIOUS').career;
    expect(currentExpeditionStage(career)?.progress ?? 0).toBeGreaterThanOrEqual(progressBefore);
  });

  it('can spend rope to protect a critical physical stage', () => {
    let { career } = organizationCareer();
    career = startPlannedClimb(career);
    const climb = career.activeClimb!;
    const simulation = climb.simulation!;
    const criticalIndex = simulation.ascentStages.findIndex(stage => stage.critical);
    expect(criticalIndex).toBeGreaterThanOrEqual(0);
    career = {
      ...career,
      activeClimb: {
        ...climb,
        simulation: { ...simulation, stageIndex: criticalIndex, activeEvent: null, leaderOrder: null },
      },
    };
    const before = career.activeClimb!.ropeMetersRemaining;
    const action = previewExpeditionActions(career).find(item => item.id === 'FIX_ROPE')!;
    expect(action.disabled).toBe(false);
    career = resolveExpeditionFieldAction(career, 'FIX_ROPE').career;
    expect(career.activeClimb!.ropeMetersRemaining).toBe(before - 20);
    expect(currentExpeditionStage(career)!.preparation).toBeGreaterThan(0);
  });

  it('writes a playtest snapshot after a finished expedition', () => {
    const { career } = organizationCareer();
    let finished = advanceExpedition(startPlannedClimb(career));
    if (finished.activeClimb && ['COMPLETE', 'RETREATED', 'FAILED'].includes(finished.activeClimb.phase)) finished = closeClimb(finished);
    if (finished.reports.length) {
      const report = finished.reports.at(-1)!;
      expect(report.playtest?.seed).toBe(config.seed);
      expect(report.playtest?.difficulty).toBe(config.difficulty);
      expect(report.playtest?.actionCount).toBeGreaterThan(0);
      expect(report.playtest?.teamSize).toBeGreaterThanOrEqual(1);
    }
  });
});
