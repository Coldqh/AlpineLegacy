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

  it('keeps geography stable when only the starting era changes', () => {
    const pioneer = generateWorld({ ...config, eraId: 'PIONEER', startYear: 1900 });
    const modern = generateWorld({ ...config, eraId: 'MODERN', startYear: 2020 });

    const geography = (world: ReturnType<typeof generateWorld>) => world.region.mountains.map(mountain => ({
      id: mountain.id,
      name: mountain.name,
      elevation: mountain.elevation,
      profilePoints: mountain.profilePoints,
    }));

    expect(geography(pioneer)).toEqual(geography(modern));
  });


  it('gives mountains distinct gameplay characters', () => {
    const world = generateWorld(config);
    const characters = new Set(world.region.mountains.map(mountain => mountain.characterId));
    expect(characters.size).toBeGreaterThanOrEqual(4);
    expect(world.region.mountains.every(mountain => mountain.characterTitle.length > 0)).toBe(true);
  });

  it('does not generate mountain history after the career start year', () => {
    const world = generateWorld({ ...config, eraId: 'PIONEER', startYear: 1888 });
    const years = world.region.mountains.flatMap(mountain => mountain.history.map(line => Number(line.slice(0, 4))));

    expect(years.every(year => year < 1888)).toBe(true);
  });

});
