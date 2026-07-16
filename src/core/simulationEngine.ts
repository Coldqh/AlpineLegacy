import { detectTerrainModule, terrainModuleById } from '../content/terrainModules';
import { targetStageBudget } from './contentPipeline';
import { LEGACY_DIFFICULTY } from './balanceTuning';
import {
  buildStageBrief,
  missingPreparationGroups,
  movementChoices,
  movementTacticModifier,
  nextPreparationActions,
  recommendedMovement,
  stagePrepared,
} from './expeditionTactics';
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
  return stagePrepared(stage);
}

export function missingStagePreparation(stage: ExpeditionSimulationStage) {
  return missingPreparationGroups(stage).flat();
}

export { buildStageBrief, nextPreparationActions, recommendedMovement };

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
    version: 4,
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
  if (climb.simulation?.version === 4) return climb.simulation;
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
  const prep = nextPreparationActions(stage);
  let preferredAction: ExpeditionFieldActionId;
  let text: string;
  if (stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP') {
    preferredAction = 'MAKE_CAMP';
    text = stage.phase === 'BASE_CAMP'
      ? 'Развернуть базовый лагерь. Выполни свою часть работы и доложи о готовности.'
      : 'Группа останавливается. Помоги подготовить площадку и укрытие.';
  } else if (prep.length > 0) {
    preferredAction = prep[0]!;
    const task = contextualActionTitle(career, preferredAction, stage);
    text = `${task}. Движение начнём только после доклада о готовности.`;
  } else {
    preferredAction = recommendedMovement(career, stage);
    text = preferredAction === 'MOVE_FAST'
      ? 'Линия готова. Пройти опасную зону без остановки.'
      : preferredAction === 'MOVE_CAUTIOUS'
        ? 'Работать с запасом. Держать дистанцию и не ломать темп связки.'
        : 'Держать рабочий темп до следующей точки.';
  }
  return {
    id: `${climb.id}:order:${actionCount}:${stage.id}`,
    text,
    preferredAction,
    issuedAtAction: actionCount,
    strictness: clamp(45 + (leader?.personality.discipline ?? 50) * .45),
    resolved: false,
    obeyed: null,
  };
}

