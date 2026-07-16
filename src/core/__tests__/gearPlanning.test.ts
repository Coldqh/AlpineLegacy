import { describe, expect, it } from 'vitest';
import { analyzeRouteEquipment, ROPE_BUNDLE_METERS } from '../gearPlanning';
import { applyEquipmentPreset, createCareer, expeditionWeight, getSelectedRoute, setGearQuantity, updateExpeditionPlan } from '../career';
import { generateWorld } from '../generator';

function careerFixture() {
  const world = generateWorld({ seed: 'GEAR-PLANNING-022', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
  return createCareer(world, { name: 'Gear Tester', age: 22, originId: 'CLUB_SCHOOL', entryMode: 'INDEPENDENT', organizationId: null });
}

describe('route equipment planning', () => {
  it('derives rope meters only from fixed 50 metre bundles', () => {
    let career = careerFixture();
    career = setGearQuantity(career, 'rope', 2);
    expect(career.expeditionPlan.gear.rope).toBe(2);
    expect(career.expeditionPlan.ropeMeters).toBe(2 * ROPE_BUNDLE_METERS);

    career = updateExpeditionPlan(career, { ropeMeters: 70 });
    expect(career.expeditionPlan.gear.rope).toBe(2);
    expect(career.expeditionPlan.ropeMeters).toBe(100);
  });

  it('calculates route-specific rope, shelter and supply requirements', () => {
    const career = careerFixture();
    const route = getSelectedRoute(career);
    const analysis = analyzeRouteEquipment(route, career.expeditionPlan, 4);
    expect(analysis.plannedRopeMeters).toBe((career.expeditionPlan.gear.rope ?? 0) * 50);
    expect(analysis.recommendedRopeMeters).toBeGreaterThanOrEqual(analysis.minimumRopeMeters);
    expect(analysis.recommendedFoodDays).toBeGreaterThanOrEqual(analysis.minimumFoodDays);
    expect(analysis.needs['rock-kit']).toBeDefined();
    expect(analysis.needs['ice-kit']).toBeDefined();
  });

  it('recommended preset satisfies all hard route requirements', () => {
    let career = careerFixture();
    career = applyEquipmentPreset(career, 'RECOMMENDED');
    const analysis = analyzeRouteEquipment(getSelectedRoute(career), career.expeditionPlan, 1);
    expect(Object.values(analysis.needs).every(item => item.current >= item.minimum)).toBe(true);
    expect(career.expeditionPlan.foodDays).toBeGreaterThanOrEqual(analysis.minimumFoodDays);
    expect(career.expeditionPlan.fuelUnits).toBeGreaterThanOrEqual(analysis.minimumFuelUnits);
  });

  it('does not count rope weight twice', () => {
    let career = careerFixture();
    career = setGearQuantity(career, 'rope', 1);
    const oneBundle = expeditionWeight(career);
    career = setGearQuantity(career, 'rope', 2);
    const twoBundles = expeditionWeight(career);
    expect(twoBundles).toBeGreaterThan(oneBundle);
    expect(twoBundles - oneBundle).toBeLessThan(5);
  });
});
