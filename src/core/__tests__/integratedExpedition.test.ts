import { beforeEach, describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  applyEquipmentPreset,
  availableExpeditionOffers,
  createCareer,
  closeClimb,
  persistIntegratedExpedition,
  startPlannedClimb,
} from '../career';
import {
  distributeIntegratedLoads,
  integratedExpeditionDebrief,
  integratedStepPreview,
  normalizeIntegratedExpeditionState,
  integratedWeatherAt,
  reduceIntegratedExpedition,
  type IntegratedExpeditionContext,
  type IntegratedExpeditionState,
} from '../expedition';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { loadCareer, saveCareer } from '../storage';
import {
  buildMountainRouteOptions,
  buildMountainStages,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  type GridPoint,
} from '../../topography/mountainGridEngine';
import type { CareerState, DifficultyId } from '../types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function startCareer(difficulty: DifficultyId = 'CLIMBER', seed = `INTEGRATED-${difficulty}`) {
  const world = generateWorld({ seed, eraId: 'EXPEDITION', startYear: 1968, difficulty });
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, {
    name: 'Integrated Tester',
    age: 20,
    originId: 'CLUB_SCHOOL',
    entryMode: 'ORGANIZATION',
    organizationId: organization.id,
  });
  career = acceptExpeditionOffer(world, career, availableExpeditionOffers(world, career)[0]!.id);
  career = applyEquipmentPreset(career, 'RECOMMENDED');
  career = startPlannedClimb(career);
  expect(career.activeClimb?.topo).toBeTruthy();
  return { world, career };
}

function firstStage(topo: IntegratedExpeditionState) {
  const grid = generateMountainGrid(`${topo.seed}:v${topo.variant}`, topo.startElevation, topo.summitElevation);
  const options = buildMountainRouteOptions(grid, topo.entrySide);
  const route = options.find(option => option.id === topo.routeChoice) ?? options[0]!;
  const stages = buildMountainStages(grid, topo.entrySide, route.route, route.profile);
  const stage = stages[Math.min(topo.stageIndex, stages.length - 1)]!;
  const localMap = generateLocalStageMap(stage, grid.seed);
  const path = findLocalGuidedRoute(localMap, route.localProfile);
  const context: IntegratedExpeditionContext = {
    stageId: stage.id,
    stageTitle: stage.title,
    stageCount: stages.length,
    localMap,
    weather: integratedWeatherAt(topo),
  };
  return { context, path };
}

function initializedTopo(career: CareerState) {
  const topo = career.activeClimb!.topo!;
  const { context, path } = firstStage(topo);
  const withPath = reduceIntegratedExpedition(topo, {
    type: 'ENSURE_STAGE_PATH',
    stageId: context.stageId,
    path,
    currentElevation: context.localMap.minElevation,
  }, context);
  return { topo: withPath, context, path };
}

