import { describe, expect, it } from 'vitest';
import { acceptExpeditionOffer, availableExpeditionOffers, createCareer, issueClimbOrder, startPlannedClimb } from '../career';
import { entityTable, getEntryOrganizations, tableValues, validateWorldEcosystem } from '../ecosystem';
import { generateWorld } from '../generator';

const config = { seed: 'FOUNDATION-061', eraId: 'EXPEDITION' as const, startYear: 1968, difficulty: 'CLIMBER' as const };

describe('normalized world ecosystem', () => {
  it('builds validated registries with stable references', () => {
    const world = generateWorld(config);
    const report = validateWorldEcosystem(world.ecosystem);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.stats.regions).toBe(1);
    expect(report.stats.mountains).toBe(world.region.mountains.length);
    expect(report.stats.routes).toBe(world.region.mountains.length * 3);
    expect(report.stats.organizations).toBeGreaterThanOrEqual(5);
    expect(report.stats.npcs).toBeGreaterThanOrEqual(60);
    expect(report.stats.offers).toBeGreaterThanOrEqual(9);
  });

  it('gives every route a reachable graph and a real play-time budget', () => {
    const world = generateWorld(config);
    const routes = world.ecosystem.content.routes.allIds.map(id => world.ecosystem.content.routes.byId[id]!);
    for (const route of routes) {
      expect(route.graph?.nodes.length).toBeGreaterThan(route.segments.length);
      expect(route.expectedPlayMinutes).toBeGreaterThanOrEqual(20);
      expect(route.estimatedDecisionCount).toBeGreaterThanOrEqual(12);
    }
    expect(Math.max(...routes.map(route => route.expectedPlayMinutes ?? 0))).toBeGreaterThanOrEqual(30);
  });

  it('starts an organization career without a private team or command rights', () => {
    const world = generateWorld(config);
    const organization = getEntryOrganizations(world)[0]!;
    const career = createCareer(world, { name: 'Участник', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
    expect(career.membership.rank).toBe('NOVICE');
    expect(career.membership.permissions.canChooseRoute).toBe(false);
    expect(career.membership.permissions.canChooseTeam).toBe(false);
    expect(career.expeditionPlan.teamMemberIds).toEqual([]);
    expect(career.selectedOfferId).toBeNull();
  });

  it('lets a novice join an NPC-led expedition but not command it', () => {
    const world = generateWorld(config);
    const organization = getEntryOrganizations(world)[0]!;
    let career = createCareer(world, { name: 'Участник', age: 20, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
    const offer = availableExpeditionOffers(world, career)[0]!;
    career = acceptExpeditionOffer(world, career, offer.id);
    expect(career.selectedOfferId).toBe(offer.id);
    expect(career.expeditionPlan.leaderNpcId).toBeTruthy();
    expect(career.expeditionPlan.teamMemberIds.length).toBeGreaterThan(0);
    expect(career.expeditionPlan.authorityMode).toBe('PARTICIPANT');
    career = startPlannedClimb(career);
    if (career.activeClimb) {
      const result = issueClimbOrder(career, 'SLOW_DOWN');
      expect(result.headline).toBe('Ты не руководитель');
      expect(result.career.activeClimb?.decisions).toEqual([]);
    }
  });


  it('lets an independent climber join somebody else instead of going solo', () => {
    const world = generateWorld(config);
    let career = createCareer(world, { name: 'Независимый', age: 21, originId: 'HIGHLAND_LOCAL', entryMode: 'INDEPENDENT', organizationId: null });
    const foreignOffer = availableExpeditionOffers(world, career).find(offer => !offer.solo)!;
    expect(foreignOffer).toBeTruthy();
    career = acceptExpeditionOffer(world, career, foreignOffer.id);
    expect(career.expeditionPlan.authorityMode).toBe('PARTICIPANT');
    expect(career.expeditionPlan.leaderNpcId).toBeTruthy();
    expect(career.expeditionPlan.playerRole).not.toBe('LEADER');
  });

  it('keeps constant-time entity lookup with thousands of records', () => {
    const records = Array.from({ length: 5_000 }, (_, index) => ({ id: `npc-scale-${index}`, value: index }));
    const table = entityTable(records);
    expect(table.allIds).toHaveLength(5_000);
    expect(table.byId['npc-scale-4321']?.value).toBe(4321);
  });

  it('keeps content definitions separate from runtime state', () => {
    const world = generateWorld(config);
    const npcId = world.ecosystem.content.npcs.allIds[0]!;
    const definition = world.ecosystem.content.npcs.byId[npcId]!;
    const runtime = world.ecosystem.runtime.npcs.byId[npcId]!;
    expect(definition).not.toHaveProperty('condition');
    expect(runtime).not.toHaveProperty('name');
    expect(runtime.id).toBe(definition.id);
  });
  it('creates three distinct mentors for every organization', () => {
    const world = generateWorld({ seed: 'MENTOR-SCHOOLS', eraId: 'EXPEDITION', startYear: 1968, difficulty: 'CLIMBER' });
    const organizations = tableValues(world.ecosystem.content.organizations);
    for (const organization of organizations) {
      expect(organization.mentorNpcIds).toHaveLength(3);
      const mentors = organization.mentorNpcIds.map(id => world.ecosystem.content.npcs.byId[id]!);
      expect(mentors.every(mentor => mentor.isMentor)).toBe(true);
      expect(new Set(mentors.map(mentor => mentor.routePreference))).toEqual(new Set(['EASY', 'BALANCED', 'HARD']));
      expect(mentors.every(mentor => Object.values(mentor.skills).every(value => value >= 1 && value <= 10))).toBe(true);
    }
  });

});
