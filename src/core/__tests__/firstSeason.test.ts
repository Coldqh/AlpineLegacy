import { describe, expect, it } from 'vitest';
import { acceptExpeditionOffer, availableExpeditionOffers, createCareer, startPlannedClimb } from '../career';
import { advanceFirstSeasonAfterExpedition, firstSeasonObjective, normalizeFirstSeasonState } from '../firstSeason';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { buildSchoolExpeditionBoard } from '../schoolExpeditions';
import type { ExpeditionReport, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'FIRST-SEASON-1968', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };

function fixture() {
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  const career = createCareer(world, { name: 'Season Tester', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  return { world, career };
}

function reportFor(career: ReturnType<typeof fixture>['career'], outcome: ExpeditionReport['outcome'] = 'SUMMIT'): ExpeditionReport {
  const route = career.routes.find(item => item.id === career.expeditionPlan.routeId)!;
  return {
    id: `report-${career.year}-${career.seasonDay}`,
    year: career.year,
    seasonDay: career.seasonDay,
    mountainName: route.mountainName,
    routeName: route.name,
    outcome,
    highestElevation: outcome === 'SUMMIT' ? route.summitElevation : route.startElevation + 500,
    elapsedMinutes: 900,
    teamMemberIds: career.expeditionPlan.teamMemberIds,
    casualties: [],
    injuries: [],
    decisions: [],
    clubReaction: 'Разбор завершён.',
    pressReaction: 'Школа отметила результат.',
    reputationDelta: 4,
    moneyDelta: 0,
    purpose: career.activeClimb?.purpose ?? 'TRAINING',
  };
}

describe('first full season journey', () => {
  it('starts with a mentor, rival, finale and one clear objective', () => {
    const { career } = fixture();
    const state = normalizeFirstSeasonState(career);
    const objective = firstSeasonObjective(career);
    expect(career.schemaVersion).toBe(22);
    expect(state.stage).toBe('FIRST_OUTING');
    expect(state.mentorNpcId).toBeTruthy();
    expect(state.rivalNpcId).toBeTruthy();
    expect(state.finaleRouteId).toBeTruthy();
    expect(objective.step).toBe(1);
    expect(objective.title).toContain('учебный');
  });

  it('labels the first school plans as real expedition purposes', () => {
    const { world, career } = fixture();
    const board = buildSchoolExpeditionBoard(world, career);
    expect(board.length).toBeGreaterThan(2);
    expect(board.some(offer => offer.purpose === 'TRAINING')).toBe(true);
    expect(board.every(offer => Boolean(offer.purposeLabel))).toBe(true);
  });

  it('moves from first outing to recovery and records the mentor debrief', () => {
    const { world, career: source } = fixture();
    const offer = availableExpeditionOffers(world, source)[0]!;
    const accepted = acceptExpeditionOffer(world, source, offer.id);
    const started = startPlannedClimb(accepted);
    const climb = started.activeClimb!;
    const report = reportFor(started, 'RETREAT');
    const advanced = advanceFirstSeasonAfterExpedition({ ...started, recoveryDays: 6, reports: [...started.reports, report] }, climb, report);
    expect(advanced.firstSeason.stage).toBe('RECOVERY');
    expect(advanced.firstSeason.debriefs).toHaveLength(1);
    expect(advanced.firstSeason.mentorScore).toBeGreaterThan(0);
    expect(advanced.firstSeason.rivalScore).toBeGreaterThan(0);
  });

  it('creates a featured finale plan once the skill test is complete', () => {
    const { world, career } = fixture();
    const staged = {
      ...career,
      membership: { ...career.membership, rank: 'SPECIALIST' as const, rankPoints: 20 },
      firstSeason: { ...career.firstSeason, stage: 'FINALE' as const, stageStartedDay: career.seasonDay },
    };
    const finale = buildSchoolExpeditionBoard(world, staged).find(offer => offer.featured);
    expect(finale?.purpose).toBe('FINALE');
    expect(finale?.routeId).toBe(staged.firstSeason.finaleRouteId);
    expect(finale?.requiredRank).toBe('SPECIALIST');
  });
});
