import { detectTerrainModule, terrainModuleById } from '../content/terrainModules';
import { targetStageBudget } from './contentPipeline';
import { createParticipantEvent, resolveParticipantSkill } from './expeditionEngine';
import { createRng } from './rng';
import type {
  CareerState,
  ClimbStepResult,
  ExpeditionActionPreview,
  ExpeditionFieldActionId,
  ExpeditionLeaderOrder,
  ExpeditionPreparationTag,
  ExpeditionRoute,
  ExpeditionSimulationStage,
  ExpeditionSimulationState,
  ParticipantSceneOption,
  QualificationClimb,
  RouteSegment,
  SkillId,
} from './types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const actionTitles: Record<ExpeditionFieldActionId, string> = {
  MOVE_CAUTIOUS: 'Идти осторожно',
  MOVE_STEADY: 'Двигаться ровно',
  MOVE_FAST: 'Ускориться',
  SCOUT_LINE: 'Разведать линию',
  PLACE_ANCHOR: 'Поставить точку',
  FIX_ROPE: 'Закрепить верёвку',
  CHECK_SURFACE: 'Проверить снег и лёд',
  REST_SHORT: 'Короткий отдых',
  EAT_DRINK: 'Есть и пить',
  MAKE_CAMP: 'Поставить лагерь',
  MELT_SNOW: 'Топить снег',
  HELP_TEAM: 'Помочь группе',
  DROP_LOAD: 'Бросить часть груза',
  REQUEST_AID: 'Запросить помощь',
  CHALLENGE_ORDER: 'Оспорить приказ',
  TURN_BACK: 'Начать отход',
};


const movementTitles: Partial<Record<ExpeditionSimulationStage['terrainModuleId'], [string, string, string]>> = {
  APPROACH_TRAIL: ['Идти коротким шагом', 'Держать походный темп', 'Ускорить колонну'],
  MORAINE: ['Идти по устойчивым камням', 'Пересечь морену', 'Быстро пройти осыпь'],
  GLACIER: ['Двигаться в связке', 'Идти по отмеченной линии', 'Ускориться на леднике'],
  CREVASSE_FIELD: ['Прощупывать путь', 'Идти по проверенной линии', 'Форсировать мосты'],
  ICEFALL: ['Проходить под защитой', 'Двигаться без остановки', 'Форсировать ледопад'],
  ROCK_WALL: ['Лезть под страховкой', 'Пройти верёвку', 'Лезть на пределе'],
  MIXED_FACE: ['Проверять каждое движение', 'Пройти микст', 'Форсировать стену'],
  SNOW_SLOPE: ['Нагружать склон по одному', 'Идти по следу', 'Форсировать склон'],
  RIDGE: ['Держаться безопасной стороны', 'Двигаться по гребню', 'Ускориться на гребне'],
  ALTITUDE_PLATEAU: ['Беречь дыхание', 'Держать высотный темп', 'Ускорить набор'],
  EXIT_TRAIL: ['Идти аккуратно к старту', 'Возвращаться по тропе', 'Ускорить выход'],
};

function contextualActionTitle(career: CareerState, actionId: ExpeditionFieldActionId, stage: ExpeditionSimulationStage) {
  if (actionId === 'MOVE_CAUTIOUS' || actionId === 'MOVE_STEADY' || actionId === 'MOVE_FAST') {
    const titles = movementTitles[stage.terrainModuleId];
    if (titles) return titles[actionId === 'MOVE_CAUTIOUS' ? 0 : actionId === 'MOVE_STEADY' ? 1 : 2];
  }
  if (actionId === 'MAKE_CAMP') {
    if (career.activeClimb?.authorityMode === 'COMMAND') return stage.phase === 'BASE_CAMP' ? 'Развернуть базовый лагерь' : 'Организовать лагерь';
    return stage.phase === 'BASE_CAMP' ? 'Работать на базовом лагере' : 'Помочь разбить лагерь';
  }
  if (actionId === 'PLACE_ANCHOR' && career.activeClimb?.playerRole === 'SUPPORT') return 'Поставить точку по команде';
  if (actionId === 'FIX_ROPE' && career.activeClimb?.playerRole !== 'ROPE_LEAD' && career.activeClimb?.authorityMode !== 'COMMAND') return 'Помочь закрепить линию';
  return actionTitles[actionId];
}

function actionSkill(actionId: ExpeditionFieldActionId, stage: ExpeditionSimulationStage): SkillId | null {
  if (actionId === 'SCOUT_LINE') return 'NAVIGATION';
  if (actionId === 'PLACE_ANCHOR' || actionId === 'FIX_ROPE') return stage.terrain.toLowerCase().includes('лед') ? 'ICE' : 'ROCK';
  if (actionId === 'CHECK_SURFACE') return stage.terrain.toLowerCase().includes('лед') || stage.terrain.toLowerCase().includes('снег') ? 'ICE' : 'NAVIGATION';
  if (actionId === 'HELP_TEAM' || actionId === 'REQUEST_AID') return 'MEDICINE';
  if (actionId === 'CHALLENGE_ORDER') return 'LEADERSHIP';
  if (actionId.startsWith('MOVE_')) return stage.skill;
  return null;
}


function uniqueTags(tags: ExpeditionPreparationTag[]) {
  return [...new Set(tags)];
}

export function isStagePrepared(stage: ExpeditionSimulationStage) {
  return stage.preparationOptions.some(option => option.every(tag => stage.preparationTags.includes(tag)));
}

export function missingStagePreparation(stage: ExpeditionSimulationStage) {
  const tagCost: Record<ExpeditionPreparationTag, number> = {
    ROUTE_SCOUTED: 1,
    SURFACE_CHECKED: 1,
    TEAM_STABILIZED: 1,
    ANCHOR_PLACED: 2,
    ROPE_FIXED: 6,
  };
  const options = stage.preparationOptions
    .map(option => option.filter(tag => !stage.preparationTags.includes(tag)))
    .sort((a, b) => a.reduce((sum, tag) => sum + tagCost[tag], 0) - b.reduce((sum, tag) => sum + tagCost[tag], 0));
  return options[0] ?? [];
}

function addPreparationTag(stage: ExpeditionSimulationStage, tag: ExpeditionPreparationTag) {
  return { ...stage, preparationTags: uniqueTags([...stage.preparationTags, tag]) };
}

function phaseForSegment(segment: RouteSegment) {
  if (segment.exposure >= 58) return 'HAZARD' as const;
  if (segment.difficulty >= 58) return 'TECHNICAL' as const;
  return 'TECHNICAL' as const;
}

function distributeCounts(segments: RouteSegment[], target: number) {
  const weights = segments.map(segment => Math.max(1, segment.elevationGain) * (1 + segment.difficulty / 130 + segment.exposure / 180));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const counts = weights.map(weight => Math.max(2, Math.round(target * weight / total)));
  while (counts.reduce((sum, value) => sum + value, 0) < target) {
    const index = weights.indexOf(Math.max(...weights));
    counts[index] += 1;
  }
  while (counts.reduce((sum, value) => sum + value, 0) > target && counts.some(value => value > 2)) {
    const candidates = counts.map((value, index) => ({ value, index, weight: weights[index]! })).filter(item => item.value > 2).sort((a, b) => a.weight - b.weight);
    counts[candidates[0]!.index] -= 1;
  }
  return counts;
}

function campStage(route: ExpeditionRoute, id: string, label: string, relativeElevation: number, phase: 'BASE_CAMP' | 'CAMP'): ExpeditionSimulationStage {
  const module = terrainModuleById('CAMP_ZONE');
  return {
    id,
    terrainModuleId: module.id,
    sourceSegmentId: null,
    linkedAscentStageId: null,
    phase,
    label,
    terrain: module.label,
    hazard: phase === 'BASE_CAMP' ? 'Организация лагеря и проверка готовности группы' : 'Потеря времени, топлива и тепла при плохой организации',
    skill: module.primarySkill,
    difficulty: module.baseDifficulty,
    exposure: module.baseExposure,
    relativeStart: relativeElevation,
    relativeEnd: relativeElevation,
    progress: 0,
    requiredProgress: 100,
    preparation: 0,
    routeKnowledge: 20,
    surfaceKnowledge: 0,
    anchorsPlaced: 0,
    ropeFixed: false,
    campPossible: true,
    critical: false,
    preparationOptions: module.preparationOptions,
    preparationTags: [],
    recommendedActions: ['MAKE_CAMP', 'EAT_DRINK', 'MELT_SNOW', 'HELP_TEAM'],
    repetitionKey: `${module.id}:${phase}:${id}`,
    incidentHistory: [],
    completed: false,
  };
}

