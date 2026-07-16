import type { CareerState, RegionData, RegionId, WorldState } from './types';

export type RegionAccess = {
  region: RegionData;
  unlocked: boolean;
  current: boolean;
  reputationGap: number;
  affordable: boolean;
  travelCost: number;
  travelDays: number;
};

export function worldRegions(world: WorldState) {
  return world.ecosystem.content.regions.allIds
    .map(id => world.ecosystem.content.regions.byId[id])
    .filter((region): region is RegionData => Boolean(region));
}

export function careerRegion(world: WorldState, career: Pick<CareerState, 'currentRegionId'>) {
  return world.ecosystem.content.regions.byId[career.currentRegionId]
    ?? world.ecosystem.content.regions.byId[world.ecosystem.content.primaryRegionId]
    ?? world.region;
}

export function regionMountains(world: WorldState, regionId: RegionId) {
  const region = world.ecosystem.content.regions.byId[regionId];
  if (!region) return [];
  return (region.mountainIds ?? [])
    .map(id => world.ecosystem.content.mountains.byId[id])
    .filter(Boolean);
}

export function regionRoutes(career: Pick<CareerState, 'routes'>, regionId: RegionId) {
  return career.routes.filter(route => route.regionId === regionId);
}

export function automaticUnlockedRegions(world: WorldState, career: Pick<CareerState, 'hero' | 'unlockedRegionIds' | 'currentRegionId'>) {
  const unlocked = new Set(career.unlockedRegionIds ?? []);
  unlocked.add(career.currentRegionId);
  unlocked.add(world.ecosystem.content.primaryRegionId);
  for (const region of worldRegions(world)) {
    if (career.hero.reputation >= (region.accessReputation ?? 0)) unlocked.add(region.id);
  }
  return [...unlocked];
}

export function regionTravelCost(world: WorldState, region: RegionData) {
  return Math.max(region.id === world.ecosystem.content.primaryRegionId ? 80 : 0, region.travelCost ?? 0);
}

export function regionAccessList(world: WorldState, career: CareerState): RegionAccess[] {
  const unlocked = new Set(automaticUnlockedRegions(world, career));
  return worldRegions(world).map(region => {
    const travelCost = regionTravelCost(world, region);
    const travelDays = Math.max(1, region.travelDays ?? 2);
    return {
      region,
      unlocked: unlocked.has(region.id),
      current: region.id === career.currentRegionId,
      reputationGap: Math.max(0, (region.accessReputation ?? 0) - career.hero.reputation),
      affordable: career.hero.money >= travelCost,
      travelCost,
      travelDays,
    };
  });
}

export function defaultRouteForRegion(career: Pick<CareerState, 'routes'>, regionId: RegionId) {
  return regionRoutes(career, regionId)
    .slice()
    .sort((a, b) => a.objectiveRisk - b.objectiveRisk || a.technicality - b.technicality || a.summitElevation - b.summitElevation)[0] ?? null;
}
