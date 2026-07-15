import { weatherAtGrid, type GridWeather } from '../../topography/mountainGridEngine';
import type { IntegratedExpeditionState, IntegratedParticipantState, IntegratedSkillId } from './state';

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
