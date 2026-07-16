import { describe, expect, it } from 'vitest';
import { createCareer, schoolExpeditionBoard, travelToRegion } from '../career';
import { generateWorld } from '../generator';
import { regionAccessList, regionRoutes, worldRegions } from '../regionalCareer';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'WORLD-CAREER-018', eraId: 'EXPEDITION', startYear: 1978, difficulty: 'CLIMBER' };

function careerFixture() {
  const world = generateWorld(config);
  const career = createCareer(world, { name: 'World Climber', age: 22, originId: 'HIGHLAND_LOCAL', entryMode: 'INDEPENDENT', organizationId: null });
  return { world, career };
}

describe('real regional world career', () => {
  it('builds six real-country mountain regions with regional routes', () => {
    const { world, career } = careerFixture();
    const regions = worldRegions(world);
    expect(regions.map(region => region.country)).toEqual(['Швейцария', 'Франция', 'Перу', 'Аргентина', 'Непал', 'Пакистан']);
    expect(regions.every(region => region.mountains.length === 6)).toBe(true);
    expect(world.ecosystem.content.mountains.allIds).toHaveLength(36);
    expect(career.routes).toHaveLength(108);
    for (const region of regions) {
      expect(regionRoutes(career, region.id)).toHaveLength(18);
    }
  });

  it('starts in Switzerland and locks distant regions behind reputation', () => {
    const { world, career } = careerFixture();
    const current = world.ecosystem.content.regions.byId[career.currentRegionId]!;
    const access = regionAccessList(world, career);
    expect(current.country).toBe('Швейцария');
    expect(access.find(item => item.region.country === 'Франция')?.unlocked).toBe(false);
    expect(access.find(item => item.region.country === 'Непал')?.reputationGap).toBeGreaterThan(0);
  });

  it('travels to an unlocked region and exposes several local school expeditions', () => {
    const { world, career } = careerFixture();
    const nepal = worldRegions(world).find(region => region.country === 'Непал')!;
    const prepared = {
      ...career,
      hero: { ...career.hero, reputation: 70, money: 2500 },
    };
    const traveled = travelToRegion(world, prepared, nepal.id);
    expect(traveled.currentRegionId).toBe(nepal.id);
    expect(traveled.hero.money).toBe(prepared.hero.money - (nepal.travelCost ?? 0));
    expect(traveled.travelHistory.at(-1)?.toRegionId).toBe(nepal.id);
    expect(traveled.routes.find(route => route.id === traveled.expeditionPlan.routeId)?.regionId).toBe(nepal.id);

    const board = schoolExpeditionBoard(world, traveled, true);
    expect(board.length).toBeGreaterThanOrEqual(6);
    expect(new Set(board.map(offer => offer.organizationId).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(board.map(offer => offer.leaderNpcId).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
    expect(board.every(offer => world.ecosystem.content.routes.byId[offer.routeId]?.regionId === nepal.id)).toBe(true);
  });

  it('does not allow travel during an active climb', () => {
    const { world, career } = careerFixture();
    const france = worldRegions(world).find(region => region.country === 'Франция')!;
    const locked = { ...career, activeClimb: { id: 'busy' } as typeof career.activeClimb, hero: { ...career.hero, reputation: 100, money: 2500 } };
    expect(travelToRegion(world, locked, france.id)).toBe(locked);
  });
});
