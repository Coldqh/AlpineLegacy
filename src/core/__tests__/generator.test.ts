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

  it('builds a coherent authored identity for every generated mountain', () => {
    const world = generateWorld(config);
    const signatures = world.region.mountains.map(mountain => mountain.identity.generationSignature);

    expect(new Set(signatures).size).toBe(world.region.mountains.length);
    expect(world.region.mountains.every(mountain => mountain.identity.landmarkNames.length === 4)).toBe(true);
    expect(world.region.mountains.every(mountain => mountain.summary.includes(mountain.identity.signatureFeature))).toBe(true);
    expect(world.region.mountains.every(mountain => mountain.history.some(line => mountain.identity.landmarkNames.some(name => line.includes(name))))).toBe(true);
  });

  it('gives every mountain three authored routes instead of one repeated template', () => {
    const world = generateWorld(config);
    for (const mountain of world.region.mountains) {
      const routes = world.ecosystem.content.routes.allIds
        .map(id => world.ecosystem.content.routes.byId[id])
        .filter(route => route?.mountainId === mountain.id);
      expect(routes).toHaveLength(3);
      expect(new Set(routes.map(route => route!.name)).size).toBe(3);
      expect(new Set(routes.map(route => route!.routeArchetype)).size).toBe(3);
      expect(new Set(routes.map(route => route!.segments.map(segment => segment.terrainModuleId).join('|'))).size).toBeGreaterThanOrEqual(2);
      expect(routes.every(route => (route?.decisions?.length ?? 0) >= 1)).toBe(true);
      expect(routes.every(route => route?.routeStory?.length === 3)).toBe(true);
      expect(routes.every(route => route?.mountainFormId === mountain.identity.formId)).toBe(true);
    }
  });

});
