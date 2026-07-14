import { describe, expect, it } from 'vitest';
import { applyTraining, createCareer, getSelectedRoute, migrateCareerV4, migrateCareerV5, migrateCareerV6, migrateCareerV7, migrateCareerV8, selectMountain } from '../career';
import { generateWorld } from '../generator';
import type { CareerDraft, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'WORLD-ALIVE-05', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };
const draft: CareerDraft = { name: 'World Test', age: 21, originId: 'HIGHLAND_LOCAL' };

describe('living world simulation', () => {
  it('creates clubs, active athletes, mountain history and records', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    expect(career.livingWorld.clubs).toHaveLength(6);
    expect(career.livingWorld.athletes.length).toBeGreaterThan(30);
    expect(career.livingWorld.mountainHistory).toHaveLength(world.region.mountains.length);
    expect(career.livingWorld.records.length).toBeGreaterThanOrEqual(4);
  });

  it('advances autonomous expeditions whenever career time moves', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const advanced = applyTraining(career, 'CONDITIONING');
    expect(advanced.livingWorld.tick).toBeGreaterThan(career.livingWorld.tick);
    expect(advanced.livingWorld.expeditions.length).toBeGreaterThan(0);
    expect(advanced.livingWorld.news.length).toBeGreaterThan(career.livingWorld.news.length);
  });

  it('is deterministic for the same seed, career state and action', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const first = applyTraining(career, 'MAP_ROOM');
    const second = applyTraining(career, 'MAP_ROOM');
    expect(first.livingWorld).toEqual(second.livingWorld);
  });



  it('migrates a v0.5.1 career to the new route character model', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 6, routes: career.routes.map(({ mountainCharacterId, ...route }) => route) } as any;
    const migrated = migrateCareerV6(legacy, world);
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.routes.every(route => route.mountainCharacterId)).toBe(true);
  });

  it('migrates a v0.5 career and preserves the selected mountain', () => {
    const world = generateWorld(config);
    const target = world.region.mountains.at(-1)!;
    const career = selectMountain(createCareer(world, draft), target.id);
    const legacy = { ...career, schemaVersion: 5 } as any;
    const migrated = migrateCareerV5(legacy, world);
    expect(migrated.schemaVersion).toBe(13);
    expect(getSelectedRoute(migrated).mountainId).toBe(target.id);
  });

  it('migrates a v0.4 career without losing the roster', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 4 } as any;
    delete legacy.livingWorld;
    const migrated = migrateCareerV4(legacy, world);
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.teamRoster.map(item => item.id)).toEqual(career.teamRoster.map(item => item.id));
    expect(migrated.livingWorld.athletes.length).toBeGreaterThan(30);
  });
  it('migrates an active v0.5.2 climb to the separate descent model', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 7, activeClimb: null } as any;
    const migrated = migrateCareerV7(legacy, world);
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.routes.some(route => route.isSignature && route.descentSegments?.length)).toBe(true);
  });

  it('migrates a v0.5.3 career and restores hardening metadata', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 8 } as any;
    delete legacy.rootSeed;
    delete legacy.difficulty;
    delete legacy.onboarding;
    const migrated = migrateCareerV8(legacy, world);
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.rootSeed).toBe(config.seed);
    expect(migrated.difficulty).toBe(config.difficulty);
    expect(migrated.onboarding.completed).toBe(false);
  });

});