function buildAscentStages(route: ExpeditionRoute): ExpeditionSimulationStage[] {
  const budget = targetStageBudget(route);
  const maxRelative = Math.max(1, route.summitElevation - route.startElevation);
  const approachCount = budget.scale === 'GIANT' ? 4 : budget.scale === 'MAJOR' ? 3 : 2;
  const approachRatio = budget.scale === 'GIANT' ? .22 : budget.scale === 'MAJOR' ? .19 : .15;
  const approachGain = Math.round(clamp(maxRelative * approachRatio, Math.min(260, maxRelative * .2), Math.min(1200, maxRelative * .32)));
  const campStops = route.segments.slice(0, -1).filter(segment => segment.campPossible).length;
  const movementTarget = Math.max(route.segments.length * 2, budget.ascent - approachCount - 1 - campStops);
  const counts = distributeCounts(route.segments, movementTarget);
  const stages: ExpeditionSimulationStage[] = [];

  for (let index = 0; index < approachCount; index += 1) {
    const module = terrainModuleById('APPROACH_TRAIL');
    const startElevation = Math.round(approachGain * index / approachCount);
    const endElevation = Math.round(approachGain * (index + 1) / approachCount);
    stages.push({
      id: `${route.id}:approach:${index + 1}`,
      terrainModuleId: module.id,
      sourceSegmentId: null,
      linkedAscentStageId: null,
      phase: 'APPROACH',
      label: index === 0 ? 'Нижний подход' : index === approachCount - 1 ? 'Выход к базовому лагерю' : 'Подход по долине',
      terrain: module.label,
      hazard: index === approachCount - 1 ? 'Растянутая колонна и тяжёлый груз' : 'Неверный темп в начале пути',
      skill: module.primarySkill,
      difficulty: clamp(module.baseDifficulty + route.estimatedHours * .28 + index * 2),
      exposure: module.baseExposure,
      relativeStart: startElevation,
      relativeEnd: endElevation,
      progress: 0,
      requiredProgress: 70,
      preparation: 0,
      routeKnowledge: 0,
      surfaceKnowledge: 0,
      anchorsPlaced: 0,
      ropeFixed: false,
      campPossible: false,
      critical: false,
      preparationOptions: module.preparationOptions,
      preparationTags: [],
      recommendedActions: module.recommendedActions,
      repetitionKey: `${module.id}:${index}`,
      incidentHistory: [],
      completed: false,
    });
  }

  stages.push(campStage(route, `${route.id}:base-camp`, 'Базовый лагерь', approachGain, 'BASE_CAMP'));

  const remainingGain = Math.max(1, maxRelative - approachGain);
  const rawTotal = Math.max(1, route.segments.reduce((sum, segment) => sum + Math.max(1, segment.elevationGain), 0));
  const scaledGains = route.segments.map(segment => Math.max(1, Math.round(remainingGain * Math.max(1, segment.elevationGain) / rawTotal)));
  scaledGains[scaledGains.length - 1] += remainingGain - scaledGains.reduce((sum, value) => sum + value, 0);
  let relative = approachGain;

  route.segments.forEach((segment, segmentIndex) => {
    const count = counts[segmentIndex]!;
    const segmentGain = scaledGains[segmentIndex]!;
    const segmentStart = relative;
    const module = segment.terrainModuleId ? terrainModuleById(segment.terrainModuleId) : detectTerrainModule(segment.terrain);
    for (let index = 0; index < count; index += 1) {
      const startElevation = segmentStart + Math.round(segmentGain * index / count);
      const endElevation = segmentStart + Math.round(segmentGain * (index + 1) / count);
      const finalPart = index === count - 1;
      const moduleCheckpoint = module.id === 'ICEFALL'
        ? (index + 1) % 3 === 0
        : module.id === 'MIXED_FACE'
          ? (index + 1) % 2 === 0
          : false;
      const critical = (finalPart && (segment.difficulty >= 52 || segment.exposure >= 45 || Boolean(segment.decisionId))) || moduleCheckpoint;
      const requiredProgress = Math.round((critical ? 145 : segment.difficulty >= 55 ? 86 : 64) / module.progressMultiplier);
      stages.push({
        id: `${route.id}:ascent:${segment.id}:${index + 1}`,
        terrainModuleId: module.id,
        sourceSegmentId: segment.id,
        linkedAscentStageId: null,
        phase: segment.decisionId && finalPart ? 'DECISION' : phaseForSegment(segment),
        label: count > 2 ? `${segment.name} · ${index + 1}/${count}` : segment.name,
        terrain: segment.terrain,
        hazard: segment.hazard,
        skill: segment.skill ?? module.primarySkill,
        difficulty: clamp(Math.max(module.baseDifficulty, segment.difficulty) + (critical ? 7 : index * .55)),
        exposure: clamp(Math.max(module.baseExposure, segment.exposure) + (critical ? 7 : 0)),
        relativeStart: startElevation,
        relativeEnd: endElevation,
        progress: 0,
        requiredProgress,
        preparation: 0,
        routeKnowledge: 0,
        surfaceKnowledge: 0,
        anchorsPlaced: 0,
        ropeFixed: false,
        campPossible: false,
        critical,
        preparationOptions: module.preparationOptions,
        preparationTags: [],
        recommendedActions: module.recommendedActions,
        repetitionKey: `${module.id}:${segment.id}`,
        incidentHistory: [],
        completed: false,
      });
    }
    relative += segmentGain;
    if (segment.campPossible && segmentIndex < route.segments.length - 1) {
      stages.push(campStage(route, `${route.id}:camp:${segment.id}`, `Лагерь · ${segment.name}`, relative, 'CAMP'));
    }
  });

  const finalStage = [...stages].reverse().find(stage => stage.relativeStart !== stage.relativeEnd);
  if (finalStage) finalStage.relativeEnd = maxRelative;
  return stages;
}

function buildFullDescentStages(route: ExpeditionRoute, ascent: ExpeditionSimulationStage[]): ExpeditionSimulationStage[] {
  const movementStages = ascent.filter(stage => stage.relativeStart !== stage.relativeEnd);
  const stages: ExpeditionSimulationStage[] = movementStages.reverse().map((source, index) => {
    const module = terrainModuleById(source.terrainModuleId);
    const inheritedTags = [...source.preparationTags];
    if (source.ropeFixed && !inheritedTags.includes('ROPE_FIXED')) inheritedTags.push('ROPE_FIXED');
    if (source.anchorsPlaced > 0 && !inheritedTags.includes('ANCHOR_PLACED')) inheritedTags.push('ANCHOR_PLACED');
    const critical = source.critical || source.exposure >= 58;
    return {
      ...source,
      id: `${route.id}:descent:${source.id}:${index + 1}`,
      linkedAscentStageId: source.id,
      phase: 'DESCENT' as const,
      label: `Спуск · ${source.label}`,
      hazard: `${source.hazard}; усталость и обратное движение`,
      difficulty: clamp(source.difficulty + module.descentDifficultyModifier + (critical ? 4 : 0)),
      exposure: clamp(source.exposure + 5 + (critical ? 5 : 0)),
      relativeStart: source.relativeEnd,
      relativeEnd: source.relativeStart,
      progress: 0,
      requiredProgress: Math.round((critical ? 128 : source.difficulty >= 55 ? 78 : 58) / module.progressMultiplier),
      preparation: source.ropeFixed ? 30 : source.preparation * .55,
      routeKnowledge: Math.max(15, source.routeKnowledge),
      surfaceKnowledge: source.surfaceKnowledge,
      preparationTags: uniqueTags(inheritedTags),
      campPossible: false,
      critical,
      recommendedActions: module.recommendedActions,
      repetitionKey: `${module.id}:${source.id}:descent`,
      incidentHistory: [],
      completed: false,
    };
  });

  const exitModule = terrainModuleById('EXIT_TRAIL');
  stages.push({
    id: `${route.id}:descent:exit`, sourceSegmentId: null, linkedAscentStageId: null, phase: 'EXIT', label: 'Выход к точке старта', terrainModuleId: exitModule.id,
    terrain: exitModule.label, hazard: 'Усталость на простом рельефе', skill: exitModule.primarySkill, difficulty: 24, exposure: 7,
    relativeStart: 0, relativeEnd: 0, progress: 0, requiredProgress: 88, preparation: 0, routeKnowledge: 30, surfaceKnowledge: 0,
    anchorsPlaced: 0, ropeFixed: false, campPossible: false, critical: false, preparationOptions: exitModule.preparationOptions, preparationTags: [],
    recommendedActions: exitModule.recommendedActions, repetitionKey: `${exitModule.id}:exit`, incidentHistory: [], completed: false,
  });
  return stages;
}

export function createExpeditionSimulation(route: ExpeditionRoute): ExpeditionSimulationState {
  const ascentStages = buildAscentStages(route);
  const descentStages = buildFullDescentStages(route, ascentStages);
  return {
    version: 3,
    direction: 'ASCENT',
    status: 'ACTIVE',
    ascentStages,
    descentStages,
    stageIndex: 0,
    relativeElevation: 0,
    maxRelativeElevation: Math.max(0, route.summitElevation - route.startElevation),
    highestRelativeElevation: 0,
    totalActions: 0,
    totalMovementActions: 0,
    eventSerial: 0,
    actionsUntilEvent: 6,
    activeEvent: null,
    leaderOrder: null,
    survivalTurns: 0,
    forcedRetreat: false,
    returnReason: null,
    loadDroppedKg: 0,
    rescueEtaMinutes: null,
    actionLog: [],
    failureTrace: [],
    lastCheckpointAction: 0,
  };
}

