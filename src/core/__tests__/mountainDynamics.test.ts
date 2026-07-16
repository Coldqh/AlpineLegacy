import { describe, expect, it } from 'vitest';
import { createCareer, getSelectedRoute, selectMountain } from '../career';
import { generateWorld } from '../generator';
import { applyMountainDynamicsToMap, applyMountainDynamicsToWeather, buildMountainDynamics } from '../mountainDynamics';
import { buildMountainStages, buildMountainRouteOptions, generateLocalStageMap, generateMountainGrid } from '../../topography/mountainGridEngine';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'ALPINE-DYNAMIC', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };

function careerAt(day: number) {
  const world = generateWorld(config);
  let career = createCareer(world, { name: 'Dynamic Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT', organizationId: null });
  career = { ...career, seasonDay: day };
  return { world, career };
}

describe('dynamic mountains', () => {
  it('changes seasonal mountain state without changing the permanent route', () => {
    const early = careerAt(18).career;
    const late = careerAt(160).career;
    const earlyRoute = getSelectedRoute(early);
    const lateRoute = getSelectedRoute(late);
    const thaw = buildMountainDynamics(early, earlyRoute.mountainId, earlyRoute.id);
    const freeze = buildMountainDynamics(late, lateRoute.mountainId, lateRoute.id);
    expect(thaw.seasonId).toBe('THAW');
    expect(freeze.seasonId).toBe('AUTUMN_FREEZE');
    expect(thaw.windDelta).not.toBe(freeze.windDelta);
    expect(earlyRoute.segments).toEqual(lateRoute.segments);
  });

  it('applies seasonal hazards to local maps deterministically', () => {
    const { career } = careerAt(18);
    const route = getSelectedRoute(career);
    const dynamics = buildMountainDynamics(career, route.mountainId, route.id);
    const grid = generateMountainGrid('dynamic-map', route.startElevation, route.summitElevation);
    const option = buildMountainRouteOptions(grid, 'SOUTH')[0]!;
    const stage = buildMountainStages(grid, 'SOUTH', option.route, option.profile)[1]!;
    const base = generateLocalStageMap(stage, grid.seed);
    const first = applyMountainDynamicsToMap(base, dynamics);
    const second = applyMountainDynamicsToMap(base, dynamics);
    expect(first).toEqual(second);
    expect(first.cells.some((cell, index) => cell.hazard !== base.cells[index]?.hazard || cell.surface !== base.cells[index]?.surface || cell.campPossible !== base.cells[index]?.campPossible || cell.stability !== base.cells[index]?.stability)).toBe(true);
  });

  it('modifies expedition weather from the current seasonal condition', () => {
    const { career } = careerAt(160);
    const route = getSelectedRoute(career);
    const dynamics = buildMountainDynamics(career, route.mountainId, route.id);
    const weather = applyMountainDynamicsToWeather({ temperatureC: -8, windKmh: 20, visibility: 80, snowSoftness: 40 }, dynamics);
    expect(weather.windKmh).toBeGreaterThan(20);
    expect(weather.temperatureC).toBeLessThan(-8);
  });

  it('never closes every generated line on one mountain', () => {
    const { world, career: initial } = careerAt(160);
    const target = world.region.mountains[0]!;
    const career = selectMountain(initial, target.id);
    const routes = career.routes.filter(route => route.mountainId === target.id);
    const states = routes.map(route => buildMountainDynamics(career, target.id, route.id));
    expect(states.filter(item => item.status !== 'CLOSED').length).toBeGreaterThanOrEqual(Math.max(1, routes.length - 1));
  });
});
