import { detectTerrainModule, TERRAIN_MODULES } from '../content/terrainModules';
import type {
  ContentValidationReport,
  ExpeditionRoute,
  ExpeditionScale,
  RouteContentReport,
  TerrainModuleId,
  WorldState,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function expeditionScaleForRoute(route: ExpeditionRoute): ExpeditionScale {
  const gain = Math.max(0, route.summitElevation - route.startElevation);
  // Height and total gain define the expedition class. Route hours only refine it;
  // they must not turn a low mountain into a giant because of one slow technical line.
  const load = route.estimatedHours * .2 + route.technicality * .12 + route.objectiveRisk * .08 + gain / 350;
  if (route.summitElevation >= 6500 || gain >= 5000 || load >= 40) return 'GIANT';
  if (route.summitElevation >= 4700 || gain >= 3000 || load >= 24) return 'MAJOR';
  return 'SMALL';
}

export function targetStageBudget(route: ExpeditionRoute) {
  const scale = expeditionScaleForRoute(route);
  const gain = Math.max(1, route.summitElevation - route.startElevation);
  // Full vertical gain is the dominant term. Technicality adds work, but can no
  // longer flatten every route against the same maximum stage cap.
  const raw = 8 + gain / 180 + route.technicality * .06 + route.objectiveRisk * .05 + route.estimatedHours * .1;
  const ascent = scale === 'SMALL'
    ? Math.round(clamp(raw, 12, 20))
    : scale === 'MAJOR'
      ? Math.round(clamp(raw, 18, 30))
      : Math.round(clamp(raw, 28, 48));
  const descent = Math.round(ascent * (scale === 'GIANT' ? .78 : scale === 'MAJOR' ? .73 : .65));
  return { scale, ascent, descent };
}

export function normalizedTerrainModule(route: ExpeditionRoute, segmentIndex: number): TerrainModuleId {
  const segment = route.segments[segmentIndex]!;
  return segment.terrainModuleId ?? detectTerrainModule(segment.terrain).id;
}

function expectedActionsForModule(id: TerrainModuleId, critical: boolean) {
  const module = TERRAIN_MODULES[id];
  const shortestPreparation = Math.min(...module.preparationOptions.map(option => option.length));
  return 1 + shortestPreparation + (critical ? 1 : 0);
}

export function buildRouteContentReport(route: ExpeditionRoute): RouteContentReport {
  const budget = targetStageBudget(route);
  const moduleCounts: Record<string, number> = {};
  const moduleSequence = route.segments.map((segment, index) => {
    const id = segment.terrainModuleId ?? detectTerrainModule(segment.terrain).id;
    moduleCounts[id] = (moduleCounts[id] ?? 0) + 1;
    return id;
  });
  const uniqueModules = new Set(moduleSequence);
  const criticalSegments = route.segments.filter(segment => segment.difficulty >= 56 || segment.exposure >= 50 || segment.decisionId).length;
  const averageActions = route.segments.reduce((sum, segment, index) => {
    const moduleId = moduleSequence[index]!;
    return sum + expectedActionsForModule(moduleId, segment.difficulty >= 56 || segment.exposure >= 50 || Boolean(segment.decisionId));
  }, 0) / Math.max(1, route.segments.length);
  const estimatedActions = Math.round((budget.ascent + budget.descent) * clamp(averageActions * .72, 1.45, 2.7));
  const expectedPlayMinutes = budget.scale === 'SMALL'
    ? Math.round(clamp(estimatedActions * .48, 15, 25))
    : budget.scale === 'MAJOR'
      ? Math.round(clamp(estimatedActions * .5, 30, 40))
      : Math.round(clamp(estimatedActions * .52, 45, 60));
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!route.segments.length) errors.push('Маршрут не содержит участков подъёма.');
  if (!(route.descentSegments?.length)) errors.push('Маршрут не содержит отдельного спуска.');
  if (route.summitElevation <= route.startElevation) errors.push('Вершина находится не выше точки старта.');
  if (route.startElevation < 0 || route.startElevation > 1000) errors.push('Точка старта должна находиться в диапазоне 0–1000 м.');
  const declaredGain = route.segments.reduce((sum, segment) => sum + segment.elevationGain, 0);
  const fullGain = route.summitElevation - route.startElevation;
  if (Math.abs(declaredGain - fullGain) > Math.max(20, fullGain * .02)) errors.push('Участки маршрута не покрывают полный набор от старта до вершины.');
  if (!route.requiredGearIds.length) warnings.push('Не задано обязательное снаряжение.');
  if (uniqueModules.size < Math.min(3, route.segments.length)) warnings.push('Слишком мало разных terrain-модулей.');
  if (criticalSegments === 0) warnings.push('Нет ключевых многошаговых участков.');
  if (!(route.segments.some(segment => segment.campPossible))) warnings.push('На подъёме нет ни одной площадки для лагеря.');

  let longestRun = 1;
  let run = 1;
  for (let index = 1; index < moduleSequence.length; index += 1) {
    if (moduleSequence[index] === moduleSequence[index - 1]) run += 1;
    else run = 1;
    longestRun = Math.max(longestRun, run);
  }
  if (longestRun >= 4) warnings.push(`Повтор одного terrain-модуля ${longestRun} раз подряд.`);

  return {
    routeId: route.id,
    scale: budget.scale,
    ascentStages: budget.ascent,
    descentStages: budget.descent,
    estimatedActions,
    expectedPlayMinutes,
    moduleCounts,
    warnings,
    errors,
  };
}

