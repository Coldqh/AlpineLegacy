import { describe, expect, it } from 'vitest';
import {
  applyToExpeditionOffer,
  availableExpeditionOffers,
  closeClimb,
  createCareer,
  currentExpeditionStage,
  previewExpeditionActions,
  resolveExpeditionFieldAction,
  resolveParticipantAction,
  startPlannedClimb,
} from '../career';
import { getCurrentParticipantScene } from '../expeditionEngine';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { autoplayExpedition } from '../playtest';
import type { CareerState, ParticipantSceneOption } from '../types';

const config = { seed: 'PARTICIPANT-063', eraId: 'EXPEDITION' as const, startYear: 1968, difficulty: 'EXPLORER' as const };

function acceptedCareer() {
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Участник', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  for (const offer of availableExpeditionOffers(world, career)) {
    career = applyToExpeditionOffer(world, career, offer.id);
    if (career.selectedOfferId) break;
  }
  return { world, career };
}

function safestOption(options: ParticipantSceneOption[]) {
  const order = ['CARE', 'OBEY', 'QUESTION', 'INITIATIVE', 'REFUSE'] as const;
  return [...options].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))[0]!;
}

describe('playable participant expedition', () => {
  it('uses a real application result before assigning the player to a team', () => {
    const { career } = acceptedCareer();
    expect(career.applications.length).toBeGreaterThan(0);
    expect(career.applications.some(item => item.status === 'ACCEPTED')).toBe(true);
    expect(career.selectedOfferId).toBeTruthy();
    expect(career.expeditionPlan.authorityMode).toBe('PARTICIPANT');
    expect(career.expeditionPlan.leaderNpcId).toBeTruthy();
  });

  it('starts at relative zero with a long physical route and field actions', () => {
    const { career } = acceptedCareer();
    const started = startPlannedClimb(career);
    const simulation = started.activeClimb?.simulation;
    expect(started.activeClimb?.participant).toBeTruthy();
    expect(simulation?.relativeElevation).toBe(0);
    expect((simulation?.ascentStages.length ?? 0) + (simulation?.descentStages.length ?? 0)).toBeGreaterThanOrEqual(30);
    expect(currentExpeditionStage(started)?.phase).toBe('APPROACH');
    const actionIds = previewExpeditionActions(started).map(action => action.id);
    expect(actionIds.length).toBeGreaterThanOrEqual(2);
    expect(actionIds.length).toBeLessThanOrEqual(6);
    expect(actionIds).toContain('MOVE_STEADY');
    expect(actionIds).not.toContain('FIX_ROPE');
    expect(actionIds).not.toContain('MAKE_CAMP');
  });

  it('triggers personal events on top of movement instead of replacing it', () => {
    const { career } = acceptedCareer();
    let current: CareerState = startPlannedClimb(career);
    for (let step = 0; step < 30 && !getCurrentParticipantScene(current); step += 1) {
      const action = previewExpeditionActions(current).find(item => !item.disabled);
      if (!action) break;
      current = resolveExpeditionFieldAction(current, action.id).career;
    }
    const scene = getCurrentParticipantScene(current);
    expect(scene?.options.length).toBeGreaterThanOrEqual(3);
    expect(scene?.leaderNpcId).toBeTruthy();
    const beforeMoves = current.activeClimb?.moveCount ?? 0;
    current = resolveParticipantAction(current, safestOption(scene!.options).id).career;
    expect(current.activeClimb?.moveCount).toBe(beforeMoves);
    expect(currentExpeditionStage(current)).toBeTruthy();
  });

  it('records a long physical expedition and produces a leader evaluation after return or evacuation', () => {
    const { career } = acceptedCareer();
    let current = autoplayExpedition(startPlannedClimb(career));
    expect(['COMPLETE', 'RETREATED', 'FAILED']).toContain(current.activeClimb?.phase);
    expect(current.activeClimb?.moveCount ?? 0).toBeGreaterThanOrEqual(30);
    expect(current.activeClimb?.participant?.totalActions ?? 0).toBeGreaterThanOrEqual(25);
    current = closeClimb(current);
    const report = current.reports.at(-1);
    expect(report).toBeTruthy();
    expect(report?.participantEvaluation).toBeTruthy();
    expect(report?.participantEvaluation?.rankPoints).toBeGreaterThanOrEqual(0);
  });
});
