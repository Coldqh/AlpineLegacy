import { describe, expect, it } from 'vitest';
import {
  applyEquipmentPreset,
  applyToExpeditionOffer,
  createCareer,
  expeditionReadiness,
  saveCurrentAsPermanentTeam,
  schoolExpeditionBoard,
  setPermanentTeamStyle,
  startPlannedClimb,
  waitForSchoolDeparture,
  closeClimb,
  updateExpeditionPlan,
  usePermanentTeam,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { schoolExpeditionPhase } from '../schoolExpeditions';
import type { CareerState, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'SCHOOL-CIRCUIT-15', eraId: 'EXPEDITION', startYear: 1972, difficulty: 'CLIMBER' };

function organizationCareer() {
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  const career = createCareer(world, { name: 'Board Tester', age: 22, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  return { world, organization, career };
}

describe('rotating school expeditions and permanent teams', () => {
  it('keeps several instructor plans alive inside every school', () => {
    const { world, organization, career } = organizationCareer();
    const board = schoolExpeditionBoard(world, career, true);
    const own = board.filter(item => item.organizationId === organization.id);
    expect(own.length).toBeGreaterThanOrEqual(6);
    expect(new Set(own.map(item => item.leaderNpcId)).size).toBe(3);
    expect(own.some(item => item.planSeries === 1)).toBe(true);
    expect(new Set(own.map(item => item.routeId)).size).toBeGreaterThan(1);
    expect(own.some(item => schoolExpeditionPhase(item, career.seasonDay) === 'RECRUITING')).toBe(true);
  });

  it('moves a plan through recruitment, preparation and departure as days pass', () => {
    const { world, career } = organizationCareer();
    const offer = schoolExpeditionBoard(world, career)[0]!;
    const departure = offer.departureDay!;
    expect(['ANNOUNCED', 'RECRUITING']).toContain(schoolExpeditionPhase(offer, career.seasonDay));
    expect(schoolExpeditionPhase(offer, offer.recruitmentClosesDay! + 1)).toBe('PREPARING');
    expect(['WEATHER_HOLD', 'DEPARTING']).toContain(schoolExpeditionPhase(offer, departure - 2));
    expect(schoolExpeditionPhase(offer, departure)).toBe('DEPARTING');
  });

  it('stores the accepted school plan and makes the player wait for its departure', () => {
    const { world, career } = organizationCareer();
    const offer = schoolExpeditionBoard(world, career).find(item => ['ANNOUNCED', 'RECRUITING'].includes(schoolExpeditionPhase(item, career.seasonDay)))!;
    const accepted = applyToExpeditionOffer(world, career, offer.id);
    expect(accepted.acceptedOffer?.id).toBe(offer.id);
    expect(accepted.expeditionPlan.leaderNpcId).toBe(offer.leaderNpcId);
    expect(expeditionReadiness(accepted).blockers.some(item => item.includes('До выхода'))).toBe(true);
    expect(startPlannedClimb(accepted).activeClimb).toBeNull();
  });

  it('saves a recurring rope team and uses its style in the expedition engine', () => {
    const world = generateWorld({ ...config, seed: 'PERMANENT-ROPE-TEAM' });
    let career = createCareer(world, { name: 'Team Tester', age: 24, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT', organizationId: null });
    career = {
      ...career,
      membership: { ...career.membership, rank: 'LEADER', permissions: { ...career.membership.permissions, canChooseTeam: true } },
    } as CareerState;
    const ids = career.teamRoster.slice(0, 3).map(member => member.id);
    career = updateExpeditionPlan(career, { teamMemberIds: ids, acclimatizationDays: 5 });
    career = saveCurrentAsPermanentTeam(career);
    career = setPermanentTeamStyle(career, 'CAUTIOUS');
    career = updateExpeditionPlan(career, { teamMemberIds: [] });
    career = usePermanentTeam(career);
    career = applyEquipmentPreset(career, 'RECOMMENDED');
    career = startPlannedClimb(career);
    expect(career.permanentTeam.memberIds).toEqual(ids);
    expect(career.activeClimb?.topo?.pace).toBe('CAUTIOUS');
  });

  it('waits to the accepted departure and starts the expedition', () => {
    const { world, career } = organizationCareer();
    const offer = schoolExpeditionBoard(world, career).find(item => ['ANNOUNCED', 'RECRUITING'].includes(schoolExpeditionPhase(item, career.seasonDay)))!;
    let accepted = applyToExpeditionOffer(world, career, offer.id);
    accepted = applyEquipmentPreset(accepted, 'RECOMMENDED');
    const started = waitForSchoolDeparture(world, accepted);
    expect(started.seasonDay).toBeGreaterThanOrEqual(offer.departureDay!);
    expect(started.activeClimb).toBeTruthy();
    expect(started.activeClimb?.expeditionOfferId).toBe(offer.id);
  });

  it('removes a resolved school plan after retreat', () => {
    const { world, career } = organizationCareer();
    const offer = schoolExpeditionBoard(world, career).find(item => ['ANNOUNCED', 'RECRUITING'].includes(schoolExpeditionPhase(item, career.seasonDay)))!;
    let accepted = applyToExpeditionOffer(world, career, offer.id);
    accepted = applyEquipmentPreset(accepted, 'RECOMMENDED');
    const started = waitForSchoolDeparture(world, accepted);
    expect(started.activeClimb).toBeTruthy();
    const retreated = { ...started, activeClimb: { ...started.activeClimb!, phase: 'RETREATED' as const, retreating: true } };
    const closed = closeClimb(retreated);
    expect(closed.resolvedSchoolOfferIds).toContain(offer.id);
    expect(schoolExpeditionBoard(world, closed).some(item => item.id === offer.id)).toBe(false);
  });

  it('does not place the same ordinary NPC into overlapping school programs', () => {
    const { world, career } = organizationCareer();
    const board = schoolExpeditionBoard(world, career, true)
      .filter(item => !['CANCELLED', 'RECOVERING'].includes(schoolExpeditionPhase(item, career.seasonDay)));
    const assignments = new Map<string, string[]>();
    for (const offer of board) {
      for (const memberId of offer.memberNpcIds) {
        assignments.set(memberId, [...(assignments.get(memberId) ?? []), offer.id]);
      }
    }
    expect([...assignments.values()].every(ids => ids.length === 1)).toBe(true);
  });

});
