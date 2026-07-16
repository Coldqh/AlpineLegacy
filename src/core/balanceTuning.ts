import type { DifficultyId } from './types';
import type { IntegratedDifficulty, IntegratedPace } from './expedition/state';

export interface IntegratedDifficultyProfile {
  risk: number;
  energy: number;
  incident: number;
  condition: number;
  injury: number;
  incidentCooldown: number;
}

export const INTEGRATED_DIFFICULTY: Record<IntegratedDifficulty, IntegratedDifficultyProfile> = {
  EXPLORER: { risk: .68, energy: .86, incident: .56, condition: .7, injury: .68, incidentCooldown: 7 },
  CLIMBER: { risk: 1, energy: 1, incident: 1, condition: 1, injury: 1, incidentCooldown: 5 },
  EXPEDITION: { risk: 1.34, energy: 1.13, incident: 1.48, condition: 1.3, injury: 1.28, incidentCooldown: 3 },
};

export const INTEGRATED_PACE: Record<IntegratedPace, { risk: number; energy: number; minutes: number; incident: number }> = {
  CAUTIOUS: { risk: .79, energy: .72, minutes: 1.22, incident: .76 },
  STEADY: { risk: 1, energy: 1, minutes: 1, incident: 1 },
  FAST: { risk: 1.28, energy: 1.13, minutes: .78, incident: 1.36 },
};

export interface LegacyDifficultyProfile {
  chanceBonus: number;
  energyMultiplier: number;
  failureConsequence: number;
  learningPerFailure: number;
  learningCap: number;
  criticalFailureLimit: number;
}

export const LEGACY_DIFFICULTY: Record<DifficultyId, LegacyDifficultyProfile> = {
  EXPLORER: { chanceBonus: -17, energyMultiplier: .9, failureConsequence: .8, learningPerFailure: 9, learningCap: 20, criticalFailureLimit: 1 },
  CLIMBER: { chanceBonus: -28, energyMultiplier: 1.04, failureConsequence: 1.12, learningPerFailure: 4, learningCap: 8, criticalFailureLimit: 1 },
  EXPEDITION: { chanceBonus: -34, energyMultiplier: 1.22, failureConsequence: 1.52, learningPerFailure: 2, learningCap: 4, criticalFailureLimit: 1 },
};
