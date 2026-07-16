import { weatherAtGrid, type GridWeather } from '../../topography/mountainGridEngine';
import type { IntegratedExpeditionState, IntegratedIncidentRecord, IntegratedParticipantState, IntegratedSkillId } from './state';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function integratedWeatherAt(state: IntegratedExpeditionState): GridWeather {
  const procedural = weatherAtGrid(state.elapsedMinutes);
  const elapsedHours = state.elapsedMinutes / 60;
  const overrun = Math.max(0, elapsedHours - state.weatherWindow.durationHours);
  const stabilityPenalty = Math.max(0, 70 - state.weatherWindow.stability) / 70;
  const front = Math.min(1.4, overrun / 8 + stabilityPenalty * elapsedHours / 18);
  return {
    temperatureC: Math.round(state.weatherWindow.temperatureC + (procedural.temperatureC + 10) * 0.45 - front * 5),
    windKmh: Math.round(clamp(state.weatherWindow.windKmh + (procedural.windKmh - 15) * 0.55 + front * 22, 0, 120)),
    visibility: Math.round(clamp(procedural.visibility - state.weatherWindow.snowfallCm * 1.2 - front * 34, 8, 100)),
    snowSoftness: Math.round(clamp(procedural.snowSoftness + state.weatherWindow.snowfallCm * 1.8 + front * 18, 0, 100)),
  };
}

export function activeIntegratedParticipants(state: IntegratedExpeditionState) {
  return state.participants.filter(participant => participant.status !== 'DEAD');
}

export function mobileIntegratedParticipants(state: IntegratedExpeditionState) {
  return activeIntegratedParticipants(state).filter(participant => participant.status === 'ACTIVE' || participant.status === 'INJURED');
}

export function integratedLeader(state: IntegratedExpeditionState): IntegratedParticipantState {
  return mobileIntegratedParticipants(state)[0]
    ?? activeIntegratedParticipants(state)[0]
    ?? state.participants[0]!;
}

export function integratedSpecialist(state: IntegratedExpeditionState, skillId: IntegratedSkillId): IntegratedParticipantState {
  return [...mobileIntegratedParticipants(state)]
    .sort((a, b) => {
      const aScore = a.skills[skillId] * 10 + a.energy * .12 + a.condition * .1 + a.trust * .05;
      const bScore = b.skills[skillId] * 10 + b.energy * .12 + b.condition * .1 + b.trust * .05;
      return bScore - aScore;
    })[0] ?? integratedLeader(state);
}

function average(state: IntegratedExpeditionState, getter: (participant: IntegratedParticipantState) => number) {
  const active = activeIntegratedParticipants(state);
  if (!active.length) return 0;
  return Math.round(active.reduce((sum, participant) => sum + getter(participant), 0) / active.length);
}

export function integratedTeamCondition(state: IntegratedExpeditionState) {
  return average(state, participant => participant.condition);
}

export function integratedTeamEnergy(state: IntegratedExpeditionState) {
  return average(state, participant => participant.energy);
}

export function integratedTeamMorale(state: IntegratedExpeditionState) {
  return average(state, participant => participant.morale);
}

export function integratedTeamTrust(state: IntegratedExpeditionState) {
  return average(state, participant => participant.trust);
}

export function integratedTeamLoadRatio(state: IntegratedExpeditionState) {
  const mobile = mobileIntegratedParticipants(state);
  if (!mobile.length) return 2;
  const load = mobile.reduce((sum, participant) => sum + participant.loadKg, 0);
  const capacity = mobile.reduce((sum, participant) => sum + participant.carryCapacityKg, 0);
  return capacity > 0 ? load / capacity : 2;
}

export function integratedCanContinue(state: IntegratedExpeditionState) {
  return !['COMPLETE', 'RETREATED', 'FAILED'].includes(state.phase)
    && mobileIntegratedParticipants(state).length > 0;
}

export interface IntegratedExpeditionDebrief {
  strengths: string[];
  risks: string[];
  contributors: string[];
  equipment: string[];
  mistakes: string[];
}

