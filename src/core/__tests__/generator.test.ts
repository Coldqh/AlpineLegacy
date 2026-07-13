import { describe, expect, it } from 'vitest';
import { generateWorld } from '../generator';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = {
  seed: 'ALPINE-1907',
  eraId: 'EXPEDITION',
  startYear: 1968,
  difficulty: 'CLIMBER',
};

describe('world generator', () => {
  it('generates the same region and mountains for the same seed', () => {
    const first = generateWorld(config);
    const second = generateWorld(config);

    expect(first.region).toEqual(second.region);
  });

  it('creates a valid mountain register', () => {
    const world = generateWorld(config);

    expect(world.region.mountains.length).toBeGreaterThanOrEqual(5);
    expect(world.region.mountains.every((mountain) => mountain.profilePoints.length >= 10)).toBe(true);
    expect(world.region.elevationMax).toBe(Math.max(...world.region.mountains.map((mountain) => mountain.elevation)));
  });
});
