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
    expect(career.livingWorld.clubs.length).toBeGreaterThanOrEqual(18);
    expect(career.livingWorld.athletes.length).toBeGreaterThan(180);
    expect(career.livingWorld.mountainHistory).toHaveLength(world.ecosystem.content.mountains.allIds.length);
    expect(new Set(career.livingWorld.clubs.map(club => club.regionId)).size).toBe(6);
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


  it('gives every school its own doctrine, training focus and risk profile', () => {
    const world = generateWorld({ ...config, seed: 'SCHOOL-IDENTITY-011' });
    const career = createCareer(world, draft);
    const profiles = career.livingWorld.clubs.map(club => `${club.focusSkill}:${club.riskProfile}:${club.trainingQuality}:${club.recoveryStandard}`);
    expect(new Set(profiles).size).toBeGreaterThanOrEqual(4);
    for (const club of career.livingWorld.clubs) {
      const mentors = career.livingWorld.athletes.filter(athlete => athlete.clubId === club.id && athlete.isMentor);
      expect(mentors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('rotates NPC groups through real routes and gives them recovery and practice', () => {
    const world = generateWorld({ ...config, seed: 'NPC-SEASON-011' });
    let career = createCareer(world, draft);
    const startingXp = new Map(career.livingWorld.athletes.map(athlete => [athlete.id, Object.values(athlete.skillXp).reduce((sum, value) => sum + value, 0)]));
    for (let index = 0; index < 8; index += 1) career = applyTraining(career, 'MAP_ROOM');
    const npcExpeditions = career.livingWorld.expeditions.filter(item => item.leaderAthleteId !== 'hero');
    expect(npcExpeditions.length).toBeGreaterThan(12);
    expect(new Set(npcExpeditions.map(item => item.routeId).filter(Boolean)).size).toBeGreaterThan(3);
    expect(npcExpeditions.every(item => item.teamSize >= 3 && item.recoveryDays >= 3)).toBe(true);
    expect(career.livingWorld.athletes.some(athlete => athlete.expeditionCount > 0 && athlete.lastRouteId)).toBe(true);
    expect(career.livingWorld.athletes.some(athlete => Object.values(athlete.skillXp).reduce((sum, value) => sum + value, 0) > (startingXp.get(athlete.id) ?? 0))).toBe(true);
  });


  it('sends mentors onto routes that fit their own difficulty preference', () => {
    const world = generateWorld({ ...config, seed: 'MENTOR-ROUTES' });
    const career = createCareer(world, draft);
    const advanced = applyTraining(career, 'CONDITIONING');
    const mentorExpeditions = advanced.livingWorld.expeditions.filter(expedition => {
      const leader = advanced.livingWorld.athletes.find(athlete => athlete.id === expedition.leaderAthleteId);
      return leader?.isMentor;
    });
    expect(new Set(mentorExpeditions.map(expedition => expedition.clubId)).size).toBeGreaterThanOrEqual(4);
    expect(mentorExpeditions.every(expedition => Boolean(expedition.routeId))).toBe(true);
    for (const expedition of mentorExpeditions) {
      const leader = advanced.livingWorld.athletes.find(athlete => athlete.id === expedition.leaderAthleteId)!;
      const route = career.routes.find(item => item.id === expedition.routeId)!;
      expect(route.regionId).toBe(expedition.regionId);
      const regionalScores = career.routes
        .filter(item => item.regionId === route.regionId)
        .map(item => item.objectiveRisk * .45 + item.technicality * .4 + Math.max(0, item.summitElevation - item.startElevation) / 180)
        .sort((a, b) => a - b);
      const rank = regionalScores.filter(score => score <= expedition.difficultyScore).length / regionalScores.length;
      const club = advanced.livingWorld.clubs.find(item => item.id === leader.clubId);
      if (leader.routePreference === 'EASY' && club?.riskProfile !== 'AGGRESSIVE') expect(rank).toBeLessThanOrEqual(.67);
      if (leader.routePreference === 'HARD' && club?.riskProfile !== 'CAUTIOUS') expect(rank).toBeGreaterThanOrEqual(.34);
    }
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
    expect(migrated.schemaVersion).toBe(21);
    expect(migrated.routes.every(route => route.mountainCharacterId)).toBe(true);
  });

  it('migrates a v0.5 career and preserves the selected mountain', () => {
    const world = generateWorld(config);
    const target = world.region.mountains.at(-1)!;
    const career = selectMountain(createCareer(world, draft), target.id);
    const legacy = { ...career, schemaVersion: 5 } as any;
    const migrated = migrateCareerV5(legacy, world);
    expect(migrated.schemaVersion).toBe(21);
    expect(getSelectedRoute(migrated).mountainId).toBe(target.id);
  });

  it('migrates a v0.4 career without losing the roster', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 4 } as any;
    delete legacy.livingWorld;
    const migrated = migrateCareerV4(legacy, world);
    expect(migrated.schemaVersion).toBe(21);
    expect(migrated.teamRoster.map(item => item.id)).toEqual(career.teamRoster.map(item => item.id));
    expect(migrated.livingWorld.athletes.length).toBeGreaterThan(30);
  });
  it('migrates an active v0.5.2 climb to the separate descent model', () => {
    const world = generateWorld(config);
    const career = createCareer(world, draft);
    const legacy = { ...career, schemaVersion: 7, activeClimb: null } as any;
    const migrated = migrateCareerV7(legacy, world);
    expect(migrated.schemaVersion).toBe(21);
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
    expect(migrated.schemaVersion).toBe(21);
    expect(migrated.rootSeed).toBe(config.seed);
    expect(migrated.difficulty).toBe(config.difficulty);
    expect(migrated.onboarding.completed).toBe(false);
  });

});
