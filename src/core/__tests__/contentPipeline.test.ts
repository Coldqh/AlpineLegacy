import { describe, expect, it } from 'vitest';
import { TERRAIN_MODULES, detectTerrainModule } from '../../content/terrainModules';
import { buildRouteContentReport, expeditionScaleForRoute, validateWorldContent } from '../contentPipeline';
import { generateWorld } from '../generator';
import type { ExpeditionRoute } from '../types';

const config = { seed: 'CONTENT-PIPELINE', eraId: 'EXPEDITION' as const, startYear: 1968, difficulty: 'CLIMBER' as const };

function scaledRoute(base: ExpeditionRoute, summitElevation: number, estimatedHours: number, technicality: number, objectiveRisk: number): ExpeditionRoute {
  return { ...base, id: `${base.id}-${summitElevation}`, startElevation: 1000, summitElevation, estimatedHours, technicality, objectiveRisk };
}

describe('expedition content pipeline', () => {
  it('validates generated references and route graphs', () => {
    const world = generateWorld(config);
    const report = validateWorldContent(world);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.routeReports.length).toBe(world.ecosystem.content.routes.allIds.length);
    expect(report.routeReports.every(item => item.ascentStages > 0 && item.descentStages > 0)).toBe(true);
  });

  it('supports small, major and giant expedition budgets with one route schema', () => {
    const world = generateWorld(config);
    const base = world.ecosystem.content.routes.byId[world.ecosystem.content.routes.allIds[0]!]!;
    const small = scaledRoute(base, 2800, 6, 18, 16);
    const major = scaledRoute(base, 4800, 8, 20, 20);
    const giant = scaledRoute(base, 7200, 30, 68, 72);
    expect(expeditionScaleForRoute(small)).toBe('SMALL');
    expect(expeditionScaleForRoute(major)).toBe('MAJOR');
    expect(expeditionScaleForRoute(giant)).toBe('GIANT');
    const reports = [small, major, giant].map(buildRouteContentReport);
    expect(reports[0]!.expectedPlayMinutes).toBeGreaterThanOrEqual(15);
    expect(reports[0]!.expectedPlayMinutes).toBeLessThanOrEqual(25);
    expect(reports[1]!.expectedPlayMinutes).toBeGreaterThanOrEqual(30);
    expect(reports[1]!.expectedPlayMinutes).toBeLessThanOrEqual(40);
    expect(reports[2]!.expectedPlayMinutes).toBeGreaterThanOrEqual(45);
    expect(reports[2]!.expectedPlayMinutes).toBeLessThanOrEqual(60);
    expect(reports[0]!.ascentStages).toBeLessThan(reports[1]!.ascentStages);
    expect(reports[1]!.ascentStages).toBeLessThan(reports[2]!.ascentStages);
  });

  it('maps terrain text to reusable gameplay modules', () => {
    expect(Object.keys(TERRAIN_MODULES).length).toBeGreaterThanOrEqual(12);
    expect(detectTerrainModule('поле трещин и снежные мосты').id).toBe('CREVASSE_FIELD');
    expect(detectTerrainModule('скальная стена').id).toBe('ROCK_WALL');
    expect(detectTerrainModule('выход из района', 'EXIT').id).toBe('EXIT_TRAIL');
  });
});
