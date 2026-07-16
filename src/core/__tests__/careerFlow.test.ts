import { describe, expect, it } from 'vitest';
import {
  applyEquipmentPreset,
  applyToExpeditionOffer,
  closeClimb,
  createCareer,
  schoolExpeditionBoard,
  travelToRegion,
  waitForSchoolDeparture,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { schoolExpeditionPhase } from '../schoolExpeditions';
import { normalizeUiState } from '../uiState';
import type { CareerState, WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'CAREER-FLOW-019', eraId: 'MODERN', startYear: 2025, difficulty: 'CLIMBER' };

describe('complete career navigation and school flow', () => {
  it('moves from school board to retreat, refreshes plans and continues in another region', () => {
    const world = generateWorld(config);
    const organization = getEntryOrganizations(world)[0]!;
    let career = createCareer(world, {
      name: 'Flow Tester',
      age: 22,
      originId: 'CLUB_SCHOOL',
      entryMode: 'ORGANIZATION',
      organizationId: organization.id,
    });

    const offer = schoolExpeditionBoard(world, career)
      .find(item => ['ANNOUNCED', 'RECRUITING'].includes(schoolExpeditionPhase(item, career.seasonDay)))!;
    career = applyToExpeditionOffer(world, career, offer.id);
    career = applyEquipmentPreset(career, 'RECOMMENDED');
    career = waitForSchoolDeparture(world, career);
    expect(career.activeClimb?.expeditionOfferId).toBe(offer.id);

    career = {
      ...career,
      activeClimb: { ...career.activeClimb!, phase: 'RETREATED', retreating: true },
    } as CareerState;
    career = closeClimb(career);
    expect(career.activeClimb).toBeNull();
    expect(career.seasonPlan).toBeTruthy();
    expect(career.resolvedSchoolOfferIds).toContain(offer.id);
    expect(schoolExpeditionBoard(world, career).some(item => item.id === offer.id)).toBe(false);

    const destination = world.ecosystem.content.regions.allIds.find(id => id !== career.currentRegionId)!;
    career = {
      ...career,
      hero: { ...career.hero, money: 50_000, reputation: 100 },
      unlockedRegionIds: [...new Set([...career.unlockedRegionIds, destination])],
    };
    career = travelToRegion(world, career, destination);
    expect(career.currentRegionId).toBe(destination);
    const regionalBoard = schoolExpeditionBoard(world, career, true);
    expect(regionalBoard.length).toBeGreaterThan(2);
    expect(regionalBoard.every(item => world.ecosystem.content.routes.byId[item.routeId]?.regionId === destination)).toBe(true);

    const ui = normalizeUiState({ screen: 'CAREER', careerTab: 'ROUTE', atlasReturnScreen: 'CAREER' }, world, career);
    expect(ui.screen).toBe('CAREER');
    expect(ui.careerTab).toBe('ROUTE');
  });
});