export function hydrateExpeditionSimulation(climb: QualificationClimb, route: ExpeditionRoute): ExpeditionSimulationState {
  if (climb.simulation?.version === 3) return climb.simulation;
  const fresh = createExpeditionSimulation(route);
  const legacy = climb.simulation as any;
  const direction = legacy?.direction === 'DESCENT' || climb.phase === 'DESCENT' ? 'DESCENT' as const : 'ASCENT' as const;
  const relative = clamp(climb.currentElevation - climb.startElevation, 0, fresh.maxRelativeElevation);
  const stages = direction === 'ASCENT' ? fresh.ascentStages : fresh.descentStages;
  let stageIndex = stages.findIndex(stage => direction === 'ASCENT'
    ? relative <= Math.max(stage.relativeStart, stage.relativeEnd)
    : relative >= Math.min(stage.relativeStart, stage.relativeEnd));
  if (stageIndex < 0) stageIndex = Math.max(0, stages.length - 1);
  const actionLog = Array.isArray(legacy?.actionLog) ? legacy.actionLog.map((record: any, index: number) => ({
    id: record.id ?? `${climb.id}:legacy-action:${index}`,
    actionId: record.actionId ?? 'MOVE_STEADY',
    stageId: record.stageId ?? stages[stageIndex]?.id ?? 'legacy',
    success: record.success !== false,
    detail: record.detail ?? 'Восстановлено из старого сейва.',
    elapsedMinutes: record.elapsedMinutes ?? climb.elapsedMinutes,
    relativeElevation: record.relativeElevation ?? relative,
    energyAfter: record.energyAfter ?? climb.energy,
    conditionAfter: record.conditionAfter ?? climb.condition,
    stageProgressAfter: record.stageProgressAfter ?? 0,
    suppliesAfter: record.suppliesAfter ?? { ...climb.supplies },
  })) : [];
  return {
    ...fresh,
    direction,
    status: legacy?.status ?? (climb.phase === 'SUMMIT' ? 'SUMMIT' : 'ACTIVE'),
    relativeElevation: relative,
    highestRelativeElevation: Math.max(relative, legacy?.highestRelativeElevation ?? relative),
    stageIndex,
    totalActions: legacy?.totalActions ?? actionLog.length,
    totalMovementActions: legacy?.totalMovementActions ?? climb.moveCount,
    eventSerial: legacy?.eventSerial ?? 0,
    actionsUntilEvent: legacy?.actionsUntilEvent ?? 4,
    forcedRetreat: legacy?.forcedRetreat ?? climb.retreating,
    returnReason: legacy?.returnReason ?? null,
    loadDroppedKg: legacy?.loadDroppedKg ?? 0,
    rescueEtaMinutes: legacy?.rescueEtaMinutes ?? null,
    actionLog,
    failureTrace: legacy?.failureTrace ?? [],
    lastCheckpointAction: legacy?.lastCheckpointAction ?? actionLog.length,
  };
}

export function currentExpeditionStage(career: CareerState) {
  const simulation = career.activeClimb?.simulation;
  if (!simulation) return null;
  const stages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
  return stages[Math.min(simulation.stageIndex, Math.max(0, stages.length - 1))] ?? null;
}

function leaderFor(career: CareerState) {
  const id = career.activeClimb?.leaderNpcId;
  return id ? career.teamRoster.find(member => member.id === id) ?? null : null;
}

function makeLeaderOrder(career: CareerState, stage: ExpeditionSimulationStage, actionCount: number): ExpeditionLeaderOrder | null {
  const climb = career.activeClimb;
  if (!climb || climb.authorityMode === 'COMMAND') return null;
  const leader = leaderFor(career);
  const cautious = (leader?.personality.caution ?? 55) >= (leader?.personality.ambition ?? 50);
  let preferredAction: ExpeditionFieldActionId = cautious ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
  let text = cautious ? 'Держать связку плотной. Не ускоряться без команды.' : 'Темп не терять. Пройти участок до следующей остановки.';
  if (stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP') {
    preferredAction = 'MAKE_CAMP';
    text = stage.phase === 'BASE_CAMP' ? 'Развернуть базовый лагерь. Выполнить свою часть работы и доложить о готовности.' : 'Группа останавливается на ночёвку. Помочь поставить лагерь.';
  } else if (stage.critical && stage.exposure >= 50) {
    preferredAction = stage.terrain.toLowerCase().includes('снег') || stage.terrain.toLowerCase().includes('лед') ? 'CHECK_SURFACE' : 'PLACE_ANCHOR';
    text = preferredAction === 'CHECK_SURFACE' ? 'Сначала проверить поверхность. Никого не выпускать на склон вслепую.' : 'Поставить надёжную точку и только потом вести связку.';
  } else if (stage.critical && stage.difficulty >= 62) {
    preferredAction = 'FIX_ROPE';
    text = 'Закрепить линию. Скорость сейчас не важнее обратного пути.';
  } else if (!cautious && stage.exposure < 42) {
    preferredAction = 'MOVE_FAST';
    text = 'Участок простой. Ускориться и не тратить окно.';
  }
  return { id: `${climb.id}:order:${actionCount}:${stage.id}`, text, preferredAction, issuedAtAction: actionCount, strictness: clamp(45 + (leader?.personality.discipline ?? 50) * .45), resolved: false, obeyed: null };
}

function chanceFor(career: CareerState, actionId: ExpeditionFieldActionId, stage: ExpeditionSimulationStage) {
  const climb = career.activeClimb!;
  const skillId = actionSkill(actionId, stage);
  const skill = skillId ? career.hero.skills[skillId] : 5;
  const paceModifier = actionId === 'MOVE_CAUTIOUS' ? 18 : actionId === 'MOVE_FAST' ? -14 : 0;
  const weatherPenalty = Math.max(0, climb.windKmh - 45) * .18 + Math.max(0, 45 - climb.visibility) * .15 + Math.max(0, -20 - climb.temperatureC) * .25;
  const fatiguePenalty = Math.max(0, climb.hoursAwake - 14) * .9 + Math.max(0, 25 - climb.energy) * .25;
  const prepared = isStagePrepared(stage);
  const missing = missingStagePreparation(stage).length;
  const preparation = stage.preparation * .3 + stage.routeKnowledge * .2 + stage.surfaceKnowledge * .22 + stage.anchorsPlaced * 7 + (stage.ropeFixed ? 12 : 0) + (prepared ? 12 : 0);
  const tacticalPenalty = actionId.startsWith('MOVE_') && stage.critical && !prepared ? 18 + missing * 5 : 0;
  const loadPenalty = Math.max(0, climb.packWeightKg - 13) * 1.1;
  const raw = 52 + skill * 7 + career.hero.form * .15 + preparation + paceModifier - stage.difficulty * .52 - stage.exposure * .16 - weatherPenalty - fatiguePenalty - loadPenalty - tacticalPenalty;
  return Math.round(clamp(raw, 4, 96));
}

function simulationFor(career: CareerState) {
  return career.activeClimb!.simulation!;
}

