import { evaluateLocalStepRisk, localCellAt, localMoveCost, type GridPoint, type GridWeather, type LocalStageMap, type LocalStepRiskBand } from '../../topography/mountainGridEngine';
import type { IntegratedDifficulty, IntegratedExpeditionState, IntegratedSkillId } from './state';
import { integratedLeader } from './selectors';

const DIFFICULTY = {
  EXPLORER: { risk: 0.68, energy: 0.84, incident: 0.62, condition: 0.72 },
  CLIMBER: { risk: 1, energy: 1, incident: 1, condition: 1 },
  EXPEDITION: { risk: 1.28, energy: 1.14, incident: 1.38, condition: 1.3 },
} satisfies Record<IntegratedDifficulty, { risk: number; energy: number; incident: number; condition: number }>;

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
  const skill = leader.skills[skillId];
  const tuning = DIFFICULTY[state.difficulty];
  const baseRisk = evaluateLocalStepRisk(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, attempt });
  const acclimatization = Math.min(12, state.acclimatizationDays * 1.5);
  const loadPenalty = Math.max(0, state.packWeightKg - 14) * 1.8;
  const conditionPenalty = Math.max(0, 55 - leader.condition) * 0.42;
  const skillReduction = skill * 2.1 + leader.skills.ENDURANCE * 0.75 + acclimatization;
  const score = Math.max(0, Math.min(98, Math.round(baseRisk.score * tuning.risk + loadPenalty + conditionPenalty - skillReduction)));
  const band: LocalStepRiskBand = score >= 78 ? 'EXTREME' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  const cost = localMoveCost(map, from, to, weather, { fixedRope, leaderEnergy: leader.energy, unprotectedTechnical: cell.ropeRequired && !fixedRope });
  const energy = Math.max(1, Math.round(cost.energy * tuning.energy * (1 + Math.max(0, state.packWeightKg - 16) / 35)));
  return {
    ...baseRisk,
    score,
    band,
    energy,
    minutes: cost.minutes,
    skillId,
    skill,
    incidentChance: Math.min(0.82, score / 210 * tuning.incident),
    conditionMultiplier: tuning.condition,
  };
}
