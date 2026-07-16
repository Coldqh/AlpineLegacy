import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../career';
import { generateWorld } from '../generator';
import { loadUiState, normalizeUiState, saveUiState } from '../uiState';
import type { WorldSeedConfig } from '../types';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const config: WorldSeedConfig = { seed: 'UI-STATE-190', eraId: 'MODERN', startYear: 2024, difficulty: 'CLIMBER' };

describe('persistent UI state', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  });

  it('restores the career tab and selected mountain', () => {
    const world = generateWorld(config);
    const career = createCareer(world, { name: 'UI Tester', age: 21, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT' });
    const mountain = world.region.mountains[2]!;
    saveUiState({ screen: 'MOUNTAIN', careerTab: 'NEWS', atlasReturnScreen: 'CAREER', selectedMountainId: mountain.id });
    expect(loadUiState(world, career)).toEqual({ screen: 'MOUNTAIN', careerTab: 'NEWS', atlasReturnScreen: 'CAREER', selectedMountainId: mountain.id });
  });

  it('does not restore screens that have no required world or career', () => {
    expect(normalizeUiState({ screen: 'CAREER', careerTab: 'ROUTE' }, null, null).screen).toBe('MENU');
    const world = generateWorld(config);
    expect(normalizeUiState({ screen: 'CAREER', careerTab: 'ROUTE' }, world, null).screen).toBe('REGION');
  });

  it('forces an unfinished expedition back into the climb tab', () => {
    const world = generateWorld(config);
    const career = createCareer(world, { name: 'UI Tester', age: 21, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT' });
    const active = { ...career, activeClimb: { id: 'active' } as typeof career.activeClimb };
    const ui = normalizeUiState({ screen: 'MENU', careerTab: 'OVERVIEW' }, world, active);
    expect(ui.screen).toBe('CAREER');
    expect(ui.careerTab).toBe('CLIMB');
  });
});
