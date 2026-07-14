import {
  acceptExpeditionOffer,
  availableExpeditionOffers,
  beginDescent,
  chooseRouteDecision,
  createCareer,
  establishCamp,
  getCurrentRouteDecision,
  meltSnow,
  resolveClimbStep,
  resolveParticipantAction,
  startPlannedClimb,
} from './career';
import { getEntryOrganizations } from './ecosystem';
import { getCurrentParticipantScene } from './expeditionEngine';
import { generateWorld } from './generator';
import type { CareerState, DifficultyId, OriginId, ParticipantSceneOption } from './types';

export interface BalanceSample {
  sampleSize: number;
  difficulty: DifficultyId;
  successRate: number;
  retreatRate: number;
  failureRate: number;
  averageMoves: number;
  averageFinalEnergy: number;
  averageFinalTeamCondition: number;
  injuryRate: number;
  outcomes: Array<{ seed: string; origin: OriginId; phase: string; moves: number; energy: number; teamCondition: number; injuries: number }>;
}

const origins: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];

function safestParticipantOption(options: ParticipantSceneOption[]) {
  const order = ['CARE', 'OBEY', 'QUESTION', 'INITIATIVE', 'REFUSE'] as const;
  return [...options].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))[0]!;
}

function runCareer(seed: string, origin: OriginId, difficulty: DifficultyId) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty });
  const organization = getEntryOrganizations(world)[0]!;
  let career: CareerState = createCareer(world, { name: 'Balance Runner', age: 20, originId: origin, entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offer = availableExpeditionOffers(world, career)[0]!;
  career = startPlannedClimb(acceptExpeditionOffer(world, career, offer.id));
  for (let guard = 0; guard < 180; guard += 1) {
    const climb = career.activeClimb;
    if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) break;
    if (climb.participant) {
      const scene = getCurrentParticipantScene(career);
      if (!scene) break;
      career = resolveParticipantAction(career, safestParticipantOption(scene.options).id).career;
      continue;
    }
    if (climb.phase === 'SUMMIT') {
      career = beginDescent(career);
      continue;
    }
    const decision = getCurrentRouteDecision(career);
    if (decision) {
      const choice = decision.options.find(item => item.tone === 'SAFE' && (!item.requiresRopeMeters || climb.ropeMetersRemaining >= item.requiresRopeMeters)) ?? decision.options[0]!;
      career = chooseRouteDecision(career, choice.id).career;
      continue;
    }
    const segment = climb.route[climb.segmentIndex]!;
    if (segment.campPossible && climb.hoursAwake > 7 && climb.supplies.foodUnits > 0 && climb.supplies.fuelUnits > 0) {
      career = establishCamp(career).career;
      continue;
    }
    if (climb.supplies.waterUnits < 4 && climb.supplies.fuelUnits > 0) {
      career = meltSnow(career).career;
      continue;
    }
    career = resolveClimbStep(career, 'CAUTIOUS').career;
  }
  const climb = career.activeClimb!;
  return {
    seed,
    origin,
    phase: climb?.phase ?? 'MISSING',
    moves: climb?.moveCount ?? 0,
    energy: Math.round(climb?.energy ?? 0),
    teamCondition: Math.round(climb?.teamCondition ?? 0),
    injuries: climb?.injuries.length ?? 0,
  };
}

export function runBalanceSample(seedPrefix: string, count = 12, difficulty: DifficultyId = 'CLIMBER'): BalanceSample {
  const outcomes = Array.from({ length: count }, (_, index) => `${seedPrefix}-${index + 1}`)
    .flatMap(seed => origins.map(origin => runCareer(seed, origin, difficulty)));
  const sampleSize = outcomes.length;
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
  const rate = (phase: string) => Number((outcomes.filter(item => item.phase === phase).length / sampleSize).toFixed(3));
  return {
    sampleSize,
    difficulty,
    successRate: rate('COMPLETE'),
    retreatRate: rate('RETREATED'),
    failureRate: rate('FAILED'),
    averageMoves: average(outcomes.map(item => item.moves)),
    averageFinalEnergy: average(outcomes.map(item => item.energy)),
    averageFinalTeamCondition: average(outcomes.map(item => item.teamCondition)),
    injuryRate: Number((outcomes.filter(item => item.injuries > 0).length / sampleSize).toFixed(3)),
    outcomes,
  };
}
