import { describe, expect, it } from 'vitest';
import { runBalanceAudit, runEquipmentSensitivityAudit } from '../playtest';

describe('0.26 balance audit', () => {
  it('keeps the three difficulty bands separated across a large deterministic sample', () => {
    const audit = runBalanceAudit('BALANCE-LAB-026', 12);
    const explorer = audit.difficultySummary.find(item => item.difficulty === 'EXPLORER')!;
    const climber = audit.difficultySummary.find(item => item.difficulty === 'CLIMBER')!;
    const expedition = audit.difficultySummary.find(item => item.difficulty === 'EXPEDITION')!;
    expect(audit.totalRuns).toBe(108);
    expect(explorer.successRate).toBeGreaterThanOrEqual(.55);
    expect(explorer.successRate).toBeLessThanOrEqual(.82);
    expect(climber.successRate).toBeGreaterThanOrEqual(.35);
    expect(climber.successRate).toBeLessThanOrEqual(.65);
    expect(expedition.successRate).toBeGreaterThanOrEqual(.15);
    expect(expedition.successRate).toBeLessThanOrEqual(.4);
    expect(explorer.successRate).toBeGreaterThan(climber.successRate);
    expect(climber.successRate).toBeGreaterThan(expedition.successRate);
    expect(audit.warnings).toEqual([]);
  }, 15000);

  it('shows a measurable cost for removing route-critical equipment', () => {
    const equipment = runEquipmentSensitivityAudit('BALANCE-LAB-026-GEAR');
    expect(equipment.ropeRiskReduction).toBeGreaterThanOrEqual(18);
    expect(equipment.noRopeReadiness).toBeLessThanOrEqual(equipment.recommendedReadiness - 20);
    expect(equipment.noShelterReadiness).toBeLessThanOrEqual(equipment.recommendedReadiness - 20);
    expect(equipment.noMedkitReadiness).toBeLessThan(equipment.recommendedReadiness);
    expect(equipment.medkitSeverityReduction).toBeGreaterThanOrEqual(15);
  });
});
