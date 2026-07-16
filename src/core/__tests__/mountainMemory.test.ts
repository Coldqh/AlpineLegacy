import { describe, expect, it } from 'vitest';
import {
  acceptExpeditionOffer,
  availableExpeditionOffers,
  closeClimb,
  createCareer,
  getSelectedRoute,
  startPlannedClimb,
} from '../career';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import { buildMountainMemory } from '../mountainMemory';
import { autoplayExpedition } from '../playtest';
import type { WorldSeedConfig } from '../types';

const config: WorldSeedConfig = { seed: 'ALPINE-MEMORY', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' };

function organizationCareer() {
  const world = generateWorld(config);
  const organization = getEntryOrganizations(world)[0]!;
  let career = createCareer(world, { name: 'Memory Climber', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  const offer = availableExpeditionOffers(world, career)[0]!;
  career = acceptExpeditionOffer(world, career, offer.id);
  return { world, career };
}

describe('mountain memory', () => {
  it('shows unknown mountains as empty history', () => {
    const { career } = organizationCareer();
    const snapshot = buildMountainMemory(career, 'unknown-mountain');
    expect(snapshot.mountainId).toBe('unknown-mountain');
    expect(snapshot.attempts).toBe(0);
    expect(snapshot.signs[0]).toContain('Подтверждённых');
  });

  it('reflects a finished expedition in mountain history', () => {
    let { career } = organizationCareer();
    const mountainId = getSelectedRoute(career).mountainId;
    career = startPlannedClimb(career);
    career = autoplayExpedition(career);
    career = closeClimb(career);
    const snapshot = buildMountainMemory(career, mountainId);
    expect(snapshot.attempts).toBeGreaterThanOrEqual(1);
    expect(snapshot.stories.length).toBeGreaterThan(0);
    expect(snapshot.firstAscentLabel.length).toBeGreaterThan(0);
  });
});
