import { createRng } from './rng';
import type {
  CareerState,
  ClimbMemberState,
  ExpeditionReport,
  MemoryType,
  PersonMemory,
  QualificationClimb,
  RelationshipProfile,
  TeamMember,
} from './types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const goals = [
  'Заслужить право вести собственную связку.',
  'Вернуться домой после каждого выхода.',
  'Пройти первый маршрут лидером.',
  'Стать человеком, которому доверяют спасение.',
  'Добраться до самой высокой вершины региона.',
  'Обойти более известного клубного соперника.',
  'Открыть маршрут, который останется в архиве.',
];

const hiddenIssues = [
  'Старая боль в колене',
  'Плохо восстановившееся обморожение пальцев',
  'Недосып перед выходом',
  'Первые симптомы простуды',
  'Слабая реакция на высоту',
];

function personalityBase(temperament: string) {
  if (temperament === 'Амбициозный') return { caution: 38, ambition: 84, discipline: 61, loyalty: 48, empathy: 42, ego: 73 };
  if (temperament === 'Методичный') return { caution: 72, ambition: 53, discipline: 86, loyalty: 68, empathy: 58, ego: 35 };
  if (temperament === 'Осторожный') return { caution: 88, ambition: 38, discipline: 72, loyalty: 65, empathy: 61, ego: 28 };
  if (temperament === 'Холодный') return { caution: 74, ambition: 45, discipline: 83, loyalty: 57, empathy: 66, ego: 31 };
  return { caution: 67, ambition: 51, discipline: 81, loyalty: 72, empathy: 55, ego: 34 };
}

function jitter(value: number, amount: number, next: () => number) {
  return clamp(Math.round(value + (next() * 2 - 1) * amount));
}

export function enrichTeamMember(member: Partial<TeamMember> & Pick<TeamMember, 'id' | 'name' | 'age' | 'role' | 'specialty' | 'skill' | 'endurance' | 'trust' | 'condition' | 'temperament' | 'note'>, seed: string, index: number, year: number, seasonDay: number): TeamMember {
  const rng = createRng(`${seed}:person:${member.id}:${index}`);
  const base = personalityBase(member.temperament);
  const personality = member.personality ?? {
    caution: jitter(base.caution, 12, () => rng.next()),
    ambition: jitter(base.ambition, 13, () => rng.next()),
    discipline: jitter(base.discipline, 10, () => rng.next()),
    loyalty: jitter(base.loyalty, 12, () => rng.next()),
    empathy: jitter(base.empathy, 12, () => rng.next()),
    ego: jitter(base.ego, 13, () => rng.next()),
  };
  const relationship: RelationshipProfile = member.relationship ?? {
    trust: member.trust,
    respect: clamp(member.trust - 8 + rng.int(-5, 8)),
    bond: clamp(12 + rng.int(0, 16)),
    rivalry: clamp(personality.ambition * .2 + rng.int(0, 12)),
    resentment: 0,
    debt: 0,
  };
  const firstMemory: PersonMemory = {
    id: `memory-${member.id}-first`,
    year,
    seasonDay,
    type: 'FIRST_MEETING',
    title: 'Первый сезон вместе',
    description: `Знакомство в клубе. Первое отношение к тебе ещё строится на репутации инструктора и общей работе.`,
    trustDelta: 0,
    respectDelta: 0,
    resentmentDelta: 0,
  };
  return {
    ...member,
    required: member.required,
    morale: member.morale ?? rng.int(68, 91),
    status: member.status ?? 'ACTIVE',
    injuries: member.injuries ?? [],
    hiddenIssue: member.hiddenIssue ?? (rng.chance(.18) ? rng.pick(hiddenIssues) : null),
    personalGoal: member.personalGoal ?? rng.pick(goals),
    personality,
    relationship: { ...relationship, trust: clamp(relationship.trust) },
    memories: member.memories?.length ? member.memories : [firstMemory],
    sharedClimbs: member.sharedClimbs ?? 0,
    summits: member.summits ?? 0,
    rescues: member.rescues ?? 0,
    refusals: member.refusals ?? 0,
    availability: member.availability ?? 100,
    trust: clamp(relationship.trust),
  } as TeamMember;
}

export function enrichRoster(roster: TeamMember[], seed: string, year: number, seasonDay: number) {
  return roster.map((member, index) => enrichTeamMember(member, seed, index, year, seasonDay));
}

export function createClimbTeamStates(team: TeamMember[]): ClimbMemberState[] {
  return team.map(member => ({
    memberId: member.id,
    condition: member.condition,
    fatigue: Math.max(0, 100 - member.condition) * .25,
    morale: member.morale,
    status: 'ACTIVE',
    visibleInjury: null,
    hiddenInjury: member.hiddenIssue,
    summitReached: false,
    refusedOrders: 0,
    helperForMemberId: null,
  }));
}

