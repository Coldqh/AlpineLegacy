import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { careerRecoveryStatus, loadCareer, restoreCareerBackup, saveCareer } from '../storage';

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
    localStorage.setItem('alpine-legacy:career:v14', '{broken');
    const recovered = loadCareer(world);
    expect(recovered).toBeTruthy();
    expect(recovered?.seasonDay).toBe(career.seasonDay);
    expect(careerRecoveryStatus().lastRecovery).toBeTruthy();
  });
});
