import type { ExpeditionPlan, ExpeditionRoute, GearDefinition } from './types';

export const ROPE_BUNDLE_METERS = 50;

export type GearPlanTone = 'GOOD' | 'WARNING' | 'DANGER' | 'NEUTRAL';

export interface RouteGearNeed {
  gearId: string;
  minimum: number;
  recommended: number;
  current: number;
  tone: GearPlanTone;
  opens: string;
  effect: string;
  without: string;
}

export interface RouteEquipmentAnalysis {
  teamSize: number;
  expectedNights: number;
  rockSections: number;
  iceSections: number;
  technicalProtectionSites: number;
  minimumRopeMeters: number;
  recommendedRopeMeters: number;
  fullProtectionRopeMeters: number;
  minimumRopeBundles: number;
  recommendedRopeBundles: number;
  plannedRopeMeters: number;
  minimumFoodDays: number;
  recommendedFoodDays: number;
  minimumFuelUnits: number;
  recommendedFuelUnits: number;
  recommendedTentUnits: number;
  recommendedBivyUnits: number;
  needs: Record<string, RouteGearNeed>;
  warnings: string[];
  strengths: string[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function ropeMetersFromGear(gear: Record<string, number> | undefined) {
  return Math.max(0, Math.round(gear?.rope ?? 0)) * ROPE_BUNDLE_METERS;
}

export function normalizeRopeGear(plan: ExpeditionPlan): ExpeditionPlan {
  const legacyMeters = Math.max(0, Number(plan.ropeMeters ?? 0));
  const existingBundles = Math.max(0, Math.round(plan.gear?.rope ?? 0));
  const migratedBundles = legacyMeters > existingBundles * ROPE_BUNDLE_METERS
    ? Math.ceil(legacyMeters / ROPE_BUNDLE_METERS)
    : existingBundles;
  const bundles = clamp(migratedBundles, 0, 4);
  return {
    ...plan,
    gear: { ...(plan.gear ?? {}), rope: bundles },
    ropeMeters: bundles * ROPE_BUNDLE_METERS,
  };
}

function isRockSection(segment: ExpeditionRoute['segments'][number]) {
  return segment.skill === 'ROCK' || /скал|греб|кам|mixed|смешан/i.test(`${segment.terrain} ${segment.name}`);
}

function isIceSection(segment: ExpeditionRoute['segments'][number]) {
  return segment.skill === 'ICE' || /лед|фирн|снег|трещ|glacier|ice/i.test(`${segment.terrain} ${segment.name}`);
}

function isProtectionSite(segment: ExpeditionRoute['segments'][number]) {
  return isRockSection(segment)
    || isIceSection(segment)
    || segment.exposure >= 54
    || segment.difficulty >= 58
    || /срыв|станц|карниз|трещ|спуск|обвал/i.test(segment.hazard);
}

function need(
  gearId: string,
  current: number,
  minimum: number,
  recommended: number,
  opens: string,
  effect: string,
  without: string,
): RouteGearNeed {
  const tone: GearPlanTone = current < minimum ? 'DANGER' : current < recommended ? 'WARNING' : 'GOOD';
  return { gearId, current, minimum, recommended, tone, opens, effect, without };
}

export function analyzeRouteEquipment(route: ExpeditionRoute, plan: ExpeditionPlan, teamSize: number): RouteEquipmentAnalysis {
  const safeTeamSize = Math.max(1, teamSize);
  const ascent = route.segments;
  const descent = route.descentSegments ?? [];
  const rockSections = ascent.filter(isRockSection).length + Math.ceil(descent.filter(isRockSection).length * .45);
  const iceSections = ascent.filter(isIceSection).length + Math.ceil(descent.filter(isIceSection).length * .45);
  const rawProtectionSites = ascent.filter(isProtectionSite).length + Math.ceil(descent.filter(isProtectionSite).length * .55);
  const technicalProtectionSites = clamp(Math.ceil(rawProtectionSites / 2), 0, 10);
  const descentDemand = route.mountainCharacterId === 'DESCENT' || route.objectiveRisk >= 68 ? 20 : 0;
  const minimumRopeMeters = technicalProtectionSites === 0 ? 0 : clamp(Math.ceil(technicalProtectionSites * .45) * 20, 20, 120);
  const fullProtectionRopeMeters = technicalProtectionSites === 0 ? 0 : clamp(technicalProtectionSites * 20 + descentDemand, 20, 200);
  const recommendedRopeMeters = technicalProtectionSites === 0
    ? 0
    : clamp(Math.max(minimumRopeMeters, Math.ceil(technicalProtectionSites * .72) * 20 + descentDemand), 20, fullProtectionRopeMeters);
  const minimumRopeBundles = Math.ceil(minimumRopeMeters / ROPE_BUNDLE_METERS);
  const recommendedRopeBundles = Math.ceil(recommendedRopeMeters / ROPE_BUNDLE_METERS);
  const plannedRopeMeters = ropeMetersFromGear(plan.gear);

  const expectedNights = Math.max(0, Math.ceil(route.estimatedHours / 12) - 1);
  const minimumFoodDays = Math.max(2, Math.ceil(route.estimatedHours / 24) + 1);
  const recommendedFoodDays = clamp(minimumFoodDays + (route.objectiveRisk >= 58 ? 2 : 1), minimumFoodDays, 10);
  const minimumFuelUnits = expectedNights > 0 ? Math.max(1, expectedNights) : 1;
  const recommendedFuelUnits = clamp(minimumFuelUnits + (route.summitElevation >= 5000 ? 2 : 1), minimumFuelUnits, 10);
  const recommendedTentUnits = expectedNights > 0 ? clamp(Math.ceil(expectedNights / 1.5), 1, 4) : 0;
  const recommendedBivyUnits = route.objectiveRisk >= 45 || expectedNights > 0 ? 1 : 0;

  const gear = plan.gear ?? {};
  const needs: Record<string, RouteGearNeed> = {
    rope: need(
      'rope', gear.rope ?? 0, minimumRopeBundles, recommendedRopeBundles,
      `${plannedRopeMeters} м рабочей линии: по 20 м на закреплённый участок`,
      `Оценка маршрута: минимум ${minimumRopeMeters} м, рекомендуется ${recommendedRopeMeters} м, полная защита около ${fullProtectionRopeMeters} м.`,
      technicalProtectionSites > 0 ? 'Технические клетки придётся обходить или проходить без защиты; на спуске возрастёт риск отката и срыва.' : 'На этом маршруте фиксированная линия почти не нужна.',
    ),
    'rock-kit': need(
      'rock-kit', gear['rock-kit'] ?? 0, rockSections > 0 ? 1 : 0, rockSections > 0 ? 1 : 0,
      `${rockSections} скальных и смешанных участков`,
      'Поддерживает скальные станции, карабины и работу на гребнях. Изнашивается отдельно от ледового комплекта.',
      rockSections > 0 ? 'Скальные клетки получают штраф к риску, а при сильном износе линия закрывается.' : 'Скальное железо будет лишним весом.',
    ),
    'ice-kit': need(
      'ice-kit', gear['ice-kit'] ?? 0, iceSections > 0 ? 1 : 0, iceSections > 0 ? 1 : 0,
      `${iceSections} ледовых, фирновых и снежных участков`,
      'Отдельно поддерживает кошки, ледобуры и работу в трещинах.',
      iceSections > 0 ? 'Ледник и крутой снег становятся медленнее и опаснее; при критическом износе проход закрывается.' : 'Ледовый комплект будет лишним весом.',
    ),
    tent: need(
      'tent', gear.tent ?? 0, expectedNights > 0 ? 1 : 0, recommendedTentUnits,
      expectedNights > 0 ? `${expectedNights} ожидаемых ночёвок и полноценный сон` : 'Полный лагерь не обязателен',
      'Каждая палатка позволяет оставить один высотный лагерь и провести полноценную ночь на безопасной площадке.',
      expectedNights > 0 ? 'Без палатки останется только аварийный бивак: восстановление слабее, холод действует сильнее.' : 'На коротком маршруте палатка может оказаться лишним грузом.',
    ),
    bivy: need(
      'bivy', gear.bivy ?? 0, 0, recommendedBivyUnits,
      'Аварийную остановку вне лагерной площадки',
      'Позволяет переждать затянувшийся спуск или сорванный график, но не заменяет полноценный сон.',
      'При задержке группа останется без аварийного укрытия и быстрее потеряет состояние от холода.',
    ),
    stove: need(
      'stove', gear.stove ?? 0, expectedNights > 0 ? 1 : 0, expectedNights >= 3 ? 2 : expectedNights > 0 ? 1 : 0,
      'Топку снега, длительный отдых и полноценный сон',
      `Нужно минимум ${minimumFuelUnits} ед. топлива, рекомендуется ${recommendedFuelUnits}.`,
      expectedNights > 0 ? 'Без горелки длительный отдых и получение воды из снега недоступны.' : 'На короткой линии горелка остаётся резервом.',
    ),
    medkit: need(
      'medkit', gear.medkit ?? 0, route.objectiveRisk >= 58 ? 1 : 0, 1,
      'Лечение травм во время длительного отдыха',
      'Одна аптечка даёт три применения и снижает тяжесть происшествий.',
      'Травмы останутся без полевой обработки и чаще приведут к отходу или спасательной операции.',
    ),
    radio: need(
      'radio', gear.radio ?? 0, 0, route.objectiveRisk >= 48 || route.expeditionScale !== 'SMALL' ? 1 : 0,
      'Связь со школой и вызов спасателей',
      'Снижает задержку спасательной операции и время ожидания помощи.',
      'Спасатели будут искать группу дольше; холод и стоимость эвакуации вырастут.',
    ),
  };

  for (const gearId of route.requiredGearIds) {
    const currentNeed = needs[gearId];
    if (!currentNeed) continue;
    const minimum = Math.max(1, currentNeed.minimum);
    const recommended = Math.max(minimum, currentNeed.recommended);
    needs[gearId] = need(
      gearId,
      currentNeed.current,
      minimum,
      recommended,
      currentNeed.opens,
      currentNeed.effect,
      currentNeed.without,
    );
  }

  const warnings: string[] = [];
  const strengths: string[] = [];
  for (const item of Object.values(needs)) {
    if (item.tone === 'DANGER') warnings.push(item.without);
    else if (item.tone === 'GOOD' && item.recommended > 0) strengths.push(item.effect);
  }
  if (plan.foodDays < minimumFoodDays) warnings.push(`Еды меньше минимума: ${plan.foodDays}/${minimumFoodDays} дн.`);
  else if (plan.foodDays >= recommendedFoodDays) strengths.push(`Еда закрывает ${recommendedFoodDays} дн. с резервом.`);
  if (plan.fuelUnits < minimumFuelUnits) warnings.push(`Топлива меньше минимума: ${plan.fuelUnits}/${minimumFuelUnits}.`);
  else if (plan.fuelUnits >= recommendedFuelUnits) strengths.push(`Топливо закрывает ночёвки и резерв воды.`);

  return {
    teamSize: safeTeamSize,
    expectedNights,
    rockSections,
    iceSections,
    technicalProtectionSites,
    minimumRopeMeters,
    recommendedRopeMeters,
    fullProtectionRopeMeters,
    minimumRopeBundles,
    recommendedRopeBundles,
    plannedRopeMeters,
    minimumFoodDays,
    recommendedFoodDays,
    minimumFuelUnits,
    recommendedFuelUnits,
    recommendedTentUnits,
    recommendedBivyUnits,
    needs,
    warnings,
    strengths,
  };
}

export function equipmentPresetForRoute(route: ExpeditionRoute, plan: ExpeditionPlan, teamSize: number, preset: 'MINIMUM' | 'RECOMMENDED') {
  const analysis = analyzeRouteEquipment(route, plan, teamSize);
  const gear: Record<string, number> = {};
  for (const [gearId, item] of Object.entries(analysis.needs)) gear[gearId] = preset === 'MINIMUM' ? item.minimum : item.recommended;
  return {
    gear,
    foodDays: preset === 'MINIMUM' ? analysis.minimumFoodDays : analysis.recommendedFoodDays,
    fuelUnits: preset === 'MINIMUM' ? analysis.minimumFuelUnits : analysis.recommendedFuelUnits,
    ropeMeters: (gear.rope ?? 0) * ROPE_BUNDLE_METERS,
  };
}

export function equipmentReadinessScore(analysis: RouteEquipmentAnalysis, packWeightKg: number) {
  const hardDeficits = Object.values(analysis.needs).reduce((sum, item) => sum + Math.max(0, item.minimum - item.current), 0);
  const softDeficits = Object.values(analysis.needs).reduce((sum, item) => sum + Math.max(0, item.recommended - Math.max(item.current, item.minimum)), 0);
  const weightPenalty = Math.max(0, packWeightKg - 16) * 3.2;
  const foodPenalty = analysis.warnings.some(item => item.startsWith('Еды меньше')) ? 16 : 0;
  const fuelPenalty = analysis.warnings.some(item => item.startsWith('Топлива меньше')) ? 14 : 0;
  return clamp(Math.round(100 - hardDeficits * 22 - softDeficits * 6 - foodPenalty - fuelPenalty - weightPenalty), 0, 100);
}

export function gearDefinitionById(catalog: GearDefinition[], id: string) {
  return catalog.find(item => item.id === id) ?? null;
}