function preview(career: CareerState, actionId: ExpeditionFieldActionId): ExpeditionActionPreview {
  const climb = career.activeClimb!;
  const simulation = simulationFor(career);
  const stage = currentExpeditionStage(career)!;
  const skill = actionSkill(actionId, stage);
  const move = actionId.startsWith('MOVE_');
  const pace = actionId === 'MOVE_CAUTIOUS' ? .78 : actionId === 'MOVE_FAST' ? 1.28 : 1;
  const duration = move
    ? Math.round((24 + stage.difficulty * .34 + stage.exposure * .18) / pace)
    : actionId === 'SCOUT_LINE' ? 35
      : actionId === 'PLACE_ANCHOR' ? 28
        : actionId === 'FIX_ROPE' ? 50
          : actionId === 'CHECK_SURFACE' ? 30
            : actionId === 'REST_SHORT' ? 60
              : actionId === 'EAT_DRINK' ? 20
                : actionId === 'MAKE_CAMP' ? 420
                  : actionId === 'MELT_SNOW' ? 50
                    : actionId === 'HELP_TEAM' ? 35
                      : actionId === 'DROP_LOAD' ? 15
                        : actionId === 'REQUEST_AID' ? 15
                          : actionId === 'CHALLENGE_ORDER' ? 20
                            : 10;
  const progress = move ? Math.round((actionId === 'MOVE_CAUTIOUS' ? 54 : actionId === 'MOVE_FAST' ? 82 : 68) + career.hero.skills[stage.skill] * 1.8) : 0;
  const movementCost = Math.max(1, Math.round((.8 + stage.difficulty * .012 + stage.exposure * .008 + Math.max(0, climb.packWeightKg - 13) * .05) * (actionId === 'MOVE_CAUTIOUS' ? .82 : actionId === 'MOVE_FAST' ? 1.34 : 1)));
  const energyDelta = move ? -movementCost
    : actionId === 'SCOUT_LINE' ? -1
      : actionId === 'PLACE_ANCHOR' || actionId === 'FIX_ROPE' ? -2
        : actionId === 'CHECK_SURFACE' ? -1
          : actionId === 'REST_SHORT' ? 9
            : actionId === 'EAT_DRINK' ? 10
              : actionId === 'MAKE_CAMP' ? 42
                : actionId === 'HELP_TEAM' ? -1
                  : actionId === 'REQUEST_AID' ? -1
                    : 0;
  let disabledReason: string | null = null;
  const plannedCamp = stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP';
  if (simulation.activeEvent) disabledReason = 'Сначала разреши текущую ситуацию.';
  else if (simulation.status === 'SUMMIT' || simulation.status === 'SAFE' || simulation.status === 'DEAD' || simulation.status === 'EVACUATED') disabledReason = 'Действие сейчас недоступно.';
  else if (move && plannedCamp) disabledReason = 'Сначала группа должна закончить работу в лагере.';
  else if (move && stage.critical && !isStagePrepared(stage)) disabledReason = `Сначала подготовь участок: ${missingStagePreparation(stage).join(', ')}.`;
  else if (move && (climb.energy <= 1 || climb.condition <= 8 || simulation.status === 'STRANDED')) disabledReason = 'Сначала восстанови состояние или запроси помощь.';
  else if (actionId === 'FIX_ROPE' && (simulation.direction !== 'ASCENT' || climb.ropeMetersRemaining < 20 || stage.ropeFixed)) disabledReason = stage.ropeFixed ? 'Линия уже закреплена.' : 'Нужно 20 м свободной верёвки на подъёме.';
    else if (actionId === 'MAKE_CAMP' && !plannedCamp && simulation.status !== 'STRANDED') disabledReason = 'Лагерь организует руководитель только на назначенной площадке.';
  else if (actionId === 'MAKE_CAMP' && !stage.campPossible && !(career.expeditionPlan.gear.bivy ?? 0)) disabledReason = 'Здесь нет площадки и аварийного укрытия.';
  else if (actionId === 'MAKE_CAMP' && (climb.supplies.foodUnits <= 0 || climb.supplies.fuelUnits <= 0)) disabledReason = 'Для лагеря нужны еда и топливо.';
  else if (actionId === 'EAT_DRINK' && (climb.supplies.foodUnits <= 0 || climb.supplies.waterUnits <= 0)) disabledReason = 'Еда или вода закончились.';
  else if (actionId === 'MELT_SNOW' && (!plannedCamp || climb.supplies.fuelUnits <= 0)) disabledReason = plannedCamp ? 'Топливо закончилось.' : 'Снег топят во время остановки или лагеря.';
  else if (actionId === 'DROP_LOAD' && climb.packWeightKg - simulation.loadDroppedKg <= 7) disabledReason = 'Больше бросать нечего.';
  else if (actionId === 'REQUEST_AID' && simulation.rescueEtaMinutes !== null) disabledReason = 'Помощь уже вызвана.';
  else if (actionId === 'REQUEST_AID' && simulation.status !== 'STRANDED' && climb.condition > 18) disabledReason = 'Эвакуация вызывается при реальной невозможности двигаться.';
  else if (actionId === 'CHALLENGE_ORDER' && (!simulation.leaderOrder || simulation.leaderOrder.resolved)) disabledReason = 'Нет активного приказа.';
  else if (actionId === 'TURN_BACK' && simulation.direction !== 'ASCENT') disabledReason = 'Группа уже возвращается.';
  const successChance = skill ? chanceFor(career, actionId, stage) : null;
  const risk = successChance === null ? 0 : 100 - successChance + (move ? stage.exposure * .18 : 0);
  const riskLabel = risk < 18 ? 'НИЗКИЙ' : risk < 34 ? 'СРЕДНИЙ' : risk < 56 ? 'ВЫСОКИЙ' : 'КРИТИЧЕСКИЙ';
  const missingPreparation = missingStagePreparation(stage);
  const prepText = missingPreparation.length ? ` Не подготовлено: ${missingPreparation.join(', ')}.` : ' Участок подготовлен.';
  const detail = move
    ? `${progress} прогресса участка. Результат зависит от навыка, подготовки и темпа.${stage.critical ? prepText : ''}`
    : actionId === 'SCOUT_LINE' ? 'Открывает линию и повышает шанс следующего движения.'
      : actionId === 'PLACE_ANCHOR' ? 'Ставит точку из технического комплекта и повышает защиту участка.'
        : actionId === 'FIX_ROPE' ? 'Тратит 20 м верёвки, упрощает работу группы и обратный путь.'
          : actionId === 'CHECK_SURFACE' ? 'Снижает неизвестность снега, льда и трещин.'
            : actionId === 'REST_SHORT' ? 'Восстанавливает силы, но время и погода продолжают идти.'
              : actionId === 'EAT_DRINK' ? 'Тратит личный запас и возвращает рабочее состояние.'
                : actionId === 'MAKE_CAMP' ? (climb.authorityMode === 'COMMAND' ? 'Ты принимаешь решение о лагере и распределяешь работу.' : 'Руководитель остановил группу. Ты выполняешь свою часть лагерной работы.')
                  : actionId === 'MELT_SNOW' ? 'Топливо превращается в воду для всей группы.'
                    : actionId === 'HELP_TEAM' ? 'Стабилизирует слабого участника ценой твоих сил.'
                      : actionId === 'DROP_LOAD' ? 'Снижает вес, но часть груза останется на горе.'
                        : actionId === 'REQUEST_AID' ? 'Начинает реальную эвакуацию. До контакта нужно выжить.'
                          : actionId === 'CHALLENGE_ORDER' ? 'Проверка лидерства. Можно изменить опасный приказ.'
                            : 'Разворот не завершает экспедицию. Весь путь вниз останется впереди.';
  return { id: actionId, title: contextualActionTitle(career, actionId, stage), detail, durationMinutes: duration, energyDelta, progressDelta: progress, successChance, riskLabel, disabled: Boolean(disabledReason), disabledReason, skill };
}

function actionForPreparationTag(tag: ExpeditionPreparationTag): ExpeditionFieldActionId {
  if (tag === 'ROUTE_SCOUTED') return 'SCOUT_LINE';
  if (tag === 'SURFACE_CHECKED') return 'CHECK_SURFACE';
  if (tag === 'ANCHOR_PLACED') return 'PLACE_ANCHOR';
  if (tag === 'ROPE_FIXED') return 'FIX_ROPE';
  return 'HELP_TEAM';
}

export function previewExpeditionActions(career: CareerState): ExpeditionActionPreview[] {
  const climb = career.activeClimb;
  const stage = currentExpeditionStage(career);
  const simulation = climb?.simulation;
  if (!climb || !simulation || !stage || simulation.activeEvent) return [];

  const ids: ExpeditionFieldActionId[] = [];
  const add = (id: ExpeditionFieldActionId) => { if (!ids.includes(id)) ids.push(id); };
  const plannedCamp = stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP';
  const prepared = isStagePrepared(stage);

  if (simulation.status === 'STRANDED') {
    add('REST_SHORT');
    add('EAT_DRINK');
    if (stage.campPossible || (career.expeditionPlan.gear.bivy ?? 0) > 0) add('MAKE_CAMP');
    if (climb.packWeightKg - simulation.loadDroppedKg > 9) add('DROP_LOAD');
    add('REQUEST_AID');
    if (climb.teamCondition < 65) add('HELP_TEAM');
  } else if (plannedCamp) {
    add('MAKE_CAMP');
    if (climb.supplies.waterUnits < Math.max(8, climb.teamMemberIds.length * 2)) add('MELT_SNOW');
    add('EAT_DRINK');
    add('HELP_TEAM');
  } else {
    if (stage.critical && !prepared) {
      missingStagePreparation(stage).map(actionForPreparationTag).forEach(add);
    } else {
      if (stage.terrainModuleId === 'ICEFALL') {
        add('MOVE_STEADY'); add('MOVE_FAST');
      } else if (stage.exposure >= 55 || stage.terrainModuleId === 'CREVASSE_FIELD' || stage.terrainModuleId === 'RIDGE') {
        add('MOVE_CAUTIOUS'); add('MOVE_STEADY');
      } else if (stage.terrainModuleId === 'APPROACH_TRAIL' || stage.terrainModuleId === 'MORAINE' || stage.terrainModuleId === 'ALTITUDE_PLATEAU' || stage.terrainModuleId === 'EXIT_TRAIL') {
        add('MOVE_STEADY'); add('MOVE_FAST');
      } else {
        add('MOVE_CAUTIOUS'); add('MOVE_STEADY');
      }
    }

    const role = climb.playerRole;
    const ordered = simulation.leaderOrder?.resolved === false ? simulation.leaderOrder.preferredAction : null;
    const ropeCanProtect = simulation.direction === 'ASCENT'
      && climb.ropeMetersRemaining >= 20
      && !stage.ropeFixed
      && (stage.critical || stage.preparationOptions.some(option => option.includes('ROPE_FIXED')));
    if (ropeCanProtect) add('FIX_ROPE');
    for (const recommended of stage.recommendedActions) {
      if (recommended.startsWith('MOVE_')) continue;
      if (recommended === 'SCOUT_LINE' && !['NAVIGATOR', 'ROPE_LEAD', 'LEADER'].includes(role) && ordered !== 'SCOUT_LINE' && stage.terrainModuleId !== 'MORAINE') continue;
      add(recommended);
    }
    if (ordered) add(ordered);
    if (climb.teamCondition < 68 || missingStagePreparation(stage).includes('TEAM_STABILIZED')) add('HELP_TEAM');
    if (climb.energy < 58 || climb.hoursAwake >= 10) add('REST_SHORT');
    if (climb.energy < 68 || climb.hoursAwake >= 8) add('EAT_DRINK');
    if (climb.packWeightKg - simulation.loadDroppedKg > 19) add('DROP_LOAD');
    if (simulation.leaderOrder && !simulation.leaderOrder.resolved) add('CHALLENGE_ORDER');
  }

  const previews = ids.map(id => preview(career, id));
  const enabled = previews.filter(item => !item.disabled);
  const disabledRequired = previews.filter(item => item.disabled && ['SCOUT_LINE', 'PLACE_ANCHOR', 'FIX_ROPE', 'CHECK_SURFACE', 'MAKE_CAMP'].includes(item.id));
  return [...enabled, ...disabledRequired].slice(0, 6);
}