export function integratedExpeditionDebrief(state: IntegratedExpeditionState): IntegratedExpeditionDebrief {
  const revealed = Object.values(state.infrastructure).reduce((sum, item) => sum + item.revealed.length, 0);
  const ropes = Object.values(state.infrastructure).reduce((sum, item) => sum + item.ropes.length, 0);
  const strengths: string[] = [];
  const risks: string[] = [];
  const contributors: string[] = [];
  const equipment: string[] = [];
  const mistakes: string[] = [];

  if (state.summitReached && state.phase === 'COMPLETE') strengths.push('Группа достигла вершины и физически завершила спуск.');
  else if (state.phase === 'RETREATED' && !state.forcedRetreat) strengths.push('Отход был принят до полного разрушения состояния группы.');
  if (revealed >= 20) strengths.push(`Разведка раскрыла ${revealed} клеток и снизила количество слепых решений.`);
  if (ropes > 0) strengths.push(`Закреплённая линия защитила ${ropes} технических участков и осталась на спуск.`);
  if (state.nightsSlept > 0) strengths.push(`Группа провела ${state.nightsSlept} полноценн${state.nightsSlept === 1 ? 'ую ночь' : 'ых ночи'} на маршруте.`);
  if (!state.casualties.length) strengths.push('Все участники вернулись живыми.');

  const incidentText = state.incidents.map(item => `${item.title} ${item.detail}`.toLowerCase()).join(' ');
  if (ropes > 0) equipment.push(`Верёвка: защищено ${ropes} участк${ropes === 1 ? 'а' : 'ов'}, остаток ${state.ropeMeters} м, состояние ${Math.round(state.gear.ropeCondition)}%.`);
  if (incidentText.includes('верёвк') || state.incidents.some(item => item.type === 'FALL' || item.type === 'CREVASSE' || item.type === 'DESCENT')) {
    equipment.push(`Страховка: ${state.gear.ropeCondition >= 35 ? 'оставалась рабочей' : 'была близка к отказу'} на ключевых технических эпизодах.`);
  }
  if (state.gear.rockHardwareCondition < 98 || state.incidents.some(item => item.type === 'ROCKFALL')) {
    equipment.push(`Скальный комплект: состояние ${Math.round(state.gear.rockHardwareCondition)}%; работал на станциях, гребнях и камнепаде.`);
  }
  if (state.gear.iceHardwareCondition < 98 || state.incidents.some(item => item.type === 'CREVASSE' || item.type === 'AVALANCHE')) {
    equipment.push(`Ледовый комплект: состояние ${Math.round(state.gear.iceHardwareCondition)}%; работал на снегу, льду и трещинах.`);
  }
  if (state.nightsSlept > 0 || state.gear.shelterCondition < 99) {
    equipment.push(`Укрытие: ${state.nightsSlept} ночёв${state.nightsSlept === 1 ? 'ка' : 'ки'}, остаток состояния ${Math.round(state.gear.shelterCondition)}%.`);
  }
  if (state.gear.medkitCharges < 3 && state.injuries.length > 0) equipment.push(`Аптечка: использована для ${state.injuries.length} травм, осталось ${state.gear.medkitCharges} применений.`);
  if (state.rescueDurationMinutes > 0) equipment.push(`Радио: обеспечило вызов спасателей; состояние после операции ${Math.round(state.gear.radioCondition)}%.`);

  if (state.minutesSinceSleep > 900) mistakes.push(`Группа работала без сна ${Math.round(state.minutesSinceSleep / 60)} ч.`);
  if (state.supplies.waterUnits < 1) mistakes.push('Воды осталось меньше одной единицы — запас был рассчитан впритык.');
  if (state.supplies.foodUnits < 1) mistakes.push('Еда закончилась или почти закончилась до возвращения.');
  if (state.gear.ropeCondition < 25) mistakes.push('Верёвка подошла к критическому износу до окончания маршрута.');
  if (state.gear.rockHardwareCondition < 20 || state.gear.iceHardwareCondition < 20) mistakes.push('Один из технических комплектов был почти выведен из строя.');
  if (state.incidents.some(item => item.type === 'ALTITUDE')) mistakes.push('Высоту сна набирали слишком быстро для текущей акклиматизации.');
  if (state.incidents.some(item => item.type === 'EXHAUSTION')) mistakes.push('Темп не был вовремя снижен под состояние слабейшего участника.');
  if (state.incidents.some(item => item.type === 'FALL' && !item.detail.toLowerCase().includes('верёвк'))) mistakes.push('Технический участок проходили без закреплённой линии.');

  const grouped = new Map<string, number>();
  for (const incident of state.incidents) grouped.set(incident.type, (grouped.get(incident.type) ?? 0) + 1);
  const riskLabels: Partial<Record<IntegratedIncidentRecord['type'], string>> = {
    AVALANCHE: 'лавинные участки',
    ROCKFALL: 'камнепад',
    CREVASSE: 'трещины и снежные мосты',
    DESCENT: 'ошибки и задержки на спуске',
    FALL: 'незащищённые технические участки',
    ALTITUDE: 'слишком быстрый набор высоты сна',
    FROSTBITE: 'долгая работа на морозе',
    EXHAUSTION: 'истощение и недосып',
    NAVIGATION: 'потери линии',
    WEATHER: 'ветер и плохая видимость',
    GEAR_LOSS: 'износ и потеря снаряжения',
    CONFLICT: 'низкое доверие внутри группы',
  };
  for (const [type, count] of [...grouped.entries()].sort((a, b) => b[1] - a[1])) {
    const label = riskLabels[type as IntegratedIncidentRecord['type']];
    if (label) risks.push(`${label}: ${count} событ${count === 1 ? 'ие' : 'ия'}.`);
  }
  if (state.minutesSinceSleep > 900) risks.push(`К концу вылазки группа не спала ${Math.round(state.minutesSinceSleep / 60)} ч.`);
  if (state.supplies.waterUnits < 1) risks.push('Запас воды подошёл к критическому уровню.');
  if (state.forcedRetreat) risks.push('Отход стал вынужденным после потери рабочего состояния группы.');

  if (revealed > 0) {
    const navigator = integratedSpecialist(state, 'NAVIGATION');
    contributors.push(`${navigator.name}: навигация и разведка.`);
  }
  if (ropes > 0) {
    const technical = integratedSpecialist(state, state.incidents.some(item => item.type === 'CREVASSE') ? 'ICE' : 'ROCK');
    contributors.push(`${technical.name}: страховка и техническая линия.`);
  }
  if (state.injuries.length || state.rescuedMemberIds.length) {
    const medic = integratedSpecialist(state, 'MEDICINE');
    contributors.push(`${medic.name}: контроль травм и состояния людей.`);
  }
  const leader = integratedLeader(state);
  contributors.push(`${leader.name}: удержание общего темпа и решений группы.`);

  return {
    strengths: [...new Set(strengths)].slice(0, 4),
    risks: [...new Set(risks)].slice(0, 4),
    contributors: [...new Set(contributors)].slice(0, 4),
    equipment: [...new Set(equipment)].slice(0, 5),
    mistakes: [...new Set(mistakes)].slice(0, 4),
  };
}
