import { evaluateLocalStepRisk, localCellAt, localMoveCost, type GridPoint, type GridWeather, type LocalStageMap, type LocalStepRiskBand } from '../../topography/mountainGridEngine';
import type { IntegratedDifficulty, IntegratedExpeditionState, IntegratedPace, IntegratedSkillId } from './state';
import { integratedLeader, integratedSpecialist, integratedTeamLoadRatio, integratedTeamMorale, integratedTeamTrust } from './selectors';

const DIFFICULTY = {
  EXPLORER: { risk: 0.68, energy: 0.84, incident: 0.62, condition: 0.72 },
  CLIMBER: { risk: 1, energy: 1, incident: 1, condition: 1 },
  EXPEDITION: { risk: 1.28, energy: 1.14, incident: 1.38, condition: 1.3 },
} satisfies Record<IntegratedDifficulty, { risk: number; energy: number; incident: number; condition: number }>;

const PACE = {
  CAUTIOUS: { risk: .78, energy: .88, minutes: 1.24, incident: .78 },
  STEADY: { risk: 1, energy: 1, minutes: 1, incident: 1 },
  FAST: { risk: 1.26, energy: 1.18, minutes: .78, incident: 1.3 },
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

export function integratedDifficultyTuning(difficulty: IntegratedDifficulty) {
  return DIFFICULTY[difficulty];
}

export function integratedPaceTuning(pace: IntegratedPace) {
  return PACE[pace];
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
  const skill = Math.round((leaderSkill * .64 + specialistSkill * .36) * 10) / 10;
  const tuning = DIFFICULTY[state.difficulty];
  const pace = PACE[state.pace];
  const baseRisk = evaluateLocalStepRisk(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, attempt });
  const acclimatization = Math.min(12, state.acclimatizationDays * 1.5);
  const loadRatio = integratedTeamLoadRatio(state);
  const loadPenalty = Math.max(0, loadRatio - .82) * 28 + Math.max(0, leader.loadKg - leader.carryCapacityKg) * 2.2;
  const conditionPenalty = Math.max(0, 55 - leader.condition) * 0.42;
  const coordination = (integratedTeamTrust(state) + integratedTeamMorale(state)) / 2;
  const coordinationPenalty = Math.max(-7, Math.min(12, (58 - coordination) * .22));
  const leadershipReduction = leader.skills.LEADERSHIP * .72;
  const skillReduction = skill * 2.1 + leader.skills.ENDURANCE * 0.75 + acclimatization + leadershipReduction;
  const terrainGear = cell.terrain === 'GLACIER'
    ? state.gear.hardwareCondition
    : cell.terrain === 'ROCK' || cell.terrain === 'RIDGE'
      ? state.gear.hardwareCondition
      : 100;
  const gearPenalty = Math.max(0, 62 - terrainGear) * .28 + (fixedRope ? Math.max(0, 55 - state.gear.ropeCondition) * .22 : 0);
  const score = Math.max(0, Math.min(98, Math.round((baseRisk.score * tuning.risk + loadPenalty + conditionPenalty + coordinationPenalty + gearPenalty - skillReduction) * pace.risk)));
  const band: LocalStepRiskBand = score >= 78 ? 'EXTREME' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  const cost = localMoveCost(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, unprotectedTechnical: cell.ropeRequired && !fixedRope });
  const energy = Math.max(1, Math.round(cost.energy * tuning.energy * pace.energy * (1 + Math.max(0, loadRatio - .72) * .7)));
  const minutes = Math.max(4, Math.round(cost.minutes * pace.minutes * (1 + Math.max(0, loadRatio - 1) * .32)));
  return {
    ...baseRisk,
    score,
    band,
    energy,
    minutes,
    skillId,
    skill,
    specialistId: specialist.id,
    specialistName: specialist.name,
    incidentChance: Math.min(0.88, score / 210 * tuning.incident * pace.incident),
    conditionMultiplier: tuning.condition,
  };
}