function consume(climb: QualificationClimb, minutes: number) {
  const teamSize = Math.max(1, climb.teamMemberIds.length + 1);
  const hours = minutes / 60;
  return {
    foodUnits: Math.max(0, climb.supplies.foodUnits - Math.floor(hours * teamSize / 7)),
    waterUnits: Math.max(0, climb.supplies.waterUnits - Math.floor(hours * teamSize / 5)),
    fuelUnits: climb.supplies.fuelUnits,
  };
}

function evolveWeather(career: CareerState, climb: QualificationClimb, minutes: number) {
  const rng = createRng(`${career.rootSeed}:${climb.id}:weather:${climb.elapsedMinutes}:${minutes}`);
  const steps = Math.max(1, Math.round(minutes / 45));
  const temperatureDrift = climb.temperatureC < -30 ? rng.int(0, 2) : climb.temperatureC > -8 ? rng.int(-2, 0) : rng.int(-1, 1);
  const windDrift = climb.windKmh > 68 ? rng.int(-8, 1) : climb.windKmh < 18 ? rng.int(-1, 6) : rng.int(-4, 4);
  const visibilityDrift = climb.visibility < 28 ? rng.int(0, 10) : climb.visibility > 86 ? rng.int(-8, 1) : rng.int(-6, 7);
  const longStopPenalty = minutes >= 300 ? rng.int(-1, 1) : 0;
  return {
    temperatureC: clamp(climb.temperatureC + temperatureDrift + longStopPenalty, -40, 8),
    windKmh: clamp(climb.windKmh + windDrift, 0, 82),
    visibility: clamp(climb.visibility + visibilityDrift, 8, 100),
    weatherStep: climb.weatherStep + steps,
  };
}

function buildRetreatStages(simulation: ExpeditionSimulationState) {
  const completed = simulation.ascentStages.slice(0, simulation.stageIndex + 1).filter(stage => Math.max(stage.relativeStart, stage.relativeEnd) <= simulation.relativeElevation + 1 || stage.id === simulation.ascentStages[simulation.stageIndex]?.id);
  const stages: ExpeditionSimulationStage[] = [];
  let current = simulation.relativeElevation;
  for (const source of [...completed].reverse()) {
    const lower = Math.min(source.relativeStart, source.relativeEnd, current);
    if (current <= lower && source.relativeStart === source.relativeEnd) continue;
    const fixed = source.ropeFixed;
    stages.push({
      ...source,
      id: `${source.id}:retreat:${stages.length + 1}`,
      linkedAscentStageId: source.id,
      phase: 'DESCENT',
      label: `Отход: ${source.label}`,
      hazard: `${source.hazard}; усталость и обратное движение`,
      difficulty: clamp(source.difficulty + (fixed ? -12 : 7)),
      exposure: clamp(source.exposure + (fixed ? -10 : 8)),
      relativeStart: current,
      relativeEnd: lower,
      progress: 0,
      requiredProgress: fixed ? Math.max(52, source.requiredProgress * .68) : Math.max(64, source.requiredProgress * .84),
      preparation: fixed ? 30 : source.preparation * .45,
      routeKnowledge: Math.max(15, source.routeKnowledge),
      completed: false,
    });
    current = lower;
  }
  if (!stages.length || stages[stages.length - 1]!.relativeEnd > 0) {
    const exitModule = terrainModuleById('EXIT_TRAIL');
    stages.push({
      id: `retreat:exit:${simulation.totalActions}`, terrainModuleId: exitModule.id, sourceSegmentId: null, linkedAscentStageId: null, phase: 'EXIT', label: 'Возвращение к точке старта', terrain: exitModule.label, hazard: 'Усталость после отхода', skill: 'ENDURANCE', difficulty: 25, exposure: 5,
      relativeStart: current, relativeEnd: 0, progress: 0, requiredProgress: 62, preparation: 0, routeKnowledge: 20, surfaceKnowledge: 0, anchorsPlaced: 0, ropeFixed: false, campPossible: true, critical: false,
      preparationOptions: exitModule.preparationOptions, preparationTags: [], recommendedActions: exitModule.recommendedActions, repetitionKey: `${exitModule.id}:retreat`, incidentHistory: [], completed: false,
    });
  }
  return stages;
}

export function beginSimulationRetreat(career: CareerState, reason = 'Решение об отходе'): CareerState {
  const climb = career.activeClimb;
  const simulation = climb?.simulation;
  if (!climb || !simulation || simulation.direction === 'DESCENT' || simulation.status === 'SAFE') return career;
  const descentStages = buildRetreatStages(simulation);
  const nextSimulation: ExpeditionSimulationState = {
    ...simulation,
    direction: 'DESCENT',
    status: simulation.status === 'STRANDED' ? 'STRANDED' : 'ACTIVE',
    descentStages,
    stageIndex: 0,
    forcedRetreat: true,
    returnReason: reason,
    activeEvent: null,
    leaderOrder: null,
  };
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      retreating: true,
      route: climb.descentRoute,
      segmentIndex: 0,
      simulation: nextSimulation,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — ${reason}. Вершина больше не является целью; группа обязана физически вернуться к нулевой отметке.`],
    },
  };
}

export function beginSimulationDescent(career: CareerState): CareerState {
  const climb = career.activeClimb;
  const simulation = climb?.simulation;
  if (!climb || !simulation || simulation.status !== 'SUMMIT') return career;
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      summitReached: true,
      route: climb.descentRoute,
      segmentIndex: 0,
      simulation: { ...simulation, direction: 'DESCENT', status: 'ACTIVE', stageIndex: 0, activeEvent: null, leaderOrder: null },
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — вершина оставлена. Начат полный спуск к относительной отметке 0 м.`],
    },
  };
}

function updateOrder(career: CareerState, actionId: ExpeditionFieldActionId, simulation: ExpeditionSimulationState) {
  const participant = career.activeClimb?.participant;
  const order = simulation.leaderOrder;
  if (!participant || !order || order.resolved) return { participant, order };
  if (actionId === order.preferredAction) {
    return {
      participant: { ...participant, leaderTrust: clamp(participant.leaderTrust + 3), discipline: participant.discipline + 2, ordersObeyed: participant.ordersObeyed + 1 },
      order: { ...order, resolved: true, obeyed: true },
    };
  }
  return { participant, order };
}

function maybeIssueOrder(career: CareerState, simulation: ExpeditionSimulationState, stage: ExpeditionSimulationStage) {
  if (career.activeClimb?.authorityMode === 'COMMAND' || simulation.leaderOrder) return { simulation, participant: career.activeClimb?.participant ?? null };
  const shouldIssue = !simulation.leaderOrder || simulation.stageIndex % 2 === 0 || stage.critical;
  if (!shouldIssue) return { simulation, participant: career.activeClimb?.participant ?? null };
  const order = makeLeaderOrder(career, stage, simulation.totalActions);
  const participant = career.activeClimb?.participant;
  return {
    simulation: { ...simulation, leaderOrder: order },
    participant: participant && order ? { ...participant, ordersReceived: participant.ordersReceived + 1 } : participant ?? null,
  };
}

function maybeTriggerEvent(career: CareerState, simulation: ExpeditionSimulationState, stage: ExpeditionSimulationStage) {
  if (!career.activeClimb?.participant || simulation.activeEvent || simulation.status !== 'ACTIVE') return simulation;
  const remaining = simulation.actionsUntilEvent - 1;
  if (remaining > 0) return { ...simulation, actionsUntilEvent: remaining };
  const serial = simulation.eventSerial + 1;
  const rng = createRng(`${career.rootSeed}:${career.activeClimb.id}:event:${serial}:${stage.id}`);
  return {
    ...simulation,
    eventSerial: serial,
    actionsUntilEvent: rng.int(5, 9),
    activeEvent: createParticipantEvent(career, stage, serial),
  };
}

