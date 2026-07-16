import { describe, expect, it } from 'vitest';
import { applyTraining, createCareer } from '../career';
import { advanceCareerStories, resolveCareerStory } from '../careerStories';
import { getEntryOrganizations } from '../ecosystem';
import { generateWorld } from '../generator';
import type { CareerState } from '../types';

function fixture() {
  const world = generateWorld({ seed: 'STORY-025', eraId: 'EXPEDITION', startYear: 1972, difficulty: 'CLIMBER' });
  const organization = getEntryOrganizations(world)[0]!;
  const career = createCareer(world, { name: 'Story Tester', age: 22, originId: 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: organization.id });
  return { world, career };
}

describe('career stories', () => {
  it('creates a persistent rare decision and does not stack another while it is open', () => {
    const { career } = fixture();
    const withStory = advanceCareerStories(career, true);
    const open = withStory.storyState.events.filter(event => event.status === 'OPEN');
    expect(open).toHaveLength(1);
    const advanced = applyTraining(withStory, 'MAP_ROOM');
    expect(advanced.storyState.events.filter(event => event.status === 'OPEN')).toHaveLength(1);
  });

  it('resolves a team decision into relationship memory and permanent composition', () => {
    const { career } = fixture();
    const candidate = career.teamRoster.find(member => !member.isMentor)!;
    const prepared: CareerState = {
      ...career,
      permanentTeam: { ...career.permanentTeam, memberIds: [] },
      teamRoster: career.teamRoster.map(member => member.id === candidate.id ? { ...member, relationship: { ...member.relationship, trust: 80, respect: 75 }, trust: 80 } : member),
      storyState: { ...career.storyState, events: [], arcs: [], lastProcessedDay: 0 },
    };
    let withStory = prepared;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      withStory = advanceCareerStories({ ...withStory, seasonDay: Math.min(170, withStory.seasonDay + 11), storyState: { ...withStory.storyState, events: withStory.storyState.events.filter(event => event.status !== 'OPEN') } }, true);
      const teamEvent = [...withStory.storyState.events].reverse().find(event => event.kind === 'TEAM' && event.status === 'OPEN');
      if (teamEvent) {
        const resolved = resolveCareerStory(withStory, teamEvent.id, 'TEAM_INVITE');
        expect(resolved.permanentTeam.memberIds).toContain(teamEvent.npcIds[0]);
        expect(resolved.teamRoster.find(member => member.id === teamEvent.npcIds[0])?.memories.at(-1)?.title).toBe('Принят в постоянную связку');
        return;
      }
    }
    throw new Error('Team story was not generated');
  });

  it('turns an accepted mentor invitation into a real scheduled expedition offer', () => {
    const { career } = fixture();
    const invited: CareerState = { ...career, hero: { ...career.hero, reputation: 35 }, storyState: { ...career.storyState, events: [], arcs: [], lastProcessedDay: 0 } };
    let state = invited;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      state = advanceCareerStories({ ...state, seasonDay: Math.min(170, state.seasonDay + 11), storyState: { ...state.storyState, events: state.storyState.events.filter(event => event.status !== 'OPEN') } }, true);
      const invitation = [...state.storyState.events].reverse().find(event => event.kind === 'INVITATION' && event.status === 'OPEN');
      if (invitation) {
        const accepted = resolveCareerStory(state, invitation.id, 'INVITE_ACCEPT');
        expect(accepted.acceptedOffer?.id).toContain('story-offer-');
        expect(accepted.expeditionPlan.routeId).toBe(invitation.routeId);
        expect(accepted.acceptedOffer?.departureDay).toBeGreaterThan(accepted.seasonDay);
        return;
      }
    }
    throw new Error('Invitation story was not generated');
  });
});
