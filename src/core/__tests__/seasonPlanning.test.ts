import { describe, expect, it } from 'vitest';
import {
  applyTraining,
  createCareer,
  expeditionCost,
  expeditionReadiness,
  setSeasonBudgetPolicy,
  setSeasonRiskPolicy,
  toggleSeasonGoal,
  updateExpeditionPlan,
  usePermanentTeamForSeason,
} from '../career';
import { generateWorld } from '../generator';
import { normalizeSeasonCampaignPlan, seasonPreparationBonus } from '../seasonPlanning';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'SEASON-CAMPAIGN-16', eraId: 'EXPEDITION', startYear: 1974, difficulty: 'CLIMBER' };

function careerFixture() {
  const world = generateWorld(config);
  return createCareer(world, { name: 'Season Tester', age: 24, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT', organizationId: null });
}

describe('season campaign planning', () => {
  it('creates three long-term objectives and a protected budget', () => {
    const career = careerFixture();
    const plan = normalizeSeasonCampaignPlan(career);
    expect(career.schemaVersion).toBe(20);
    expect(plan.goalRouteIds.length).toBeGreaterThanOrEqual(2);
    expect(plan.goalRouteIds.length).toBeLessThanOrEqual(3);
    expect(plan.reserveCredits).toBeGreaterThan(0);
    expect(plan.spentCredits).toBe(0);
  });

  it('lets the player change goals, budget and risk without creating daily micromanagement', () => {
    let career = careerFixture();
    const existing = normalizeSeasonCampaignPlan(career).goalRouteIds;
    const route = career.routes.find(item => item.regionId === career.currentRegionId && !existing.includes(item.id))!;
    career = toggleSeasonGoal(career, route.id);
    career = setSeasonBudgetPolicy(career, 'FULL');
    career = setSeasonRiskPolicy(career, 'CAUTIOUS');
    const plan = normalizeSeasonCampaignPlan(career);
    expect(plan.goalRouteIds).toContain(route.id);
    expect(plan.budgetPolicy).toBe('FULL');
    expect(plan.riskPolicy).toBe('CAUTIOUS');
  });

  it('turns training days into preparation for season objectives', () => {
    let career = careerFixture();
    const routeId = normalizeSeasonCampaignPlan(career).goalRouteIds[0]!;
    career = updateExpeditionPlan(career, { routeId });
    const before = seasonPreparationBonus(career, routeId);
    career = applyTraining(career, 'MAP_ROOM');
    const after = seasonPreparationBonus(career, routeId);
    expect(after).toBeGreaterThan(before);
  });

  it('uses the permanent rope team as the season core and applies budget support', () => {
    let career = careerFixture();
    const ids = career.teamRoster.slice(0, 3).map(member => member.id);
    career = { ...career, permanentTeam: { ...career.permanentTeam, memberIds: ids } };
    career = usePermanentTeamForSeason(career);
    career = updateExpeditionPlan(career, { teamMemberIds: ids, routeId: normalizeSeasonCampaignPlan(career).goalRouteIds[0]! });
    const standardCost = expeditionCost(career);
    career = setSeasonBudgetPolicy(career, 'FULL');
    const fullCost = expeditionCost(career);
    expect(normalizeSeasonCampaignPlan(career).coreMemberIds).toEqual(ids);
    expect(fullCost).toBeLessThanOrEqual(standardCost);
    expect(expeditionReadiness(career).team).toBeGreaterThan(0);
  });
});
