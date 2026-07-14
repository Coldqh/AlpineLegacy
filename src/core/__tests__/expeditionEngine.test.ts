import { describe, expect, it } from 'vitest';
import {
  applyToExpeditionOffer,
  availableExpeditionOffers,
  closeClimb,
  createCareer,
  resolveParticipantAction,
  startPlannedClimb,
} from '../career';
import { getCurrentParticipantScene } from '../expeditionEngine';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import type { CareerState, ParticipantSceneOption } from '../types';

const config = { seed: 'PARTICIPANT-062', eraId: 'EXPEDITION' as const, startYear: 1968, difficulty: 'EXPLORER' as const };

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

  it('starts with a long graph of personal decisions and NPC orders', () => {
    const { career } = acceptedCareer();
    const started = startPlannedClimb(career);
    expect(started.activeClimb?.participant).toBeTruthy();
    expect(started.activeClimb?.participant?.targetActions).toBeGreaterThanOrEqual(25);
    const scene = getCurrentParticipantScene(started);
    expect(scene?.options.length).toBeGreaterThanOrEqual(3);
    expect(scene?.leaderNpcId).toBeTruthy();
  });

  it('records personal choices and produces a leader evaluation', () => {
    const { career } = acceptedCareer();
    let current: CareerState = startPlannedClimb(career);
    for (let step = 0; step < 180 && current.activeClimb; step += 1) {
      const climb = current.activeClimb;
      if (['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) break;
      const scene = getCurrentParticipantScene(current);
      if (!scene) break;
      current = resolveParticipantAction(current, safestOption(scene.options).id).career;
    }
    expect(current.activeClimb?.participant?.totalActions ?? 0).toBeGreaterThanOrEqual(20);
    if (current.activeClimb && ['FAILED', 'RETREATED'].includes(current.activeClimb.phase)) current = closeClimb(current);
    const report = current.reports[current.reports.length - 1];
    expect(report).toBeTruthy();
    expect(report?.participantEvaluation).toBeTruthy();
    expect(report?.participantEvaluation?.rankPoints).toBeGreaterThan(0);
  });
});
