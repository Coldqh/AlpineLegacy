import type { CareerState, ExpeditionRoute, MountainId, RouteId } from './types';
import type { GridWeather, LocalCell, LocalStageMap } from '../topography/mountainGridEngine';

export type MountainSeasonId = 'THAW' | 'EARLY_WINDOW' | 'HIGH_WINDOW' | 'AUTUMN_FREEZE';
export type DynamicRouteStatus = 'OPEN' | 'CAUTION' | 'CLOSED';
export type DynamicHazardBias = 'ROCKFALL' | 'AVALANCHE' | 'CREVASSE' | 'ICE' | 'WIND';

export interface RouteHistorySnapshot {
  attempts: number;
  summits: number;
  retreats: number;
  tragedies: number;
  firstAscentYear: number | null;
  lastOutcome: string | null;
}

export interface MountainDynamics {
  mountainId: MountainId;
  routeId: RouteId;
  seasonId: MountainSeasonId;
  seasonTitle: string;
  seasonSummary: string;
  status: DynamicRouteStatus;
  statusLabel: string;
  closureReason: string | null;
  hazardBias: DynamicHazardBias;
  movementMultiplier: number;
  fatigueMultiplier: number;
  campQualityModifier: number;
  visibilityDelta: number;
  windDelta: number;
  temperatureDelta: number;
  snowSoftnessDelta: number;
  stabilityDelta: number;
  knownRouteBonus: number;
  traceDensity: number;
  routeHistory: RouteHistorySnapshot;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seasonForDay(day: number): MountainSeasonId {
  if (day <= 40) return 'THAW';
  if (day <= 85) return 'EARLY_WINDOW';
  if (day <= 135) return 'HIGH_WINDOW';
  return 'AUTUMN_FREEZE';
}

function seasonProfile(seasonId: MountainSeasonId, route: ExpeditionRoute) {
  if (seasonId === 'THAW') {
    return {
      title: 'Весенний распад',
      summary: 'Мокрый снег, дневной прогрев и ослабленная порода делают нижнюю и среднюю часть массива нестабильной.',
      hazardBias: (route.mountainCharacterId === 'ALTITUDE' ? 'AVALANCHE' : 'ROCKFALL') as DynamicHazardBias,
      movementMultiplier: 1.12,
      fatigueMultiplier: 1.1,
      campQualityModifier: -.18,
      visibilityDelta: -5,
      windDelta: 3,
      temperatureDelta: 4,
      snowSoftnessDelta: 18,
      stabilityDelta: -17,
    };
  }
  if (seasonId === 'EARLY_WINDOW') {
    return {
      title: 'Раннее снежное окно',
      summary: 'Ночью снег держит лучше, но мосты над трещинами и свежие доски ещё требуют внимательной разведки.',
      hazardBias: (route.style.toLowerCase().includes('лед') || route.mountainCharacterId === 'WEATHER' ? 'CREVASSE' : 'AVALANCHE') as DynamicHazardBias,
      movementMultiplier: 1.04,
      fatigueMultiplier: 1.02,
      campQualityModifier: .04,
      visibilityDelta: 2,
      windDelta: -2,
      temperatureDelta: -4,
      snowSoftnessDelta: -6,
      stabilityDelta: 5,
    };
  }
  if (seasonId === 'HIGH_WINDOW') {
    return {
      title: 'Главное высотное окно',
      summary: 'Большинство линий открыты, но дневной прогрев ускоряет камнепад и разрушает ледовые участки.',
      hazardBias: (route.technicality >= 60 || route.mountainFormId === 'BROKEN_MASSIF' ? 'ROCKFALL' : 'ICE') as DynamicHazardBias,
      movementMultiplier: 1,
      fatigueMultiplier: 1,
      campQualityModifier: .08,
      visibilityDelta: 5,
      windDelta: 0,
      temperatureDelta: 5,
      snowSoftnessDelta: 7,
      stabilityDelta: 2,
    };
  }
  return {
    title: 'Осеннее закрытие',
    summary: 'Лёд становится жёстким, день короче, а гребни чаще закрываются ветром и обледенением.',
    hazardBias: (route.mountainCharacterId === 'DESCENT' || route.style.toLowerCase().includes('греб') ? 'WIND' : 'ICE') as DynamicHazardBias,
    movementMultiplier: 1.09,
    fatigueMultiplier: 1.12,
    campQualityModifier: -.08,
    visibilityDelta: -8,
    windDelta: 16,
    temperatureDelta: -7,
    snowSoftnessDelta: -14,
    stabilityDelta: 6,
  };
}

function routeHistory(career: CareerState, route: ExpeditionRoute): RouteHistorySnapshot {
  const expeditions = career.livingWorld.expeditions
    .filter(item => item.routeId === route.id || (item.mountainId === route.mountainId && item.routeName === route.name))
    .slice()
    .sort((a, b) => b.year - a.year || b.seasonDay - a.seasonDay);
  return {
    attempts: expeditions.length,
    summits: expeditions.filter(item => item.outcome === 'SUMMIT').length,
    retreats: expeditions.filter(item => item.outcome === 'RETREAT' || item.outcome === 'FAILED').length,
    tragedies: expeditions.filter(item => item.outcome === 'TRAGEDY').length,
    firstAscentYear: expeditions.filter(item => item.outcome === 'SUMMIT').sort((a, b) => a.year - b.year || a.seasonDay - b.seasonDay)[0]?.year ?? null,
    lastOutcome: expeditions[0]?.outcome ?? null,
  };
}

function statusForRoute(career: CareerState, route: ExpeditionRoute, seasonId: MountainSeasonId, history: RouteHistorySnapshot) {
  const routes = career.routes.filter(item => item.mountainId === route.mountainId).slice().sort((a, b) => a.id.localeCompare(b.id));
  const routeIndex = Math.max(0, routes.findIndex(item => item.id === route.id));
  const closureIndex = routes.length ? hash(`${career.rootSeed}:${career.year}:${seasonId}:${route.mountainId}`) % routes.length : -1;
  const randomPressure = (hash(`${career.rootSeed}:${career.year}:${career.seasonDay}:${route.id}`) % 31) - 15;
  const seasonalPressure = seasonId === 'THAW' ? 20 : seasonId === 'AUTUMN_FREEZE' ? 17 : seasonId === 'HIGH_WINDOW' ? 7 : 3;
  const exposurePressure = route.objectiveRisk * .58 + route.technicality * .42 + history.tragedies * 8 + randomPressure + seasonalPressure;
  const closeThreshold = seasonId === 'THAW' ? 77 : seasonId === 'AUTUMN_FREEZE' ? 82 : seasonId === 'HIGH_WINDOW' ? 102 : 112;
  const closureCandidate = routeIndex === closureIndex && routes.length > 1;

  if (closureCandidate && exposurePressure >= closeThreshold) {
    const reason = seasonId === 'THAW'
      ? 'Дневной прогрев и мокрый снег закрыли ключевой участок маршрута.'
      : seasonId === 'AUTUMN_FREEZE'
        ? 'Ветер и обледенение сделали верхнюю часть маршрута непроходимой.'
        : 'Прогрев разрушил технический участок, линия временно закрыта.';
    return { status: 'CLOSED' as const, reason };
  }
  if (exposurePressure >= closeThreshold - 22 || history.tragedies > 0) {
    return { status: 'CAUTION' as const, reason: 'Линия открыта, но сезонное состояние усиливает её ключевую опасность.' };
  }
  return { status: 'OPEN' as const, reason: null };
}

export function buildMountainDynamics(career: CareerState, mountainId: MountainId, routeId: RouteId): MountainDynamics {
  const route = career.routes.find(item => item.id === routeId)
    ?? career.routes.find(item => item.mountainId === mountainId)
    ?? career.routes[0]!;
  const history = routeHistory(career, route);
  const seasonId = seasonForDay(career.seasonDay);
  const profile = seasonProfile(seasonId, route);
  const status = statusForRoute(career, route, seasonId, history);
  const mountainHistory = career.livingWorld.mountainHistory.find(item => item.mountainId === mountainId);
  const knownRouteBonus = clamp(history.attempts * 6 + history.summits * 4 + (mountainHistory?.currentAttention ?? 0) * .18, 0, 42);
  const traceDensity = clamp(history.attempts * 9 + history.summits * 7 + history.tragedies * 5, 0, 100);
  return {
    mountainId,
    routeId: route.id,
    seasonId,
    seasonTitle: profile.title,
    seasonSummary: profile.summary,
    status: status.status,
    statusLabel: status.status === 'CLOSED' ? 'закрыт' : status.status === 'CAUTION' ? 'нестабилен' : 'открыт',
    closureReason: status.reason,
    hazardBias: profile.hazardBias,
    movementMultiplier: profile.movementMultiplier,
    fatigueMultiplier: profile.fatigueMultiplier,
    campQualityModifier: profile.campQualityModifier,
    visibilityDelta: profile.visibilityDelta,
    windDelta: profile.windDelta,
    temperatureDelta: profile.temperatureDelta,
    snowSoftnessDelta: profile.snowSoftnessDelta,
    stabilityDelta: profile.stabilityDelta,
    knownRouteBonus,
    traceDensity,
    routeHistory: history,
  };
}

function dynamicRoll(dynamics: MountainDynamics, map: LocalStageMap, cell: LocalCell, salt: string) {
  return hash(`${dynamics.mountainId}:${dynamics.routeId}:${dynamics.seasonId}:${map.id}:${cell.x}:${cell.y}:${salt}`) % 100;
}

export function applyMountainDynamicsToMap(map: LocalStageMap, dynamics: MountainDynamics): LocalStageMap {
  const cells = map.cells.map(cell => {
    if (!cell.passable || cell.terrain === 'SUMMIT' || (cell.x === map.start.x && cell.y === map.start.y) || (cell.x === map.goal.x && cell.y === map.goal.y)) return cell;
    let next = {
      ...cell,
      stability: clamp(cell.stability + dynamics.stabilityDelta, 5, 100),
      exposure: clamp(cell.exposure + (dynamics.hazardBias === 'WIND' ? 6 : 0), 0, 100),
    };
    const roll = dynamicRoll(dynamics, map, cell, 'hazard');
    const campRoll = dynamicRoll(dynamics, map, cell, 'camp');

    if (dynamics.hazardBias === 'ROCKFALL' && ['ROCK', 'SCREE', 'RIDGE'].includes(cell.terrain) && roll < 14) {
      next = { ...next, hazard: 'ROCKFALL', stability: clamp(next.stability - 22, 5, 100), exposure: clamp(next.exposure + 10, 0, 100), campPossible: false };
    } else if (dynamics.hazardBias === 'AVALANCHE' && ['SNOW', 'GLACIER'].includes(cell.terrain) && roll < 13) {
      next = { ...next, hazard: 'AVALANCHE', stability: clamp(next.stability - 24, 5, 100), surface: 'SOFT', campPossible: false };
    } else if (dynamics.hazardBias === 'CREVASSE' && cell.terrain === 'GLACIER' && roll < 12) {
      next = { ...next, hazard: 'CREVASSE', ropeRequired: true, ropeRecommended: true, stability: clamp(next.stability - 18, 5, 100), campPossible: false };
    } else if (dynamics.hazardBias === 'ICE' && ['SNOW', 'GLACIER', 'RIDGE'].includes(cell.terrain) && roll < 21) {
      next = { ...next, surface: 'ICE', ropeRecommended: true, anchorQuality: clamp(next.anchorQuality + 8, 0, 100), stability: clamp(next.stability + 5, 0, 100) };
    } else if (dynamics.hazardBias === 'WIND' && ['RIDGE', 'SNOW'].includes(cell.terrain) && roll < 20) {
      next = { ...next, exposure: clamp(next.exposure + 18, 0, 100), campPossible: false, ropeRecommended: true };
    }

    if (dynamics.campQualityModifier < 0 && next.campPossible && campRoll < Math.round(Math.abs(dynamics.campQualityModifier) * 100)) {
      next = { ...next, campPossible: false };
    } else if (dynamics.campQualityModifier > 0 && !next.campPossible && next.slope < 20 && next.hazard === 'NONE' && campRoll < Math.round(dynamics.campQualityModifier * 100)) {
      next = { ...next, campPossible: true };
    }
    return next;
  });
  return { ...map, cells };
}

export function applyMountainDynamicsToWeather(weather: GridWeather, dynamics: MountainDynamics): GridWeather {
  return {
    temperatureC: weather.temperatureC + dynamics.temperatureDelta,
    windKmh: Math.max(0, weather.windKmh + dynamics.windDelta),
    visibility: clamp(weather.visibility + dynamics.visibilityDelta, 10, 100),
    snowSoftness: clamp(weather.snowSoftness + dynamics.snowSoftnessDelta, 0, 100),
  };
}

export function routeIsClosed(career: CareerState, route: ExpeditionRoute) {
  return buildMountainDynamics(career, route.mountainId, route.id).status === 'CLOSED';
}
