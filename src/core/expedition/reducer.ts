import { createRng } from '../rng';
import { isSamePoint, localCellAt, type GridPoint } from '../../topography/mountainGridEngine';
import type { IntegratedExpeditionCommand, IntegratedExpeditionContext } from './commands';
import { integratedDifficultyTuning, integratedPaceTuning, integratedStepPreview } from './risk';
import {
  activeIntegratedParticipants,
  integratedLeader,
  integratedSpecialist,
  integratedTeamCondition,
  integratedTeamMorale,
  integratedTeamTrust,
  mobileIntegratedParticipants,
} from './selectors';
import {
  distributeIntegratedLoads,
  EMPTY_INTEGRATED_INFRASTRUCTURE,
  type IntegratedExpeditionEvent,
  type IntegratedExpeditionState,
  type IntegratedIncidentRecord,
  type IntegratedParticipantState,
  type IntegratedRestMode,
} from './state';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pointKey = (point: GridPoint) => `${point.x}:${point.y}`;

function event(state: IntegratedExpeditionState, kind: IntegratedExpeditionEvent['kind'], severity: IntegratedExpeditionEvent['severity'], text: string) {
  return { serial: state.lastEvent.serial + 1, kind, severity, text } satisfies IntegratedExpeditionEvent;
}

function finalizeTransition(previous: IntegratedExpeditionState, next: IntegratedExpeditionState) {
  if (next === previous || next.lastEvent.serial === previous.lastEvent.serial) return next;
  const eventLog = [...(previous.eventLog ?? []), next.lastEvent].slice(-160);
  return { ...next, eventLog };
}