function stageCompleteResult(career: CareerState, climb: QualificationClimb, simulation: ExpeditionSimulationState, stage: ExpeditionSimulationStage) {
  const stages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
  const nextIndex = simulation.stageIndex + 1;
  const completedStages = stages.map((item, index) => index === simulation.stageIndex ? { ...item, progress: item.requiredProgress, completed: true } : item);
  let nextSimulation: ExpeditionSimulationState = {
    ...simulation,
    ascentStages: simulation.direction === 'ASCENT' ? completedStages : simulation.ascentStages,
    descentStages: simulation.direction === 'DESCENT' ? completedStages : simulation.descentStages,
    stageIndex: nextIndex,
    relativeElevation: stage.relativeEnd,
    highestRelativeElevation: Math.max(simulation.highestRelativeElevation, stage.relativeEnd),
    leaderOrder: null,
  };
  let nextClimb: QualificationClimb = { ...climb, currentElevation: climb.startElevation + stage.relativeEnd, simulation: nextSimulation };
  if (nextIndex >= stages.length) {
    if (simulation.direction === 'ASCENT') {
      nextSimulation = { ...nextSimulation, status: 'SUMMIT', relativeElevation: simulation.maxRelativeElevation, highestRelativeElevation: simulation.maxRelativeElevation };
      nextClimb = { ...nextClimb, phase: 'SUMMIT', summitReached: true, currentElevation: climb.summitElevation, simulation: nextSimulation, log: [...nextClimb.log, `${clock(nextClimb.elapsedMinutes)} — вершина достигнута. Экспедиция не завершена: впереди полный спуск.`] };
      return { career: { ...career, activeClimb: nextClimb }, headline: 'Вершина достигнута', detail: 'Высота взята. Победа будет записана только после возвращения на отметку 0 м.', severity: 'SUCCESS' as const };
    }
    const successful = climb.summitReached && !climb.retreating;
    nextSimulation = { ...nextSimulation, status: 'SAFE', relativeElevation: 0 };
    nextClimb = { ...nextClimb, phase: successful ? 'COMPLETE' : 'RETREATED', currentElevation: climb.startElevation, simulation: nextSimulation, log: [...nextClimb.log, `${clock(nextClimb.elapsedMinutes)} — группа вернулась на относительную отметку 0 м. Экспедиция физически закончена.`] };
    return { career: { ...career, activeClimb: nextClimb }, headline: 'Группа вернулась', detail: successful ? 'Восхождение засчитано после полного спуска.' : 'Отход завершён. Все последствия сохранены.', severity: 'SUCCESS' as const };
  }
  const nextStage = completedStages[nextIndex] ?? (simulation.direction === 'ASCENT' ? simulation.ascentStages[nextIndex] : simulation.descentStages[nextIndex]);
  if (nextStage) {
    const issued = maybeIssueOrder({ ...career, activeClimb: nextClimb }, nextSimulation, nextStage);
    nextSimulation = issued.simulation;
    nextClimb = { ...nextClimb, participant: issued.participant, simulation: nextSimulation };
  }
  return { career: { ...career, activeClimb: nextClimb }, headline: 'Участок пройден', detail: `Следующий этап: ${nextStage?.label ?? 'возвращение'}.`, severity: 'CALM' as const };
}

function applySurvival(career: CareerState, climb: QualificationClimb, simulation: ExpeditionSimulationState, duration: number, helpful: boolean) {
  let rescueEtaMinutes = simulation.rescueEtaMinutes === null ? null : Math.max(0, simulation.rescueEtaMinutes - duration);
  if (rescueEtaMinutes === 0) {
    const evacuatedSimulation = { ...simulation, status: 'EVACUATED' as const, rescueEtaMinutes: 0 };
    const evacuated = { ...climb, phase: 'FAILED' as const, simulation: evacuatedSimulation, log: [...climb.log, `${clock(climb.elapsedMinutes)} — помощь дошла до группы. Игрок эвакуирован с горы.`] };
    return { career: { ...career, activeClimb: evacuated }, terminal: { headline: 'Эвакуация завершена', detail: 'Экспедиция закончилась только после фактического прибытия помощи.', severity: 'WARNING' as const } };
  }
  const stranded = climb.energy <= 1 || climb.condition <= 10 || simulation.status === 'STRANDED';
  if (!stranded) return { career: { ...career, activeClimb: { ...climb, simulation: { ...simulation, rescueEtaMinutes } } }, terminal: null };
  const rescueShelter = rescueEtaMinutes !== null ? 1.7 : 1;
  const teamShelter = 1 + Math.max(0, climb.teamCondition - 45) / 140;
  const coldLoss = Math.max(1, Math.round((Math.max(0, -10 - climb.temperatureC) + Math.max(0, climb.windKmh - 35) * .25) / ((helpful ? 18 : 10) * rescueShelter * teamShelter)));
  const condition = clamp(climb.condition - coldLoss, 0, 100);
  const nextSimulation = { ...simulation, status: condition <= 0 ? 'DEAD' as const : 'STRANDED' as const, survivalTurns: simulation.survivalTurns + 1, rescueEtaMinutes };
  const nextClimb = { ...climb, condition, simulation: nextSimulation };
  if (condition <= 0) {
    const dead = { ...nextClimb, phase: 'FAILED' as const, log: [...nextClimb.log, `${clock(nextClimb.elapsedMinutes)} — состояние стало несовместимо с продолжением. Игрок погиб до возвращения или эвакуации.`] };
    return { career: { ...career, activeClimb: dead, hero: { ...career.hero, health: 0 } }, terminal: { headline: 'Игрок погиб', detail: 'Экспедиция завершена смертью на маршруте.', severity: 'DANGER' as const } };
  }
  return { career: { ...career, activeClimb: nextClimb }, terminal: null };
}

