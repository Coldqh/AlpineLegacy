import type {
  CareerState,
  ExpeditionRoute,
  NpcId,
  RouteId,
  SeasonBudgetPolicy,
  SeasonCampaignPlan,
  SeasonRiskPolicy,
} from './types';

const budgetShare: Record<SeasonBudgetPolicy, number> = {
  LEAN: .34,
  STANDARD: .56,
  FULL: .76,
};

const preparationRate: Record<SeasonBudgetPolicy, number> = {
  LEAN: .62,
  STANDARD: 1,
  FULL: 1.28,
};

function routeDifficulty(route: ExpeditionRoute) {
  return route.objectiveRisk * .45 + route.technicality * .4 + Math.max(0, route.summitElevation - route.startElevation) / 180;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function chooseDefaultGoals(routes: ExpeditionRoute[], completedRouteIds: string[] = []) {
  const available = routes.filter(route => !completedRouteIds.includes(route.id)).sort((a, b) => routeDifficulty(a) - routeDifficulty(b));
  if (!available.length) return routes.slice(0, 3).map(route => route.id);
  const picks = [
    available[Math.floor(available.length * .22)],
    available[Math.floor(available.length * .5)],
    available[Math.floor(available.length * .78)],
  ].filter((route): route is ExpeditionRoute => Boolean(route));
  return unique(picks.map(route => route.id)).slice(0, 3);
}

function defaultCoreMembers(career: Pick<CareerState, 'permanentTeam' | 'teamRoster'>): NpcId[] {
  const available = career.permanentTeam.memberIds.filter(id => {
    const member = career.teamRoster.find(item => item.id === id);
    return member?.status === 'ACTIVE' && member.availability >= 45;
  });
  return available.slice(0, 5);
}

export function createSeasonCampaignPlan(career: Pick<CareerState, 'year' | 'hero' | 'routes' | 'reports' | 'permanentTeam' | 'teamRoster' | 'currentRegionId'>): SeasonCampaignPlan {
  const completedRouteIds = career.reports.filter(report => report.outcome === 'SUMMIT').map(report => report.routeName);
  const regionalRoutes = career.routes.filter(route => route.regionId === career.currentRegionId);
  const goals = chooseDefaultGoals(regionalRoutes.filter(route => !completedRouteIds.includes(route.name)));
  const budgetPolicy: SeasonBudgetPolicy = career.hero.money >= 700 ? 'FULL' : career.hero.money >= 350 ? 'STANDARD' : 'LEAN';
  return {
    version: 1,
    year: career.year,
    riskPolicy: 'BALANCED',
    budgetPolicy,
    goalRouteIds: goals,
    coreMemberIds: defaultCoreMembers(career),
    reserveCredits: Math.max(80, Math.round(career.hero.money * budgetShare[budgetPolicy])),
    spentCredits: 0,
    preparationDays: 0,
    completedGoalRouteIds: [],
    delayedPlans: 0,
    cancelledPlans: 0,
    lastReviewDay: 1,
  };
}

export function normalizeSeasonCampaignPlan(career: CareerState): SeasonCampaignPlan {
  const raw = career.seasonPlan;
  if (!raw || raw.year !== career.year) return createSeasonCampaignPlan(career);
  const validGoals = raw.goalRouteIds.filter(id => career.routes.some(route => route.id === id && route.regionId === career.currentRegionId));
  const validMembers = raw.coreMemberIds.filter(id => career.teamRoster.some(member => member.id === id && member.status === 'ACTIVE'));
  const budgetPolicy = raw.budgetPolicy ?? 'STANDARD';
  return {
    version: 1,
    year: career.year,
    riskPolicy: raw.riskPolicy ?? 'BALANCED',
    budgetPolicy,
    goalRouteIds: (validGoals.length ? unique(validGoals) : chooseDefaultGoals(career.routes.filter(route => route.regionId === career.currentRegionId))).slice(0, 3),
    coreMemberIds: unique(validMembers).slice(0, 5),
    reserveCredits: Math.max(0, Math.round(raw.reserveCredits ?? career.hero.money * budgetShare[budgetPolicy])),
    spentCredits: Math.max(0, Math.round(raw.spentCredits ?? 0)),
    preparationDays: Math.max(0, Math.round(raw.preparationDays ?? 0)),
    completedGoalRouteIds: unique(raw.completedGoalRouteIds ?? []).filter(id => career.routes.some(route => route.id === id)),
    delayedPlans: Math.max(0, Math.round(raw.delayedPlans ?? 0)),
    cancelledPlans: Math.max(0, Math.round(raw.cancelledPlans ?? 0)),
    lastReviewDay: Math.max(1, Math.round(raw.lastReviewDay ?? career.seasonDay)),
  };
}

export function seasonBudgetLimit(career: CareerState, policy = normalizeSeasonCampaignPlan(career).budgetPolicy) {
  const baseline = Math.max(career.hero.money, career.progression?.seasonStartMoney ?? career.hero.money);
  return Math.max(80, Math.round(baseline * budgetShare[policy]));
}

export function seasonPreparationBonus(career: CareerState, routeId: RouteId) {
  const plan = normalizeSeasonCampaignPlan(career);
  if (!plan.goalRouteIds.includes(routeId)) return 0;
  const coreCount = career.expeditionPlan.teamMemberIds.filter(id => plan.coreMemberIds.includes(id)).length;
  const route = career.routes.find(item => item.id === routeId);
  const difficulty = route ? routeDifficulty(route) : 50;
  const base = Math.min(13, plan.preparationDays * .18 * preparationRate[plan.budgetPolicy]);
  const team = Math.min(5, coreCount * 1.15);
  const difficultyPenalty = Math.max(0, difficulty - 80) * .035;
  return Math.max(0, Math.round(base + team - difficultyPenalty));
}

export function seasonRiskReadinessModifier(policy: SeasonRiskPolicy) {
  if (policy === 'CAUTIOUS') return 5;
  if (policy === 'AGGRESSIVE') return -4;
  return 0;
}

export function seasonCostSupport(career: CareerState, routeId: RouteId, rawCost: number) {
  const plan = normalizeSeasonCampaignPlan(career);
  if (!plan.goalRouteIds.includes(routeId)) return rawCost;
  const discount = plan.budgetPolicy === 'FULL' ? .18 : plan.budgetPolicy === 'STANDARD' ? .09 : 0;
  return Math.max(0, Math.round(rawCost * (1 - discount)));
}

export function setSeasonRiskPolicy(career: CareerState, riskPolicy: SeasonRiskPolicy): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return { ...career, seasonPlan: { ...plan, riskPolicy, lastReviewDay: career.seasonDay } };
}

