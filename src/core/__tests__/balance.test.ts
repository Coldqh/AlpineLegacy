import { describe, expect, it } from 'vitest';
import { acceptExpeditionOffer, availableExpeditionOffers, beginDescent, chooseRouteDecision, createCareer, establishCamp, getCurrentRouteDecision, meltSnow, resolveClimbStep, resolveParticipantAction, startPlannedClimb } from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { getCurrentParticipantScene } from '../expeditionEngine';
import { generateWorld } from '../generator';
import type { CareerState, OriginId, ParticipantSceneOption } from '../types';

function safestParticipantOption(options: ParticipantSceneOption[]) {
  const order = ['CARE', 'OBEY', 'QUESTION', 'INITIATIVE', 'REFUSE'] as const;
  return [...options].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))[0]!;
}

function simulate(seed: string, originId: OriginId) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  const organization = getEntryOrganizations(world)[0]!;
  let career: CareerState = createCareer(world, { name: 'Balance Test', age: 20, originId, entryMode: 'ORGANIZATION', organizationId: organization.id });
  career = startPlannedClimb(acceptExpeditionOffer(world, career, availableExpeditionOffers(world, career)[0]!.id));
  for (let guard = 0; guard < 180; guard += 1) {
    const climb = career.activeClimb;
    if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) return climb?.phase;
    if (climb.participant) {
      const scene = getCurrentParticipantScene(career);
      if (!scene) return climb.phase;
      career = resolveParticipantAction(career, safestParticipantOption(scene.options).id).career;
      continue;
    }
    if (climb.phase === 'SUMMIT') { career = beginDescent(career); continue; }
    const decision = getCurrentRouteDecision(career);
    if (decision) {
      const option = decision.options.find(item => item.tone === 'SAFE' && (!item.requiresRopeMeters || climb.ropeMetersRemaining >= item.requiresRopeMeters)) ?? decision.options[0]!;
      career = chooseRouteDecision(career, option.id).career;
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