export function resolveExpeditionFieldAction(career: CareerState, actionId: ExpeditionFieldActionId): ClimbStepResult {
  const climb = career.activeClimb;
  const simulation = climb?.simulation;
  const stage = currentExpeditionStage(career);
  if (!climb || !simulation || !stage) return { career, headline: 'Действие недоступно', detail: 'Экспедиционная симуляция не запущена.', severity: 'WARNING' };
  const action = preview(career, actionId);
  if (action.disabled) return { career, headline: action.title, detail: action.disabledReason ?? 'Действие недоступно.', severity: 'WARNING' };
  if (actionId === 'TURN_BACK') {
    if (climb.authorityMode === 'COMMAND') return { career: beginSimulationRetreat(career, 'Руководитель приказал начать отход'), headline: 'Начат отход', detail: 'Экспедиция не закончилась. Теперь нужно пройти весь путь вниз.', severity: 'WARNING' };
    const leader = leaderFor(career);
    const requestRng = createRng(`${career.rootSeed}:${climb.id}:retreat-request:${simulation.totalActions}:${stage.id}`);
    const trust = climb.participant?.leaderTrust ?? 45;
    const leadership = career.hero.skills.LEADERSHIP * 7;
    const leaderCaution = leader?.personality.caution ?? 50;
    const leaderAmbition = leader?.personality.ambition ?? 50;
    const emergency = climb.energy <= 8 || climb.condition <= 18 || simulation.status === 'STRANDED';
    const accepted = emergency || requestRng.int(1, 100) <= clamp(25 + trust * .35 + leadership + leaderCaution * .25 - leaderAmbition * .3, 8, 92);
    if (accepted) return { career: beginSimulationRetreat(career, 'Руководитель принял требование игрока об отходе'), headline: 'Руководитель дал отход', detail: 'Группа разворачивается. До безопасности остаётся весь путь вниз.', severity: 'WARNING' };
    const participant = climb.participant ? { ...climb.participant, leaderTrust: clamp(climb.participant.leaderTrust - 3), initiative: climb.participant.initiative + 1 } : null;
    const nextClimb = { ...climb, elapsedMinutes: climb.elapsedMinutes + 10, participant, log: [...climb.log, `${clock(climb.elapsedMinutes + 10)} — руководитель отказался разворачивать экспедицию после требования игрока.`] };
    return { career: { ...career, activeClimb: nextClimb }, headline: 'Отход не принят', detail: 'Ты не руководитель. Группа продолжает работу, но требование осталось в отношениях с лидером.', severity: 'WARNING' };
  }

  const rng = createRng(`${career.rootSeed}:${climb.id}:field:${simulation.totalActions}:${stage.id}:${actionId}`);
  const success = action.successChance === null || rng.int(1, 100) <= action.successChance;
  let duration = action.durationMinutes;
  let energy = clamp(climb.energy + action.energyDelta);
  let condition = climb.condition;
  let teamCondition = climb.teamCondition;
  let supplies = consume(climb, duration);
  let ropeMetersRemaining = climb.ropeMetersRemaining;
  let packWeightKg = climb.packWeightKg;
  let nextStage = { ...stage };
  let nextSimulation = { ...simulation, totalActions: simulation.totalActions + 1 };
  let detail = action.detail;
  let severity: ClimbStepResult['severity'] = success ? 'CALM' : 'WARNING';
  let headline = action.title;
  let helpful = false;

  if (actionId.startsWith('MOVE_')) {
    const prepared = isStagePrepared(stage);
    const rawProgress = Math.max(12, Math.round(action.progressDelta * (success ? 1 : .38)));
    const tacticalCap = Math.round(stage.requiredProgress * .38);
    const progress = stage.critical && !prepared && simulation.direction === 'ASCENT'
      ? Math.max(0, Math.min(Math.round(rawProgress * .42), tacticalCap - stage.progress))
      : stage.critical && !prepared
        ? Math.max(10, Math.round(rawProgress * .55))
        : rawProgress;
    nextStage.progress = clamp(stage.progress + progress, 0, stage.requiredProgress);
    nextSimulation.totalMovementActions += 1;
    const stageRatio = nextStage.progress / Math.max(1, stage.requiredProgress);
    nextSimulation.relativeElevation = Math.round(stage.relativeStart + (stage.relativeEnd - stage.relativeStart) * stageRatio);
    nextSimulation.highestRelativeElevation = Math.max(nextSimulation.highestRelativeElevation, nextSimulation.relativeElevation);
    if (success) {
      detail = stage.critical && !prepared && simulation.direction === 'ASCENT'
        ? progress > 0 ? `${progress} прогресса. Дальше без подготовки участок не пускает.` : 'Движение остановлено требованиями участка. Нужна разведка, проверка или страховка.'
        : stage.critical && !prepared
          ? `${progress} прогресса. Спуск идёт без полной защиты: риск остаётся высоким.`
          : `${progress} прогресса. Связка удержала выбранный темп.`;
    } else {
      const loss = rng.int(3, 9) + Math.round(stage.exposure / 18);
      energy = clamp(energy - loss);
      condition = clamp(condition - rng.int(1, Math.max(2, Math.round(stage.exposure / 22))));
      teamCondition = clamp(teamCondition - rng.int(1, 5));
      duration += rng.int(18, 55);
      detail = `Проверка навыка провалена. Пройдено только ${progress} прогресса, потеряны силы и время.`;
      severity = stage.critical || stage.exposure >= 55 ? 'DANGER' : 'WARNING';
      const baseAccidentChance = clamp((100 - (action.successChance ?? 50)) / 260, .02, .12);
      const accidentChance = prepared ? 0 : baseAccidentChance * (stage.exposure >= 72 ? 1.25 : 1);
      if (stage.critical && simulation.direction === 'ASCENT' && rng.chance(accidentChance)) {
        condition = clamp(condition - rng.int(4, 10));
        nextSimulation.forcedRetreat = true;
        nextSimulation.returnReason = `Авария на этапе «${stage.label}»`;
        headline = 'Срыв на участке';
        detail += ' Движение вверх прекращено. Сначала нужно стабилизироваться, затем вернуться вниз.';
      }
    }
  } else if (actionId === 'SCOUT_LINE') {
    nextStage.routeKnowledge = clamp(stage.routeKnowledge + (success ? 30 : 10));
    nextStage.preparation = clamp(stage.preparation + (success ? 18 : 5));
    if (success) nextStage = addPreparationTag(nextStage, 'ROUTE_SCOUTED');
    detail = success ? 'Линия прочитана. Следующее движение будет надёжнее.' : 'Разведка дала неполную картину. Время потрачено, неизвестность осталась.';
  } else if (actionId === 'PLACE_ANCHOR') {
    nextStage.anchorsPlaced += 1;
    nextStage.preparation = clamp(stage.preparation + (success ? 24 : 8));
    if (success) nextStage = addPreparationTag(nextStage, 'ANCHOR_PLACED');
    detail = success ? 'Точка выдерживает рабочую нагрузку.' : 'Точка поставлена плохо. Она даёт мало защиты и потребует перепроверки.';
  } else if (actionId === 'FIX_ROPE') {
    ropeMetersRemaining = Math.max(0, ropeMetersRemaining - 20);
    nextStage.ropeFixed = success;
    nextStage.preparation = clamp(stage.preparation + (success ? 42 : 14));
    if (success) nextStage = addPreparationTag(nextStage, 'ROPE_FIXED');
    detail = success ? 'Линия закреплена. Спуск по этому месту станет безопаснее.' : 'Верёвка потрачена, но линия закреплена плохо.';
  } else if (actionId === 'CHECK_SURFACE') {
    nextStage.surfaceKnowledge = clamp(stage.surfaceKnowledge + (success ? 34 : 11));
    nextStage.preparation = clamp(stage.preparation + (success ? 20 : 4));
    if (success) nextStage = addPreparationTag(nextStage, 'SURFACE_CHECKED');
    detail = success ? 'Опасные зоны отмечены. Группа знает, где нельзя нагружать склон.' : 'Проверка не дала уверенного ответа.';
  } else if (actionId === 'REST_SHORT') {
    helpful = true;
    energy = clamp(energy + 12);
    if (simulation.status === 'STRANDED' && energy >= 6 && condition > 10) nextSimulation.status = 'ACTIVE';
    detail = 'Пройден час. Дыхание восстановилось, но световой день и погода продолжили движение.';
  } else if (actionId === 'EAT_DRINK') {
    helpful = true;
    supplies = { ...supplies, foodUnits: Math.max(0, supplies.foodUnits - 1), waterUnits: Math.max(0, supplies.waterUnits - 1) };
    energy = clamp(energy + 10);
    condition = clamp(condition + 2);
    if (simulation.status === 'STRANDED' && energy >= 6 && condition > 10) nextSimulation.status = 'ACTIVE';
    detail = 'Личный запас потрачен. Силы частично вернулись.';
  } else if (actionId === 'MAKE_CAMP') {
    helpful = true;
    // The leader chooses the stop. A participant only performs assigned camp work.
    supplies = { ...supplies, fuelUnits: Math.max(0, supplies.fuelUnits - 1) };
    energy = clamp(energy + 42);
    condition = clamp(condition + 5);
    teamCondition = clamp(teamCondition + 12);
    nextStage.progress = nextStage.requiredProgress;
    nextStage = addPreparationTag(nextStage, 'TEAM_STABILIZED');
    nextSimulation.status = 'ACTIVE';
    detail = climb.authorityMode === 'COMMAND'
      ? 'Ты организовал лагерь и распределил работу. Группа восстановилась и готова продолжать.'
      : 'Руководитель остановил группу. Ты помог развернуть лагерь и выполнил свою работу.';
  } else if (actionId === 'MELT_SNOW') {
    helpful = true;
    supplies = { ...supplies, fuelUnits: Math.max(0, supplies.fuelUnits - 1), waterUnits: supplies.waterUnits + 5 };
    detail = 'Одна единица топлива превращена в пять запасов воды.';
  } else if (actionId === 'HELP_TEAM') {
    helpful = true;
    teamCondition = clamp(teamCondition + (success ? 7 : 2));
    energy = clamp(energy - 2);
    if (success) nextStage = addPreparationTag(nextStage, 'TEAM_STABILIZED');
    detail = success ? 'Слабый участник стабилизирован. Темп группы станет ровнее.' : 'Помощь заняла время, но проблему полностью решить не удалось.';
  } else if (actionId === 'DROP_LOAD') {
    nextSimulation.loadDroppedKg = clamp(simulation.loadDroppedKg + 2.5, 0, climb.packWeightKg - 5);
    packWeightKg = Math.max(5, climb.packWeightKg - nextSimulation.loadDroppedKg);
    detail = 'Часть груза оставлена. Двигаться легче, но потерянный запас не вернётся автоматически.';
  } else if (actionId === 'REQUEST_AID') {
    helpful = true;
    const leaderTrust = climb.participant?.leaderTrust ?? 55;
    nextSimulation.rescueEtaMinutes = Math.round(clamp(540 - leaderTrust * 3 - teamCondition * 1.2 + stage.exposure * 2, 120, 720));
    nextSimulation.status = 'STRANDED';
    detail = `Помощь вызвана. Расчётное время до контакта — ${Math.ceil(nextSimulation.rescueEtaMinutes / 60)} ч. Нужно выжить до её прихода.`;
    severity = 'WARNING';
  } else if (actionId === 'CHALLENGE_ORDER') {
    const order = simulation.leaderOrder!;
    if (success) {
      const safer: ExpeditionFieldActionId = stage.exposure >= 45 ? 'MOVE_CAUTIOUS' : 'SCOUT_LINE';
      nextSimulation.leaderOrder = { ...order, preferredAction: safer, text: 'Приказ изменён после твоего возражения. Работать с большим запасом.', resolved: false, obeyed: null };
      detail = 'Руководитель принял аргументы и изменил порядок работы.';
    } else {
      nextSimulation.leaderOrder = { ...order, resolved: true, obeyed: false };
      detail = 'Возражение не принято. Доверие руководителя снизилось.';
      severity = 'WARNING';
    }
  }

  const weather = evolveWeather(career, climb, duration);
  const elapsedMinutes = climb.elapsedMinutes + duration;
  const stages = nextSimulation.direction === 'ASCENT' ? nextSimulation.ascentStages : nextSimulation.descentStages;
  const updatedStages = stages.map((item, index) => index === nextSimulation.stageIndex ? nextStage : item);
  nextSimulation = { ...nextSimulation, ascentStages: nextSimulation.direction === 'ASCENT' ? updatedStages : nextSimulation.ascentStages, descentStages: nextSimulation.direction === 'DESCENT' ? updatedStages : nextSimulation.descentStages };
  const orderUpdate = updateOrder(career, actionId, nextSimulation);
  if (orderUpdate.order) nextSimulation.leaderOrder = orderUpdate.order;

  const actionRecord = {
    id: `${climb.id}:action:${nextSimulation.totalActions}`,
    actionId,
    stageId: stage.id,
    success,
    detail,
    elapsedMinutes,
    relativeElevation: nextSimulation.relativeElevation,
    energyAfter: energy,
    conditionAfter: condition,
    stageProgressAfter: nextStage.progress,
    suppliesAfter: { ...supplies },
  };
  const failureTrace = !success || energy <= 10 || condition <= 20
    ? [...simulation.failureTrace, {
      id: `${climb.id}:failure:${nextSimulation.totalActions}`,
      actionNumber: nextSimulation.totalActions,
      stageId: stage.id,
      cause: !success ? `Провал действия «${action.title}»` : energy <= 10 ? 'Критическое истощение' : 'Критическое состояние',
      energy,
      condition,
      food: supplies.foodUnits,
      water: supplies.waterUnits,
      temperatureC: weather.temperatureC,
      windKmh: weather.windKmh,
    }].slice(-24)
    : simulation.failureTrace;
  nextSimulation.actionLog = [...simulation.actionLog, actionRecord];
  nextSimulation.failureTrace = failureTrace;
  nextSimulation.lastCheckpointAction = nextSimulation.totalActions;
  const nextParticipant = orderUpdate.participant ? { ...orderUpdate.participant, totalActions: orderUpdate.participant.totalActions + 1, competence: orderUpdate.participant.competence + (success && action.skill ? 1 : 0), decisions: orderUpdate.participant.decisions } : climb.participant;
  let nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes,
    moveCount: climb.moveCount + (actionId.startsWith('MOVE_') ? 1 : 0),
    hoursAwake: actionId === 'MAKE_CAMP' ? 0 : climb.hoursAwake + duration / 60,
    campEstablished: actionId === 'MAKE_CAMP' ? true : climb.campEstablished,
    energy,
    condition,
    teamCondition,
    supplies,
    ropeMetersRemaining,
    packWeightKg,
    currentElevation: climb.startElevation + nextSimulation.relativeElevation,
    participant: nextParticipant,
    simulation: nextSimulation,
    log: [...climb.log, `${clock(elapsedMinutes)} — ${action.title}: ${detail}`],
  };

  let nextCareer: CareerState = { ...career, activeClimb: nextClimb };
  if (nextSimulation.forcedRetreat && nextSimulation.direction === 'ASCENT') {
    nextCareer = beginSimulationRetreat(nextCareer, nextSimulation.returnReason ?? 'Движение вверх прекращено');
    nextClimb = nextCareer.activeClimb!;
    nextSimulation = nextClimb.simulation!;
  }

  if (nextClimb.energy <= 1 || nextClimb.condition <= 10) {
    nextSimulation = { ...nextSimulation, status: 'STRANDED', returnReason: nextSimulation.returnReason ?? 'Исчерпан рабочий резерв' };
    nextClimb = { ...nextClimb, simulation: nextSimulation };
    nextCareer = { ...nextCareer, activeClimb: nextClimb };
    headline = 'Движение остановлено';
    detail = 'Ты остаёшься на текущей высоте. Восстанавливайся, организуй отход вместе с группой, проси помощь или погибнешь.';
    severity = 'DANGER';
  }

  const survived = applySurvival(nextCareer, nextCareer.activeClimb!, nextCareer.activeClimb!.simulation!, duration, helpful);
  nextCareer = survived.career;
  if (survived.terminal) return { career: nextCareer, ...survived.terminal };

  const active = nextCareer.activeClimb!;
  const activeSimulation = active.simulation!;
  const activeStage = currentExpeditionStage(nextCareer);
  if (activeStage && activeStage.progress >= activeStage.requiredProgress && activeSimulation.status === 'ACTIVE') {
    const completed = stageCompleteResult(nextCareer, active, activeSimulation, activeStage);
    const completedClimb = completed.career.activeClimb;
    const completedSimulation = completedClimb?.simulation;
    const nextStage = currentExpeditionStage(completed.career);
    if (completedClimb && completedSimulation && nextStage && completedSimulation.status === 'ACTIVE') {
      const eventSimulation = maybeTriggerEvent(completed.career, completedSimulation, nextStage);
      return { ...completed, career: { ...completed.career, activeClimb: { ...completedClimb, simulation: eventSimulation } } };
    }
    return completed;
  }

  if (activeStage) {
    let eventSimulation = maybeTriggerEvent(nextCareer, activeSimulation, activeStage);
    const issued = maybeIssueOrder({ ...nextCareer, activeClimb: { ...active, simulation: eventSimulation } }, eventSimulation, activeStage);
    eventSimulation = issued.simulation;
    nextCareer = { ...nextCareer, activeClimb: { ...active, participant: issued.participant, simulation: eventSimulation } };
  }
  return { career: nextCareer, headline, detail, severity };
}

