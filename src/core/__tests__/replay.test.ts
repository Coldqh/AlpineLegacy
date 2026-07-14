import { describe, expect, it } from 'vitest';
import { acceptExpeditionOffer, availableExpeditionOffers, createCareer, resolveExpeditionFieldAction, startPlannedClimb } from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { auditExpeditionReplay, createExpeditionReplay } from '../replay';

function startedCareer() {
  const world = generateWorld({ seed: 'REPLAY-064', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'EXPLORER' });
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Replay Tester', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  career = acceptExpeditionOffer(world, career, availableExpeditionOffers(world, career)[0]!.id);
  career = startPlannedClimb(career);
  career = resolveExpeditionFieldAction(career, 'MOVE_CAUTIOUS').career;
  return career;
}

describe('expedition replay', () => {
  it('exports auditable command history with post-action state', () => {
    const replay = createExpeditionReplay(startedCareer());
    const audit = auditExpeditionReplay(replay);
    expect(replay.version).toBe(2);
    expect(replay.actions.length).toBeGreaterThan(0);
    expect(replay.actions[0]!.energyAfter).toBeTypeOf('number');
    expect(audit.valid).toBe(true);
  });

  it('detects time reversal and invalid state ranges', () => {
    const replay = createExpeditionReplay(startedCareer());
    const broken = structuredClone(replay);
    broken.actions.push({ ...broken.actions[0]!, id: `${broken.actions[0]!.id}:broken`, elapsedMinutes: -1, energyAfter: 130 });
    const audit = auditExpeditionReplay(broken);
    expect(audit.valid).toBe(false);
    expect(audit.errors.length).toBeGreaterThanOrEqual(2);
  });
});
