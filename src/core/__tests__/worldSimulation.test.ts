import { describe, expect, it } from 'vitest';
import { applyTraining, createCareer, migrateCareerV4 } from '../career';
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

  it('migrates a v0.4 career without losing the roster', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 4 } as any;
    delete legacy.livingWorld;
    const migrated = migrateCareerV4(legacy, world);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.teamRoster.map(item => item.id)).toEqual(career.teamRoster.map(item => item.id));
    expect(migrated.livingWorld.athletes.length).toBeGreaterThan(30);
  });
});