describe('integrated expedition career loop', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  });

  it('builds the tactical expedition from the actual career team and loadout', () => {
    const { career } = startCareer();
    const climb = career.activeClimb!;
    const topo = climb.topo!;
    const expectedNames = [career.hero.name, ...career.teamRoster
      .filter(member => climb.teamMemberIds.includes(member.id))
      .map(member => member.name)];

    expect(topo.participants.map(participant => participant.name).sort()).toEqual(expectedNames.sort());
    expect(topo.ropeMeters).toBe(climb.ropeMetersRemaining);
    expect(topo.packWeightKg).toBe(climb.packWeightKg);
    expect(topo.supplies).toEqual(climb.supplies);
    expect(topo.hasMedkit).toBe(true);
    expect(topo.hasStove).toBe(true);
  });

  it('writes tactical actions back into the career climb and restores them after reload', () => {
    const { world, career } = startCareer('CLIMBER', 'INTEGRATED-SAVE');
    const { topo, context } = initializedTopo(career);
    const started = reduceIntegratedExpedition(topo, { type: 'START' }, context);
    const scouted = reduceIntegratedExpedition(started, {
      type: 'SCOUT',
      point: context.localMap.start,
      radius: 1,
      minutes: 25,
    }, context);
    const persisted = persistIntegratedExpedition(career, scouted);

    saveCareer(persisted);
    const restored = loadCareer(world)!;

    expect(restored.activeClimb?.topo?.started).toBe(true);
    expect(restored.activeClimb?.topo?.actionSerial).toBe(1);
    expect(restored.activeClimb?.topo?.elapsedMinutes).toBe(scouted.elapsedMinutes);
    expect(restored.activeClimb?.elapsedMinutes).toBe(scouted.elapsedMinutes);
    expect(scouted.elapsedMinutes).toBeLessThan(25);
    expect(restored.activeClimb?.topo?.infrastructure[context.stageId]?.revealed.length).toBeGreaterThan(1);
  });

  it('loads known route cells from mountain memory without granting free rope', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-MEMORY');
    const { topo, context, path } = initializedTopo(career);
    const revealed = path.slice(0, 4).map(point => `${point.x}:${point.y}`);
    const remembered = reduceIntegratedExpedition(topo, {
      type: 'APPLY_MOUNTAIN_MEMORY',
      stageId: context.stageId,
      revealed,
      camps: [],
    }, context);

    expect(remembered.infrastructure[context.stageId]?.revealed).toEqual(expect.arrayContaining(revealed));
    expect(remembered.ropeMeters).toBe(topo.ropeMeters);
    expect(remembered.infrastructure[context.stageId]?.ropes).toEqual([]);
  });

  it('treats a voluntary retreat as a normal outcome instead of forcing rescue', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-RETREAT');
    const { topo, context } = initializedTopo(career);
    const started = reduceIntegratedExpedition(topo, { type: 'START' }, context);
    const retreated = reduceIntegratedExpedition(started, { type: 'BEGIN_RETREAT' }, context);

    expect(retreated.phase).toBe('RETREATED');
    expect(retreated.retreating).toBe(true);
    expect(retreated.forcedRetreat).toBe(false);
  });

  it('closes a forced rescue with an incident and rescued participant ids', () => {
    const { career } = startCareer('EXPEDITION', 'INTEGRATED-RESCUE');
    const { topo, context } = initializedTopo(career);
    const victim = topo.participants.find(participant => participant.memberId)!;
    const stranded: IntegratedExpeditionState = {
      ...topo,
      started: true,
      forcedRetreat: true,
      phase: 'DESCENT',
      participants: topo.participants.map(participant => participant.id === victim.id
        ? { ...participant, status: 'INCAPACITATED', energy: 0, condition: 12 }
        : participant),
    };
    const rescued = reduceIntegratedExpedition(stranded, { type: 'REQUEST_RESCUE' }, context);

    expect(rescued.phase).toBe('RETREATED');
    expect(rescued.incidents.at(-1)?.type).toBe('RESCUE');
    expect(rescued.rescuedMemberIds).toContain(victim.memberId);
    expect(rescued.elapsedMinutes).toBe(rescued.rescueDurationMinutes);
    expect(rescued.elapsedMinutes).toBeGreaterThan(360);
    expect(rescued.rescueCost).toBeGreaterThan(0);
  });

  it('applies team casualties and hero injuries to the correct career records', () => {
    const { career } = startCareer('EXPEDITION', 'INTEGRATED-CONSEQUENCES');
    const topo = career.activeClimb!.topo!;
    const victim = topo.participants.find(participant => participant.memberId)!;
    const hero = topo.participants.find(participant => participant.memberId === null)!;
    const terminal: IntegratedExpeditionState = {
      ...topo,
      started: true,
      phase: 'RETREATED',
      retreating: true,
      currentElevation: topo.startElevation,
      highestElevation: topo.startElevation + 640,
      injuries: [`${victim.name}: серьёзная травма после срыва`, `${hero.name}: обморожение`],
      casualties: [victim.memberId!],
      participants: topo.participants.map(participant => {
        if (participant.id === victim.id) return { ...participant, status: 'DEAD', condition: 0, injury: `${victim.name}: серьёзная травма после срыва` };
        if (participant.id === hero.id) return { ...participant, status: 'INJURED', condition: 71, fatigue: 46, injury: `${hero.name}: обморожение` };
        return participant;
      }),
    };

    const persisted = persistIntegratedExpedition(career, terminal);
    const closed = closeClimb(persisted);
    const victimAfter = closed.teamRoster.find(member => member.id === victim.memberId)!;

    expect(victimAfter.status).toBe('DEAD');
    expect(closed.hero.health).toBe(71);
    expect(closed.hero.injuries).toContain(`${hero.name}: обморожение`);
    expect(closed.hero.injuries).not.toContain(`${victim.name}: серьёзная травма после срыва`);
    expect(closed.reports.at(-1)?.highestElevation).toBe(terminal.highestElevation);
    expect(closed.reports.at(-1)?.casualties).toContain(victim.name);
  });

  it('makes the same technical step harsher on expedition difficulty', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-BALANCE');
    const { topo, context, path } = initializedTopo(career);
    const from = path[0] as GridPoint;
    const to = path[1] as GridPoint;
    const explorer = integratedStepPreview({ ...topo, difficulty: 'EXPLORER' }, context.localMap, from, to, context.weather, false);
    const expedition = integratedStepPreview({ ...topo, difficulty: 'EXPEDITION' }, context.localMap, from, to, context.weather, false);

    expect(expedition.score).toBeGreaterThanOrEqual(explorer.score);
    expect(expedition.energy).toBeGreaterThanOrEqual(explorer.energy);
    expect(expedition.incidentChance).toBeGreaterThanOrEqual(explorer.incidentChance);
    expect(expedition.conditionMultiplier).toBeGreaterThan(explorer.conditionMultiplier);
  });

  it('uses one expedition pace instead of separate movement actions', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-PACE');
    const { topo, context, path } = initializedTopo(career);
    const from = path[0] as GridPoint;
    const to = path[1] as GridPoint;
    const cautious = integratedStepPreview({ ...topo, pace: 'CAUTIOUS' }, context.localMap, from, to, context.weather, false);
    const fast = integratedStepPreview({ ...topo, pace: 'FAST' }, context.localMap, from, to, context.weather, false);

    expect(cautious.score).toBeLessThanOrEqual(fast.score);
    expect(cautious.minutes).toBeGreaterThan(fast.minutes);
    expect(cautious.energy).toBeLessThanOrEqual(fast.energy);
  });

  it('lets specialists automate scouting and treatment', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-SPECIALISTS');
    const { topo, context } = initializedTopo(career);
    const started = reduceIntegratedExpedition(topo, { type: 'START' }, context);
    const scouted = reduceIntegratedExpedition(started, { type: 'SCOUT', point: context.localMap.start, radius: 1, minutes: 25 }, context);
    const patient = scouted.participants.find(participant => participant.memberId)!;
    const injured: IntegratedExpeditionState = {
      ...scouted,
      participants: scouted.participants.map(participant => participant.id === patient.id
        ? { ...participant, injury: `${participant.name}: растяжение`, status: 'INJURED', condition: 52 }
        : participant),
    };
    const rested = reduceIntegratedExpedition(injured, { type: 'REST', mode: 'BIVOUAC' }, context);
    const treated = rested.participants.find(participant => participant.id === patient.id)!;

    expect(scouted.message).toContain('проверил');
    expect(scouted.elapsedMinutes).toBeLessThan(25);
    expect(rested.gear.medkitCharges).toBe(injured.gear.medkitCharges - 1);
    expect(treated.condition).toBeGreaterThan(52);
    expect(rested.message).toContain('обработал травму');
  });

  it('redistributes load automatically when a carrier is incapacitated', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-LOAD');
    const topo = career.activeClimb!.topo!;
    const victim = topo.participants.find(participant => participant.memberId)!;
    const before = topo.participants.filter(participant => participant.id !== victim.id).reduce((sum, participant) => sum + participant.loadKg, 0);
    const redistributed = distributeIntegratedLoads(
      topo.participants.map(participant => participant.id === victim.id ? { ...participant, status: 'INCAPACITATED' as const } : participant),
      topo.packWeightKg,
    );
    const after = redistributed.filter(participant => participant.id !== victim.id).reduce((sum, participant) => sum + participant.loadKg, 0);

    expect(redistributed.find(participant => participant.id === victim.id)?.loadKg).toBe(0);
    expect(after).toBeGreaterThan(before);
  });

  it('migrates an active 0.8.5 expedition without losing its route', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-MIGRATION');
    const topo = career.activeClimb!.topo!;
    const legacy = {
      ...topo,
      version: 1,
      pace: undefined,
      gear: undefined,
      eventLog: undefined,
      rescueCost: undefined,
      rescueDurationMinutes: undefined,
      participants: topo.participants.map(({ loadKg: _loadKg, carryCapacityKg: _capacity, ...participant }) => participant),
    } as unknown as IntegratedExpeditionState;
    const migrated = normalizeIntegratedExpeditionState(legacy);

    expect(migrated.version).toBe(5);
    expect(migrated.pace).toBe('STEADY');
    expect(migrated.participants.every(participant => participant.carryCapacityKg > 0)).toBe(true);
    expect(migrated.eventLog.length).toBeGreaterThan(0);
    expect(migrated.routeChoice).toBe(topo.routeChoice);
  });

  it('reveals the full 9 by 9 square around the group', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-SCOUT-9X9');
    const { topo, context } = initializedTopo(career);
    const started = reduceIntegratedExpedition(topo, { type: 'START' }, context);
    const current = context.localMap.start;
    const scouted = reduceIntegratedExpedition(started, { type: 'SCOUT', point: { x: 0, y: 0 }, radius: 1, minutes: 99 }, context);
    const expected = context.localMap.cells.filter(cell => Math.max(Math.abs(cell.x - current.x), Math.abs(cell.y - current.y)) <= 4).length;

    expect(scouted.infrastructure[context.stageId]?.revealed).toHaveLength(expected);
    expect(scouted.message).toContain('9×9');
    expect(scouted.elapsedMinutes).toBeLessThan(22);
  });

  it('drains energy from every active participant while preserving group order', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-WHOLE-GROUP');
    const { topo, context, path } = initializedTopo(career);
    const nextPoint = path[1]!;
    const safeMap = {
      ...context.localMap,
      cells: context.localMap.cells.map(cell => cell.x === nextPoint.x && cell.y === nextPoint.y
        ? { ...cell, hazard: 'NONE' as const, stability: 100, ropeRequired: false, ropeRecommended: false, rollbackCells: 0 }
        : cell),
    };
    const safeContext = { ...context, localMap: safeMap };
    const started = reduceIntegratedExpedition({
      ...topo,
      participants: topo.participants.map(participant => ({ ...participant, energy: 100, fatigue: 10 })),
      infrastructure: { [context.stageId]: { camps: [], ropes: [], revealed: [nextPoint.x + ':' + nextPoint.y] } },
    }, { type: 'START' }, safeContext);
    const order = started.participants.map(participant => participant.id);
    const stepped = reduceIntegratedExpedition(started, { type: 'STEP' }, safeContext);
    const reordered = reduceIntegratedExpedition(stepped, { type: 'REORDER', index: 0, delta: 1 }, safeContext);

    for (const participant of stepped.participants.filter(item => item.status === 'ACTIVE' || item.status === 'INJURED')) {
      expect(participant.energy).toBeLessThan(100);
    }
    expect(reordered.participants.map(participant => participant.id)).toEqual(order);
  });

  it('builds a camp automatically for an eight hour sleep', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-SLEEP');
    const { topo, context } = initializedTopo(career);
    const campCell = context.localMap.cells.find(cell => cell.campPossible && cell.passable)!;
    const sleeping: IntegratedExpeditionState = {
      ...topo,
      started: true,
      currentElevation: campCell.elevation,
      minutesSinceSleep: 760,
      paths: { ...topo.paths, [context.stageId]: [campCell] },
      positionIndex: 0,
      supplies: { ...topo.supplies, fuelUnits: Math.max(3, topo.supplies.fuelUnits) },
      campKits: Math.max(1, topo.campKits),
    };
    const rested = reduceIntegratedExpedition(sleeping, { type: 'REST', mode: 'SLEEP' }, context);

    expect(rested.infrastructure[context.stageId]?.camps).toContain(`${campCell.x}:${campCell.y}`);
    expect(rested.minutesSinceSleep).toBe(0);
    expect(rested.nightsSlept).toBe(1);
    expect(rested.elapsedMinutes).toBeGreaterThanOrEqual(480);
  });

  it('explains the real causes of expedition incidents in the final debrief', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-DEBRIEF');
    const { topo, context } = initializedTopo(career);
    const state: IntegratedExpeditionState = {
      ...topo,
      phase: 'RETREATED',
      retreating: true,
      started: true,
      nightsSlept: 1,
      infrastructure: { [context.stageId]: { camps: ['1:1'], ropes: ['2:2'], revealed: Array.from({ length: 24 }, (_, index) => `${index}:0`) } },
      incidents: [
        { id: 'rockfall', actionSerial: 4, stageId: context.stageId, type: 'ROCKFALL', participantId: null, title: 'Камнепад', detail: 'Порода сошла после прогрева.', severity: 'DANGER', elapsedMinutes: 90 },
        { id: 'navigation', actionSerial: 8, stageId: context.stageId, type: 'NAVIGATION', participantId: null, title: 'Ошибка линии', detail: 'Группа потеряла маршрут в тумане.', severity: 'WARNING', elapsedMinutes: 180 },
      ],
    };
    const debrief = integratedExpeditionDebrief(state);

    expect(debrief.strengths.join(' ')).toContain('Разведка');
    expect(debrief.risks.join(' ')).toContain('камнепад');
    expect(debrief.risks.join(' ')).toContain('потери линии');
    expect(debrief.contributors.length).toBeGreaterThan(0);
    expect(debrief.equipment.join(' ')).toContain('Верёвка');
    expect(Array.isArray(debrief.mistakes)).toBe(true);
  });

  it('reports concrete hazards and old route traces during scouting', () => {
    const { career } = startCareer('CLIMBER', 'INTEGRATED-SCOUT-CONTEXT');
    const { topo, context } = initializedTopo(career);
    const target = context.localMap.cells.find(cell => cell.passable && Math.max(Math.abs(cell.x - context.localMap.start.x), Math.abs(cell.y - context.localMap.start.y)) <= 4 && (cell.x !== context.localMap.start.x || cell.y !== context.localMap.start.y))!;
    const localMap = {
      ...context.localMap,
      cells: context.localMap.cells.map(cell => cell.x === target.x && cell.y === target.y ? { ...cell, hazard: 'CREVASSE' as const } : cell),
    };
    const contextual: IntegratedExpeditionContext = {
      ...context,
      localMap,
      character: {
        mountainCharacterId: 'TECHNICAL',
        mountainFormId: 'GLACIER_DOME',
        routeArchetype: 'GLACIER_LINE',
        routeName: 'Тестовая ледовая линия',
        seasonTitle: 'Раннее окно',
        hazardBias: 'CREVASSE',
        traceDensity: 100,
        historyAttempts: 8,
        historyTragedies: 1,
        descentProblem: 'трещины на обратном пути',
      },
    };
    const started = reduceIntegratedExpedition(topo, { type: 'START' }, contextual);
    const scouted = reduceIntegratedExpedition(started, { type: 'SCOUT', point: context.localMap.start, radius: 4, minutes: 20 }, contextual);

    expect(scouted.message).toContain('трещины');
    expect(scouted.message).toMatch(/старая станция|аварийного обхода/);
  });

});
