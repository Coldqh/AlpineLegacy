import {
  acceptExpeditionOffer,
  applyEquipmentPreset,
  availableExpeditionOffers,
  beginDescent,
  createCareer,
  expeditionWeight,
  getSelectedRoute,
  currentExpeditionStage,
  previewExpeditionActions,
  resolveExpeditionFieldAction,
  resolveParticipantAction,
  startPlannedClimb,
} from './career';
import { isStagePrepared, missingStagePreparation } from './simulationEngine';
import { integratedStepPreview, integratedWeatherAt } from './expedition';
import { analyzeRouteEquipment, equipmentReadinessScore } from './gearPlanning';
import { getEntryOrganizations } from './ecosystem';
import { getCurrentParticipantScene } from './expeditionEngine';
import { generateWorld } from './generator';
import type { CareerState, DifficultyId, OriginId, ParticipantSceneOption } from './types';
import { buildMountainRouteOptions, buildMountainStages, findLocalGuidedRoute, generateLocalStageMap, generateMountainGrid, localCellAt } from '../topography/mountainGridEngine';

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

function chooseAutoplayAction(career: CareerState) {
  const climb = career.activeClimb!;
  const simulation = climb.simulation!;
  const stage = currentExpeditionStage(career)!;
  const actions = previewExpeditionActions(career);
  const usable = (id: string) => actions.find(action => action.id === id && !action.disabled);

  if (simulation.status === 'STRANDED') {
    return usable('MAKE_CAMP')
      ?? usable('EAT_DRINK')
      ?? (climb.energy < 45 ? usable('REST_SHORT') : undefined)
      ?? usable('REQUEST_AID')
      ?? usable('REST_SHORT')
      ?? usable('DROP_LOAD');
  }

  const ascentRatio = simulation.maxRelativeElevation > 0 ? simulation.relativeElevation / simulation.maxRelativeElevation : 0;
  if (simulation.direction === 'ASCENT' && (
    climb.condition < 36
    || (climb.supplies.waterUnits <= 0 && climb.supplies.fuelUnits <= 0)
    || (climb.supplies.foodUnits <= 0 && ascentRatio < .72)
  )) {
    const retreat = usable('TURN_BACK');
    if (retreat) return retreat;
  }

  if (climb.energy < 24) {
    const recovery = usable('EAT_DRINK')
      ?? (climb.energy < 52 ? usable('REST_SHORT') : undefined)
      ?? usable('DROP_LOAD')
      ?? usable('REQUEST_AID')
      ?? usable('TURN_BACK');
    if (recovery) return recovery;
  }

  if (climb.hoursAwake > 16) {
    const camp = usable('MAKE_CAMP');
    if (camp) return camp;
    if (climb.energy < 48) return usable('REST_SHORT') ?? usable('EAT_DRINK');
  }

  if (climb.supplies.waterUnits <= 3) {
    const water = usable('MELT_SNOW');
    if (water) return water;
    if (climb.supplies.waterUnits > 0 && climb.energy < 72) {
      const ration = usable('EAT_DRINK');
      if (ration) return ration;
    }
  }

  const cautious = usable('MOVE_CAUTIOUS');
  if (cautious?.successChance !== null && cautious && cautious.successChance < 58 && stage.preparation < 38) {
    const prep = stage.terrain.toLowerCase().includes('снег') || stage.terrain.toLowerCase().includes('лед')
      ? usable('CHECK_SURFACE')
      : usable('SCOUT_LINE');
    if (prep) return prep;
  }

  if (climb.teamCondition < 45) {
    const help = usable('HELP_TEAM');
    if (help) return help;
  }

  const missingPreparation = missingStagePreparation(stage);
  if (missingPreparation.length) {
    const actionForTag = {
      ROUTE_SCOUTED: 'SCOUT_LINE',
      SURFACE_CHECKED: 'CHECK_SURFACE',
      ANCHOR_PLACED: 'PLACE_ANCHOR',
      ROPE_FIXED: 'FIX_ROPE',
      TEAM_STABILIZED: 'HELP_TEAM',
    } as const;
    for (const tag of missingPreparation) {
      const candidate = usable(actionForTag[tag]);
      if (candidate) return candidate;
    }
  }

  if (stage.critical) {
    if (stage.exposure >= 78 && !stage.ropeFixed && climb.ropeMetersRemaining >= 40) {
      const fixed = usable('FIX_ROPE');
      if (fixed) return fixed;
    }
    if (stage.preparation < 24 && !isStagePrepared(stage)) {
      const prep = stage.terrain.toLowerCase().includes('снег') || stage.terrain.toLowerCase().includes('лед')
        ? usable('CHECK_SURFACE')
        : usable('SCOUT_LINE');
      if (prep) return prep;
    }
  }

  if (simulation.leaderOrder && !simulation.leaderOrder.resolved) {
    const ordered = usable(simulation.leaderOrder.preferredAction);
    if (ordered) return ordered;
  }

  return actions.find(action => action.id.startsWith('MOVE_') && !action.disabled)
    ?? usable('REST_SHORT')
    ?? actions.find(action => !action.disabled);
}