export function resolveExpeditionEventChoice(career: CareerState, optionId: string): ClimbStepResult {
  const climb = career.activeClimb;
  const simulation = climb?.simulation;
  const scene = simulation?.activeEvent;
  if (!climb || !simulation || !scene || !climb.participant) return { career, headline: 'Событие недоступно', detail: 'На маршруте нет нерешённой ситуации.', severity: 'WARNING' };
  const selected = scene.options.find(option => option.id === optionId);
  if (!selected) return { career, headline: 'Решение не найдено', detail: '', severity: 'WARNING' };
  const skillResult = resolveParticipantSkill(career, selected);
  const success = !selected.skill || skillResult.success;
  const scale = success ? 1 : -.4;
  const effect = (value: number) => value >= 0 ? value * scale : value;
  const participant = {
    ...climb.participant,
    leaderTrust: clamp(climb.participant.leaderTrust + effect(selected.leaderTrustDelta)),
    groupTrust: clamp(climb.participant.groupTrust + effect(selected.groupTrustDelta)),
    discipline: climb.participant.discipline + effect(selected.disciplineDelta),
    initiative: climb.participant.initiative + effect(selected.initiativeDelta),
    care: climb.participant.care + effect(selected.careDelta),
    competence: climb.participant.competence + effect(selected.competenceDelta),
    ordersReceived: climb.participant.ordersReceived + (scene.kind === 'ORDER' ? 1 : 0),
    ordersObeyed: climb.participant.ordersObeyed + (scene.kind === 'ORDER' && selected.tone === 'OBEY' ? 1 : 0),
    ordersRefused: climb.participant.ordersRefused + (scene.kind === 'ORDER' && selected.tone === 'REFUSE' ? 1 : 0),
    decisions: [...climb.participant.decisions, {
      id: `${climb.id}:event-choice:${simulation.eventSerial}`,
      sceneId: scene.id,
      nodeId: scene.nodeId,
      optionId: selected.id,
      optionTitle: selected.title,
      tone: selected.tone,
      success,
      detail: success ? selected.detail : `${selected.detail} Проверка навыка провалена.`,
      elapsedMinutes: climb.elapsedMinutes + selected.advanceMinutes,
    }],
  };
  const weather = evolveWeather(career, climb, selected.advanceMinutes);
  const nextSimulation = { ...simulation, activeEvent: null, totalActions: simulation.totalActions + 1 };
  const nextClimb = {
    ...climb,
    ...weather,
    elapsedMinutes: climb.elapsedMinutes + selected.advanceMinutes,
    hoursAwake: climb.hoursAwake + selected.advanceMinutes / 60,
    energy: clamp(climb.energy + selected.energyDelta * .55 - (success ? 0 : 2)),
    condition: clamp(climb.condition + selected.conditionDelta - (success ? 0 : 1)),
    teamCondition: clamp(climb.teamCondition + effect(selected.teamDelta)),
    participant,
    simulation: nextSimulation,
    log: [...climb.log, `${clock(climb.elapsedMinutes + selected.advanceMinutes)} — ${scene.title}: ${selected.title}. ${success ? selected.detail : 'Навыка не хватило.'}`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: selected.title, detail: success ? selected.detail : 'Решение выполнено плохо. Физический маршрут всё равно продолжается.', severity: success ? 'CALM' : 'WARNING' };
}
