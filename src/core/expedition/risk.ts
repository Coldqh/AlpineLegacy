import { evaluateLocalStepRisk, localCellAt, localMoveCost, type GridPoint, type GridWeather, type LocalStageMap, type LocalStepRiskBand } from '../../topography/mountainGridEngine';
import type { IntegratedDifficulty, IntegratedExpeditionState, IntegratedPace, IntegratedParticipantState, IntegratedSkillId } from './state';
import { integratedLeader, integratedSpecialist, integratedTeamLoadRatio, integratedTeamMorale, integratedTeamTrust, mobileIntegratedParticipants } from './selectors';

const DIFFICULTY = {
  EXPLORER: { risk: 0.72, energy: 0.88, incident: 0.66, condition: 0.74 },
  CLIMBER: { risk: 1, energy: 1, incident: 1, condition: 1 },
  EXPEDITION: { risk: 1.2, energy: 1.08, incident: 1.28, condition: 1.2 },
} satisfies Record<IntegratedDifficulty, { risk: number; energy: number; incident: number; condition: number }>;

const PACE = {
  CAUTIOUS: { risk: .8, energy: .7, minutes: 1.2, incident: .78 },
  STEADY: { risk: 1, energy: 1, minutes: 1, incident: 1 },
  FAST: { risk: 1.23, energy: 1.1, minutes: .8, incident: 1.3 },
} satisfies Record<IntegratedPace, { risk: number; energy: number; minutes: number; incident: number }>;

const SKILL_BY_TERRAIN: Record<string, IntegratedSkillId> = {
  VALLEY: 'ENDURANCE',
  SCREE: 'NAVIGATION',
  GLACIER: 'ICE',
  SNOW: 'ENDURANCE',
  ROCK: 'ROCK',
  RIDGE: 'ROCK',
  SUMMIT: 'ENDURANCE',
};

const TERRAIN_EXERTION: Record<string, number> = {
  VALLEY: .82,
  SCREE: 1.05,
  GLACIER: 1.12,
  SNOW: 1.08,
  ROCK: 1.18,
  RIDGE: 1.2,
  SUMMIT: 1.16,
};

export function integratedDifficultyTuning(difficulty: IntegratedDifficulty) {
  return DIFFICULTY[difficulty];
}

export function integratedPaceTuning(pace: IntegratedPace) {
  return PACE[pace];
}

function participantEnergyForStep(
  state: IntegratedExpeditionState,
  participant: IntegratedParticipantState,
  minutes: number,
  terrain: string,
  elevation: number,
  fixedRope: boolean,
) {
  const hours = minutes / 60;
  const endurance = participant.skills.ENDURANCE;
  const loadRatio = participant.carryCapacityKg > 0 ? participant.loadKg / participant.carryCapacityKg : 1;
  const basePerHour = Math.max(1.85, 4.65 - endurance * .27);
  const terrainFactor = TERRAIN_EXERTION[terrain] ?? 1;
  const loadFactor = Math.max(.86, 1 + (loadRatio - .72) * .58);
  const altitudeRatio = Math.max(0, (elevation - 2800) / 4200);
  const acclimatization = Math.min(.28, state.acclimatizationDays * .035 + state.nightsSlept * .012);
  const altitudeFactor = 1 + Math.max(0, altitudeRatio * .46 - acclimatization);
  const wakeFactor = 1 + Math.max(0, state.minutesSinceSleep - 720) / 2200;
  const fatigueFactor = 1 + Math.max(0, participant.fatigue - 52) / 170;
  const ropeFactor = fixedRope && ['ROCK', 'RIDGE', 'GLACIER'].includes(terrain) ? .88 : 1;
  const tuning = DIFFICULTY[state.difficulty];
  const pace = PACE[state.pace];
  return Math.max(.1, hours * basePerHour * terrainFactor * loadFactor * altitudeFactor * wakeFactor * fatigueFactor * ropeFactor * tuning.energy * pace.energy);
}

export function integratedStepPreview(
  state: IntegratedExpeditionState,
  map: LocalStageMap,
  from: GridPoint,
  to: GridPoint,
  weather: GridWeather,
  fixedRope: boolean,
  attempt = 0,
) {
  const leader = integratedLeader(state);
  const cell = localCellAt(map, to)!;
  const skillId = SKILL_BY_TERRAIN[cell.terrain] ?? 'ENDURANCE';
  const specialist = integratedSpecialist(state, skillId);
  const leaderSkill = leader.skills[skillId];
  const specialistSkill = specialist.skills[skillId];
  const skill = Math.round((leaderSkill * .55 + specialistSkill * .45) * 10) / 10;
  const tuning = DIFFICULTY[state.difficulty];
  const pace = PACE[state.pace];
  const baseRisk = evaluateLocalStepRisk(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, attempt });
  const acclimatization = Math.min(16, state.acclimatizationDays * 1.5 + state.nightsSlept * .45);
  const loadRatio = integratedTeamLoadRatio(state);
  const loadPenalty = Math.max(0, loadRatio - .88) * 23;
  const conditionPenalty = Math.max(0, 52 - leader.condition) * .32;
  const wakePenalty = Math.max(0, state.minutesSinceSleep - 840) / 70;
  const coordination = (integratedTeamTrust(state) + integratedTeamMorale(state)) / 2;
  const coordinationPenalty = Math.max(-6, Math.min(10, (55 - coordination) * .18));
  const leadershipReduction = integratedSpecialist(state, 'LEADERSHIP').skills.LEADERSHIP * .62;
  const skillReduction = skill * 1.85 + leader.skills.ENDURANCE * .52 + acclimatization + leadershipReduction;
  const terrainGear = cell.terrain === 'GLACIER' ? state.gear.iceHardwareCondition : cell.terrain === 'ROCK' || cell.terrain === 'RIDGE' ? state.gear.rockHardwareCondition : 100;
  const gearPenalty = Math.max(0, 58 - terrainGear) * .24 + (fixedRope ? Math.max(0, 52 - state.gear.ropeCondition) * .18 : 0);
  const score = Math.max(0, Math.min(98, Math.round((baseRisk.score * tuning.risk + loadPenalty + conditionPenalty + coordinationPenalty + gearPenalty + wakePenalty - skillReduction) * pace.risk)));
  const band: LocalStepRiskBand = score >= 78 ? 'EXTREME' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  const cost = localMoveCost(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, unprotectedTechnical: cell.ropeRequired && !fixedRope });
  const minutes = Math.max(5, Math.round(cost.minutes * pace.minutes * (1 + Math.max(0, loadRatio - 1) * .28)));
  const participantEnergyCosts = Object.fromEntries(
    mobileIntegratedParticipants(state).map(participant => [participant.id, participantEnergyForStep(state, participant, minutes, cell.terrain, cell.elevation, fixedRope)]),
  );
  const values = Object.values(participantEnergyCosts);
  const energy = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
  const technicalExposure = cell.ropeRequired || cell.slope >= 42 || cell.hazard === 'CREVASSE' || cell.hazard === 'CORNICE';
  const baseIncident = score < 20 ? .002 : score < 40 ? .007 : score < 58 ? .022 : score < 75 ? .06 : .13;
  const incidentChance = Math.min(.28, baseIncident * tuning.incident * pace.incident * (technicalExposure ? 1.22 : .82) * (fixedRope ? .42 : 1));
  return {
    ...baseRisk,
    score,
    band,
    energy,
    participantEnergyCosts,
    minutes,
    skillId,
    skill,
    specialistId: specialist.id,
    specialistName: specialist.name,
    incidentChance,
    conditionMultiplier: tuning.condition,
    technicalExposure,
  };
}
