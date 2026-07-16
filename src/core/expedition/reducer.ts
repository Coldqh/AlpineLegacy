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
  const nextElapsed = state.elapsedMinutes + minutes;
  return {
    ...state,
    elapsedMinutes: nextElapsed,
    minutesSinceSleep: state.minutesSinceSleep + minutes,
    climbingDays: Math.max(state.climbingDays, Math.floor(nextElapsed / 1440)),
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

function applyMovementFatigue(
  state: IntegratedExpeditionState,
  energyCosts: Record<string, number>,
  minutes: number,
  weatherTemperatureC: number,
): IntegratedExpeditionState {
  const tuning = integratedDifficultyTuning(state.difficulty);
  const noFood = state.supplies.foodUnits <= 0;
  const noWater = state.supplies.waterUnits <= 0;
  const coldStress = Math.max(0, -weatherTemperatureC - 18) / 40;
  const participants = state.participants.map(participant => {
    if (participant.status === 'DEAD' || participant.status === 'INCAPACITATED') return participant;
    const energyLoss = energyCosts[participant.id] ?? Math.max(.1, minutes / 60 * 3.2);
    const energy = clamp(participant.energy - energyLoss);
    const fatigueGain = energyLoss * 1.05 + minutes / 240;
    const fatigue = clamp(participant.fatigue + fatigueGain);
    const deprivation = (noFood ? minutes / 420 : 0) + (noWater ? minutes / 170 : 0);
    const exhaustion = energy < 8 ? (8 - energy) * .16 : fatigue > 92 ? (fatigue - 92) * .08 : 0;
    const conditionLoss = Math.max(0, (deprivation + exhaustion + coldStress * minutes / 180) * tuning.condition);
    const condition = clamp(participant.condition - conditionLoss);
    let status: IntegratedParticipantState['status'] = participant.status;
    if (condition <= 0) status = 'DEAD';
    else if (condition < 15 || energy <= 0) status = 'INCAPACITATED';
    const strained = energy < 24 || participant.loadKg > participant.carryCapacityKg;
    const moraleDelta = state.pace === 'FAST' && strained ? -1 : 0;
    return { ...participant, energy, fatigue, condition, morale: clamp(participant.morale + moraleDelta), status };
  });
  const casualties = [...state.casualties];
  for (const participant of participants) {
    const casualtyId = participant.memberId ?? participant.id;
    if (participant.status === 'DEAD' && !casualties.includes(casualtyId)) casualties.push(casualtyId);
  }
  const averageCost = Object.values(energyCosts).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.keys(energyCosts).length);
  return rebalanceLoads({
    ...state,
    participants,
    casualties,
    gear: {
      ...state.gear,
      hardwareCondition: clamp(state.gear.hardwareCondition - Math.max(0, (averageCost - 2.5) / 24)),
      ropeCondition: clamp(state.gear.ropeCondition - (state.phase === 'DESCENT' ? .18 : .1)),
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

function resolveIncident(
  state: IntegratedExpeditionState,
  context: IntegratedExpeditionContext,
  riskScore: number,
  point: GridPoint,
  protectedByRope: boolean,
): IntegratedExpeditionState {
  const rng = createRng(`${state.seed}:integrated:${context.stageId}:${state.actionSerial + 1}:${point.x}:${point.y}`);
  const target = rng.chance(0.42) ? integratedLeader(state) : weakestParticipant(state);
  const medic = integratedSpecialist(state, 'MEDICINE');
  const navigator = integratedSpecialist(state, 'NAVIGATION');
  const cell = localCellAt(context.localMap, point)!;
  const medicalMitigation = Math.min(.34, medic.skills.MEDICINE * .034 + (state.gear.medkitCharges > 0 ? .08 : 0));
  const weather = context.weather;
  const severe = riskScore >= 80 || rng.chance(state.difficulty === 'EXPEDITION' ? 0.16 : 0.07);
  const severityFactor = 1 - medicalMitigation;
  let next = adjustTeamMindset(state, severe ? -5 : -2, severe ? -3 : -1);

  const altitudeGainSinceSleep = Math.max(0, state.currentElevation - state.lastSleepElevation);
  const altitudeExposure = state.currentElevation >= 3000 && altitudeGainSinceSleep > 500 && state.acclimatizationDays < 5;
  if (altitudeExposure && rng.chance(.38)) {
    const injury = `${target.name}: высотные симптомы`;
    next = damageParticipant(next, target.id, Math.round((severe ? 13 : 6) * severityFactor), severe ? 12 : 6, injury);
    return withIncident(next, context, 'ALTITUDE', target, 'Высотные симптомы', `${target.name} плохо переносит набор высоты после сна на ${Math.round(state.lastSleepElevation)} м. ${medic.name} контролирует состояние.`, severe ? 'CRITICAL' : 'DANGER');
  }
  if (weather.temperatureC <= -20 && state.minutesSinceSleep > 480 && rng.chance(.24)) {
    const injury = `${target.name}: обморожение`;
    next = damageParticipant(next, target.id, Math.round((severe ? 12 : 5) * severityFactor), 5, injury);
    return withIncident(next, context, 'FROSTBITE', target, 'Холодовая травма', `${target.name} долго работал на морозе. ${medic.name} начинает отогревание и проверку чувствительности.`, severe ? 'CRITICAL' : 'DANGER');
  }

  const technical = cell.ropeRequired || cell.slope >= 48 || cell.hazard === 'CREVASSE' || cell.hazard === 'CORNICE';
  const fallChance = technical ? (protectedByRope ? .02 : .16) : 0;
  if (fallChance > 0 && rng.chance(fallChance)) {
    const injury = `${target.name}: ${severe ? 'травма после срыва' : 'растяжение после срыва'}`;
    next = damageParticipant(next, target.id, Math.round((severe ? 22 : 7) * severityFactor), severe ? 16 : 6, injury);
    return withIncident(next, context, 'FALL', target, 'Срыв', protectedByRope
      ? `${target.name} сорвался, но страховка удержала. ${medic.name} проверяет травму.`
      : `${target.name} сорвался на незащищённом участке.`, severe ? 'CRITICAL' : 'DANGER');
  }

  if (rng.chance(.11) && state.ropeMeters >= 20 && (cell.terrain === 'ROCK' || cell.terrain === 'RIDGE')) {
    next = {
      ...next,
      ropeMeters: Math.max(0, next.ropeMeters - 20),
      gear: {
        ...next.gear,
        ropeCondition: clamp(next.gear.ropeCondition - 6),
        hardwareCondition: clamp(next.gear.hardwareCondition - 3),
        lostWeightKg: next.gear.lostWeightKg + 1.8,
      },
    };
    return withIncident(rebalanceLoads(next), context, 'GEAR_LOSS', null, 'Потеря снаряжения', 'Часть бухты и несколько элементов страховки ушли вниз по склону.', 'DANGER');
  }

  if (target.energy < 28 || state.minutesSinceSleep > 900) {
    const energyLoss = severe ? 5 : 2;
    next = {
      ...next,
      participants: next.participants.map(participant => participant.id === target.id
        ? { ...participant, energy: clamp(participant.energy - energyLoss), fatigue: clamp(participant.fatigue + energyLoss * 1.5) }
        : participant),
    };
    return withIncident(next, context, 'EXHAUSTION', target, 'Сбой темпа', `${target.name} не удержал рабочий темп. Группа потеряла время, но травмы нет.`, 'WARNING');
  }

  if (cell.terrain === 'SCREE' || context.weather.visibility < 45) {
    const delay = Math.max(8, 28 - navigator.skills.NAVIGATION * 2);
    next = applyTime(next, delay, .45);
    return withIncident(next, context, 'NAVIGATION', navigator, 'Ошибка линии', `${navigator.name} заметил неверный выход и вернул группу на линию. Потеряно ${delay} мин.`, 'WARNING');
  }

  return withIncident(next, context, 'NEAR_MISS', target, 'Опасный момент', `${target.name} вовремя остановился. Группа продолжает без травм.`, 'WARNING');
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
  const exhausted = mobileIntegratedParticipants(state).find(participant => participant.energy < (preview.participantEnergyCosts[participant.id] ?? preview.energy));
  if (exhausted) {
    const text = `${exhausted.name} больше не держит рабочий темп. Нужен привал, сон или отход.`;
    return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
  }

  const rng = createRng(`${state.seed}:step:${context.stageId}:${state.actionSerial + 1}:${next.x}:${next.y}`);
  const rollbackChance = protectedByRope ? 0 : Math.min(.16, Math.max(0, preview.score - 58) / 260);
  const rollback = cell.rollbackCells > 0 && rng.chance(rollbackChance);
  let nextState = applyTime({ ...state, actionSerial: state.actionSerial + 1 }, preview.minutes, 1.08);
  nextState = applyMovementFatigue(nextState, preview.participantEnergyCosts, preview.minutes, context.weather.temperatureC);

  if (rollback) {
    const rollbackTo = Math.max(0, state.positionIndex - Math.max(1, cell.rollbackCells));
    nextState = { ...nextState, positionIndex: rollbackTo, currentElevation: localCellAt(context.localMap, path[rollbackTo] ?? context.localMap.start)?.elevation ?? state.currentElevation };
    if (rng.chance(Math.min(.2, .025 + preview.score / 700))) nextState = resolveIncident(nextState, context, Math.max(55, preview.score), next, protectedByRope);
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

  if (rng.chance(preview.incidentChance)) nextState = resolveIncident(nextState, context, preview.score, next, protectedByRope);
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
  if (mode === 'BREAK') return { minutes: 20, baseEnergy: 2.2, condition: 0, fuel: 0, morale: 1 };
  if (mode === 'BIVOUAC') return { minutes: 300, baseEnergy: 24, condition: 1, fuel: 1, morale: 2 };
  return { minutes: 480, baseEnergy: 48, condition: 4, fuel: 2, morale: 5 };
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
  if (command.type === 'SET_TUTORIAL_STEP') {
    return { ...state, tutorialStep: clamp(command.step, 0, 6) };
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
    const radius = 4;
    const minutes = Math.max(8, Math.round(22 - navigator.skills.NAVIGATION * 1.5));
    const around = context.localMap.cells
      .filter(cell => Math.max(Math.abs(cell.x - current.x), Math.abs(cell.y - current.y)) <= radius)
      .map(pointKey);
    let next = updateInfrastructure(state, context.stageId, value => ({ ...value, revealed: [...new Set([...value.revealed, ...around])] }));
    next = applyTime({ ...next, actionSerial: state.actionSerial + 1 }, minutes, .55);
    const text = `${navigator.name} проверил квадрат 9×9 вокруг группы. Открыто ${around.length} клеток.`;
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
    const text = 'Лагерь ставится автоматически при выборе сна на безопасной площадке.';
    return { ...state, message: text, lastEvent: event(state, 'INFO', 'CALM', text) };
  }
  if (command.type === 'REST') {
    const currentPath = state.paths[context.stageId] ?? [context.localMap.start];
    const current = currentPath[state.positionIndex] ?? context.localMap.start;
    const cell = localCellAt(context.localMap, current)!;
    const id = pointKey(current);
    let infra = state.infrastructure[context.stageId] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
    let campBuilt = false;
    let next = state;

    if (command.mode === 'BREAK' && (cell.hazard !== 'NONE' || cell.slope > 38)) {
      const text = 'Здесь нельзя безопасно остановиться даже на короткий привал.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }
    if (command.mode === 'SLEEP' && !infra.camps.includes(id)) {
      if (!cell.campPossible) {
        const text = 'Для сна нужна ровная безопасная площадка. Дойди до клетки, отмеченной точкой лагеря.';
        return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
      }
      if (state.campKits <= 0 || state.gear.shelterCondition < 12) {
        const text = 'Нет свободного комплекта укрытия для ночного лагеря.';
        return { ...state, message: text, lastEvent: event(state, 'STOP', 'DANGER', text) };
      }
      next = updateInfrastructure(state, context.stageId, value => ({ ...value, camps: [...new Set([...value.camps, id])] }));
      next = applyTime({ ...next, campKits: next.campKits - 1, actionSerial: next.actionSerial + 1 }, Math.max(45, 88 - integratedSpecialist(state, 'ENDURANCE').skills.ENDURANCE * 4), .72);
      infra = next.infrastructure[context.stageId] ?? infra;
      campBuilt = true;
    }
    if (command.mode === 'BIVOUAC' && !infra.camps.includes(id) && !state.hasBivy) {
      const text = 'Для аварийного бивака нет укрытия.';
      return { ...state, message: text, lastEvent: event(state, 'STOP', 'WARNING', text) };
    }

    const recovery = restRecovery(command.mode);
    if (recovery.fuel > next.supplies.fuelUnits || (recovery.fuel > 0 && (!next.hasStove || next.gear.stoveCondition < 10))) {
      const text = !next.hasStove || next.gear.stoveCondition < 10 ? 'Горелка недоступна. Нельзя растопить воду для длительного отдыха.' : 'Не хватает топлива для длительного отдыха.';
      return { ...next, message: text, lastEvent: event(next, 'STOP', 'DANGER', text) };
    }

    const altitudeGain = Math.max(0, next.currentElevation - next.lastSleepElevation);
    const excessiveSleepingGain = command.mode === 'SLEEP' && next.currentElevation >= 3000 && altitudeGain > 500;
    const shelterFactor = infra.camps.includes(id) ? 1 : command.mode === 'BIVOUAC' ? .66 : 1;
    const altitudeFactor = excessiveSleepingGain ? Math.max(.48, 1 - (altitudeGain - 500) / 1800) : 1;
    const medic = integratedSpecialist(next, 'MEDICINE');
    const patient = [...activeIntegratedParticipants(next)].filter(participant => participant.injury).sort((a, b) => a.condition - b.condition)[0];
    const canTreat = Boolean(patient && command.mode !== 'BREAK' && next.gear.medkitCharges > 0);
    const treatment = canTreat ? 2 + medic.skills.MEDICINE * .75 : 0;

    next = applyTime({ ...next, actionSerial: next.actionSerial + 1 }, recovery.minutes, command.mode === 'BREAK' ? .35 : .62);
    next = {
      ...next,
      minutesSinceSleep: command.mode === 'SLEEP' ? 0 : next.minutesSinceSleep,
      lastSleepElevation: command.mode === 'SLEEP' ? next.currentElevation : next.lastSleepElevation,
      nightsSlept: next.nightsSlept + (command.mode === 'SLEEP' ? 1 : 0),
      acclimatizationDays: next.acclimatizationDays + (command.mode === 'SLEEP' && !excessiveSleepingGain ? .35 : 0),
      supplies: { ...next.supplies, fuelUnits: Math.max(0, next.supplies.fuelUnits - recovery.fuel) },
      gear: {
        ...next.gear,
        medkitCharges: Math.max(0, next.gear.medkitCharges - (canTreat ? 1 : 0)),
        stoveCondition: clamp(next.gear.stoveCondition - recovery.fuel * .7),
        shelterCondition: clamp(next.gear.shelterCondition - (command.mode === 'SLEEP' ? 1.4 : command.mode === 'BIVOUAC' ? .8 : 0)),
      },
      participants: next.participants.map(participant => {
        if (participant.status === 'DEAD') return participant;
        const enduranceFactor = .78 + participant.skills.ENDURANCE * .045;
        const personalRecovery = recovery.baseEnergy * enduranceFactor * shelterFactor * altitudeFactor;
        const isPatient = patient?.id === participant.id;
        const condition = clamp(participant.condition + recovery.condition * altitudeFactor + (isPatient ? treatment : 0) - (excessiveSleepingGain ? 1.5 : 0));
        const energy = clamp(participant.energy + personalRecovery);
        const status = participant.status === 'INCAPACITATED' && condition >= 22 && energy >= 12 ? 'INJURED' : participant.status;
        return {
          ...participant,
          energy,
          condition,
          fatigue: clamp(participant.fatigue - personalRecovery * (command.mode === 'SLEEP' ? .82 : .5)),
          morale: clamp(participant.morale + recovery.morale - (excessiveSleepingGain ? 2 : 0)),
          trust: clamp(participant.trust + (canTreat ? 1 : 0)),
          status,
        };
      }),
    };
    next = rebalanceLoads(next);
    const treatmentText = canTreat && patient ? ` ${medic.name} обработал травму: ${patient.name}.` : '';
    const altitudeText = excessiveSleepingGain ? ` Набор высоты сна составил ${Math.round(altitudeGain)} м: восстановление хуже, риск высотных симптомов выше.` : '';
    const text = `${campBuilt ? 'Лагерь установлен. ' : ''}${command.mode === 'BREAK' ? 'Короткий привал завершён.' : command.mode === 'BIVOUAC' ? 'Аварийный бивак завершён.' : 'Группа провела полноценную ночь.'}${treatmentText}${altitudeText}`;
    return { ...next, message: text, lastEvent: event(next, 'INFO', excessiveSleepingGain ? 'WARNING' : 'CALM', text) };
  }
  if (command.type === 'REORDER') {
    const text = 'Порядок группы фиксируется руководителем до выхода и не меняется во время движения.';
    return { ...state, message: text, lastEvent: event(state, 'INFO', 'CALM', text) };
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
