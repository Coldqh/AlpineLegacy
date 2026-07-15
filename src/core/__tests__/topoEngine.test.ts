import { describe, expect, it } from 'vitest';
import {
  TOPO_CREVASSES,
  TOPO_START,
  TOPO_SUMMIT,
  canPlaceCamp,
  estimateRoute,
  movementFactor,
  routeCrossesCrevasse,
  routeGrade,
  terrainAt,
  weatherAt,
  type TopoPoint,
} from '../../topography/topoEngine';

describe('topographic expedition prototype', () => {
  it('distinguishes terrain directly from the map geometry', () => {
    expect(terrainAt({ x: 405, y: 500 })).toBe('GLACIER');
    expect(terrainAt({ x: 760, y: 150 })).toBe('RIDGE');
    expect(terrainAt({ x: 150, y: 540 })).toBe('SCREE');
  });

  it('makes a serpentine line less steep than a direct climb', () => {
    const directGrade = routeGrade({ x: 300, y: 570 }, { x: 620, y: 280 });
    const traverseA = routeGrade({ x: 300, y: 570 }, { x: 560, y: 520 });
    const traverseB = routeGrade({ x: 560, y: 520 }, { x: 760, y: 410 });
    const traverseC = routeGrade({ x: 760, y: 410 }, { x: 620, y: 280 });
    expect((traverseA + traverseB + traverseC) / 3).toBeLessThan(directGrade);
  });

  it('detects a route crossing a physical crevasse', () => {
    const crevasse = TOPO_CREVASSES[0]!;
    const route: TopoPoint[] = [
      { x: crevasse.a.x - 25, y: crevasse.a.y - 25 },
      { x: crevasse.b.x + 25, y: crevasse.b.y + 25 },
    ];
    expect(routeCrossesCrevasse(route, crevasse)).toBe(true);
  });

  it('only allows camps on the two prepared terraces', () => {
    expect(canPlaceCamp({ x: 285, y: 505 })).toBe(true);
    expect(canPlaceCamp({ x: 630, y: 300 })).toBe(true);
    expect(canPlaceCamp({ x: 800, y: 500 })).toBe(false);
  });

  it('physically changes snow and visibility as the day develops', () => {
    const morning = weatherAt(0);
    const afternoon = weatherAt(600);
    expect(afternoon.snowSoftness).toBeGreaterThan(morning.snowSoftness);
    expect(afternoon.visibility).toBeLessThan(morning.visibility);
  });

  it('makes route choice change duration and encountered hazards', () => {
    const direct = estimateRoute([TOPO_START, { x: 430, y: 500 }, { x: 620, y: 320 }, TOPO_SUMMIT]);
    const westRidge = estimateRoute([TOPO_START, { x: 180, y: 500 }, { x: 370, y: 390 }, { x: 610, y: 250 }, TOPO_SUMMIT]);
    expect(direct.crossedCrevasses.length).toBeGreaterThan(0);
    expect(direct.minutes).not.toBe(westRidge.minutes);
  });

  it('fixed rope increases movement efficiency on rock', () => {
    const point = { x: 820, y: 470 };
    const next = { x: 830, y: 430 };
    const weather = weatherAt(120);
    expect(movementFactor(point, next, weather, true)).toBeGreaterThan(movementFactor(point, next, weather, false));
  });
});