export function autoplayExpedition(career: CareerState, maxActions = 1400): CareerState {
  let current = career;
  for (let guard = 0; guard < maxActions; guard += 1) {
    const climb = current.activeClimb;
    if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) break;
    if (climb.phase === 'SUMMIT') {
      current = beginDescent(current);
      continue;
    }
    const scene = getCurrentParticipantScene(current);
    if (scene) {
      current = resolveParticipantAction(current, safestParticipantOption(scene.options).id).career;
      continue;
    }
    const chosen = chooseAutoplayAction(current);
    if (!chosen) break;
    current = resolveExpeditionFieldAction(current, chosen.id).career;
  }
  return current;
}

function runCareer(seed: string, origin: OriginId, difficulty: DifficultyId) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty });
  const organization = getEntryOrganizations(world)[0]!;
  let career: CareerState = createCareer(world, { name: 'Balance Runner', age: 20, originId: origin, entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offer = availableExpeditionOffers(world, career)[0]!;
  career = autoplayExpedition(startPlannedClimb(acceptExpeditionOffer(world, career, offer.id)));
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
  const successRate = rate('COMPLETE');
  const retreatRate = rate('RETREATED');
  const failureRate = 1 - successRate - retreatRate;
  return {
    sampleSize,
    difficulty,
    successRate,
    retreatRate,
    failureRate,
    averageMoves: average(outcomes.map(item => item.moves)),
    averageFinalEnergy: average(outcomes.map(item => item.energy)),
    averageFinalTeamCondition: average(outcomes.map(item => item.teamCondition)),
    injuryRate: Number((outcomes.filter(item => item.injuries > 0).length / sampleSize).toFixed(3)),
    outcomes,
  };
}


export interface EquipmentSensitivityAudit {
  ropeRiskReduction: number;
  ropeEnergyReduction: number;
  recommendedReadiness: number;
  noRopeReadiness: number;
  noShelterReadiness: number;
  noMedkitReadiness: number;
  expectedNights: number;
  recommendedRopeMeters: number;
  medkitSeverityReduction: number;
}

export interface BalanceAudit {
  seedPrefix: string;
  seedsPerDifficulty: number;
  totalRuns: number;
  difficultySummary: BalanceSample[];
  equipment: EquipmentSensitivityAudit;
  warnings: string[];
}

function readinessWithout(career: CareerState, gearIds: string[]) {
  const route = getSelectedRoute(career);
  const gear = { ...career.expeditionPlan.gear };
  for (const id of gearIds) gear[id] = 0;
  const plan = { ...career.expeditionPlan, gear, ropeMeters: (gear.rope ?? 0) * 50 };
  const analysis = analyzeRouteEquipment(route, plan, Math.max(1, plan.teamMemberIds.length + 1));
  const changed = { ...career, expeditionPlan: plan };
  return equipmentReadinessScore(analysis, expeditionWeight(changed));
}

export function runEquipmentSensitivityAudit(seed = 'BALANCE-GEAR'): EquipmentSensitivityAudit {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Gear Runner', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offer = availableExpeditionOffers(world, career)[0]!;
  career = acceptExpeditionOffer(world, career, offer.id);
  career = applyEquipmentPreset(career, 'RECOMMENDED');
  const route = getSelectedRoute(career);
  const analysis = analyzeRouteEquipment(route, career.expeditionPlan, Math.max(1, career.expeditionPlan.teamMemberIds.length + 1));
  const recommendedReadiness = equipmentReadinessScore(analysis, expeditionWeight(career));
  const started = startPlannedClimb(career);
  const topo = started.activeClimb?.topo;
  let ropeRiskReduction = 0;
  let ropeEnergyReduction = 0;

  if (topo) {
    const grid = generateMountainGrid(`${topo.seed}:v${topo.variant}`, topo.startElevation, topo.summitElevation, undefined, {
      formId: route.mountainFormId,
      characterId: route.mountainCharacterId,
    });
    const options = buildMountainRouteOptions(grid, topo.entrySide);
    const selected = options.find(item => item.id === topo.routeChoice) ?? options[0]!;
    const stages = buildMountainStages(grid, topo.entrySide, selected.route, selected.profile);
    const weather = integratedWeatherAt(topo);
    for (const stage of stages) {
      const map = generateLocalStageMap(stage, grid.seed);
      const path = findLocalGuidedRoute(map, selected.localProfile);
      for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1]!;
        const to = path[index]!;
        const cell = localCellAt(map, to);
        if (!cell || !(cell.ropeRequired || cell.ropeRecommended || cell.slope >= 40 || cell.hazard !== 'NONE')) continue;
        const unprotected = integratedStepPreview(topo, map, from, to, weather, false);
        const protectedStep = integratedStepPreview(topo, map, from, to, weather, true);
        ropeRiskReduction = Math.max(ropeRiskReduction, unprotected.score - protectedStep.score);
        ropeEnergyReduction = Math.max(ropeEnergyReduction, Number((unprotected.energy - protectedStep.energy).toFixed(1)));
      }
    }
  }

  const medicSkill = topo?.participants.reduce((best, member) => Math.max(best, member.skills.MEDICINE), 0) ?? 0;
  const mitigationWithMedkit = Math.min(.38, medicSkill * .034 + .1);
  const mitigationWithoutMedkit = Math.min(.38, medicSkill * .034);
  const medkitSeverityReduction = Math.round((mitigationWithMedkit - mitigationWithoutMedkit) * 200);

  return {
    ropeRiskReduction: Math.round(ropeRiskReduction),
    ropeEnergyReduction,
    recommendedReadiness,
    noRopeReadiness: readinessWithout(career, ['rope']),
    noShelterReadiness: readinessWithout(career, ['tent', 'bivy']),
    noMedkitReadiness: readinessWithout(career, ['medkit']),
    expectedNights: analysis.expectedNights,
    recommendedRopeMeters: analysis.recommendedRopeMeters,
    medkitSeverityReduction,
  };
}