export function setSeasonBudgetPolicy(career: CareerState, budgetPolicy: SeasonBudgetPolicy): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return {
    ...career,
    seasonPlan: {
      ...plan,
      budgetPolicy,
      reserveCredits: seasonBudgetLimit(career, budgetPolicy),
      lastReviewDay: career.seasonDay,
    },
  };
}

export function toggleSeasonGoal(career: CareerState, routeId: RouteId): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  const active = plan.goalRouteIds.includes(routeId);
  let goals = active ? plan.goalRouteIds.filter(id => id !== routeId) : [...plan.goalRouteIds, routeId];
  if (goals.length > 3) goals = goals.slice(goals.length - 3);
  if (!goals.length) goals = [routeId];
  return { ...career, seasonPlan: { ...plan, goalRouteIds: goals, lastReviewDay: career.seasonDay } };
}

export function usePermanentTeamForSeason(career: CareerState): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return { ...career, seasonPlan: { ...plan, coreMemberIds: defaultCoreMembers(career), lastReviewDay: career.seasonDay } };
}

export function addSeasonPreparation(career: CareerState, days: number): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return {
    ...career,
    seasonPlan: {
      ...plan,
      preparationDays: Math.min(120, plan.preparationDays + Math.max(0, days)),
      lastReviewDay: career.seasonDay,
    },
  };
}

export function recordSeasonExpeditionStart(career: CareerState, routeId: RouteId, cost: number): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return { ...career, seasonPlan: { ...plan, spentCredits: plan.spentCredits + Math.max(0, cost), lastReviewDay: career.seasonDay } };
}

export function recordSeasonExpeditionResult(career: CareerState, routeId: RouteId, summit: boolean): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return {
    ...career,
    seasonPlan: {
      ...plan,
      completedGoalRouteIds: summit && plan.goalRouteIds.includes(routeId)
        ? unique([...plan.completedGoalRouteIds, routeId])
        : plan.completedGoalRouteIds,
      lastReviewDay: career.seasonDay,
    },
  };
}

export function recordSchoolScheduleChange(career: CareerState, kind: 'DELAY' | 'CANCEL'): CareerState {
  const plan = normalizeSeasonCampaignPlan(career);
  return {
    ...career,
    seasonPlan: {
      ...plan,
      delayedPlans: plan.delayedPlans + (kind === 'DELAY' ? 1 : 0),
      cancelledPlans: plan.cancelledPlans + (kind === 'CANCEL' ? 1 : 0),
      lastReviewDay: career.seasonDay,
    },
  };
}

export function seasonPlanRoutes(career: CareerState) {
  const plan = normalizeSeasonCampaignPlan(career);
  return plan.goalRouteIds.map(id => career.routes.find(route => route.id === id)).filter((route): route is ExpeditionRoute => Boolean(route));
}
