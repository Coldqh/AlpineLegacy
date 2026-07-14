import { createParticipantEvent, resolveParticipantSkill } from './expeditionEngine';
import { createRng } from './rng';
import type {
  CareerState,
  ClimbStepResult,
  ExpeditionActionPreview,
  ExpeditionFieldActionId,
  ExpeditionLeaderOrder,
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

function actionSkill(actionId: ExpeditionFieldActionId, stage: ExpeditionSimulationStage): SkillId | null {
  if (actionId === 'SCOUT_LINE') return 'NAVIGATION';
  if (actionId === 'PLACE_ANCHOR' || actionId === 'FIX_ROPE') return stage.terrain.toLowerCase().includes('лед') ? 'ICE' : 'ROCK';
  if (actionId === 'CHECK_SURFACE') return stage.terrain.toLowerCase().includes('лед') || stage.terrain.toLowerCase().includes('снег') ? 'ICE' : 'NAVIGATION';
  if (actionId === 'HELP_TEAM' || actionId === 'REQUEST_AID') return 'MEDICINE';
  if (actionId === 'CHALLENGE_ORDER') return 'LEADERSHIP';
  if (actionId.startsWith('MOVE_')) return stage.skill;
  return null;
}

function phaseForSegment(segment: RouteSegment) {
  if (segment.campPossible) return 'CAMP' as const;
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

function buildAscentStages(route: ExpeditionRoute): ExpeditionSimulationStage[] {
  const gain = Math.max(1, route.summitElevation - route.startElevation);
  const target = Math.round(clamp(gain / 55 + route.estimatedHours / 2 + route.technicality / 14, 16, 46));
  const counts = distributeCounts(route.segments, target);
  const stages: ExpeditionSimulationStage[] = [];
  let relative = 0;

  // Approach begins at relative height zero and gives the expedition a physical start.
  const approachCount = Math.max(2, Math.min(5, Math.round(route.estimatedHours / 6)));
  for (let index = 0; index < approachCount; index += 1) {
    stages.push({
      id: `${route.id}:approach:${index + 1}`,
      sourceSegmentId: null,
      linkedAscentStageId: null,
      phase: 'APPROACH',
      label: index === 0 ? 'Выход с точки старта' : 'Подход под маршрут',
      terrain: 'Тропа и морена',
      hazard: index === approachCount - 1 ? 'Растянутая колонна и тяжёлый груз' : 'Неверный темп в начале пути',
      skill: 'ENDURANCE',
      difficulty: clamp(22 + route.estimatedHours * 1.2),
      exposure: 10,
      relativeStart: 0,
      relativeEnd: 0,
      progress: 0,
      requiredProgress: 90,
      preparation: 0,
      routeKnowledge: 0,
      surfaceKnowledge: 0,
      anchorsPlaced: 0,
      ropeFixed: false,
      campPossible: index === approachCount - 1,
      critical: false,
      completed: false,
    });
  }

  route.segments.forEach((segment, segmentIndex) => {
    const count = counts[segmentIndex]!;
    const segmentStart = relative;
    for (let index = 0; index < count; index += 1) {
      const start = segmentStart + Math.round(segment.elevationGain * index / count);
      const end = segmentStart + Math.round(segment.elevationGain * (index + 1) / count);
      const finalPart = index === count - 1;
      const critical = finalPart && (segment.difficulty >= 55 || segment.exposure >= 48 || Boolean(segment.decisionId));
      stages.push({
        id: `${route.id}:ascent:${segment.id}:${index + 1}`,
        sourceSegmentId: segment.id,
        linkedAscentStageId: null,
        phase: segment.decisionId && finalPart ? 'DECISION' : phaseForSegment(segment),
        label: count > 2 ? `${segment.name} · ${index + 1}/${count}` : segment.name,
        terrain: segment.terrain,
        hazard: segment.hazard,
        skill: segment.skill,
        difficulty: clamp(segment.difficulty + (critical ? 7 : index * 1.2)),
        exposure: clamp(segment.exposure + (critical ? 8 : 0)),
        relativeStart: start,
        relativeEnd: end,
        progress: 0,
        requiredProgress: critical ? 160 : segment.difficulty >= 55 ? 125 : 100,
        preparation: 0,
        routeKnowledge: 0,
        surfaceKnowledge: 0,
        anchorsPlaced: 0,
        ropeFixed: false,
        campPossible: finalPart && segment.campPossible,
        critical,
        completed: false,
      });
    }
    relative += segment.elevationGain;
  });
  return stages;
}

function buildFullDescentStages(route: ExpeditionRoute, ascent: ExpeditionSimulationStage[]): ExpeditionSimulationStage[] {
  const source = route.descentSegments?.length ? route.descentSegments : [...route.segments].reverse();
  const target = Math.max(12, Math.round(ascent.filter(stage => stage.sourceSegmentId).length * .78 + route.objectiveRisk / 18));
  const counts = distributeCounts(source, target);
  const bySegment = new Map<string, ExpeditionSimulationStage[]>();
  ascent.forEach(stage => {
    if (!stage.sourceSegmentId) return;
    const items = bySegment.get(stage.sourceSegmentId) ?? [];
    items.push(stage);
    bySegment.set(stage.sourceSegmentId, items);
  });
  const stages: ExpeditionSimulationStage[] = [];
  let relative = route.summitElevation - route.startElevation;
  source.forEach((segment, segmentIndex) => {
    const count = counts[segmentIndex]!;
    const sourceId = segment.linkedAscentSegmentId ?? segment.id.replace(/-descent$/, '');
    const ascentParts = bySegment.get(sourceId) ?? [];
    const segmentDrop = Math.min(relative, segment.elevationGain);
    const segmentStart = relative;
    for (let index = 0; index < count; index += 1) {
      const start = segmentStart - Math.round(segmentDrop * index / count);
      const end = segmentStart - Math.round(segmentDrop * (index + 1) / count);
      const linked = ascentParts[Math.max(0, ascentParts.length - 1 - Math.floor(index * ascentParts.length / count))] ?? null;
      const critical = index === 0 && (segment.exposure >= 50 || segment.difficulty >= 58);
      stages.push({
        id: `${route.id}:descent:${segment.id}:${index + 1}`,
        sourceSegmentId: segment.id,
        linkedAscentStageId: linked?.id ?? null,
        phase: 'DESCENT',
        label: count > 2 ? `${segment.name} · ${index + 1}/${count}` : segment.name,
        terrain: segment.terrain,
        hazard: `${segment.hazard}; накопленная усталость`,
        skill: segment.skill,
        difficulty: clamp(segment.difficulty + 6 + (critical ? 6 : 0)),
        exposure: clamp(segment.exposure + 6 + (critical ? 8 : 0)),
        relativeStart: start,
        relativeEnd: end,
        progress: 0,
        requiredProgress: critical ? 145 : segment.difficulty >= 55 ? 120 : 95,
        preparation: linked?.ropeFixed ? 25 : 0,
        routeKnowledge: 10,
        surfaceKnowledge: 0,
        anchorsPlaced: linked?.anchorsPlaced ?? 0,
        ropeFixed: Boolean(linked?.ropeFixed),
        campPossible: segment.campPossible,
        critical,
        completed: false,
      });
    }
    relative -= segmentDrop;
  });
  if (relative > 0) {
    stages.push({
      id: `${route.id}:descent:exit`, sourceSegmentId: null, linkedAscentStageId: null, phase: 'EXIT', label: 'Выход к точке старта', terrain: 'Морена и тропа', hazard: 'Усталость на простом рельефе', skill: 'ENDURANCE', difficulty: 28, exposure: 8,
      relativeStart: relative, relativeEnd: 0, progress: 0, requiredProgress: 90, preparation: 0, routeKnowledge: 20, surfaceKnowledge: 0, anchorsPlaced: 0, ropeFixed: false, campPossible: true, critical: false, completed: false,
    });
  }
  return stages;
}

export function createExpeditionSimulation(route: ExpeditionRoute): ExpeditionSimulationState {
  const ascentStages = buildAscentStages(route);
  const descentStages = buildFullDescentStages(route, ascentStages);
  return {
    version: 1,
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
    actionsUntilEvent: 4,
    activeEvent: null,
    leaderOrder: null,
    survivalTurns: 0,
    forcedRetreat: false,
    returnReason: null,
    loadDroppedKg: 0,
    rescueEtaMinutes: null,
    actionLog: [],
  };
}

export function hydrateExpeditionSimulation(climb: QualificationClimb, route: ExpeditionRoute): ExpeditionSimulationState {
  if (climb.simulation?.version === 1) return climb.simulation;
  const simulation = createExpeditionSimulation(route);
  const relative = clamp(climb.currentElevation - climb.startElevation, 0, simulation.maxRelativeElevation);
  const stages = simulation.ascentStages;
  let stageIndex = stages.findIndex(stage => relative <= Math.max(stage.relativeStart, stage.relativeEnd));
  if (stageIndex < 0) stageIndex = Math.max(0, stages.length - 1);
  return { ...simulation, relativeElevation: relative, highestRelativeElevation: relative, stageIndex };
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
  if (stage.critical && stage.exposure >= 50) {
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
  const preparation = stage.preparation * .3 + stage.routeKnowledge * .2 + stage.surfaceKnowledge * .22 + stage.anchorsPlaced * 7 + (stage.ropeFixed ? 12 : 0);
  const loadPenalty = Math.max(0, climb.packWeightKg - 13) * 1.1;
  const raw = 52 + skill * 7 + career.hero.form * .15 + preparation + paceModifier - stage.difficulty * .52 - stage.exposure * .16 - weatherPenalty - fatiguePenalty - loadPenalty;
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
  const progress = move ? Math.round((actionId === 'MOVE_CAUTIOUS' ? 44 : actionId === 'MOVE_FAST' ? 78 : 60) + career.hero.skills[stage.skill] * 2.2) : 0;
  const energyDelta = move ? -Math.round((4 + stage.difficulty * .055 + stage.exposure * .035 + Math.max(0, climb.packWeightKg - 13) * .32) * (actionId === 'MOVE_CAUTIOUS' ? .86 : actionId === 'MOVE_FAST' ? 1.26 : 1))
    : actionId === 'SCOUT_LINE' ? -2
      : actionId === 'PLACE_ANCHOR' || actionId === 'FIX_ROPE' ? -3
        : actionId === 'CHECK_SURFACE' ? -2
          : actionId === 'REST_SHORT' ? 12
            : actionId === 'EAT_DRINK' ? 10
              : actionId === 'MAKE_CAMP' ? 38
                : actionId === 'HELP_TEAM' ? -2
                  : actionId === 'REQUEST_AID' ? -1
                    : 0;
  let disabledReason: string | null = null;
  if (simulation.activeEvent) disabledReason = 'Сначала разреши текущую ситуацию.';
  else if (simulation.status === 'SUMMIT' || simulation.status === 'SAFE' || simulation.status === 'DEAD' || simulation.status === 'EVACUATED') disabledReason = 'Действие сейчас недоступно.';
  else if (move && (climb.energy <= 1 || climb.condition <= 8 || simulation.status === 'STRANDED')) disabledReason = 'Сначала восстанови состояние или запроси помощь.';
  else if (actionId === 'FIX_ROPE' && (simulation.direction !== 'ASCENT' || climb.ropeMetersRemaining < 20 || stage.ropeFixed)) disabledReason = stage.ropeFixed ? 'Линия уже закреплена.' : 'Нужно 20 м свободной верёвки на подъёме.';
  else if (actionId === 'PLACE_ANCHOR' && climb.ropeMetersRemaining < 5) disabledReason = 'Нет 5 м верёвки для станции.';
  else if (actionId === 'MAKE_CAMP' && !stage.campPossible && !(career.expeditionPlan.gear.bivy ?? 0)) disabledReason = 'Здесь нет площадки и аварийного укрытия.';
  else if (actionId === 'MAKE_CAMP' && (climb.supplies.foodUnits <= 0 || climb.supplies.fuelUnits <= 0)) disabledReason = 'Для лагеря нужны еда и топливо.';
  else if (actionId === 'EAT_DRINK' && (climb.supplies.foodUnits <= 0 || climb.supplies.waterUnits <= 0)) disabledReason = 'Еда или вода закончились.';
  else if (actionId === 'MELT_SNOW' && climb.supplies.fuelUnits <= 0) disabledReason = 'Топливо закончилось.';
  else if (actionId === 'DROP_LOAD' && climb.packWeightKg - simulation.loadDroppedKg <= 7) disabledReason = 'Больше бросать нечего.';
  else if (actionId === 'REQUEST_AID' && simulation.rescueEtaMinutes !== null) disabledReason = 'Помощь уже вызвана.';
  else if (actionId === 'CHALLENGE_ORDER' && (!simulation.leaderOrder || simulation.leaderOrder.resolved)) disabledReason = 'Нет активного приказа.';
  else if (actionId === 'TURN_BACK' && simulation.direction !== 'ASCENT') disabledReason = 'Группа уже возвращается.';
  const successChance = skill ? chanceFor(career, actionId, stage) : null;
  const risk = successChance === null ? 0 : 100 - successChance + (move ? stage.exposure * .18 : 0);
  const riskLabel = risk < 18 ? 'НИЗКИЙ' : risk < 34 ? 'СРЕДНИЙ' : risk < 56 ? 'ВЫСОКИЙ' : 'КРИТИЧЕСКИЙ';
  const detail = move
    ? `${progress} прогресса участка. Темп меняет время, расход сил и шанс ошибки.`
    : actionId === 'SCOUT_LINE' ? 'Открывает линию и повышает шанс следующего движения.'
      : actionId === 'PLACE_ANCHOR' ? 'Тратит 5 м верёвки, повышает защиту текущего участка.'
        : actionId === 'FIX_ROPE' ? 'Тратит 20 м верёвки, сильно упрощает работу и обратный путь.'
          : actionId === 'CHECK_SURFACE' ? 'Снижает неизвестность снега, льда и трещин.'
            : actionId === 'REST_SHORT' ? 'Восстанавливает силы, но не сбрасывает время без сна.'
              : actionId === 'EAT_DRINK' ? 'Тратит личный запас и возвращает рабочее состояние.'
                : actionId === 'MAKE_CAMP' ? 'Полный отдых. Погода и запасы продолжают меняться.'
                  : actionId === 'MELT_SNOW' ? 'Топливо превращается в воду.'
                    : actionId === 'HELP_TEAM' ? 'Стабилизирует слабого участника ценой твоих сил.'
                      : actionId === 'DROP_LOAD' ? 'Снижает вес, но часть груза останется на горе.'
                        : actionId === 'REQUEST_AID' ? 'Группа или спасатели начнут эвакуацию. Придётся дождаться их.'
                          : actionId === 'CHALLENGE_ORDER' ? 'Проверка лидерства. Можно изменить опасный приказ.'
                            : 'Разворот не завершает экспедицию. Весь путь вниз останется впереди.';
  return { id: actionId, title: actionTitles[actionId], detail, durationMinutes: duration, energyDelta, progressDelta: progress, successChance, riskLabel, disabled: Boolean(disabledReason), disabledReason, skill };
}

export function previewExpeditionActions(career: CareerState): ExpeditionActionPreview[] {
  if (!career.activeClimb?.simulation || !currentExpeditionStage(career)) return [];
  const core: ExpeditionFieldActionId[] = ['MOVE_CAUTIOUS', 'MOVE_STEADY', 'MOVE_FAST', 'SCOUT_LINE', 'PLACE_ANCHOR', 'FIX_ROPE', 'CHECK_SURFACE', 'REST_SHORT', 'EAT_DRINK', 'MAKE_CAMP', 'MELT_SNOW', 'HELP_TEAM', 'DROP_LOAD', 'REQUEST_AID', 'CHALLENGE_ORDER', 'TURN_BACK'];
  return core.map(id => preview(career, id));
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
  return {
    temperatureC: clamp(climb.temperatureC + rng.int(-1, 1) + (minutes >= 300 ? rng.int(-2, 1) : 0), -45, 8),
    windKmh: clamp(climb.windKmh + rng.int(-4, 5), 0, 95),
    visibility: clamp(climb.visibility + rng.int(-7, 7), 5, 100),
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
      requiredProgress: fixed ? Math.max(75, source.requiredProgress * .72) : Math.max(90, source.requiredProgress * .92),
      preparation: fixed ? 30 : source.preparation * .45,
      routeKnowledge: Math.max(15, source.routeKnowledge),
      completed: false,
    });
    current = lower;
  }
  if (!stages.length || stages[stages.length - 1]!.relativeEnd > 0) {
    stages.push({
      id: `retreat:exit:${simulation.totalActions}`, sourceSegmentId: null, linkedAscentStageId: null, phase: 'EXIT', label: 'Возвращение к точке старта', terrain: 'Тропа и морена', hazard: 'Усталость после отхода', skill: 'ENDURANCE', difficulty: 25, exposure: 5,
      relativeStart: current, relativeEnd: 0, progress: 0, requiredProgress: 85, preparation: 0, routeKnowledge: 20, surfaceKnowledge: 0, anchorsPlaced: 0, ropeFixed: false, campPossible: true, critical: false, completed: false,
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
    actionsUntilEvent: rng.int(3, 6),
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
  const coldLoss = Math.max(1, Math.round((Math.max(0, -10 - climb.temperatureC) + Math.max(0, climb.windKmh - 35) * .25) / (helpful ? 16 : 8)));
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
  if (actionId === 'TURN_BACK') return { career: beginSimulationRetreat(career, 'Игрок потребовал начать отход'), headline: 'Начат отход', detail: 'Экспедиция не закончилась. Теперь нужно пройти весь путь вниз.', severity: 'WARNING' };

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
    const progress = Math.max(12, Math.round(action.progressDelta * (success ? 1 : .38)));
    nextStage.progress = clamp(stage.progress + progress, 0, stage.requiredProgress);
    nextSimulation.totalMovementActions += 1;
    const stageRatio = nextStage.progress / Math.max(1, stage.requiredProgress);
    nextSimulation.relativeElevation = Math.round(stage.relativeStart + (stage.relativeEnd - stage.relativeStart) * stageRatio);
    nextSimulation.highestRelativeElevation = Math.max(nextSimulation.highestRelativeElevation, nextSimulation.relativeElevation);
    if (success) {
      detail = `${progress} прогресса. Связка удержала выбранный темп.`;
    } else {
      const loss = rng.int(3, 9) + Math.round(stage.exposure / 18);
      energy = clamp(energy - loss);
      condition = clamp(condition - rng.int(1, Math.max(2, Math.round(stage.exposure / 14))));
      teamCondition = clamp(teamCondition - rng.int(1, 5));
      duration += rng.int(18, 55);
      detail = `Проверка навыка провалена. Пройдено только ${progress} прогресса, потеряны силы и время.`;
      severity = stage.critical || stage.exposure >= 55 ? 'DANGER' : 'WARNING';
      if (stage.critical && rng.chance(clamp((100 - (action.successChance ?? 50)) / 120, .08, .38))) {
        condition = clamp(condition - rng.int(8, 18));
        nextSimulation.forcedRetreat = true;
        nextSimulation.returnReason = `Авария на этапе «${stage.label}»`;
        headline = 'Срыв на участке';
        detail += ' Движение вверх прекращено. Сначала нужно стабилизироваться, затем вернуться вниз.';
      }
    }
  } else if (actionId === 'SCOUT_LINE') {
    nextStage.routeKnowledge = clamp(stage.routeKnowledge + (success ? 30 : 10));
    nextStage.preparation = clamp(stage.preparation + (success ? 18 : 5));
    detail = success ? 'Линия прочитана. Следующее движение будет надёжнее.' : 'Разведка дала неполную картину. Время потрачено, неизвестность осталась.';
  } else if (actionId === 'PLACE_ANCHOR') {
    ropeMetersRemaining = Math.max(0, ropeMetersRemaining - 5);
    nextStage.anchorsPlaced += 1;
    nextStage.preparation = clamp(stage.preparation + (success ? 24 : 8));
    detail = success ? 'Точка выдерживает рабочую нагрузку.' : 'Точка поставлена плохо. Она даёт мало защиты и потребует перепроверки.';
  } else if (actionId === 'FIX_ROPE') {
    ropeMetersRemaining = Math.max(0, ropeMetersRemaining - 20);
    nextStage.ropeFixed = success;
    nextStage.preparation = clamp(stage.preparation + (success ? 42 : 14));
    detail = success ? 'Линия закреплена. Спуск по этому месту станет безопаснее.' : 'Верёвка потрачена, но линия закреплена плохо.';
  } else if (actionId === 'CHECK_SURFACE') {
    nextStage.surfaceKnowledge = clamp(stage.surfaceKnowledge + (success ? 34 : 11));
    nextStage.preparation = clamp(stage.preparation + (success ? 20 : 4));
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
    // The seven-hour passage has already consumed group food and water in consume().
    // Camp setup spends fuel once instead of charging the same night twice.
    supplies = { ...supplies, fuelUnits: Math.max(0, supplies.fuelUnits - 1) };
    energy = clamp(energy + 38);
    condition = clamp(condition + 5);
    teamCondition = clamp(teamCondition + 12);
    nextSimulation.status = 'ACTIVE';
    detail = 'Лагерь поставлен. Группа пережила семь часов и снова может двигаться.';
  } else if (actionId === 'MELT_SNOW') {
    helpful = true;
    supplies = { ...supplies, fuelUnits: Math.max(0, supplies.fuelUnits - 1), waterUnits: supplies.waterUnits + 5 };
    detail = 'Одна единица топлива превращена в пять запасов воды.';
  } else if (actionId === 'HELP_TEAM') {
    helpful = true;
    teamCondition = clamp(teamCondition + (success ? 7 : 2));
    energy = clamp(energy - 2);
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

  const actionRecord = { id: `${climb.id}:action:${nextSimulation.totalActions}`, actionId, stageId: stage.id, success, detail, elapsedMinutes, relativeElevation: nextSimulation.relativeElevation };
  nextSimulation.actionLog = [...simulation.actionLog, actionRecord];
  const nextParticipant = orderUpdate.participant ? { ...orderUpdate.participant, totalActions: orderUpdate.participant.totalActions + 1, competence: orderUpdate.participant.competence + (success && action.skill ? 1 : 0), decisions: orderUpdate.participant.decisions } : climb.participant;
  let nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes,
    moveCount: climb.moveCount + (actionId.startsWith('MOVE_') ? 1 : 0),
    hoursAwake: actionId === 'MAKE_CAMP' ? 0 : climb.hoursAwake + duration / 60,
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
    nextSimulation = { ...nextSimulation, status: 'STRANDED', forcedRetreat: true, returnReason: nextSimulation.returnReason ?? 'Исчерпан рабочий резерв' };
    nextClimb = { ...nextClimb, simulation: nextSimulation };
    nextCareer = { ...nextCareer, activeClimb: nextClimb };
    if (nextSimulation.direction === 'ASCENT') nextCareer = beginSimulationRetreat(nextCareer, 'Исчерпан рабочий резерв');
    headline = 'Движение остановлено';
    detail = 'Ты не исчезаешь с горы. Восстанавливайся, проси помощь или погибнешь до возвращения.';
    severity = 'DANGER';
  }

  const survived = applySurvival(nextCareer, nextCareer.activeClimb!, nextCareer.activeClimb!.simulation!, duration, helpful);
  nextCareer = survived.career;
  if (survived.terminal) return { career: nextCareer, ...survived.terminal };

  const active = nextCareer.activeClimb!;
  const activeSimulation = active.simulation!;
  const activeStage = currentExpeditionStage(nextCareer);
  if (activeStage && activeStage.progress >= activeStage.requiredProgress && activeSimulation.status === 'ACTIVE') {
    return stageCompleteResult(nextCareer, active, activeSimulation, activeStage);
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