export function memory(
  member: TeamMember,
  career: Pick<CareerState, 'year' | 'seasonDay'>,
  type: MemoryType,
  title: string,
  description: string,
  trustDelta: number,
  respectDelta: number,
  resentmentDelta: number,
): TeamMember {
  const record: PersonMemory = {
    id: `memory-${member.id}-${career.year}-${career.seasonDay}-${member.memories.length + 1}`,
    year: career.year,
    seasonDay: career.seasonDay,
    type,
    title,
    description,
    trustDelta,
    respectDelta,
    resentmentDelta,
  };
  const relationship = {
    ...member.relationship,
    trust: clamp(member.relationship.trust + trustDelta),
    respect: clamp(member.relationship.respect + respectDelta),
    resentment: clamp(member.relationship.resentment + resentmentDelta),
    bond: clamp(member.relationship.bond + Math.max(0, trustDelta + respectDelta) * .3),
  };
  return { ...member, trust: relationship.trust, relationship, memories: [...member.memories, record] };
}

export function memberById(career: CareerState, id: string) {
  return career.teamRoster.find(member => member.id === id);
}

export function teamAverage(states: ClimbMemberState[]) {
  const active = states.filter(state => state.status === 'ACTIVE');
  if (!active.length) return 0;
  return Math.round(active.reduce((sum, state) => sum + state.condition, 0) / active.length);
}

export function finalizeRosterAfterClimb(career: CareerState, climb: QualificationClimb, successful: boolean): TeamMember[] {
  const participantIds = new Set(climb.teamMemberIds);
  return career.teamRoster.map(member => {
    if (!participantIds.has(member.id)) return member;
    const state = climb.teamStates.find(item => item.memberId === member.id);
    if (!state) return member;
    let next: TeamMember = {
      ...member,
      sharedClimbs: member.sharedClimbs + 1,
      summits: member.summits + (state.summitReached ? 1 : 0),
      condition: clamp(Math.min(member.condition, state.condition + 12)),
      morale: clamp(state.morale),
      hiddenIssue: state.hiddenInjury && state.visibleInjury ? null : state.hiddenInjury,
      injuries: state.visibleInjury ? [...member.injuries, state.visibleInjury] : member.injuries,
      status: state.status === 'DEAD' ? 'DEAD' : state.visibleInjury && state.condition < 55 ? 'INJURED' : member.status,
      availability: state.status === 'DEAD' ? 0 : clamp(state.condition),
    };
    if (state.status === 'DEAD') {
      next = memory(next, career, 'LOSS', 'Последний маршрут', `Погиб на ${climb.mountainName}, маршрут «${climb.routeName}».`, 0, 0, 0);
      return next;
    }
    if (state.status === 'TURNED_BACK') {
      next = memory(next, career, 'RETREAT', 'Развёрнут на маршруте', 'Ты приказал ему прекратить подъём и вернуться вниз.', member.personality.caution > 60 ? 5 : -6, member.personality.caution > 60 ? 3 : -4, member.personality.ambition > 65 ? 8 : 0);
    } else if (successful) {
      next = memory(next, career, 'SUMMIT', 'Общая вершина', `Вы вместе прошли «${climb.routeName}» и вернулись вниз.`, 5, 7, -1);
    } else {
      next = memory(next, career, 'RETREAT', 'Общий отход', 'Группа вернулась без вершины. Решение осталось частью вашей общей истории.', member.personality.caution > 55 ? 3 : -2, 2, member.personality.ambition > 70 ? 4 : 0);
    }
    return next;
  });
}

export function buildExpeditionReport(career: CareerState, climb: QualificationClimb, reputationDelta: number, moneyDelta: number): ExpeditionReport {
  const outcome: ExpeditionReport['outcome'] = climb.summitReached && !climb.retreating ? 'SUMMIT' : climb.phase === 'FAILED' ? 'FAILED' : 'RETREAT';
  const casualtyNames = climb.casualties.map(id => memberById(career, id)?.name ?? id);
  const clubReaction = casualtyNames.length
    ? `Клуб требует полный разбор решений. Погибли: ${casualtyNames.join(', ')}.`
    : outcome === 'SUMMIT'
      ? 'Клуб признаёт восхождение и отмечает полный возврат группы.'
      : outcome === 'RETREAT'
        ? 'Инструкторы разбирают отход как часть подготовки, а не как провал.'
        : 'Выход закрыт аварийным отчётом. Следующая экспедиция будет доступна после восстановления.';
  const pressReaction = outcome === 'SUMMIT'
    ? `Местная спортивная хроника отмечает маршрут «${climb.routeName}» и состояние команды после спуска.`
    : casualtyNames.length
      ? 'Газеты пишут о трагедии и спорят, стоило ли группе продолжать движение.'
      : 'Результат почти не выходит за пределы клубного архива.';
  return {
    id: `report-${climb.id}`,
    year: career.year,
    seasonDay: career.seasonDay,
    mountainName: climb.mountainName,
    routeName: climb.routeName,
    outcome,
    highestElevation: climb.summitReached ? climb.summitElevation : climb.currentElevation,
    elapsedMinutes: climb.elapsedMinutes,
    teamMemberIds: climb.teamMemberIds,
    casualties: casualtyNames,
    injuries: climb.injuries,
    decisions: climb.decisions,
    clubReaction,
    pressReaction,
    reputationDelta,
    moneyDelta,
    routeChoices: climb.routeChoices,
    fixedRopes: climb.fixedRopeSegmentIds.length,
    cachesRecovered: climb.caches.filter(item => item.recovered).length,
  };
}
