import type {
  CareerState,
  ExpeditionFieldActionId,
  ExpeditionPreparationTag,
  ExpeditionSimulationStage,
} from './types';

export type StageBrief = {
  eyebrow: string;
  title: string;
  task: string;
  reason: string;
  clue: string;
  primaryActionId: ExpeditionFieldActionId;
};

const PREP_ACTION: Record<ExpeditionPreparationTag, ExpeditionFieldActionId> = {
  ROUTE_SCOUTED: 'SCOUT_LINE',
  SURFACE_CHECKED: 'CHECK_SURFACE',
  ANCHOR_PLACED: 'PLACE_ANCHOR',
  ROPE_FIXED: 'FIX_ROPE',
  TEAM_STABILIZED: 'HELP_TEAM',
};

const ACTION_TASK: Record<ExpeditionFieldActionId, string> = {
  MOVE_CAUTIOUS: 'Пройди участок с большим запасом',
  MOVE_STEADY: 'Пройди участок рабочим темпом',
  MOVE_FAST: 'Быстро покинь опасную зону',
  SCOUT_LINE: 'Разведай линию движения',
  PLACE_ANCHOR: 'Поставь надёжную точку',
  FIX_ROPE: 'Закрепи рабочую линию',
  CHECK_SURFACE: 'Проверь снег и лёд',
  REST_SHORT: 'Восстанови рабочие силы',
  EAT_DRINK: 'Поешь и попей',
  MAKE_CAMP: 'Выполни лагерную работу',
  MELT_SNOW: 'Подготовь воду для группы',
  HELP_TEAM: 'Стабилизируй связку',
  DROP_LOAD: 'Сбрось часть груза',
  REQUEST_AID: 'Вызови помощь',
  CHALLENGE_ORDER: 'Оспорь опасный приказ',
  TURN_BACK: 'Начни возвращение',
};

function has(stage: ExpeditionSimulationStage, tag: ExpeditionPreparationTag) {
  return stage.preparationTags.includes(tag);
}

/** Ordered tactical work. Alternative arrays mean that any one option closes the step. */
export function preparationPlan(stage: ExpeditionSimulationStage): ExpeditionPreparationTag[][] {
  if (!stage.critical) return [];
  switch (stage.terrainModuleId) {
    case 'MORAINE': return [['ROUTE_SCOUTED']];
    case 'GLACIER': return [['SURFACE_CHECKED']];
    case 'CREVASSE_FIELD': return [['SURFACE_CHECKED'], ['ANCHOR_PLACED', 'ROPE_FIXED']];
    case 'ICEFALL': return [['ROUTE_SCOUTED'], ['SURFACE_CHECKED'], ['ANCHOR_PLACED', 'ROPE_FIXED']];
    case 'ROCK_WALL': return [['ROUTE_SCOUTED'], ['ANCHOR_PLACED', 'ROPE_FIXED']];
    case 'MIXED_FACE': return [['ROUTE_SCOUTED'], ['SURFACE_CHECKED'], ['ANCHOR_PLACED', 'ROPE_FIXED']];
    case 'SNOW_SLOPE': return [['SURFACE_CHECKED'], ['TEAM_STABILIZED']];
    case 'RIDGE': return [['ROUTE_SCOUTED'], ['ANCHOR_PLACED', 'TEAM_STABILIZED']];
    case 'ALTITUDE_PLATEAU': return [['TEAM_STABILIZED']];
    default: return [];
  }
}

export function missingPreparationGroups(stage: ExpeditionSimulationStage) {
  return preparationPlan(stage).filter(group => !group.some(tag => has(stage, tag)));
}

export function stagePrepared(stage: ExpeditionSimulationStage) {
  return missingPreparationGroups(stage).length === 0;
}

export function nextPreparationActions(stage: ExpeditionSimulationStage): ExpeditionFieldActionId[] {
  const group = missingPreparationGroups(stage)[0];
  if (!group) return [];
  return group.map(tag => PREP_ACTION[tag]);
}

export function recommendedMovement(career: CareerState, stage: ExpeditionSimulationStage): ExpeditionFieldActionId {
  const climb = career.activeClimb!;
  const exhausted = climb.energy < 48 || climb.hoursAwake >= 10;
  const badWeather = climb.windKmh >= 48 || climb.visibility < 40;

  if (stage.terrainModuleId === 'ICEFALL') {
    return !badWeather && stagePrepared(stage) ? 'MOVE_FAST' : 'MOVE_STEADY';
  }
  if (['CREVASSE_FIELD', 'RIDGE', 'SNOW_SLOPE', 'ROCK_WALL', 'MIXED_FACE'].includes(stage.terrainModuleId)) {
    return 'MOVE_CAUTIOUS';
  }
  if (stage.terrainModuleId === 'ALTITUDE_PLATEAU') return exhausted ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
  if (stage.terrainModuleId === 'GLACIER') return badWeather ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
  if (stage.terrainModuleId === 'MORAINE') return climb.packWeightKg > 18 || exhausted ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
  if (stage.terrainModuleId === 'APPROACH_TRAIL' || stage.terrainModuleId === 'EXIT_TRAIL') {
    return exhausted ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
  }
  return stage.exposure >= 52 ? 'MOVE_CAUTIOUS' : 'MOVE_STEADY';
}

