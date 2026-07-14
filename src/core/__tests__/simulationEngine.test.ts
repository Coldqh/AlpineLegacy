import { describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  availableExpeditionOffers,
  createCareer,
  currentExpeditionStage,
  previewExpeditionActions,
  resolveExpeditionFieldAction,
  resolveParticipantAction,
  startPlannedClimb,
} from '../career';
import { createExpeditionSimulation } from '../simulationEngine';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';

function startedCareer(seed = 'SIM-063') {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'EXPLORER' });
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Field Tester', age: 20, originId: 'ROCK_SECTION', entryMode: 'ORGANIZATION', organizationId: organization.id });
  career = acceptExpeditionOffer(world, career, availableExpeditionOffers(world, career)[0]!.id);
  return { world, career: startPlannedClimb(career) };
}

describe('physical expedition simulation', () => {
  it('starts at relative altitude zero and gives taller routes more stages', () => {
    const { world, career } = startedCareer();
    expect(career.activeClimb?.simulation?.relativeElevation).toBe(0);
    expect(career.activeClimb?.currentElevation).toBe(career.activeClimb?.startElevation);
    expect(career.activeClimb?.startElevation).toBeGreaterThanOrEqual(0);
    expect(career.activeClimb?.startElevation).toBeLessThanOrEqual(1000);
    expect((career.activeClimb?.summitElevation ?? 0) - (career.activeClimb?.startElevation ?? 0)).toBeGreaterThan(1000);
    const routes = [...world.ecosystem.content.routes.allIds]
      .map(id => world.ecosystem.content.routes.byId[id]!)
      .sort((a, b) => (a.summitElevation - a.startElevation) - (b.summitElevation - b.startElevation));
    const low = createExpeditionSimulation(routes[0]!);
    const high = createExpeditionSimulation(routes.at(-1)!);
    expect(high.ascentStages.length + high.descentStages.length).toBeGreaterThan(low.ascentStages.length + low.descentStages.length);
  });

  it('turns scouting, anchors and movement into separate physical actions', () => {
    let { career } = startedCareer('SIM-ACTIONS');
    const initial = currentExpeditionStage(career)!;
    career = resolveExpeditionFieldAction(career, 'SCOUT_LINE').career;
    expect(currentExpeditionStage(career)!.routeKnowledge).toBeGreaterThan(initial.routeKnowledge);
    const beforeProgress = currentExpeditionStage(career)!.progress;
    career = resolveExpeditionFieldAction(career, 'MOVE_CAUTIOUS').career;
    expect(currentExpeditionStage(career)!.progress).toBeGreaterThan(beforeProgress);
    expect(career.activeClimb!.moveCount).toBe(1);
  });

  it('requires multi-action preparation on a critical stage', () => {
    let { career } = startedCareer('SIM-CRITICAL');
    const climb = career.activeClimb!;
    const simulation = climb.simulation!;
    const criticalIndex = simulation.ascentStages.findIndex(stage => stage.critical);
    career = {
      ...career,
      activeClimb: { ...climb, simulation: { ...simulation, stageIndex: criticalIndex, activeEvent: null, leaderOrder: null } },
    };
    const before = currentExpeditionStage(career)!;
    const rope = previewExpeditionActions(career).find(action => action.id === 'FIX_ROPE')!;
    expect(rope.disabled).toBe(false);
    career = resolveExpeditionFieldAction(career, 'FIX_ROPE').career;
    expect(career.activeClimb!.ropeMetersRemaining).toBe(climb.ropeMetersRemaining - 20);
    expect(currentExpeditionStage(career)!.preparation).toBeGreaterThan(before.preparation);
  });

  it('changes a failed ascent into a real descent instead of returning home instantly', () => {
    let { career } = startedCareer('SIM-RETREAT');
    for (let step = 0; step < 8; step += 1) {
      if (career.activeClimb?.simulation?.activeEvent) break;
      career = resolveExpeditionFieldAction(career, 'MOVE_CAUTIOUS').career;
    }
    if (career.activeClimb?.simulation?.activeEvent) {
      const event = career.activeClimb.simulation.activeEvent;
      const option = event.options[0]!;
      career = resolveParticipantAction(career, option.id).career;
    }
    career = resolveExpeditionFieldAction(career, 'TURN_BACK').career;
    expect(career.activeClimb?.phase).toBe('DESCENT');
    expect(career.activeClimb?.simulation?.direction).toBe('DESCENT');
    expect(career.activeClimb?.simulation?.status).not.toBe('SAFE');
    expect(career.activeClimb?.currentElevation).toBeGreaterThanOrEqual(career.activeClimb?.startElevation ?? 0);
  });

  it('does not teleport an exhausted player home', () => {
    let { career } = startedCareer('SIM-STRANDED');
    const climb = career.activeClimb!;
    career = {
      ...career,
      activeClimb: { ...climb, energy: 0, condition: 25, simulation: { ...climb.simulation!, status: 'STRANDED', forcedRetreat: true } },
    };
    const rest = resolveExpeditionFieldAction(career, 'REST_SHORT');
    expect(rest.career.activeClimb?.phase).not.toBe('COMPLETE');
    expect(rest.career.activeClimb?.currentElevation).toBeGreaterThanOrEqual(rest.career.activeClimb?.startElevation ?? 0);
    expect(rest.career.activeClimb?.energy).toBeGreaterThan(0);
  });
});
