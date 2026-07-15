import { describe, expect, it } from 'vitest';
import { applyTraining, createCareer, expeditionReadiness } from '../career';
import { generateWorld } from '../generator';
import { syncCareerProgression } from '../progression';
import type { ExpeditionReport } from '../types';

function careerFixture() {
  const world = generateWorld({ seed: 'CAREER-060', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  return createCareer(world, { name: 'Алексей Ветров', age: 20, originId: 'CLUB_SCHOOL' });
}

function report(year: number, index: number): ExpeditionReport {
  return {
    id: `report-${index}`,
    year,
    seasonDay: 40 + index,
    mountainName: `Гора ${index}`,
    routeName: 'Гребень',
    outcome: 'RETREAT',
    highestElevation: 3200,
    elapsedMinutes: 600,
    teamMemberIds: [],
    casualties: [],
    injuries: [],
    decisions: [],
    clubReaction: '',
    pressReaction: '',
    reputationDelta: 0,
    moneyDelta: 0,
  };
}

describe('career progression 0.6', () => {
  it('creates a season, tier and milestone track', () => {
    const career = careerFixture();
    expect(career.schemaVersion).toBe(16);
    expect(career.progression.seasonNumber).toBe(1);
    expect(career.progression.tier).toBe('NOVICE');
    expect(career.progression.milestones).toHaveLength(6);
  });

  it('awards milestones once', () => {
    const career = careerFixture();
    const completed = syncCareerProgression({ ...career, completedClimbs: 1, highestElevation: 5200 });
    const first = completed.progression.milestones.find(item => item.id === 'FIRST_SUMMIT');
    const altitude = completed.progression.milestones.find(item => item.id === 'FIVE_THOUSAND');
    expect(first?.completed).toBe(true);
    expect(altitude?.completed).toBe(true);
    const money = completed.hero.money;
    const again = syncCareerProgression(completed);
    expect(again.hero.money).toBe(money);
  });

  it('closes the old season when time crosses the boundary', () => {
    const career = careerFixture();
    const lateSeason = { ...career, seasonDay: 178, week: 26 };
    const next = applyTraining(lateSeason, 'RECOVERY');
    expect(next.year).toBe(career.year + 1);
    expect(next.progression.seasonNumber).toBe(2);
    expect(next.progression.seasonHistory).toHaveLength(1);
    expect(next.progression.seasonHistory[0]?.year).toBe(career.year);
  });

  it('limits expeditions by career tier', () => {
    const career = careerFixture();
    const capped = { ...career, reports: [report(career.year, 1), report(career.year, 2)] };
    expect(expeditionReadiness(capped).blockers).toContain('Лимит экспедиций сезона исчерпан.');
  });
});