export function movementChoices(career: CareerState, stage: ExpeditionSimulationStage): ExpeditionFieldActionId[] {
  const recommended = recommendedMovement(career, stage);
  const alternative: ExpeditionFieldActionId = recommended === 'MOVE_CAUTIOUS'
    ? 'MOVE_STEADY'
    : recommended === 'MOVE_FAST'
      ? 'MOVE_STEADY'
      : stage.terrainModuleId === 'ICEFALL' ? 'MOVE_FAST' : 'MOVE_CAUTIOUS';
  return recommended === alternative ? [recommended] : [recommended, alternative];
}

export function movementTacticModifier(career: CareerState, stage: ExpeditionSimulationStage, actionId: ExpeditionFieldActionId) {
  if (!actionId.startsWith('MOVE_')) return 0;
  const recommended = recommendedMovement(career, stage);
  if (actionId === recommended) return 28;
  const dangerousFast = actionId === 'MOVE_FAST' && stage.terrainModuleId !== 'ICEFALL';
  const tooSlowInIcefall = actionId === 'MOVE_CAUTIOUS' && stage.terrainModuleId === 'ICEFALL';
  return dangerousFast || tooSlowInIcefall ? -30 : -14;
}

function terrainReason(stage: ExpeditionSimulationStage) {
  switch (stage.terrainModuleId) {
    case 'APPROACH_TRAIL': return 'Ранний перерасход сил испортит весь день.';
    case 'MORAINE': return 'Неустойчивые камни и тяжёлый груз наказывают за плохую линию.';
    case 'GLACIER': return 'Поверхность скрывает слабые мосты и трещины.';
    case 'CREVASSE_FIELD': return 'Без проверки и удерживающей системы один провал потянет связку.';
    case 'ICEFALL': return 'Опасность растёт от времени внутри зоны, но входить вслепую нельзя.';
    case 'ROCK_WALL': return 'Ошибочная линия и слабая страховка оставят группу без защиты.';
    case 'MIXED_FACE': return 'Камень и лёд требуют разных проверок в одной связке.';
    case 'SNOW_SLOPE': return 'Слой нужно проверить до того, как группа нагрузит склон.';
    case 'RIDGE': return 'Ветер и карнизы не прощают неверной стороны движения.';
    case 'ALTITUDE_PLATEAU': return 'Высота копит усталость даже на простом рельефе.';
    case 'CAMP_ZONE': return 'Лагерь считается готовым только после общей работы.';
    case 'EXIT_TRAIL': return 'На простом рельефе ошибки случаются из-за полного истощения.';
  }
}

function movementClue(career: CareerState, stage: ExpeditionSimulationStage, action: ExpeditionFieldActionId) {
  if (stage.terrainModuleId === 'ICEFALL') return action === 'MOVE_FAST'
    ? 'Линия подготовлена, видимость рабочая: задерживаться опаснее, чем ускориться.'
    : 'Погода или подготовка не позволяют форсировать зону.';
  if (action === 'MOVE_CAUTIOUS') return 'Экспозиция, ветер или состояние группы требуют запаса.';
  if (action === 'MOVE_STEADY') return 'Условия рабочие: лишняя спешка не окупит расход сил.';
  return 'Окно короткое: скорость сейчас снижает время под объективной опасностью.';
}

export function buildStageBrief(career: CareerState, stage: ExpeditionSimulationStage): StageBrief {
  const climb = career.activeClimb!;
  const simulation = climb.simulation!;
  if (simulation.status === 'STRANDED') {
    const primary = climb.supplies.foodUnits > 0 && climb.supplies.waterUnits > 0 ? 'EAT_DRINK' : 'REST_SHORT';
    return {
      eyebrow: 'ВЫЖИВАНИЕ', title: 'Движение остановлено', task: ACTION_TASK[primary],
      reason: 'Сначала верни минимальный рабочий резерв. Затем добивайся отхода или помощи.',
      clue: `Силы ${Math.round(climb.energy)} · состояние ${Math.round(climb.condition)}.`, primaryActionId: primary,
    };
  }
  if (stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP') {
    return {
      eyebrow: stage.phase === 'BASE_CAMP' ? 'БАЗОВЫЙ ЛАГЕРЬ' : 'ЛАГЕРЬ',
      title: climb.authorityMode === 'COMMAND' ? 'Организуй остановку' : 'Выполни свою работу',
      task: ACTION_TASK.MAKE_CAMP,
      reason: 'Решение остановиться уже принято руководителем. Твоя задача зависит от роли.',
      clue: 'После завершения работы группа восстановится и откроется следующий участок.',
      primaryActionId: 'MAKE_CAMP',
    };
  }
  const prep = nextPreparationActions(stage);
  if (prep.length) {
    const primary = prep[0]!;
    return {
      eyebrow: 'ПОДГОТОВКА УЧАСТКА', title: ACTION_TASK[primary], task: prep.map(id => ACTION_TASK[id]).join(' или '),
      reason: terrainReason(stage),
      clue: prep.length > 1 ? 'Точка дешевле. Стационарная верёвка дороже, но останется на спуск.' : 'Успех зависит от профильного навыка, состояния и погоды.',
      primaryActionId: primary,
    };
  }
  const movement = recommendedMovement(career, stage);
  return {
    eyebrow: simulation.direction === 'ASCENT' ? 'ПРОХОЖДЕНИЕ' : 'ВОЗВРАЩЕНИЕ',
    title: ACTION_TASK[movement], task: ACTION_TASK[movement], reason: terrainReason(stage),
    clue: movementClue(career, stage, movement), primaryActionId: movement,
  };
}
