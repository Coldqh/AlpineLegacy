import { describe, expect, it } from 'vitest';
import { createCareer } from '../career';
import { generateWorld } from '../generator';
import { auditCareerForRelease, releaseSafeCareerTab, repairCareerForRelease } from '../releaseCandidate';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'RC-2000', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };

function careerFixture() {
  const world = generateWorld(config);
  const organization = world.ecosystem.content.organizations.byId[world.ecosystem.content.organizations.allIds[0]!]!;
  const career = createCareer(world, {
    name: 'Release Tester',
    age: 20,
    originId: 'CLUB_SCHOOL',
    entryMode: 'ORGANIZATION',
    organizationId: organization.id,
  });
  return { world, career };
}

describe('0.20.0 release candidate safeguards', () => {
  it('repairs stale routes, duplicate team ids and broken numeric values', () => {
    const { world, career } = careerFixture();
    const memberId = career.teamRoster[0]!.id;
    const broken = {
      ...career,
      currentRegionId: 'missing-region',
      hero: { ...career.hero, health: Number.NaN, fatigue: 900 },
      expeditionPlan: { ...career.expeditionPlan, routeId: 'missing-route', teamMemberIds: [memberId, memberId, 'ghost'] },
      permanentTeam: { ...career.permanentTeam, memberIds: [memberId, memberId, 'ghost'] },
      knownNpcIds: [memberId, memberId],
    };
    const repaired = repairCareerForRelease(world, broken);
    expect(repaired.repairs.length).toBeGreaterThanOrEqual(3);
    expect(repaired.career.currentRegionId).toBe(world.ecosystem.content.primaryRegionId);
    expect(repaired.career.routes.some(route => route.id === repaired.career.expeditionPlan.routeId)).toBe(true);
    expect(repaired.career.expeditionPlan.teamMemberIds).toEqual([memberId]);
    expect(repaired.career.permanentTeam.memberIds).toEqual([memberId]);
    expect(repaired.career.hero.health).toBe(100);
    expect(repaired.career.hero.fatigue).toBe(100);
    expect(auditCareerForRelease(world, repaired.career).valid).toBe(true);
  });

  it('clears a resolved school plan that survived a stale save', () => {
    const { world, career } = careerFixture();
    const fakeOffer = {
      id: 'resolved-offer', organizationId: career.membership.organizationId, routeId: career.routes[0]!.id,
      leaderNpcId: career.teamRoster[0]!.id, memberNpcIds: career.teamRoster.slice(1, 3).map(item => item.id),
      playerRole: 'SUPPORT' as const, requiredRank: 'NOVICE' as const, authority: 'PARTICIPANT' as const,
      solo: false, status: 'CLOSED' as const, opensOnDay: 1, expiresOnDay: 20, departureDay: 10,
      expectedReturnDay: 16, scheduleStatus: 'ON_TIME' as const,
    };
    const stale = { ...career, seasonDay: 24, selectedOfferId: fakeOffer.id, acceptedOffer: fakeOffer, resolvedSchoolOfferIds: [fakeOffer.id] };
    const repaired = repairCareerForRelease(world, stale);
    expect(repaired.career.selectedOfferId).toBeNull();
    expect(repaired.career.acceptedOffer).toBeNull();
  });

  it('never restores the climb tab without an active expedition', () => {
    const { career } = careerFixture();
    expect(releaseSafeCareerTab(career, 'CLIMB')).toBe('OVERVIEW');
    const withClimb = { ...career, activeClimb: { routeId: career.routes[0]!.id } as typeof career.activeClimb };
    expect(releaseSafeCareerTab(withClimb, 'NEWS')).toBe('CLIMB');
  });
});