export function validateWorldContent(world: WorldState): ContentValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registry = world.ecosystem.content;
  const routeReports = registry.routes.allIds.map(id => {
    const route = registry.routes.byId[id];
    if (!route) {
      errors.push(`routes.allIds содержит отсутствующий ID: ${id}`);
      return null;
    }
    if (!registry.mountains.byId[route.mountainId]) errors.push(`Маршрут ${id} ссылается на отсутствующую гору ${route.mountainId}.`);
    for (const gearId of route.requiredGearIds) {
      if (!registry.gear.byId[gearId]) errors.push(`Маршрут ${id} требует отсутствующее снаряжение ${gearId}.`);
    }
    for (const segment of [...route.segments, ...(route.descentSegments ?? [])]) {
      const moduleId = segment.terrainModuleId ?? detectTerrainModule(segment.terrain).id;
      if (!TERRAIN_MODULES[moduleId]) errors.push(`Участок ${segment.id} использует неизвестный terrain-модуль ${moduleId}.`);
      if (segment.elevationGain < 0) errors.push(`Участок ${segment.id} имеет отрицательный перепад.`);
    }
    const report = buildRouteContentReport(route);
    errors.push(...report.errors.map(message => `${id}: ${message}`));
    warnings.push(...report.warnings.map(message => `${id}: ${message}`));
    return report;
  }).filter((item): item is RouteContentReport => Boolean(item));

  for (const mountainId of registry.mountains.allIds) {
    const mountain = registry.mountains.byId[mountainId];
    if (!mountain) {
      errors.push(`mountains.allIds содержит отсутствующий ID: ${mountainId}`);
      continue;
    }
    const routeIds = mountain.routeIds ?? [];
    if (!routeIds.length) warnings.push(`Гора ${mountainId} не имеет маршрутов.`);
    for (const routeId of routeIds) if (!registry.routes.byId[routeId]) errors.push(`Гора ${mountainId} ссылается на отсутствующий маршрут ${routeId}.`);
  }

  return { valid: errors.length === 0, routeReports, warnings, errors };
}

export function attachContentMetadata(route: ExpeditionRoute): ExpeditionRoute {
  const report = buildRouteContentReport(route);
  return {
    ...route,
    expeditionScale: report.scale,
    expectedPlayMinutes: report.expectedPlayMinutes,
    estimatedDecisionCount: report.estimatedActions,
    contentVersion: 3,
  };
}
