import { describe, expect, it } from 'vitest';
import {
  buildMountainRouteOptions,
  buildMountainStages,
  cellAt,
  evaluateLocalRoute,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
  stageCountForMountain,
  weatherAtGrid,
} from '../../topography/mountainGridEngine';

describe('mountain routes and local terrain gameplay', () => {
  it('keeps the summit on the actual highest cell', () => {
    const grid = generateMountainGrid('SUMMIT-CHECK');
    const summit = cellAt(grid, grid.summit)!;
    expect(summit.elevation).toBe(grid.summitElevation);
    expect(Math.max(...grid.cells.map(cell => cell.elevation))).toBe(grid.summitElevation);
  });

  it('makes higher mountains physically larger and splits them into more stages', () => {
    const small = generateMountainGrid('HEIGHT-SCALE', 420, 2280);
    const giant = generateMountainGrid('HEIGHT-SCALE', 620, 7420);
    expect(giant.width).toBeGreaterThan(small.width);
    expect(giant.physicalDiameterKm).toBeGreaterThan(small.physicalDiameterKm);
    expect(stageCountForMountain(giant)).toBeGreaterThan(stageCountForMountain(small));
    expect(stageCountForMountain(giant)).toBeLessThanOrEqual(18);
  });

  it('creates named routes with distinct profiles and connected lines', () => {
    const grid = generateMountainGrid('NAMED-ROUTES');
    const routes = buildMountainRouteOptions(grid, 'WEST');
    expect(routes).toHaveLength(4);
    expect(new Set(routes.map(route => route.name)).size).toBe(4);
    expect(new Set(routes.map(route => route.profile)).size).toBe(4);
    expect(new Set(routes.map(route => route.route.map(point => `${point.x}:${point.y}`).join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(routes.some(route => route.difficulty === 5)).toBe(true);
    for (const route of routes) {
      expect(isSamePoint(route.route[0]!, grid.entries.WEST)).toBe(true);
      expect(isSamePoint(route.route.at(-1)!, grid.summit)).toBe(true);
      expect(route.stageCount).toBeGreaterThanOrEqual(7);
      for (let index = 1; index < route.route.length; index += 1) {
        expect(isAdjacent(route.route[index - 1]!, route.route[index]!)).toBe(true);
      }
    }
  });

  it('builds a dynamic stage chain from the selected route', () => {
    const grid = generateMountainGrid('DYNAMIC-STAGES', 540, 5120);
    const selected = buildMountainRouteOptions(grid, 'NORTH')[2]!;
    const stages = buildMountainStages(grid, 'NORTH', selected.route, selected.profile);
    expect(stages.length).toBe(selected.stageCount);
    expect(stages.length).toBeGreaterThan(10);
    expect(stages[0]!.type).toBe('APPROACH');
    expect(stages.at(-1)!.type).toBe('SUMMIT');
    expect(stages.every(stage => stage.localMapSize >= 11 && stage.localMapSize <= 15)).toBe(true);
  });

  it('gives technical stages several terrain zones and multi-cell hazards', () => {
    const grid = generateMountainGrid('LOCAL-TERRAIN');
    const selected = buildMountainRouteOptions(grid, 'SOUTH')[1]!;
    const stages = buildMountainStages(grid, 'SOUTH', selected.route, selected.profile);
    const glacier = stages.find(stage => stage.type === 'GLACIER')!;
    const map = generateLocalStageMap(glacier, grid.seed, 13);
    expect(new Set(map.cells.map(cell => cell.terrain)).size).toBeGreaterThanOrEqual(2);
    expect(map.cells.filter(cell => cell.hazard === 'CREVASSE').length).toBeGreaterThanOrEqual(4);
    expect(map.cells.filter(cell => cell.campPossible).length).toBeGreaterThan(0);
    const route = findLocalGuidedRoute(map, 'SAFE');
    expect(isSamePoint(route[0]!, map.start)).toBe(true);
    expect(isSamePoint(route.at(-1)!, map.goal)).toBe(true);
  });

  it('makes safe and direct plans produce different route costs', () => {
    const grid = generateMountainGrid('ROUTE-COSTS');
    const selected = buildMountainRouteOptions(grid, 'EAST')[0]!;
    const stages = buildMountainStages(grid, 'EAST', selected.route, selected.profile);
    const snow = stages.find(stage => stage.type === 'SNOWFIELD')!;
    const map = generateLocalStageMap(snow, grid.seed, 13);
    const safe = findLocalGuidedRoute(map, 'SAFE');
    const direct = findLocalGuidedRoute(map, 'DIRECT');
    const weather = weatherAtGrid(420);
    const safeMetrics = evaluateLocalRoute(map, safe, weather);
    const directMetrics = evaluateLocalRoute(map, direct, weather);
    expect(safe).not.toEqual(direct);
    expect(safeMetrics.hazardCells).toBeLessThanOrEqual(directMetrics.hazardCells);
    expect(safeMetrics.cells + directMetrics.cells).toBeGreaterThan(10);
  });
});
