import { describe, expect, it } from 'vitest';
import {
  cellAt,
  cellCanHostCamp,
  findGuidedRoute,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
  moveCost,
  routeCost,
  weatherAtGrid,
} from '../../topography/mountainGridEngine';

describe('mountain grid expedition engine', () => {
  it('generates the same mountain from the same seed', () => {
    const first = generateMountainGrid('GRID-TEST');
    const second = generateMountainGrid('GRID-TEST');
    expect(first.cells.map(cell => [cell.elevation, cell.terrain, cell.hazard])).toEqual(
      second.cells.map(cell => [cell.elevation, cell.terrain, cell.hazard]),
    );
  });

  it('builds a long contiguous guided route from start to summit', () => {
    const grid = generateMountainGrid('GUIDED-ROUTE');
    const route = findGuidedRoute(grid);
    expect(isSamePoint(route[0]!, grid.start)).toBe(true);
    expect(isSamePoint(route.at(-1)!, grid.summit)).toBe(true);
    expect(route.length).toBeGreaterThanOrEqual(20);
    for (let index = 1; index < route.length; index += 1) {
      expect(isAdjacent(route[index - 1]!, route[index]!)).toBe(true);
      expect(cellAt(grid, route[index]!)?.passable).toBe(true);
    }
  });

  it('contains at least two valid camp sites away from hazards', () => {
    const grid = generateMountainGrid('CAMPS');
    const camps = grid.cells.filter(cellCanHostCamp);
    expect(camps.length).toBeGreaterThanOrEqual(2);
    expect(camps.every(cell => cell.hazard === 'NONE' && cell.passable)).toBe(true);
  });

  it('makes steep technical movement slower and more expensive', () => {
    const grid = generateMountainGrid('MOVEMENT');
    const route = findGuidedRoute(grid);
    const weather = weatherAtGrid(0);
    const costs = route.slice(1).map((point, index) => moveCost(grid, route[index]!, point, weather, { roped: true, fixedRope: false, leaderEnergy: 90 }));
    expect(Math.max(...costs.map(cost => cost.minutes))).toBeGreaterThan(Math.min(...costs.map(cost => cost.minutes)));
    expect(Math.max(...costs.map(cost => cost.energy))).toBeGreaterThanOrEqual(Math.min(...costs.map(cost => cost.energy)));
  });

  it('produces a meaningful full-route time budget', () => {
    const grid = generateMountainGrid('BUDGET', 620, 3480);
    const route = findGuidedRoute(grid);
    const summary = routeCost(grid, route);
    expect(summary.cells).toBe(route.length - 1);
    expect(summary.minutes).toBeGreaterThan(300);
    expect(summary.minutes).toBeLessThan(3000);
  });
});