function chanceFor(career: CareerState, actionId: ExpeditionFieldActionId, stage: ExpeditionSimulationStage) {
  const climb = career.activeClimb!;
  const tuning = LEGACY_DIFFICULTY[career.difficulty];
  const skillId = actionSkill(actionId, stage);
  const skill = skillId ? career.hero.skills[skillId] : 5;
  const weatherPenalty = Math.max(0, climb.windKmh - 42) * .22 + Math.max(0, 50 - climb.visibility) * .18 + Math.max(0, -18 - climb.temperatureC) * .28;
  const fatiguePenalty = Math.max(0, climb.hoursAwake - 10) * 1.1 + Math.max(0, 45 - climb.energy) * .32;
  const prepared = isStagePrepared(stage);
  const missing = missingStagePreparation(stage).length;
  const preparation = stage.preparation * .18 + stage.routeKnowledge * .14 + stage.surfaceKnowledge * .17 + stage.anchorsPlaced * 5 + (stage.ropeFixed ? 10 : 0) + (prepared ? 8 : 0);
  const tacticalPenalty = actionId.startsWith('MOVE_') && stage.critical && !prepared ? 34 + missing * 8 : 0;
  const loadPenalty = Math.max(0, climb.packWeightKg - 13) * 1.2;
  const tactic = movementTacticModifier(career, stage, actionId);
  const repeatFailures = stage.incidentHistory.filter(item => item === `ACTION_FAIL:${actionId}`).length;
  const learningBonus = Math.min(tuning.learningCap, repeatFailures * tuning.learningPerFailure);
  const raw = 58 + tuning.chanceBonus + skill * 8 + career.hero.form * .15 + preparation + tactic + learningBonus - stage.difficulty * .48 - stage.exposure * .14 - weatherPenalty - fatiguePenalty - loadPenalty - tacticalPenalty;
  return Math.round(clamp(raw, 3, 94));
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
  const pace = actionId === 'MOVE_CAUTIOUS' ? .82 : actionId === 'MOVE_FAST' ? 1.22 : 1;
  const duration = move
    ? Math.round((30 + stage.difficulty * .38 + stage.exposure * .22) / pace)
    : actionId === 'SCOUT_LINE' ? 35
      : actionId === 'PLACE_ANCHOR' ? 28
        : actionId === 'FIX_ROPE' ? 50
          : actionId === 'CHECK_SURFACE' ? 30
            : actionId === 'REST_SHORT' ? 45
              : actionId === 'EAT_DRINK' ? 15
                : actionId === 'MAKE_CAMP' ? 360
                  : actionId === 'MELT_SNOW' ? 45
                    : actionId === 'HELP_TEAM' ? 30
                      : actionId === 'DROP_LOAD' ? 12
                        : actionId === 'REQUEST_AID' ? 10
                          : actionId === 'CHALLENGE_ORDER' ? 15
                            : 10;
  const remaining = Math.max(0, stage.requiredProgress - stage.progress);
  const progress = move ? remaining : 0;
  const movementCost = Math.max(2, Math.round((1.5 + stage.difficulty * .018 + stage.exposure * .012 + Math.max(0, climb.packWeightKg - 13) * .065) * (actionId === 'MOVE_CAUTIOUS' ? .88 : actionId === 'MOVE_FAST' ? 1.3 : 1) * LEGACY_DIFFICULTY[career.difficulty].energyMultiplier));
  const energyDelta = move ? -movementCost
    : actionId === 'SCOUT_LINE' ? -1
      : actionId === 'PLACE_ANCHOR' || actionId === 'FIX_ROPE' ? -2
        : actionId === 'CHECK_SURFACE' ? -1
          : actionId === 'REST_SHORT' ? 8
            : actionId === 'EAT_DRINK' ? 10
              : actionId === 'MAKE_CAMP' ? 38
                : actionId === 'HELP_TEAM' ? -2
                  : actionId === 'REQUEST_AID' ? -1
                    : 0;
  let disabledReason: string | null = null;
  const plannedCamp = stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP';
  const preparationActions = nextPreparationActions(stage);
  if (simulation.activeEvent) disabledReason = 'Сначала разреши текущую ситуацию.';
  else if (simulation.status === 'SUMMIT' || simulation.status === 'SAFE' || simulation.status === 'DEAD' || simulation.status === 'EVACUATED') disabledReason = 'Действие сейчас недоступно.';
  else if (move && plannedCamp) disabledReason = 'Сначала закончи порученную лагерную работу.';
  else if (move && preparationActions.length > 0) disabledReason = 'Сначала выполни текущую задачу участка.';
  else if (move && (climb.energy <= 2 || climb.condition <= 8 || simulation.status === 'STRANDED')) disabledReason = 'Сначала восстанови состояние или запроси помощь.';
  else if (actionId === 'FIX_ROPE' && (simulation.direction !== 'ASCENT' || climb.ropeMetersRemaining < 20 || stage.ropeFixed)) disabledReason = stage.ropeFixed ? 'Линия уже закреплена.' : 'Нужно 20 м свободной верёвки на подъёме.';
  else if (actionId === 'MAKE_CAMP' && !plannedCamp && simulation.status !== 'STRANDED') disabledReason = career.activeClimb?.authorityMode === 'COMMAND' ? 'Здесь нет запланированной площадки.' : 'Решение об остановке принимает руководитель.';
  else if (actionId === 'MAKE_CAMP' && !plannedCamp && career.activeClimb?.authorityMode !== 'COMMAND' && simulation.leaderOrder?.preferredAction !== 'MAKE_CAMP') disabledReason = 'Руководитель не отдавал приказ на бивак.';
  else if (actionId === 'MAKE_CAMP' && !stage.campPossible && !(career.expeditionPlan.gear.bivy ?? 0)) disabledReason = 'Здесь нет площадки и аварийного укрытия.';
  else if (actionId === 'MAKE_CAMP' && (climb.supplies.foodUnits <= 0 || climb.supplies.fuelUnits <= 0)) disabledReason = 'Для лагеря нужны еда и топливо.';
  else if (actionId === 'REST_SHORT' && simulation.status !== 'STRANDED' && climb.energy >= 84 && climb.hoursAwake < 8) disabledReason = 'Силы ещё в рабочем диапазоне.';
  else if (actionId === 'EAT_DRINK' && (climb.supplies.foodUnits <= 0 || climb.supplies.waterUnits <= 0)) disabledReason = 'Еда или вода закончились.';
  else if (actionId === 'EAT_DRINK' && simulation.status !== 'STRANDED' && climb.energy >= 84 && climb.condition >= 88) disabledReason = 'Сейчас запас лучше сохранить.';
  else if (actionId === 'MELT_SNOW' && (!plannedCamp || climb.supplies.fuelUnits <= 0)) disabledReason = plannedCamp ? 'Топливо закончилось.' : 'Снег топят во время остановки или лагеря.';
  else if (actionId === 'HELP_TEAM' && climb.teamCondition >= 86 && !preparationActions.includes('HELP_TEAM')) disabledReason = 'Группа сейчас не требует помощи.';
  else if (actionId === 'DROP_LOAD' && climb.packWeightKg - simulation.loadDroppedKg <= 9) disabledReason = 'Больше бросать нечего.';
  else if (actionId === 'REQUEST_AID' && simulation.rescueEtaMinutes !== null) disabledReason = 'Помощь уже вызвана.';
  else if (actionId === 'REQUEST_AID' && simulation.status !== 'STRANDED' && climb.condition > 18) disabledReason = 'Эвакуация вызывается при реальной невозможности двигаться.';
  else if (actionId === 'CHALLENGE_ORDER' && (!simulation.leaderOrder || simulation.leaderOrder.resolved)) disabledReason = 'Нет активного приказа.';
  else if (actionId === 'TURN_BACK' && simulation.direction !== 'ASCENT') disabledReason = 'Группа уже возвращается.';

  const successChance = skill ? chanceFor(career, actionId, stage) : null;
  const risk = successChance === null ? 0 : 100 - successChance + (move ? stage.exposure * .16 : 0);
  const riskLabel = risk < 18 ? 'НИЗКИЙ' : risk < 34 ? 'СРЕДНИЙ' : risk < 56 ? 'ВЫСОКИЙ' : 'КРИТИЧЕСКИЙ';
  const recommended = move && actionId === recommendedMovement(career, stage);
  const detail = move
    ? recommended
      ? 'Тактика подходит текущему рельефу и условиям. Успех завершит этап.'
      : 'Альтернативный темп. Он может сработать, но хуже отвечает текущим условиям.'
    : actionId === 'SCOUT_LINE' ? 'Чтение рельефа. Успех откроет следующий шаг подготовки.'
      : actionId === 'PLACE_ANCHOR' ? 'Экономная защита участка. На спуске она помогает меньше стационарной линии.'
        : actionId === 'FIX_ROPE' ? 'Тратит 20 м верёвки, зато защищает группу и обратный путь.'
          : actionId === 'CHECK_SURFACE' ? 'Проверка слоя, льда и скрытых провалов профильным навыком.'
            : actionId === 'REST_SHORT' ? 'Возвращает часть сил, но погода и время продолжают идти.'
              : actionId === 'EAT_DRINK' ? 'Тратит запас и возвращает рабочее состояние.'
                : actionId === 'MAKE_CAMP' ? (climb.authorityMode === 'COMMAND' ? 'Ты распределяешь работу лагеря.' : 'Руководитель уже остановил группу. Ты выполняешь порученную работу.')
                  : actionId === 'MELT_SNOW' ? 'Топливо превращается в воду для всей группы.'
                    : actionId === 'HELP_TEAM' ? 'Стабилизирует связку ценой твоих сил и времени.'
                      : actionId === 'DROP_LOAD' ? 'Снижает вес, но часть груза останется на горе.'
                        : actionId === 'REQUEST_AID' ? 'Запускает реальную эвакуацию. До контакта нужно выжить.'
                          : actionId === 'CHALLENGE_ORDER' ? 'Попытка изменить опасный приказ через лидерство.'
                            : 'Разворот не завершает экспедицию. Весь путь вниз останется впереди.';
  return { id: actionId, title: contextualActionTitle(career, actionId, stage), detail, durationMinutes: duration, energyDelta, progressDelta: progress, successChance, riskLabel, disabled: Boolean(disabledReason), disabledReason, skill };
}

