import { weatherAtGrid, type GridWeather } from '../../topography/mountainGridEngine';
import type { IntegratedExpeditionState, IntegratedParticipantState } from './state';

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

export function integratedLeader(state: IntegratedExpeditionState): IntegratedParticipantState {
  return activeIntegratedParticipants(state).find(participant => participant.status === 'ACTIVE' || participant.status === 'INJURED')
    ?? state.participants[0]!;
}

export function integratedTeamCondition(state: IntegratedExpeditionState) {
  const active = activeIntegratedParticipants(state);
  if (!active.length) return 0;
  return Math.round(active.reduce((sum, participant) => sum + participant.condition, 0) / active.length);
}

export function integratedTeamEnergy(state: IntegratedExpeditionState) {
  const active = activeIntegratedParticipants(state);
  if (!active.length) return 0;
  return Math.round(active.reduce((sum, participant) => sum + participant.energy, 0) / active.length);
}

export function integratedCanContinue(state: IntegratedExpeditionState) {
  return !['COMPLETE', 'RETREATED', 'FAILED'].includes(state.phase)
    && activeIntegratedParticipants(state).some(participant => participant.status !== 'INCAPACITATED');
}
