import { hydrateCareerFoundation } from './career';
import { normalizeSeasonCampaignPlan } from './seasonPlanning';
import { buildSchoolExpeditionBoard, schoolExpeditionPhase } from './schoolExpeditions';
import type { CareerState, CareerTabId, WorldState } from './types';

export interface ReleaseAuditIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface ReleaseAuditResult {
  valid: boolean;
  issues: ReleaseAuditIssue[];
}

export interface ReleaseRepairResult {
  career: CareerState;
  repairs: string[];
}

const terminalClimbPhases = new Set(['COMPLETE', 'FAILED', 'RETREATED']);

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function finite(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function routeForRegion(career: CareerState, regionId: string) {
  return career.routes.find(route => route.regionId === regionId) ?? career.routes[0] ?? null;
}

function activeRosterIds(career: CareerState) {
  return new Set(career.teamRoster
    .filter(member => member.status !== 'DEAD' && member.status !== 'RETIRED' && member.status !== 'LEFT')
    .map(member => member.id));
}

export function auditCareerForRelease(world: WorldState, career: CareerState): ReleaseAuditResult {
  const issues: ReleaseAuditIssue[] = [];
  const routeIds = new Set(career.routes.map(route => route.id));
  const rosterIds = new Set(career.teamRoster.map(member => member.id));

  if (career.worldId !== world.id) issues.push({ code: 'WORLD_MISMATCH', severity: 'ERROR', message: 'Карьера относится к другому миру.' });
  if (!world.ecosystem.content.regions.byId[career.currentRegionId]) issues.push({ code: 'REGION_MISSING', severity: 'ERROR', message: 'Текущий регион отсутствует в мире.' });
  if (!routeIds.has(career.expeditionPlan.routeId)) issues.push({ code: 'ROUTE_MISSING', severity: 'ERROR', message: 'Выбранный маршрут больше не существует.' });
  if (new Set(career.expeditionPlan.teamMemberIds).size !== career.expeditionPlan.teamMemberIds.length) issues.push({ code: 'TEAM_DUPLICATE', severity: 'ERROR', message: 'В плане экспедиции повторяется участник.' });
  if (career.expeditionPlan.teamMemberIds.some(id => !rosterIds.has(id))) issues.push({ code: 'TEAM_UNKNOWN', severity: 'ERROR', message: 'В плане экспедиции есть неизвестный участник.' });
  if (new Set(career.permanentTeam.memberIds).size !== career.permanentTeam.memberIds.length) issues.push({ code: 'PERMANENT_DUPLICATE', severity: 'WARNING', message: 'В постоянной команде повторяется участник.' });
  if (career.acceptedOffer && career.resolvedSchoolOfferIds.includes(career.acceptedOffer.id)) issues.push({ code: 'RESOLVED_OFFER_ACTIVE', severity: 'ERROR', message: 'Завершённый план школы всё ещё выбран.' });
  if (career.selectedOfferId && !career.acceptedOffer) issues.push({ code: 'OFFER_ORPHAN', severity: 'WARNING', message: 'Выбран план школы без сохранённой заявки.' });
  if (career.activeClimb && !routeIds.has(career.activeClimb.routeId)) issues.push({ code: 'CLIMB_ROUTE_MISSING', severity: 'ERROR', message: 'Активная экспедиция ссылается на отсутствующий маршрут.' });
  if (career.activeClimb && new Set(career.activeClimb.teamMemberIds).size !== career.activeClimb.teamMemberIds.length) issues.push({ code: 'CLIMB_TEAM_DUPLICATE', severity: 'ERROR', message: 'В активной экспедиции повторяется участник.' });
  if (!Number.isFinite(career.hero.health) || !Number.isFinite(career.hero.fatigue) || !Number.isFinite(career.hero.form)) issues.push({ code: 'HERO_NUMERIC', severity: 'ERROR', message: 'Параметры героя повреждены.' });
  if (career.activeClimb && terminalClimbPhases.has(career.activeClimb.phase) && career.activeClimb.topo && !terminalClimbPhases.has(career.activeClimb.topo.phase)) issues.push({ code: 'CLIMB_PHASE_SPLIT', severity: 'WARNING', message: 'Итог экспедиции расходится между карьерой и картой.' });

  return { valid: !issues.some(issue => issue.severity === 'ERROR'), issues };
}

export function repairCareerForRelease(world: WorldState, input: CareerState): ReleaseRepairResult {
  let career = hydrateCareerFoundation(input, world, false);
  const repairs: string[] = [];
  const activeIds = activeRosterIds(career);
  const primaryRegionId = world.ecosystem.content.primaryRegionId;
  const currentRegionId = world.ecosystem.content.regions.byId[career.currentRegionId]
    ? career.currentRegionId
    : primaryRegionId;
  if (currentRegionId !== career.currentRegionId) repairs.push('Восстановлен доступный регион.');

  const defaultRoute = routeForRegion(career, currentRegionId);
  const routeId = career.routes.some(route => route.id === career.expeditionPlan.routeId)
    ? career.expeditionPlan.routeId
    : defaultRoute?.id ?? career.expeditionPlan.routeId;
  if (routeId !== career.expeditionPlan.routeId) repairs.push('Восстановлен доступный маршрут.');

  const teamMemberIds = unique(career.expeditionPlan.teamMemberIds).filter(id => activeIds.has(id));
  if (teamMemberIds.length !== career.expeditionPlan.teamMemberIds.length) repairs.push('Очищен повреждённый состав экспедиции.');

  const permanentMemberIds = unique(career.permanentTeam.memberIds).filter(id => activeIds.has(id));
  if (permanentMemberIds.length !== career.permanentTeam.memberIds.length) repairs.push('Очищен состав постоянной команды.');

  let acceptedOffer = career.acceptedOffer;
  let selectedOfferId = career.selectedOfferId;
  if (!career.activeClimb && acceptedOffer) {
    const boardOffer = buildSchoolExpeditionBoard(world, career).find(offer => offer.id === acceptedOffer!.id);
    const currentOffer = boardOffer ?? acceptedOffer;
    const phase = schoolExpeditionPhase(currentOffer, career.seasonDay);
    const stale = career.resolvedSchoolOfferIds.includes(currentOffer.id)
      || currentOffer.scheduleStatus === 'CANCELLED'
      || phase === 'ON_ROUTE'
      || phase === 'RECOVERING'
      || currentOffer.expiresOnDay < career.seasonDay;
    if (stale) {
      acceptedOffer = null;
      selectedOfferId = null;
      repairs.push('Удалён завершённый или пропущенный план школы.');
    } else {
      acceptedOffer = currentOffer;
      selectedOfferId = currentOffer.id;
    }
  }
  if (!acceptedOffer && selectedOfferId) {
    selectedOfferId = null;
    repairs.push('Удалена потерянная ссылка на план школы.');
  }

  const hero = {
    ...career.hero,
    health: finite(career.hero.health, 100, 0, 100),
    form: finite(career.hero.form, 50, 0, 100),
    fatigue: finite(career.hero.fatigue, 0, 0, 100),
    morale: finite(career.hero.morale, 50, 0, 100),
    reputation: finite(career.hero.reputation, 0, 0, 100),
    money: finite(career.hero.money, 0, 0, 99_999),
  };
  if (JSON.stringify(hero) !== JSON.stringify(career.hero)) repairs.push('Восстановлены числовые параметры героя.');

  career = {
    ...career,
    currentRegionId,
    unlockedRegionIds: unique([...career.unlockedRegionIds, currentRegionId]),
    hero,
    selectedOfferId,
    acceptedOffer,
    expeditionPlan: {
      ...career.expeditionPlan,
      routeId,
      offerId: acceptedOffer?.id ?? (career.membership.mode === 'INDEPENDENT' ? career.expeditionPlan.offerId : null),
      leaderNpcId: acceptedOffer?.leaderNpcId ?? (career.membership.mode === 'INDEPENDENT' ? career.expeditionPlan.leaderNpcId : null),
      teamMemberIds,
    },
    permanentTeam: {
      ...career.permanentTeam,
      memberIds: permanentMemberIds,
      cohesion: finite(career.permanentTeam.cohesion, 0, 0, 100),
    },
    resolvedSchoolOfferIds: unique(career.resolvedSchoolOfferIds),
    knownNpcIds: unique(career.knownNpcIds),
  };
  career = { ...career, seasonPlan: normalizeSeasonCampaignPlan(career) };

  return { career, repairs };
}

export function releaseSafeCareerTab(career: CareerState | null, requested: CareerTabId): CareerTabId {
  if (!career) return 'OVERVIEW';
  if (career.activeClimb) return 'CLIMB';
  if (requested === 'CLIMB') return 'OVERVIEW';
  return requested;
}