export function previewExpeditionActions(career: CareerState): ExpeditionActionPreview[] {
  const climb = career.activeClimb;
  const stage = currentExpeditionStage(career);
  const simulation = climb?.simulation;
  if (!climb || !simulation || !stage || simulation.activeEvent) return [];

  const ids: ExpeditionFieldActionId[] = [];
  const add = (id: ExpeditionFieldActionId) => { if (!ids.includes(id)) ids.push(id); };
  const plannedCamp = stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP';

  if (simulation.status === 'STRANDED') {
    if (climb.supplies.foodUnits > 0 && climb.supplies.waterUnits > 0) add('EAT_DRINK');
    add('REST_SHORT');
    if (stage.campPossible || (career.expeditionPlan.gear.bivy ?? 0) > 0) add('MAKE_CAMP');
    if (climb.packWeightKg - simulation.loadDroppedKg > 11) add('DROP_LOAD');
    add('REQUEST_AID');
  } else if (plannedCamp) {
    add('MAKE_CAMP');
    if (climb.supplies.waterUnits < Math.max(8, climb.teamMemberIds.length * 2)) add('MELT_SNOW');
    if (climb.energy < 78) add('EAT_DRINK');
  } else {
    const prepActions = nextPreparationActions(stage);
    if (prepActions.length) {
      prepActions.forEach(add);
      if (stage.critical && simulation.direction === 'ASCENT' && !stage.ropeFixed && climb.ropeMetersRemaining >= 20) add('FIX_ROPE');
      if (climb.energy < 42 || climb.hoursAwake >= 10) add('REST_SHORT');
      if (climb.energy < 50 && climb.supplies.foodUnits > 0 && climb.supplies.waterUnits > 0) add('EAT_DRINK');
    } else {
      movementChoices(career, stage).forEach(add);
      if (climb.teamCondition < 50) add('HELP_TEAM');
      if (climb.energy < 38 || climb.hoursAwake >= 11) add('REST_SHORT');
      if (climb.energy < 44 && climb.supplies.foodUnits > 0 && climb.supplies.waterUnits > 0) add('EAT_DRINK');
    }
    if (simulation.leaderOrder && !simulation.leaderOrder.resolved) {
      const ordered = simulation.leaderOrder.preferredAction;
      if (prepActions.includes(ordered) || movementChoices(career, stage).includes(ordered)) add(ordered);
      add('CHALLENGE_ORDER');
    }
  }

  return ids.map(id => preview(career, id)).filter(item => !item.disabled).slice(0, 4);
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
  const priorMoveFailures = stage.incidentHistory.filter(item => item.startsWith('MOVE_FAIL')).length;
  const priorActionFailures = stage.incidentHistory.filter(item => item === `ACTION_FAIL:${actionId}`).length;
  const learnedPass = actionId.startsWith('MOVE_')
    ? actionId === recommendedMovement(career, stage) && priorMoveFailures >= 1 && isStagePrepared(stage)
    : Boolean(action.skill) && priorActionFailures >= 1;
  const success = learnedPass || action.successChance === null || rng.int(1, 100) <= action.successChance;
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
    const remaining = Math.max(0, stage.requiredProgress - stage.progress);
    const previousMoveFailures = stage.incidentHistory.filter(item => item.startsWith('MOVE_FAIL')).length;
    const correctTactic = actionId === recommendedMovement(career, stage);
    if (success && prepared) {
      nextStage.progress = stage.requiredProgress;
      nextStage.incidentHistory = [...stage.incidentHistory, `MOVE_OK:${actionId}`].slice(-8);
      nextSimulation.totalMovementActions += 1;
      nextSimulation.relativeElevation = stage.relativeEnd;
      nextSimulation.highestRelativeElevation = Math.max(nextSimulation.highestRelativeElevation, nextSimulation.relativeElevation);
      detail = correctTactic
        ? `Участок пройден выбранной тактикой. ${Math.abs(stage.relativeEnd - stage.relativeStart)} м маршрута закрыты.`
        : `Участок пройден, но альтернативный темп потребовал большего запаса. ${Math.abs(stage.relativeEnd - stage.relativeStart)} м маршрута закрыты.`;
      if (!correctTactic) {
        energy = clamp(energy - 2);
        duration += 12;
      }
    } else {
      const progress = prepared ? Math.min(remaining, Math.max(6, Math.round(stage.requiredProgress * (success ? .18 : .1)))) : 0;
      nextStage.progress = clamp(stage.progress + progress, 0, stage.requiredProgress);
      nextStage.incidentHistory = [...stage.incidentHistory, `MOVE_FAIL:${actionId}`].slice(-8);
      nextSimulation.totalMovementActions += 1;
      const stageRatio = nextStage.progress / Math.max(1, stage.requiredProgress);
      nextSimulation.relativeElevation = Math.round(stage.relativeStart + (stage.relativeEnd - stage.relativeStart) * stageRatio);
      nextSimulation.highestRelativeElevation = Math.max(nextSimulation.highestRelativeElevation, nextSimulation.relativeElevation);
      const failureNumber = previousMoveFailures + 1;
      const consequence = LEGACY_DIFFICULTY[career.difficulty].failureConsequence;
      const loss = Math.round((rng.int(3, 7) + Math.round(stage.exposure / 28) + (correctTactic ? 0 : 3)) * consequence);
      energy = clamp(energy - loss);
      condition = clamp(condition - Math.round(rng.int(0, Math.max(1, Math.round(stage.exposure / 34))) * consequence));
      teamCondition = clamp(teamCondition - Math.round(rng.int(0, 3) * consequence));
      duration += rng.int(25, 65);
      severity = stage.critical || stage.exposure >= 50 ? 'DANGER' : 'WARNING';
      if (!prepared) {
        headline = 'Участок не готов';
        detail = 'Движение остановлено до обязательной подготовки. Высота почти не изменилась.';
      } else {
        headline = failureNumber >= 2 ? 'Связка теряет контроль' : 'Проход не удался';
        detail = `${progress > 0 ? `Удалось пройти лишь ${progress} единиц участка. ` : ''}Ошибка забрала силы, время и состояние группы.`;
      }
      if (failureNumber >= 2) {
        condition = clamp(condition - 1);
        teamCondition = clamp(teamCondition - 2);
        detail += ' Повторная ошибка стала общей проблемой экспедиции.';
      }
      if (stage.critical && failureNumber >= LEGACY_DIFFICULTY[career.difficulty].criticalFailureLimit && simulation.direction === 'ASCENT') {
        nextSimulation.forcedRetreat = true;
        nextSimulation.returnReason = `${failureNumber} неудачных попытки на этапе «${stage.label}»`;
        headline = 'Руководитель прекращает подъём';
        detail += ' Дальнейшие попытки запрещены. Теперь нужно пройти весь путь вниз.';
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

  if (!actionId.startsWith('MOVE_') && action.skill) {
    const resultTag = success ? `ACTION_OK:${actionId}` : `ACTION_FAIL:${actionId}`;
    nextStage.incidentHistory = [...nextStage.incidentHistory, resultTag].slice(-12);
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
  nextSimulation.actionLog = [...simulation.actionLog, actionRecord].slice(-180);
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
    log: [...climb.log, `${clock(elapsedMinutes)} — ${action.title}: ${detail}`].slice(-220),
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
    log: [...climb.log, `${clock(climb.elapsedMinutes + selected.advanceMinutes)} — ${scene.title}: ${selected.title}. ${success ? selected.detail : 'Навыка не хватило.'}`].slice(-220),
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: selected.title, detail: success ? selected.detail : 'Решение выполнено плохо. Физический маршрут всё равно продолжается.', severity: success ? 'CALM' : 'WARNING' };
}