function updateInfrastructure(
  state: IntegratedExpeditionState,
  stageId: string,
  updater: (value: typeof EMPTY_INTEGRATED_INFRASTRUCTURE) => typeof EMPTY_INTEGRATED_INFRASTRUCTURE,
) {
  return {
    ...state,
    infrastructure: {
      ...state.infrastructure,
      [stageId]: updater(state.infrastructure[stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE),
    },
  };
}

function consumeSupplies(state: IntegratedExpeditionState, minutes: number, intensity = 1) {
  const groupSize = Math.max(1, activeIntegratedParticipants(state).length);
  const food = groupSize * 3 * minutes / 1440 * intensity;
  const water = groupSize * 4 * minutes / 1440 * intensity;
  return {
    ...state.supplies,
    foodUnits: Math.max(0, state.supplies.foodUnits - food),
    waterUnits: Math.max(0, state.supplies.waterUnits - water),
  };
}

function applyTime(state: IntegratedExpeditionState, minutes: number, intensity = 1) {
  return {
    ...state,
    elapsedMinutes: state.elapsedMinutes + minutes,
    supplies: consumeSupplies(state, minutes, intensity),
  };
}

function rebalanceLoads(state: IntegratedExpeditionState) {
  return {
    ...state,
    participants: distributeIntegratedLoads(state.participants, Math.max(0, state.packWeightKg - state.gear.lostWeightKg / Math.max(1, state.participants.length))),
  };
}

function adjustTeamMindset(state: IntegratedExpeditionState, moraleDelta: number, trustDelta: number) {
  return {
    ...state,
    participants: state.participants.map(participant => participant.status === 'DEAD' ? participant : {
      ...participant,
      morale: clamp(participant.morale + moraleDelta),
      trust: clamp(participant.trust + trustDelta),
    }),
  };
}

function withIncident(
  state: IntegratedExpeditionState,
  context: IntegratedExpeditionContext,
  type: IntegratedIncidentRecord['type'],
  participant: IntegratedParticipantState | null,
  title: string,
  detail: string,
  severity: IntegratedIncidentRecord['severity'],
) {
  const incident: IntegratedIncidentRecord = {
    id: `incident-${state.seed}-${state.actionSerial + 1}-${state.incidents.length + 1}`,
    actionSerial: state.actionSerial + 1,
    stageId: context.stageId,
    type,
    participantId: participant?.id ?? null,
    title,
    detail,
    severity,
    elapsedMinutes: state.elapsedMinutes,
  };
  return {
    ...state,
    incidents: [...state.incidents, incident],
    lastEvent: event(state, 'INCIDENT', severity === 'CRITICAL' ? 'DANGER' : 'WARNING', `${title}. ${detail}`),
    message: `${title}. ${detail}`,
  };
}

function damageParticipant(
  state: IntegratedExpeditionState,
  participantId: string,
  conditionLoss: number,
  energyLoss: number,
  injury: string | null,
) {
  let casualtyId: string | null = null;
  const participants = state.participants.map(participant => {
    if (participant.id !== participantId) return participant;
    const condition = clamp(participant.condition - conditionLoss);
    const energy = clamp(participant.energy - energyLoss);
    let status: IntegratedParticipantState['status'] = participant.status;
    if (condition <= 0) {
      status = 'DEAD';
      casualtyId = participant.memberId ?? participant.id;
    } else if (condition < 18 || energy <= 0) status = 'INCAPACITATED';
    else if (injury) status = 'INJURED';
    return {
      ...participant,
      condition,
      energy,
      morale: clamp(participant.morale - Math.max(2, Math.round(conditionLoss / 5))),
      status,
      injury: injury ?? participant.injury,
    };
  });
  return rebalanceLoads({
    ...state,
    participants,
    injuries: injury && !state.injuries.includes(injury) ? [...state.injuries, injury] : state.injuries,
    casualties: casualtyId && !state.casualties.includes(casualtyId) ? [...state.casualties, casualtyId] : state.casualties,
  });
}

function weakestParticipant(state: IntegratedExpeditionState) {
  return mobileIntegratedParticipants(state)
    .sort((a, b) => (a.condition + a.energy - a.loadKg * 1.5) - (b.condition + b.energy - b.loadKg * 1.5))[0]
    ?? integratedLeader(state);
}

function forceRetreat(
  state: IntegratedExpeditionState,
  context: IntegratedExpeditionContext,
  reason: string,
  forced = true,
): IntegratedExpeditionState {
  const path = state.paths[context.stageId] ?? [context.localMap.start];
  const traversed = path.slice(0, Math.max(1, state.positionIndex + 1));
  const retreatPath = [...traversed].reverse();
  const alreadyAtStart = state.stageIndex <= 0 && retreatPath.length <= 1;
  const text = alreadyAtStart ? 'Группа отказалась от выхода и вернулась в базовый лагерь.' : reason;
  return {
    ...state,
    phase: alreadyAtStart ? 'RETREATED' : 'DESCENT',
    retreating: true,
    forcedRetreat: forced,
    currentElevation: alreadyAtStart ? state.startElevation : state.currentElevation,
    paths: { ...state.paths, [context.stageId]: retreatPath },
    positionIndex: 0,
    message: text,
    lastEvent: event(state, alreadyAtStart ? 'EXPEDITION_COMPLETE' : 'STOP', forced ? 'DANGER' : 'WARNING', text),
  };
}

function checkExpeditionViability(state: IntegratedExpeditionState, context: IntegratedExpeditionContext) {
  const mobile = mobileIntegratedParticipants(state);
  if (!mobile.length) return forceRetreat(state, context, 'Группа потеряла возможность двигаться. Нужна спасательная операция.');
  if (state.supplies.waterUnits <= 0) return forceRetreat(state, context, 'Вода закончилась. Группа начинает аварийный отход.');
  if (integratedTeamCondition(state) <= 18) return forceRetreat(state, context, 'Состояние группы критическое. Руководитель разворачивает экспедицию.');
  return state;
}

function applyMovementFatigue(state: IntegratedExpeditionState, energyCost: number, minutes: number): IntegratedExpeditionState {
  const tuning = integratedDifficultyTuning(state.difficulty);
  const pace = integratedPaceTuning(state.pace);
  const noFood = state.supplies.foodUnits <= 0;
  const noWater = state.supplies.waterUnits <= 0;
  const cold = Math.max(0, -state.weatherWindow.temperatureC - 12) / 20;
  const participants = state.participants.map((participant, index) => {
    if (participant.status === 'DEAD') return participant;
    const roleFactor = index === 0 ? 1 : index === state.participants.length - 1 ? 0.78 : 0.68;
    const enduranceMitigation = participant.skills.ENDURANCE * 0.035;
    const loadRatio = participant.carryCapacityKg > 0 ? participant.loadKg / participant.carryCapacityKg : 1.5;
    const loadFactor = 1 + Math.max(-.12, loadRatio - .72) * .72;
    const energyLoss = Math.max(1, Math.round(energyCost * roleFactor * loadFactor * (1 - Math.min(0.32, enduranceMitigation))));
    const fatigue = clamp(participant.fatigue + energyLoss * 1.25 + minutes / 100);
    const supplyLoss = (noFood ? 2.2 : 0) + (noWater ? 5.5 : 0);
    const conditionLoss = Math.max(0, Math.round((fatigue > 72 ? (fatigue - 72) / 22 : 0) * tuning.condition + supplyLoss + cold));
    const energy = clamp(participant.energy - energyLoss);
    const condition = clamp(participant.condition - conditionLoss);
    const strained = loadRatio > 1 || energy < 28;
    const moraleDelta = state.pace === 'FAST' && strained ? -2 : state.pace === 'CAUTIOUS' && energy < 45 ? 1 : 0;
    let status: IntegratedParticipantState['status'] = participant.status;
    if (condition <= 0) status = 'DEAD';
    else if (condition < 18 || energy <= 0) status = 'INCAPACITATED';
    return { ...participant, energy, fatigue, condition, morale: clamp(participant.morale + moraleDelta), status };
  });
  const casualties = [...state.casualties];
  for (const participant of participants) {
    const casualtyId = participant.memberId ?? participant.id;
    if (participant.status === 'DEAD' && !casualties.includes(casualtyId)) casualties.push(casualtyId);
  }
  return rebalanceLoads({
    ...state,
    participants,
    casualties,
    gear: {
      ...state.gear,
      hardwareCondition: clamp(state.gear.hardwareCondition - Math.max(0, Math.round((energyCost - 7) / 12))),
      ropeCondition: clamp(state.gear.ropeCondition - (state.phase === 'DESCENT' ? .35 : .18)),
    },
  });
}

function hazardBlockReason(state: IntegratedExpeditionState, context: IntegratedExpeditionContext, point: GridPoint, protectedByRope: boolean) {
  const cell = localCellAt(context.localMap, point)!;
  if (cell.hazard === 'CREVASSE' && !protectedByRope) return 'Трещина открыта. Нужна закреплённая верёвка или обход.';
  if (cell.hazard === 'AVALANCHE' && context.weather.snowSoftness >= (state.difficulty === 'EXPLORER' ? 66 : 54)) return 'Снег размягчён. Лавинный склон сейчас закрыт.';
  if (cell.hazard === 'ROCKFALL' && context.weather.temperatureC >= (state.difficulty === 'EXPEDITION' ? -2 : 0)) return 'Прогрев усилил камнепад. Нужен обход или ожидание холода.';
  if (cell.hazard === 'CORNICE') return 'Карниз нельзя пересекать. Перестрой линию ниже гребня.';
  if ((cell.ropeRequired || protectedByRope) && state.gear.ropeCondition < 18) return 'Рабочая верёвка критически изношена. Технический участок закрыт.';
  if ((cell.terrain === 'ROCK' || cell.terrain === 'GLACIER' || cell.terrain === 'RIDGE') && state.gear.hardwareCondition < 14) return 'Кошки, крючья и карабины больше не держат рабочую нагрузку.';
  return null;
}

function resolveIncident(state: IntegratedExpeditionState, context: IntegratedExpeditionContext, riskScore: number): IntegratedExpeditionState {
  const rng = createRng(`${state.seed}:integrated:${context.stageId}:${state.actionSerial + 1}`);
  const target = rng.chance(0.58) ? integratedLeader(state) : weakestParticipant(state);
  const medic = integratedSpecialist(state, 'MEDICINE');
  const medicalMitigation = Math.min(.32, medic.skills.MEDICINE * .035 + (state.gear.medkitCharges > 0 ? .08 : 0));
  const weather = context.weather;
  const severe = riskScore >= 72 || rng.chance(state.difficulty === 'EXPEDITION' ? 0.28 : 0.12);
  const severityFactor = 1 - medicalMitigation;
  let next = adjustTeamMindset(state, severe ? -6 : -3, severe ? -4 : -2);

  if (weather.temperatureC <= -14 && rng.chance(0.34)) {
    const injury = `${target.name}: обморожение`;
    next = damageParticipant(next, target.id, Math.round((severe ? 14 : 7) * severityFactor), 7, injury);
    return withIncident(next, context, 'FROSTBITE', target, 'Обморожение', `${target.name} теряет чувствительность в пальцах. ${medic.name} начинает первую помощь.`, severe ? 'CRITICAL' : 'DANGER');
  }
  if (state.currentElevation >= state.startElevation + (state.summitElevation - state.startElevation) * 0.64 && state.acclimatizationDays < 4 && rng.chance(0.42)) {
    const injury = `${target.name}: высотные симптомы`;
    next = damageParticipant(next, target.id, Math.round((severe ? 18 : 9) * severityFactor), 12, injury);
    return withIncident(next, context, 'ALTITUDE', target, 'Высотные симптомы', `${target.name} резко сдал по состоянию. ${medic.name} контролирует симптомы.`, severe ? 'CRITICAL' : 'DANGER');
  }
  if (rng.chance(0.18) && state.ropeMeters >= 20) {
    next = {
      ...next,
      ropeMeters: Math.max(0, next.ropeMeters - 20),
      gear: {
        ...next.gear,
        ropeCondition: clamp(next.gear.ropeCondition - 9),
        hardwareCondition: clamp(next.gear.hardwareCondition - 5),
        lostWeightKg: next.gear.lostWeightKg + 2.4,
      },
    };
    return withIncident(rebalanceLoads(next), context, 'GEAR_LOSS', null, 'Потеря снаряжения', 'Двадцать метров верёвки и часть железа сорвало со склона.', 'DANGER');
  }
  const injury = `${target.name}: ${severe ? 'серьёзная травма после срыва' : 'ушиб после срыва'}`;
  next = damageParticipant(next, target.id, Math.round((severe ? 28 : 11) * severityFactor), severe ? 20 : 9, injury);
  return withIncident(next, context, 'FALL', target, 'Срыв', `${target.name} получил ${severe ? 'серьёзную травму' : 'ушиб'}.`, severe ? 'CRITICAL' : 'DANGER');
}

function teamRefusesFastPush(state: IntegratedExpeditionState, context: IntegratedExpeditionContext) {
  if (state.pace !== 'FAST' || state.phase !== 'ASCENT') return null;
  const trust = integratedTeamTrust(state);
  const morale = integratedTeamMorale(state);
  if (trust >= 45 || morale >= 48) return null;
  const rng = createRng(`${state.seed}:refusal:${context.stageId}:${state.actionSerial + 1}`);
  const chance = Math.min(.72, .14 + Math.max(0, 45 - trust) / 70 + Math.max(0, 48 - morale) / 85);
  if (!rng.chance(chance)) return null;
  const speaker = [...mobileIntegratedParticipants(state)].sort((a, b) => a.trust - b.trust)[0] ?? integratedLeader(state);
  let next = applyTime({ ...state, actionSerial: state.actionSerial + 1 }, 18, .35);
  next = adjustTeamMindset(next, -1, -3);
  return withIncident(next, context, 'CONFLICT', speaker, 'Отказ от рывка', `${speaker.name} отказался идти быстрым темпом при таком состоянии группы.`, 'WARNING');
}

function rewardSuccessfulStep(state: IntegratedExpeditionState, riskScore: number) {
  const leader = integratedLeader(state);
  const trustGain = riskScore >= 45 && leader.skills.LEADERSHIP >= 6 ? 1 : 0;
  const moraleGain = riskScore >= 60 ? 2 : riskScore >= 35 ? 1 : 0;
  return adjustTeamMindset(state, moraleGain, trustGain);
}

function reduceStep(state: IntegratedExpeditionState, context: IntegratedExpeditionContext): IntegratedExpeditionState {
  const refusal = teamRefusesFastPush(state, context);
  if (refusal) return refusal;

  const path = state.paths[context.stageId] ?? [context.localMap.start];
  if (path.length < 2 || state.positionIndex >= path.length - 1) {
    const text = 'Сначала продолжи маршрут от текущей клетки.';
    return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
  }
  const nextIndex = state.positionIndex + 1;
  const previous = path[nextIndex - 1]!;
  const next = path[nextIndex]!;
  const cell = localCellAt(context.localMap, next)!;
  const infra = state.infrastructure[context.stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
  const id = pointKey(next);
  const hazardKnown = infra.revealed.includes(id);
  const protectedByRope = infra.ropes.includes(id);

  if (cell.hazard !== 'NONE' && !hazardKnown) {
    const revealed = [...new Set([...infra.revealed, id])];
    const nextState = updateInfrastructure(state, context.stageId, value => ({ ...value, revealed }));
    const text = `Группа обнаружила: ${cell.hazard === 'CREVASSE' ? 'трещину' : cell.hazard === 'AVALANCHE' ? 'лавинный склон' : cell.hazard === 'ROCKFALL' ? 'камнепадный жёлоб' : 'карниз'}.`;
    return { ...nextState, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
  }
  const blocked = hazardBlockReason(state, context, next, protectedByRope);
  if (blocked) return { ...state, message: blocked, lastEvent: event(state, 'STOP', 'DANGER', blocked) };

  const attempt = state.incidents.filter(incident => incident.stageId === context.stageId && incident.type === 'FALL').length;
  const preview = integratedStepPreview(state, context.localMap, previous, next, context.weather, protectedByRope, attempt);
  const leader = integratedLeader(state);
  if (leader.energy < preview.energy) {
    const text = 'Ведущий больше не держит темп. Смени ведущего, отдохни или начинай отход.';
    return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
  }

  const rng = createRng(`${state.seed}:step:${context.stageId}:${state.actionSerial + 1}:${next.x}:${next.y}`);
  const rollback = cell.rollbackCells > 0 && rng.chance(preview.score / 100);
  let nextState = applyTime({ ...state, actionSerial: state.actionSerial + 1 }, preview.minutes, 1.08);
  nextState = applyMovementFatigue(nextState, preview.energy, preview.minutes);

  if (rollback) {
    const rollbackTo = Math.max(0, state.positionIndex - Math.max(1, cell.rollbackCells));
    nextState = { ...nextState, positionIndex: rollbackTo, currentElevation: localCellAt(context.localMap, path[rollbackTo] ?? context.localMap.start)?.elevation ?? state.currentElevation };
    if (rng.chance(Math.min(0.9, 0.22 + preview.score / 130))) nextState = resolveIncident(nextState, context, Math.max(55, preview.score));
    const text = `Срыв на участке ${cell.slope}°. Группа откатилась на ${state.positionIndex - rollbackTo + 1} клеток.`;
    nextState = { ...nextState, message: text, lastEvent: event(nextState, 'STOP', 'DANGER', text) };
    return checkExpeditionViability(nextState, context);
  }

  nextState = updateInfrastructure(nextState, context.stageId, value => ({ ...value, revealed: [...new Set([...value.revealed, id])] }));
  nextState = {
    ...nextState,
    positionIndex: nextIndex,
    currentElevation: cell.elevation,
    highestElevation: Math.max(nextState.highestElevation, cell.elevation),
  };

  if (rng.chance(preview.incidentChance)) nextState = resolveIncident(nextState, context, preview.score);
  else nextState = rewardSuccessfulStep(nextState, preview.score);
  nextState = checkExpeditionViability(nextState, context);
  if (nextState.forcedRetreat) return nextState;

  if (nextIndex >= path.length - 1) {
    if (!isSamePoint(next, context.localMap.goal)) {
      const text = 'План закончился до выхода. Продолжи линию с текущей клетки.';
      return { ...nextState, message: text, lastEvent: event(nextState, 'STOP', 'WARNING', text) };
    }
    if (state.phase === 'ASCENT') {
      const completedStagePaths = { ...nextState.completedStagePaths, [context.stageId]: path };
      if (state.stageIndex >= context.stageCount - 1) {
        const reversePath = [...path].reverse();
        const text = 'Вершина достигнута. Начинается спуск по созданной инфраструктуре.';
        return {
          ...nextState,
          phase: 'DESCENT',
          summitReached: true,
          completedStagePaths,
          paths: { ...nextState.paths, [context.stageId]: reversePath },
          positionIndex: 0,
          message: text,
          lastEvent: event(nextState, 'STAGE_COMPLETE', 'SUCCESS', text),
        };
      }
      const text = `Этап «${context.stageTitle}» пройден. Открыт следующий участок.`;
      return {
        ...nextState,
        stageIndex: state.stageIndex + 1,
        positionIndex: 0,
        completedStagePaths,
        message: text,
        lastEvent: event(nextState, 'STAGE_COMPLETE', 'SUCCESS', text),
      };
    }
    if (state.stageIndex <= 0) {
      const phase = state.retreating ? 'RETREATED' : 'COMPLETE';
      const text = state.retreating ? 'Группа завершила отход и вернулась к старту.' : 'Группа вернулась к старту. Подъём и спуск завершены.';
      return {
        ...nextState,
        phase,
        currentElevation: state.startElevation,
        message: text,
        lastEvent: event(nextState, 'EXPEDITION_COMPLETE', 'SUCCESS', text),
      };
    }
    const text = `Спуск через «${context.stageTitle}» завершён.`;
    return {
      ...nextState,
      stageIndex: state.stageIndex - 1,
      positionIndex: 0,
      message: text,
      lastEvent: event(nextState, 'STAGE_COMPLETE', 'SUCCESS', text),
    };
  }

  const text = nextState.lastEvent.kind === 'INCIDENT'
    ? nextState.message
    : `${preview.specialistName} поддерживает линию. Высота ${cell.elevation} м.`;
  return {
    ...nextState,
    message: text,
    lastEvent: nextState.lastEvent.kind === 'INCIDENT' ? nextState.lastEvent : event(nextState, 'INFO', 'CALM', text),
  };
}

function restRecovery(mode: IntegratedRestMode) {
  if (mode === 'BREAK') return { minutes: 30, energy: 9, condition: 0, fuel: 0, morale: 1 };
  if (mode === 'BIVOUAC') return { minutes: 180, energy: 32, condition: 3, fuel: 1, morale: 3 };
  return { minutes: 480, energy: 68, condition: 8, fuel: 2, morale: 7 };
}

function reduceIntegratedExpeditionCore(
  state: IntegratedExpeditionState,
  command: IntegratedExpeditionCommand,
  context: IntegratedExpeditionContext,
): IntegratedExpeditionState {
  if (command.type === 'SET_ENTRY') {
    if (state.started) return state;
    return {
      ...state,
      entrySide: command.side,
      routeChoice: command.routeChoice,
      paths: {},
      completedStagePaths: {},
      infrastructure: {},
      positionIndex: 0,
      stageIndex: 0,
      message: 'Сторона захода изменена. Маршрут нужно проверить заново.',
      lastEvent: event(state, 'INFO', 'CALM', 'Сторона захода изменена.'),
    };
  }
  if (command.type === 'SET_ROUTE') {
    if (state.started) return state;
    return {
      ...state,
      routeChoice: command.routeChoice,
      paths: {},
      completedStagePaths: {},
      infrastructure: {},
      positionIndex: 0,
      stageIndex: 0,
      message: 'Маршрут выбран. Локальные линии будут сохранены в карьере.',
      lastEvent: event(state, 'INFO', 'CALM', 'Маршрут выбран.'),
    };
  }
  if (command.type === 'SET_PACE') {
    if (['COMPLETE', 'RETREATED', 'FAILED'].includes(state.phase)) return state;
    const label = command.pace === 'CAUTIOUS' ? 'осторожный' : command.pace === 'FAST' ? 'быстрый' : 'рабочий';
    const text = `Установлен ${label} темп. Он применяется ко всей группе автоматически.`;
    return { ...state, pace: command.pace, message: text, lastEvent: event(state, 'INFO', 'CALM', text) };
  }
  if (command.type === 'REGENERATE') {
    if (state.started) return state;
    return {
      ...state,
      variant: state.variant + 1,
      routeChoice: state.authority === 'COMMAND' ? 'MANUAL' : 'AUTO',
      paths: {},
      completedStagePaths: {},
      infrastructure: {},
      positionIndex: 0,
      stageIndex: 0,
      message: 'Создан новый вариант массива.',
      lastEvent: event(state, 'INFO', 'CALM', 'Создан новый вариант массива.'),
    };
  }
  if (command.type === 'ENSURE_STAGE_PATH') {
    if (state.paths[command.stageId]?.length && !command.replace) return state;
    return {
      ...state,
      paths: { ...state.paths, [command.stageId]: command.path },
      positionIndex: 0,
      currentElevation: command.currentElevation,
    };
  }
  if (command.type === 'SET_STAGE_PATH') {
    if (state.authority !== 'COMMAND' && state.started) return state;
    return { ...state, paths: { ...state.paths, [command.stageId]: command.path }, positionIndex: Math.min(state.positionIndex, Math.max(0, command.path.length - 1)) };
  }
  if (command.type === 'START') {
    if (state.started) return state;
    const text = 'План зафиксирован. Специалисты, груз и снаряжение работают автоматически; ты управляешь линией, темпом, отдыхом и исходом.';
    return { ...state, started: true, message: text, lastEvent: event(state, 'INFO', 'SUCCESS', text) };
  }
  if (command.type === 'STEP') {
    if (!state.started || ['COMPLETE', 'RETREATED', 'FAILED'].includes(state.phase)) return state;
    return reduceStep(state, context);
  }
  if (command.type === 'SCOUT') {
    const currentPath = state.paths[context.stageId] ?? [context.localMap.start];
    const current = currentPath[state.positionIndex] ?? context.localMap.start;
    const navigator = integratedSpecialist(state, 'NAVIGATION');
    const radius = Math.max(command.radius, navigator.skills.NAVIGATION >= 7 ? 2 : 1);
    const minutes = Math.max(8, Math.round(command.minutes * (1 - navigator.skills.NAVIGATION * .035)));
    const distance = Math.max(Math.abs(command.point.x - current.x), Math.abs(command.point.y - current.y));
    if (distance > radius + 1) {
      const text = 'Эта клетка слишком далеко. Сначала подведи группу ближе.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    const around = context.localMap.cells
      .filter(cell => Math.max(Math.abs(cell.x - command.point.x), Math.abs(cell.y - command.point.y)) <= radius)
      .map(pointKey);
    let next = updateInfrastructure(state, context.stageId, value => ({ ...value, revealed: [...new Set([...value.revealed, ...around])] }));
    next = applyTime({ ...next, actionSerial: state.actionSerial + 1 }, minutes, 0.7);
    const text = `${navigator.name} разведал район радиусом ${radius} клетки.`;
    return { ...next, message: text, lastEvent: event(next, 'INFO', 'CALM', text) };
  }
  if (command.type === 'TOGGLE_ROPE') {
    const cell = localCellAt(context.localMap, command.point);
    if (!cell) return state;
    const id = pointKey(command.point);
    const infra = state.infrastructure[context.stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
    if (infra.ropes.includes(id)) {
      const next = updateInfrastructure(state, context.stageId, value => ({ ...value, ropes: value.ropes.filter(valueId => valueId !== id) }));
      const text = 'Верёвка снята и возвращена в запас.';
      return { ...next, ropeMeters: next.ropeMeters + 20, message: text, lastEvent: event(next, 'INFO', 'CALM', text) };
    }
    if (state.ropeMeters < 20) {
      const text = 'Не хватает двадцати метров верёвки.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    if (state.gear.ropeCondition < 18 || state.gear.hardwareCondition < 18) {
      const text = 'Страховочное снаряжение критически изношено.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
    }
    if (cell.anchorQuality < 35) {
      const text = 'Нет надёжного крепления. Ищи соседнюю скалу или лёд с лучшим анкером.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
    }
    const skillId = cell.terrain === 'GLACIER' ? 'ICE' : 'ROCK';
    const technician = integratedSpecialist(state, skillId);
    const minutes = Math.max(18, Math.round(44 - technician.skills[skillId] * 3));
    const wear = Math.max(1, 5 - Math.floor(technician.skills[skillId] / 3));
    let next = updateInfrastructure(state, context.stageId, value => ({ ...value, ropes: [...value.ropes, id], revealed: [...new Set([...value.revealed, id])] }));
    next = applyTime({
      ...next,
      ropeMeters: next.ropeMeters - 20,
      actionSerial: next.actionSerial + 1,
      gear: {
        ...next.gear,
        ropeCondition: clamp(next.gear.ropeCondition - wear),
        hardwareCondition: clamp(next.gear.hardwareCondition - Math.max(1, wear - 1)),
      },
    }, minutes, 0.85);
    const text = `${technician.name} закрепил 20 м верёвки на участке ${cell.slope}°.`;
    return { ...next, message: text, lastEvent: event(next, 'INFO', 'SUCCESS', text) };
  }
  if (command.type === 'MAKE_CAMP') {
    const cell = localCellAt(context.localMap, command.point);
    if (!cell?.campPossible) {
      const text = 'Площадка слишком крутая, открытая или опасная.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    if (state.campKits <= 0 || state.gear.shelterCondition < 12) {
      const text = state.campKits <= 0 ? 'Свободных комплектов лагеря больше нет.' : 'Укрытие слишком изношено для нового лагеря.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    const id = pointKey(command.point);
    const infra = state.infrastructure[context.stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
    if (infra.camps.includes(id)) return state;
    const endurance = integratedSpecialist(state, 'ENDURANCE').skills.ENDURANCE;
    const minutes = Math.max(60, Math.round(112 - endurance * 5));
    let next = updateInfrastructure(state, context.stageId, value => ({ ...value, camps: [...value.camps, id] }));
    next = applyTime({
      ...next,
      campKits: next.campKits - 1,
      actionSerial: next.actionSerial + 1,
      gear: { ...next.gear, shelterCondition: clamp(next.gear.shelterCondition - 3) },
    }, minutes, 0.9);
    const text = 'Группа установила лагерь. Он останется на спуск.';
    return { ...next, message: text, lastEvent: event(next, 'INFO', 'SUCCESS', text) };
  }
  if (command.type === 'REST') {
    const currentPath = state.paths[context.stageId] ?? [context.localMap.start];
    const current = currentPath[state.positionIndex] ?? context.localMap.start;
    const cell = localCellAt(context.localMap, current)!;
    const infra = state.infrastructure[context.stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
    const atCamp = infra.camps.includes(pointKey(current));
    if (command.mode !== 'BREAK' && !atCamp && !state.hasBivy) {
      const text = 'Длительный отдых доступен только в лагере или с аварийным биваком.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    if (command.mode === 'BREAK' && (cell.hazard !== 'NONE' || cell.slope > 36)) {
      const text = 'Здесь нельзя безопасно остановиться.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    const recovery = restRecovery(command.mode);
    if (recovery.fuel > state.supplies.fuelUnits || (recovery.fuel > 0 && (!state.hasStove || state.gear.stoveCondition < 10))) {
      const text = !state.hasStove || state.gear.stoveCondition < 10 ? 'Горелка недоступна. Длительный отдых не восстановит группу.' : 'Не хватает топлива для отдыха.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
    }
    const medic = integratedSpecialist(state, 'MEDICINE');
    const patient = [...activeIntegratedParticipants(state)]
      .filter(participant => participant.injury)
      .sort((a, b) => a.condition - b.condition)[0];
    const canTreat = Boolean(patient && command.mode !== 'BREAK' && state.gear.medkitCharges > 0);
    const treatment = canTreat ? 3 + Math.round(medic.skills.MEDICINE * .85) : 0;
    let next = applyTime({ ...state, actionSerial: state.actionSerial + 1 }, recovery.minutes, 0.72);
    next = {
      ...next,
      supplies: { ...next.supplies, fuelUnits: Math.max(0, next.supplies.fuelUnits - recovery.fuel) },
      gear: {
        ...next.gear,
        medkitCharges: Math.max(0, next.gear.medkitCharges - (canTreat ? 1 : 0)),
        stoveCondition: clamp(next.gear.stoveCondition - recovery.fuel),
        shelterCondition: clamp(next.gear.shelterCondition - (command.mode === 'SLEEP' ? 2 : command.mode === 'BIVOUAC' ? 1 : 0)),
      },
      participants: next.participants.map(participant => {
        if (participant.status === 'DEAD') return participant;
        const isPatient = patient?.id === participant.id;
        const condition = clamp(participant.condition + recovery.condition + (isPatient ? treatment : 0));
        const energy = clamp(participant.energy + recovery.energy);
        const status = participant.status === 'INCAPACITATED' && condition >= 22 && energy >= 12 ? 'INJURED' : participant.status;
        return {
          ...participant,
          energy,
          condition,
          fatigue: clamp(participant.fatigue - recovery.energy * 0.75),
          morale: clamp(participant.morale + recovery.morale),
          trust: clamp(participant.trust + (canTreat ? 1 : 0)),
          status,
        };
      }),
    };
    next = rebalanceLoads(next);
    const treatmentText = canTreat && patient ? ` ${medic.name} обработал травму: ${patient.name}.` : '';
    const text = `${command.mode === 'BREAK' ? 'Короткий привал завершён.' : command.mode === 'BIVOUAC' ? 'Бивак завершён.' : 'Группа выспалась в лагере.'}${treatmentText}`;
    return { ...next, message: text, lastEvent: event(next, 'INFO', 'CALM', text) };
  }
  if (command.type === 'REORDER') {
    const target = command.index + command.delta;
    if (target < 0 || target >= state.participants.length) return state;
    const participants = [...state.participants];
    [participants[command.index], participants[target]] = [participants[target]!, participants[command.index]!];
    const normalized = participants.map((participant, index) => ({ ...participant, role: index === 0 ? 'Ведущий' : index === participants.length - 1 ? 'Замыкающий' : 'Участник' }));
    const nextLeader = normalized[0]!;
    const trustDelta = nextLeader.skills.LEADERSHIP >= 7 ? 1 : nextLeader.skills.LEADERSHIP <= 3 ? -1 : 0;
    const text = `${nextLeader.name} теперь ведёт группу.`;
    return { ...adjustTeamMindset({ ...state, participants: normalized }, 0, trustDelta), message: text, lastEvent: event(state, 'INFO', 'CALM', text) };
  }
  if (command.type === 'BEGIN_RETREAT') {
    if (state.phase !== 'ASCENT') return state;
    return forceRetreat(state, context, 'Руководитель принял решение об отходе. Группа разворачивается по пройденной линии.', false);
  }
  if (command.type === 'REQUEST_RESCUE') {
    const stranded = state.participants.filter(participant => participant.status === 'INCAPACITATED').map(participant => participant.memberId ?? participant.id);
    const elevationRatio = clamp((state.currentElevation - state.startElevation) / Math.max(1, state.summitElevation - state.startElevation), 0, 1);
    const radioDelay = state.gear.radioCondition > 15 ? Math.round((100 - state.gear.radioCondition) * 1.2) : 180;
    const duration = Math.round(240 + elevationRatio * 360 + context.weather.windKmh * 1.8 + radioDelay);
    const rescueCost = Math.round(140 + stranded.length * 190 + elevationRatio * 520 + (state.difficulty === 'EXPEDITION' ? 160 : state.difficulty === 'CLIMBER' ? 80 : 0));
    const shelterMitigation = state.gear.shelterCondition > 20 ? .52 : .9;
    const coldLoss = Math.max(0, Math.round((Math.max(0, -context.weather.temperatureC - 8) / 6 + duration / 260) * shelterMitigation));
    let base = applyTime({ ...state, actionSerial: state.actionSerial + 1 }, duration, 0.45);
    base = {
      ...base,
      participants: base.participants.map(participant => participant.status === 'DEAD' ? participant : {
        ...participant,
        energy: clamp(participant.energy - Math.max(4, Math.round(duration / 120))),
        condition: clamp(participant.condition - coldLoss),
        fatigue: clamp(participant.fatigue + Math.round(duration / 100)),
        morale: clamp(participant.morale - 6),
      }),
      phase: 'RETREATED',
      retreating: true,
      forcedRetreat: true,
      currentElevation: state.startElevation,
      rescuedMemberIds: [...new Set([...state.rescuedMemberIds, ...stranded])],
      rescueCost: state.rescueCost + rescueCost,
      rescueDurationMinutes: state.rescueDurationMinutes + duration,
      gear: {
        ...base.gear,
        shelterCondition: clamp(base.gear.shelterCondition - Math.max(2, Math.round(duration / 180))),
        radioCondition: clamp(base.gear.radioCondition - 4),
      },
    };
    const text = `Спасатели добрались до группы за ${Math.round(duration / 60)} ч. Стоимость операции: ${rescueCost} кр.`;
    const next = withIncident(base, context, 'RESCUE', null, 'Спасательная операция', text, 'CRITICAL');
    return { ...next, lastEvent: event(next, 'EXPEDITION_COMPLETE', 'WARNING', text), message: text };
  }
  return state;
}

export function reduceIntegratedExpedition(
  state: IntegratedExpeditionState,
  command: IntegratedExpeditionCommand,
  context: IntegratedExpeditionContext,
): IntegratedExpeditionState {
  return finalizeTransition(state, reduceIntegratedExpeditionCore(state, command, context));
}