export function runBalanceAudit(seedPrefix = 'BALANCE-LAB', seedsPerDifficulty = 20): BalanceAudit {
  const difficulties: DifficultyId[] = ['EXPLORER', 'CLIMBER', 'EXPEDITION'];
  const difficultySummary = difficulties.map(difficulty => runBalanceSample(`${seedPrefix}-${difficulty}`, seedsPerDifficulty, difficulty));
  const equipment = runEquipmentSensitivityAudit(`${seedPrefix}-GEAR`);
  const targets: Record<DifficultyId, [number, number]> = {
    EXPLORER: [.62, .82],
    CLIMBER: [.38, .62],
    EXPEDITION: [.15, .4],
  };
  const warnings: string[] = [];
  for (const sample of difficultySummary) {
    const [minimum, maximum] = targets[sample.difficulty];
    if (sample.successRate < minimum || sample.successRate > maximum) warnings.push(`${sample.difficulty}: успех ${(sample.successRate * 100).toFixed(1)}% вне цели ${minimum * 100}–${maximum * 100}%`);
  }
  if (!(difficultySummary[0]!.successRate > difficultySummary[1]!.successRate && difficultySummary[1]!.successRate > difficultySummary[2]!.successRate)) warnings.push('Сложности недостаточно разделены по успешности.');
  if (equipment.ropeRiskReduction < 18) warnings.push('Верёвка слишком слабо снижает риск технического участка.');
  if (equipment.noRopeReadiness > equipment.recommendedReadiness - 20) warnings.push('Отсутствие верёвки недостаточно влияет на готовность.');
  if (equipment.noShelterReadiness > equipment.recommendedReadiness - 20) warnings.push('Отсутствие укрытия недостаточно влияет на готовность.');
  if (equipment.noMedkitReadiness >= equipment.recommendedReadiness) warnings.push('Аптечка не влияет на готовность экспедиции.');
  return {
    seedPrefix,
    seedsPerDifficulty,
    totalRuns: difficultySummary.reduce((sum, item) => sum + item.sampleSize, 0),
    difficultySummary,
    equipment,
    warnings,
  };
}
