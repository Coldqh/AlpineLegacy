import { describe, expect, it } from 'vitest';
import {
  buildMountainStages,
  cellAt,
  findGuidedRoute,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
} from '../../topography/mountainGridEngine';

describe('full mountain and local stages', () => {
  it('keeps summit on the actual highest cell', () => {
    const grid = generateMountainGrid('SUMMIT-CHECK');
    const summit = cellAt(grid, grid.summit)!;
    expect(summit.elevation).toBe(grid.summitElevation);
    expect(Math.max(...grid.cells.map(cell => cell.elevation))).toBe(grid.summitElevation);
  });

  it('supports a route from every side of the mountain', () => {
    const grid = generateMountainGrid('ALL-SIDES');
    for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST'] as const) {
      const route = findGuidedRoute(grid, side);
      expect(isSamePoint(route[0]!, grid.entries[side])).toBe(true);
      expect(isSamePoint(route.at(-1)!, grid.summit)).toBe(true);
      expect(route.length).toBeGreaterThan(10);
    }
  });

  it('splits a mountain approach into separate local stages', () => {
    const grid = generateMountainGrid('STAGES');
    const stages = buildMountainStages(grid, 'WEST');
    expect(stages.length).toBe(7);
    expect(stages[0]!.type).toBe('APPROACH');
    expect(stages.at(-1)!.type).toBe('SUMMIT');
  });

  it('gives every stage its own connected local square map', () => {
    const grid = generateMountainGrid('LOCAL-MAPS');
    const stages = buildMountainStages(grid, 'NORTH');
    for (const stage of stages) {
      const map = generateLocalStageMap(stage, grid.seed);
      const route = findLocalGuidedRoute(map);
      expect(map.width).toBe(11);
      expect(map.height).toBe(11);
      expect(isSamePoint(route[0]!, map.start)).toBe(true);
      expect(isSamePoint(route.at(-1)!, map.goal)).toBe(true);
      for (let index = 1; index < route.length; index += 1) expect(isAdjacent(route[index - 1]!, route[index]!)).toBe(true);
    }
  });
});
