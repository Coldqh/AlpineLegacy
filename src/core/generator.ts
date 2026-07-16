import { createWorldEcosystem, hydrateWorldEcosystem } from './ecosystem';
import { createRng } from './rng';
import { buildRealRegions } from './regionalWorld';
import { generateRoutesForWorld } from './routeFactory';
import type { WorldSeedConfig, WorldState } from './types';

export function hydrateWorld(world: WorldState): WorldState {
  const regions = buildRealRegions(world.config);
  const region = regions[0]!;
  const base = {
    ...world,
    schemaVersion: 2 as const,
    region,
  } as WorldState;
  const mountains = regions.flatMap(item => item.mountains);
  const routes = generateRoutesForWorld(base, mountains);
  const ecosystem = createWorldEcosystem(base, routes, regions);
  return hydrateWorldEcosystem({ ...base, ecosystem });
}

export function generateWorld(config: WorldSeedConfig): WorldState {
  const rng = createRng(config.seed);
  const regions = buildRealRegions(config);
  const region = regions[0]!;
  const base = {
    schemaVersion: 2 as const,
    id: `world-${config.seed.replace(/\W/g, '').slice(0, 18) || 'alpine'}-${config.eraId.toLowerCase()}-${config.startYear}`,
    config,
    createdAt: new Date().toISOString(),
    worldAge: rng.int(52, 96),
    region,
  } as Omit<WorldState, 'ecosystem'>;
  const world = { ...base, ecosystem: null as unknown as WorldState['ecosystem'] } as WorldState;
  const mountains = regions.flatMap(item => item.mountains);
  const routes = generateRoutesForWorld(world, mountains);
  world.ecosystem = createWorldEcosystem(world, routes, regions);
  return hydrateWorldEcosystem(world);
}
