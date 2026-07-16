import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { careerRecoveryStatus, loadCareer, loadWorld, restoreCareerBackup, saveCareer, saveWorld } from '../storage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function fixture() {
  const world = generateWorld({ seed: 'SAVE-064', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  const organization = getEntryOrganizations(world)[0]!;
  const career = createCareer(world, { name: 'Save Tester', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  return { world, career };
}

describe('crash-safe expedition saves', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }); });

  it('keeps the previous valid turn as a manual rollback', () => {
    const { world, career } = fixture();
    saveCareer(career);
    saveCareer({ ...career, seasonDay: career.seasonDay + 1 });
    expect(careerRecoveryStatus().backupAvailable).toBe(true);
    expect(restoreCareerBackup(world)?.seasonDay).toBe(career.seasonDay);
  });

  it('recovers from a corrupted primary save', () => {
    const { world, career } = fixture();
    saveCareer(career);
    saveCareer({ ...career, seasonDay: career.seasonDay + 2 });
    localStorage.setItem('alpine-legacy:career:v18', '{broken');
    const recovered = loadCareer(world);
    expect(recovered).toBeTruthy();
    expect(recovered?.seasonDay).toBe(career.seasonDay);
    expect(careerRecoveryStatus().lastRecovery).toBeTruthy();
  });

  it('migrates the previous v17 career into recovery-aware v18 storage', () => {
    const { world, career } = fixture();
    const legacy = { ...career, schemaVersion: 17 } as any;
    delete legacy.recoveryDays;
    localStorage.setItem('alpine-legacy:career:v17', JSON.stringify(legacy));
    const restored = loadCareer(world);
    expect(restored?.schemaVersion).toBe(18);
    expect(restored?.recoveryDays).toBe(0);
    expect(restored?.livingWorld.version).toBe(3);
    expect(localStorage.getItem('alpine-legacy:career:v18')).toBeTruthy();
  });

  it('migrates a v16 save and rebuilds NPC skills and mentor data', () => {
    const { world, career } = fixture();
    const legacy = JSON.parse(JSON.stringify({ ...career, schemaVersion: 16 }));
    for (const member of legacy.teamRoster) {
      delete member.skills;
      delete member.isMentor;
      delete member.mentorLevel;
      delete member.routePreference;
      delete member.activityRate;
    }
    legacy.livingWorld.version = 1;
    for (const athlete of legacy.livingWorld.athletes) {
      delete athlete.skills;
      delete athlete.isMentor;
      delete athlete.mentorLevel;
      delete athlete.routePreference;
      delete athlete.activityRate;
    }
    for (const expedition of legacy.livingWorld.expeditions) {
      delete expedition.routeId;
      delete expedition.routeName;
      delete expedition.difficultyScore;
    }

    localStorage.setItem('alpine-legacy:career:v16', JSON.stringify(legacy));
    const restored = loadCareer(world);

    expect(restored?.schemaVersion).toBe(18);
    expect(restored?.teamRoster.map(member => member.id)).toEqual(career.teamRoster.map(member => member.id));
    expect(restored?.teamRoster.every(member => member.skills && member.activityRate > 0)).toBe(true);
    expect(restored?.livingWorld.version).toBe(3);
    expect(restored?.livingWorld.athletes.every(athlete => athlete.skills && athlete.activityRate > 0)).toBe(true);
    expect(restored?.livingWorld.athletes.filter(athlete => athlete.isMentor).length).toBeGreaterThanOrEqual(15);
    expect(localStorage.getItem('alpine-legacy:career:v18')).toBeTruthy();
  });

});


describe('compact world persistence', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }); });

  it('stores only a small deterministic manifest instead of the full ecosystem', () => {
    const world = generateWorld({ seed: 'WORLD-MANIFEST', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
    const fullSize = JSON.stringify(world).length;

    saveWorld(world);

    const raw = localStorage.getItem('alpine-legacy:world:v1')!;
    const stored = JSON.parse(raw);
    expect(stored.format).toBe('alpine-legacy-world-manifest');
    expect(raw.length).toBeLessThan(1_000);
    expect(raw.length).toBeLessThan(fullSize / 20);

    const restored = loadWorld();
    expect(restored?.id).toBe(world.id);
    expect(restored?.createdAt).toBe(world.createdAt);
    expect(restored?.region.mountains.map(item => item.id)).toEqual(world.region.mountains.map(item => item.id));
    expect(restored?.ecosystem.content.routes.allIds).toEqual(world.ecosystem.content.routes.allIds);
  });

  it('migrates an older full-world payload to the compact manifest', () => {
    const world = generateWorld({ seed: 'WORLD-LEGACY', eraId: 'PIONEER', startYear: 1912, difficulty: 'EXPLORER' });
    localStorage.setItem('alpine-legacy:world:v1', JSON.stringify(world));

    const restored = loadWorld();
    const migrated = JSON.parse(localStorage.getItem('alpine-legacy:world:v1')!);

    expect(restored?.id).toBe(world.id);
    expect(migrated.format).toBe('alpine-legacy-world-manifest');
    expect(JSON.stringify(migrated).length).toBeLessThan(1_000);
  });
});
