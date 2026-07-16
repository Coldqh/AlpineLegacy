import { createRng } from './rng';
import { memory } from './people';
import type {
  CareerState,
  CareerStoryArc,
  CareerStoryEvent,
  CareerStoryKind,
  CareerStoryState,
  ExpeditionOffer,
  ExpeditionRank,
  NpcId,
  RouteId,
  TeamMember,
  WorldAthlete,
} from './types';

const MAX_EVENTS = 80;
const STORY_INTERVAL_DAYS = 10;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function dayNumber(year: number, seasonDay: number) {
  return year * 180 + seasonDay;
}

function storyDateDistance(state: CareerStoryState, career: CareerState) {
  return dayNumber(career.year, career.seasonDay) - dayNumber(state.lastProcessedYear, state.lastProcessedDay);
}

function activeAthletes(career: CareerState) {
  return career.livingWorld.athletes.filter(person => person.status === 'ACTIVE' && person.recoveryDays === 0 && person.condition >= 48);
}

function chooseRivals(career: CareerState) {
  const roster = new Set(career.teamRoster.map(member => member.id));
  return activeAthletes(career)
    .filter(person => !roster.has(person.id))
    .sort((a, b) => (b.fame + b.rivalry + b.ambition * .3) - (a.fame + a.rivalry + a.ambition * .3))
    .slice(0, 5)
    .map(person => person.id);
}

function chooseMentors(career: CareerState) {
  return career.teamRoster.filter(member => member.isMentor && member.status === 'ACTIVE').map(member => member.id);
}

function initialTeamLegacyName(career: CareerState) {
  const current = career.permanentTeam.name?.trim();
  if (current && !current.endsWith('· связка')) return current;
  const surname = career.hero.name.trim().split(/\s+/).at(-1) || career.hero.name;
  return `Связка ${surname}`;
}

export function createCareerStoryState(career: Pick<CareerState, 'year' | 'seasonDay' | 'teamRoster' | 'livingWorld' | 'permanentTeam' | 'hero'>): CareerStoryState {
  return {
    version: 1,
    lastProcessedYear: career.year,
    lastProcessedDay: Math.max(0, career.seasonDay - STORY_INTERVAL_DAYS),
    events: [],
    arcs: [],
    rivalNpcIds: chooseRivals(career as CareerState),
    mentorNpcIds: chooseMentors(career as CareerState),
    teamLegacyName: initialTeamLegacyName(career as CareerState),
    teamReputation: clamp(career.permanentTeam.cohesion * .35 + career.permanentTeam.summits * 8 + career.hero.reputation * .35),
    unreadCount: 0,
  };
}

export function hydrateCareerStoryState(career: CareerState, saved?: Partial<CareerStoryState> | null): CareerStoryState {
  const fresh = createCareerStoryState(career);
  if (!saved) return fresh;
  const validEvents = Array.isArray(saved.events) ? saved.events.filter(event => Boolean(event?.id && event?.title)) : [];
  const validArcs = Array.isArray(saved.arcs) ? saved.arcs.filter(arc => Boolean(arc?.id && arc?.kind)) : [];
  return {
    ...fresh,
    ...saved,
    version: 1,
    events: validEvents.slice(-MAX_EVENTS),
    arcs: validArcs,
    rivalNpcIds: [...new Set([...(saved.rivalNpcIds ?? []), ...fresh.rivalNpcIds])].slice(0, 6),
    mentorNpcIds: [...new Set([...(saved.mentorNpcIds ?? []), ...fresh.mentorNpcIds])],
    teamLegacyName: saved.teamLegacyName?.trim() || fresh.teamLegacyName,
    teamReputation: clamp(saved.teamReputation ?? fresh.teamReputation),
    unreadCount: Math.max(0, Math.round(saved.unreadCount ?? 0)),
  };
}

function personName(career: CareerState, id: string) {
  return career.teamRoster.find(member => member.id === id)?.name
    ?? career.livingWorld.athletes.find(person => person.id === id)?.name
    ?? 'Неизвестный альпинист';
}

function routeCandidate(career: CareerState, hard = false) {
  const routes = career.routes
    .filter(route => route.regionId === career.currentRegionId)
    .sort((a, b) => (a.technicality + a.objectiveRisk) - (b.technicality + b.objectiveRisk));
  if (!routes.length) return career.routes[0] ?? null;
  if (hard) return routes[Math.max(0, Math.floor(routes.length * .72))] ?? routes.at(-1)!;
  return routes[Math.max(0, Math.floor(routes.length * .42))] ?? routes[0]!;
}

function arcFor(state: CareerStoryState, kind: CareerStoryKind, npcIds: NpcId[]) {
  const key = `${kind}:${[...npcIds].sort().join(':') || 'career'}`;
  return state.arcs.find(arc => arc.id === key) ?? null;
}

function nextArc(state: CareerStoryState, kind: CareerStoryKind, title: string, npcIds: NpcId[], eventId: string) {
  const id = `${kind}:${[...npcIds].sort().join(':') || 'career'}`;
  const existing = state.arcs.find(arc => arc.id === id);
  const stage = existing?.stage ?? 0;
  const arc: CareerStoryArc = {
    id,
    kind,
    title,
    npcIds,
    stage,
    status: existing?.status ?? 'ACTIVE',
    lastEventId: eventId,
  };
  return { arc, stage };
}

function eventId(career: CareerState, kind: CareerStoryKind, serial: number) {
  return `story-${kind.toLowerCase()}-${career.year}-${career.seasonDay}-${serial}`;
}

function buildTeamEvent(career: CareerState, state: CareerStoryState, member: TeamMember, serial: number): CareerStoryEvent {
  const id = eventId(career, 'TEAM', serial);
  const { arc, stage } = nextArc(state, 'TEAM', `Связка и ${member.name}`, [member.id], id);
  const repeat = stage > 0;
  return {
    id,
    arcId: arc.id,
    stage,
    kind: 'TEAM',
    title: repeat ? `${member.name} хочет ясного места в связке` : `${member.name} просится в постоянный состав`,
    summary: repeat
      ? 'После нескольких совместных выходов человек не хочет оставаться запасным вариантом.'
      : 'Он готов строить сезон вокруг твоих целей, но ждёт нормального решения, а не обещаний.',
    detail: `${member.name}: доверие ${Math.round(member.relationship.trust)}, уважение ${Math.round(member.relationship.respect)}, общих выходов ${member.sharedClimbs}. Постоянный состав повышает слаженность, но человек будет ждать места в планах сезона.`,
    year: career.year,
    seasonDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 14),
    npcIds: [member.id],
    routeId: null,
    mountainId: null,
    choices: [
      { id: 'TEAM_INVITE', title: 'Взять в связку', detail: 'Добавить в постоянный состав и поднять слаженность.' },
      { id: 'TEAM_ROTATE', title: 'Оставить в ротации', detail: 'Не обещать постоянного места, но сохранить рабочие отношения.' },
      { id: 'TEAM_DECLINE', title: 'Отказать', detail: 'Освободить место, но человек это запомнит.' },
    ],
    status: 'OPEN',
    resolvedChoiceId: null,
    outcome: null,
    importance: 58,
  };
}

function buildMentorEvent(career: CareerState, state: CareerStoryState, mentor: TeamMember, serial: number): CareerStoryEvent {
  const id = eventId(career, 'MENTOR', serial);
  const existing = arcFor(state, 'MENTOR', [mentor.id]);
  const stage = existing?.stage ?? 0;
  const route = routeCandidate(career, stage >= 1);
  const titles = [
    `${mentor.name} проверяет, как ты держишь группу`,
    `${mentor.name} предлагает вести часть подготовки`,
    `${mentor.name} готов отдать тебе руководство`,
  ];
  return {
    id,
    arcId: `MENTOR:${mentor.id}`,
    stage,
    kind: 'MENTOR',
    title: titles[Math.min(stage, titles.length - 1)]!,
    summary: stage >= 2
      ? 'Наставник больше не хочет принимать решения за тебя. Он смотрит, готов ли ты отвечать за людей.'
      : 'Это не повышение по бумаге. Инструктор проверяет, что ты сделаешь с реальной ответственностью.',
    detail: route ? `Проверка связана с целью «${route.mountainName} · ${route.name}». Твой ответ изменит доверие наставника и скорость роста лидерского статуса.` : mentor.note,
    year: career.year,
    seasonDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 12),
    npcIds: [mentor.id],
    routeId: route?.id ?? null,
    mountainId: route?.mountainId ?? null,
    choices: [
      { id: 'MENTOR_LEAD', title: 'Взять ответственность', detail: 'Быстрее растёт лидерство, но ошибки ударят по репутации.' },
      { id: 'MENTOR_SHARE', title: 'Разделить руководство', detail: 'Медленнее, зато безопаснее для отношений и группы.' },
      { id: 'MENTOR_SPECIALIST', title: 'Остаться специалистом', detail: 'Не брать командование сейчас.' },
    ],
    status: 'OPEN',
    resolvedChoiceId: null,
    outcome: null,
    importance: 72,
  };
}

function buildRivalEvent(career: CareerState, state: CareerStoryState, rival: WorldAthlete, serial: number): CareerStoryEvent {
  const id = eventId(career, 'RIVALRY', serial);
  const existing = arcFor(state, 'RIVALRY', [rival.id]);
  const stage = existing?.stage ?? 0;
  const route = routeCandidate(career, stage >= 1 || rival.ambition > 65);
  const title = stage === 0
    ? `${rival.name} заметил твои результаты`
    : stage === 1
      ? `${rival.name} выбрал ту же цель`
      : `Гонка за маршрут с ${rival.name}`;
  return {
    id,
    arcId: `RIVALRY:${rival.id}`,
    stage,
    kind: 'RIVALRY',
    title,
    summary: stage === 0
      ? 'Пока это не вражда. Просто сильный человек начал следить за твоими выходами.'
      : `Оба смотрят на ${route?.mountainName ?? 'одну цель'}. Следующий результат изменит расклад между вами.`,
    detail: `${rival.name}: известность ${rival.fame}, амбиции ${rival.ambition}, вершин ${rival.summits}. ${rival.relationshipNote}`,
    year: career.year,
    seasonDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 16),
    npcIds: [rival.id],
    routeId: route?.id ?? null,
    mountainId: route?.mountainId ?? null,
    choices: [
      { id: 'RIVAL_CHALLENGE', title: 'Принять гонку', detail: 'Репутация и соперничество растут. Цель отмечается в плане.' },
      { id: 'RIVAL_RESPECT', title: 'Ответить с уважением', detail: 'Соперничество остаётся сильным, но без личной вражды.' },
      { id: 'RIVAL_IGNORE', title: 'Не реагировать', detail: 'Сохранить свободу планов, но отдать сопернику публичную инициативу.' },
    ],
    status: 'OPEN',
    resolvedChoiceId: null,
    outcome: null,
    importance: 64,
  };
}

function buildInvitationEvent(career: CareerState, state: CareerStoryState, mentor: TeamMember, serial: number): CareerStoryEvent {
  const id = eventId(career, 'INVITATION', serial);
  const route = routeCandidate(career, mentor.routePreference === 'HARD' || career.hero.reputation >= 35);
  const existing = arcFor(state, 'INVITATION', [mentor.id]);
  const stage = existing?.stage ?? 0;
  return {
    id,
    arcId: `INVITATION:${mentor.id}`,
    stage,
    kind: 'INVITATION',
    title: `${mentor.name} зовёт тебя в отдельную экспедицию`,
    summary: 'Место не висит на общей доске. Инструктор предлагает его лично, потому что видел твои прошлые решения.',
    detail: route ? `${route.mountainName} · ${route.name}. Выход планируется через восемь дней. Состав соберут вокруг навыков маршрута.` : 'Маршрут будет выбран после ответа.',
    year: career.year,
    seasonDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 7),
    npcIds: [mentor.id],
    routeId: route?.id ?? null,
    mountainId: route?.mountainId ?? null,
    choices: [
      { id: 'INVITE_ACCEPT', title: 'Принять место', detail: 'План сразу появится в подготовке как личное приглашение.' },
      { id: 'INVITE_DELAY', title: 'Попросить время', detail: 'Не сжигать отношения, но место могут отдать другому.' },
      { id: 'INVITE_DECLINE', title: 'Отказаться', detail: 'Сохранить свой сезонный план.' },
    ],
    status: 'OPEN',
    resolvedChoiceId: null,
    outcome: null,
    importance: 78,
  };
}

function buildClubEvent(career: CareerState, state: CareerStoryState, mentors: TeamMember[], serial: number): CareerStoryEvent {
  const first = mentors[0]!;
  const second = mentors[1]!;
  const id = eventId(career, 'CLUB', serial);
  const existing = arcFor(state, 'CLUB', [first.id, second.id]);
  const stage = existing?.stage ?? 0;
  return {
    id,
    arcId: `CLUB:${[first.id, second.id].sort().join(':')}`,
    stage,
    kind: 'CLUB',
    title: `${first.name} и ${second.name} спорят о сезоне`,
    summary: 'Один хочет сохранить людей для надёжных маршрутов. Другой требует сложной цели, пока команда в форме.',
    detail: `${first.name} предпочитает ${first.routePreference === 'EASY' ? 'учебные и безопасные линии' : first.routePreference === 'HARD' ? 'жёсткие технические цели' : 'сбалансированный сезон'}. ${second.name} держится другой логики. Твоё решение изменит риск-политику команды.`,
    year: career.year,
    seasonDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 10),
    npcIds: [first.id, second.id],
    routeId: null,
    mountainId: null,
    choices: [
      { id: 'CLUB_SAFE', title: 'Поддержать осторожный план', detail: 'Меньше риск, выше надёжность и доверие осторожных участников.' },
      { id: 'CLUB_BOLD', title: 'Выбрать тяжёлую цель', detail: 'Выше престиж и нагрузка на состав.' },
      { id: 'CLUB_MEDIATE', title: 'Разделить сезон', detail: 'Сначала подготовительный маршрут, потом серьёзная цель.' },
    ],
    status: 'OPEN',
    resolvedChoiceId: null,
    outcome: null,
    importance: 60,
  };
}

function appendEvent(state: CareerStoryState, event: CareerStoryEvent) {
  const existing = state.arcs.find(arc => arc.id === event.arcId);
  const arc: CareerStoryArc = {
    id: event.arcId,
    kind: event.kind,
    title: event.title,
    npcIds: event.npcIds,
    stage: existing?.stage ?? event.stage,
    status: existing?.status ?? 'ACTIVE',
    lastEventId: event.id,
  };
  return {
    ...state,
    events: [...state.events, event].slice(-MAX_EVENTS),
    arcs: [...state.arcs.filter(item => item.id !== arc.id), arc],
    unreadCount: state.unreadCount + 1,
  };
}

function expireEvents(career: CareerState, state: CareerStoryState) {
  let changed = false;
  const events = state.events.map(event => {
    if (event.status !== 'OPEN' || event.expiresOnDay === null || event.year !== career.year || career.seasonDay <= event.expiresOnDay) return event;
    changed = true;
    return { ...event, status: 'EXPIRED' as const, outcome: 'Решение не принято вовремя. Возможность закрылась сама.' };
  });
  return changed ? { ...state, events } : state;
}

function transferChronicles(career: CareerState, state: CareerStoryState) {
  let next = state;
  const transferred = career.livingWorld.athletes.filter(person => /переш[её]л|сменил клуб/i.test(person.lastEvent));
  for (const person of transferred) {
    const key = `transfer:${person.id}:${person.clubId}:${person.lastEvent}`;
    if (next.events.some(event => event.id === key)) continue;
    const event: CareerStoryEvent = {
      id: key,
      arcId: `TRANSFER:${person.id}`,
      stage: 0,
      kind: 'TRANSFER',
      title: `${person.name} сменил школу`,
      summary: person.lastEvent,
      detail: `${person.relationshipNote} Переход меняет доступные связки и конкуренцию внутри региона.`,
      year: career.year,
      seasonDay: career.seasonDay,
      expiresOnDay: null,
      npcIds: [person.id],
      routeId: null,
      mountainId: null,
      choices: [],
      status: 'RESOLVED',
      resolvedChoiceId: null,
      outcome: 'Переход записан в карьерную хронику.',
      importance: 52,
    };
    next = appendEvent(next, event);
  }
  return next;
}

export function advanceCareerStories(career: CareerState, force = false): CareerState {
  let state = hydrateCareerStoryState(career, career.storyState);
  state = expireEvents(career, state);
  state = transferChronicles(career, state);

  const openDecision = state.events.some(event => event.status === 'OPEN');
  const elapsed = storyDateDistance(state, career);
  if (openDecision || (!force && elapsed < STORY_INTERVAL_DAYS)) {
    return { ...career, storyState: state };
  }

  const rng = createRng(`${career.rootSeed}:career-story:${career.year}:${Math.floor((career.seasonDay - 1) / STORY_INTERVAL_DAYS)}:${career.reports.length}:${state.events.length}`);
  const serial = state.events.length + 1;
  const eligibleMembers = career.teamRoster
    .filter(member => member.status === 'ACTIVE' && !member.isMentor && !career.permanentTeam.memberIds.includes(member.id) && member.availability >= 45)
    .sort((a, b) => (b.relationship.trust + b.relationship.respect + b.sharedClimbs * 8) - (a.relationship.trust + a.relationship.respect + a.sharedClimbs * 8));
  const mentors = career.teamRoster.filter(member => member.isMentor && member.status === 'ACTIVE' && member.availability >= 45);
  const rivals = state.rivalNpcIds
    .map(id => career.livingWorld.athletes.find(person => person.id === id))
    .filter((person): person is WorldAthlete => Boolean(person && person.status === 'ACTIVE'));

  const candidates: Array<() => CareerStoryEvent> = [];
  if (eligibleMembers[0] && eligibleMembers[0].relationship.trust >= 48) candidates.push(() => buildTeamEvent(career, state, eligibleMembers[0]!, serial));
  if (mentors[0] && (force || career.membership.rankPoints >= 16 || career.completedClimbs >= 1)) candidates.push(() => buildMentorEvent(career, state, mentors[0]!, serial));
  if (rivals[0] && (career.hero.reputation >= 4 || career.completedClimbs >= 1)) candidates.push(() => buildRivalEvent(career, state, rivals[0]!, serial));
  if (mentors[0] && career.hero.reputation >= 10 && !career.acceptedOffer && !career.activeClimb) candidates.push(() => buildInvitationEvent(career, state, mentors[rng.int(0, mentors.length - 1)]!, serial));
  if (mentors.length >= 2 && career.seasonDay >= 18) candidates.push(() => buildClubEvent(career, state, mentors.slice(0, 2), serial));

  if (!candidates.length) {
    state = { ...state, lastProcessedYear: career.year, lastProcessedDay: career.seasonDay };
    return { ...career, storyState: state };
  }

  const event = rng.pick(candidates)();
  state = appendEvent({ ...state, lastProcessedYear: career.year, lastProcessedDay: career.seasonDay }, event);
  return { ...career, storyState: state };
}

function updateMemberRelationship(career: CareerState, memberId: string, type: 'LOYALTY' | 'CONFLICT', title: string, description: string, trust: number, respect: number, resentment: number) {
  return career.teamRoster.map(member => member.id === memberId ? memory(member, career, type, title, description, trust, respect, resentment) : member);
}

function rankFromPoints(points: number): ExpeditionRank {
  if (points >= 132) return 'ORGANIZER';
  if (points >= 92) return 'LEADER';
  if (points >= 62) return 'DEPUTY';
  if (points >= 38) return 'ROPE_LEAD';
  if (points >= 20) return 'SPECIALIST';
  if (points >= 8) return 'MEMBER';
  return 'NOVICE';
}

function permissionsForRank(career: CareerState, rank: ExpeditionRank) {
  const command = career.membership.mode === 'INDEPENDENT' || rank === 'LEADER' || rank === 'ORGANIZER';
  return {
    canChooseRoute: command,
    canChooseTeam: rank === 'LEADER' || rank === 'ORGANIZER',
    canIssueOrders: command,
    canOrganize: rank === 'ORGANIZER',
    canStartSolo: career.membership.mode === 'INDEPENDENT',
  };
}

function invitationOffer(career: CareerState, event: CareerStoryEvent): ExpeditionOffer | null {
  const route = career.routes.find(item => item.id === event.routeId);
  const leaderId = event.npcIds[0] ?? null;
  if (!route || !leaderId) return null;
  const crew = career.teamRoster
    .filter(member => member.id !== leaderId && member.status === 'ACTIVE' && member.availability >= 45)
    .sort((a, b) => (b.skills.ENDURANCE + b.skills[route.segments[0]?.skill ?? 'ENDURANCE']) - (a.skills.ENDURANCE + a.skills[route.segments[0]?.skill ?? 'ENDURANCE']))
    .slice(0, Math.max(2, route.recommendedTeamSize - 1))
    .map(member => member.id);
  return {
    id: `story-offer-${event.id}`,
    organizationId: career.membership.organizationId,
    routeId: route.id,
    leaderNpcId: leaderId,
    memberNpcIds: crew,
    playerRole: career.membership.rank === 'NOVICE' ? 'SUPPORT' : career.membership.rank === 'MEMBER' ? 'NAVIGATOR' : 'ROPE_LEAD',
    requiredRank: career.membership.rank,
    authority: 'PARTICIPANT',
    solo: false,
    status: 'ACCEPTED',
    opensOnDay: career.seasonDay,
    expiresOnDay: Math.min(180, career.seasonDay + 18),
    phase: 'PREPARING',
    recruitmentClosesDay: career.seasonDay,
    departureDay: Math.min(180, career.seasonDay + 8),
    expectedReturnDay: Math.min(180, career.seasonDay + 16),
    briefing: `${personName(career, leaderId)} пригласил тебя лично. Состав закрыт, идёт подготовка.`,
    openSlots: 0,
    scheduleStatus: 'ON_TIME',
    preparationProgress: 52,
    planSeries: 0,
  };
}

function storyOutcome(choiceId: string, event: CareerStoryEvent, career: CareerState) {
  const person = event.npcIds[0] ? personName(career, event.npcIds[0]) : 'Команда';
  const outcomes: Record<string, string> = {
    TEAM_INVITE: `${person} принят в постоянную связку. Теперь он ждёт места в серьёзных планах.`,
    TEAM_ROTATE: `${person} остался в ротации без обещания постоянного места.`,
    TEAM_DECLINE: `${person} получил прямой отказ и запомнил его.`,
    MENTOR_LEAD: `${person} передал тебе часть реальной ответственности.`,
    MENTOR_SHARE: `Руководство разделено с ${person}.`,
    MENTOR_SPECIALIST: `Ты отказался от командования и остался в роли специалиста.`,
    RIVAL_CHALLENGE: `Ты публично принял гонку с ${person}.`,
    RIVAL_RESPECT: `Между вами закрепилось жёсткое, но уважительное соперничество.`,
    RIVAL_IGNORE: `Ты не ответил. ${person} забрал публичную инициативу.`,
    INVITE_ACCEPT: `Личное приглашение принято. Экспедиция появилась в подготовке.`,
    INVITE_DELAY: `Ты попросил время. Место пока не закреплено.`,
    INVITE_DECLINE: `Ты отказался и сохранил собственный план сезона.`,
    CLUB_SAFE: `Школа сместила сезон к надёжным маршрутам и восстановлению.`,
    CLUB_BOLD: `Школа выбрала тяжёлую цель и подняла допустимый риск.`,
    CLUB_MEDIATE: `Сезон разделён: подготовительный выход, затем серьёзная цель.`,
  };
  return outcomes[choiceId] ?? 'Решение принято.';
}

export function resolveCareerStory(career: CareerState, eventIdValue: string, choiceId: string): CareerState {
  const state = hydrateCareerStoryState(career, career.storyState);
  const event = state.events.find(item => item.id === eventIdValue);
  if (!event || event.status !== 'OPEN' || !event.choices.some(choice => choice.id === choiceId)) return career;

  let next: CareerState = { ...career, storyState: state };
  const primaryNpcId = event.npcIds[0] ?? null;
  const outcome = storyOutcome(choiceId, event, career);

  if (choiceId === 'TEAM_INVITE' && primaryNpcId) {
    next = {
      ...next,
      permanentTeam: {
        ...next.permanentTeam,
        memberIds: [...new Set([...next.permanentTeam.memberIds, primaryNpcId])].slice(0, 6),
        cohesion: clamp(next.permanentTeam.cohesion + 9),
      },
      teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Принят в постоянную связку', 'Ты дал ему постоянное место в команде и связал будущие планы.', 8, 6, -2),
    };
  } else if (choiceId === 'TEAM_ROTATE' && primaryNpcId) {
    next = { ...next, teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Оставлен в ротации', 'Постоянного места нет, но двери не закрыты.', 1, 1, 1) };
  } else if (choiceId === 'TEAM_DECLINE' && primaryNpcId) {
    next = { ...next, teamRoster: updateMemberRelationship(next, primaryNpcId, 'CONFLICT', 'Отказ в постоянной связке', 'Ты прямо отказал ему в месте в основном составе.', -8, -3, 10) };
  } else if (choiceId === 'MENTOR_LEAD' && primaryNpcId) {
    const rankPoints = next.membership.rankPoints + 12;
    const rank = rankFromPoints(rankPoints);
    next = {
      ...next,
      membership: { ...next.membership, rankPoints, rank, authority: ['LEADER', 'ORGANIZER'].includes(rank) ? 'COMMAND' : next.membership.authority, permissions: permissionsForRank(next, rank) },
      reputationProfile: { ...next.reputationProfile, leadership: clamp(next.reputationProfile.leadership + 7) },
      hero: { ...next.hero, reputation: clamp(next.hero.reputation + 3), morale: clamp(next.hero.morale + 3) },
      teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Принял ответственность', 'Ты не отступил, когда наставник предложил отвечать за группу.', 5, 8, -2),
    };
  } else if (choiceId === 'MENTOR_SHARE' && primaryNpcId) {
    next = {
      ...next,
      membership: { ...next.membership, rankPoints: next.membership.rankPoints + 6 },
      reputationProfile: { ...next.reputationProfile, leadership: clamp(next.reputationProfile.leadership + 4), reliability: clamp(next.reputationProfile.reliability + 3) },
      teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Разделил руководство', 'Ты согласился вести людей, но оставил наставнику право остановить план.', 6, 5, -2),
    };
  } else if (choiceId === 'MENTOR_SPECIALIST' && primaryNpcId) {
    next = { ...next, teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Остался специалистом', 'Ты честно отказался брать руководство раньше готовности.', 1, 2, 0) };
  } else if (choiceId.startsWith('RIVAL_') && primaryNpcId) {
    const rivalryDelta = choiceId === 'RIVAL_CHALLENGE' ? 16 : choiceId === 'RIVAL_RESPECT' ? 8 : -4;
    const route = next.routes.find(item => item.id === event.routeId);
    next = {
      ...next,
      hero: { ...next.hero, reputation: clamp(next.hero.reputation + (choiceId === 'RIVAL_CHALLENGE' ? 3 : choiceId === 'RIVAL_RESPECT' ? 1 : 0)) },
      knownNpcIds: [...new Set([...next.knownNpcIds, primaryNpcId])],
      livingWorld: {
        ...next.livingWorld,
        athletes: next.livingWorld.athletes.map(person => person.id === primaryNpcId ? {
          ...person,
          knownToHero: true,
          rivalry: clamp(person.rivalry + rivalryDelta),
          relationshipNote: outcome,
          currentGoal: choiceId === 'RIVAL_CHALLENGE' && route ? `Обойти тебя на ${route.mountainName}` : person.currentGoal,
        } : person),
      },
      expeditionPlan: choiceId === 'RIVAL_CHALLENGE' && route ? { ...next.expeditionPlan, routeId: route.id } : next.expeditionPlan,
    };
  } else if (choiceId === 'INVITE_ACCEPT') {
    const offer = invitationOffer(next, event);
    if (offer) {
      next = {
        ...next,
        selectedOfferId: offer.id,
        acceptedOffer: offer,
        knownNpcIds: primaryNpcId ? [...new Set([...next.knownNpcIds, primaryNpcId])] : next.knownNpcIds,
        expeditionPlan: {
          ...next.expeditionPlan,
          routeId: offer.routeId,
          offerId: offer.id,
          leaderNpcId: offer.leaderNpcId,
          playerRole: offer.playerRole,
          authorityMode: offer.authority,
          teamMemberIds: [offer.leaderNpcId, ...offer.memberNpcIds].filter((id): id is string => Boolean(id)),
        },
        hero: { ...next.hero, morale: clamp(next.hero.morale + 4), reputation: clamp(next.hero.reputation + 2) },
      };
    }
  } else if (choiceId === 'INVITE_DELAY' && primaryNpcId) {
    next = { ...next, teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Попросил время на решение', 'Ты не отказал, но и не закрепил место.', 0, 0, 0) };
  } else if (choiceId === 'INVITE_DECLINE' && primaryNpcId) {
    next = { ...next, teamRoster: updateMemberRelationship(next, primaryNpcId, 'LOYALTY', 'Отказался от личного приглашения', 'Ты выбрал собственный план сезона.', -2, 1, 1) };
  } else if (choiceId === 'CLUB_SAFE') {
    next = { ...next, seasonPlan: { ...next.seasonPlan, riskPolicy: 'CAUTIOUS' }, reputationProfile: { ...next.reputationProfile, reliability: clamp(next.reputationProfile.reliability + 4), ambition: clamp(next.reputationProfile.ambition - 2) } };
  } else if (choiceId === 'CLUB_BOLD') {
    next = { ...next, seasonPlan: { ...next.seasonPlan, riskPolicy: 'AGGRESSIVE' }, reputationProfile: { ...next.reputationProfile, ambition: clamp(next.reputationProfile.ambition + 5), reliability: clamp(next.reputationProfile.reliability - 1) } };
  } else if (choiceId === 'CLUB_MEDIATE') {
    next = { ...next, seasonPlan: { ...next.seasonPlan, riskPolicy: 'BALANCED', preparationDays: next.seasonPlan.preparationDays + 4 }, reputationProfile: { ...next.reputationProfile, leadership: clamp(next.reputationProfile.leadership + 4), care: clamp(next.reputationProfile.care + 2) } };
  }

  const resolvedEvents = next.storyState.events.map(item => item.id === event.id ? { ...item, status: 'RESOLVED' as const, resolvedChoiceId: choiceId, outcome } : item);
  const resolvedArcs = next.storyState.arcs.map(arc => arc.id === event.arcId ? {
    ...arc,
    stage: arc.stage + 1,
    status: arc.stage >= 2 ? 'COMPLETE' as const : arc.status,
    lastEventId: event.id,
  } : arc);
  const type = event.kind === 'RIVALRY' ? 'PRESS' as const : event.kind === 'CLUB' ? 'CLUB' as const : 'RELATIONSHIP' as const;
  const log = [...next.log, {
    id: `log-story-${event.id}`,
    year: next.year,
    seasonDay: next.seasonDay,
    type,
    title: event.title,
    description: outcome,
  }];
  const news = event.importance >= 70 ? [{
    id: `news-story-${event.id}`,
    year: next.year,
    seasonDay: next.seasonDay,
    type: event.kind === 'RIVALRY' ? 'RIVALRY' as const : 'CLUB' as const,
    headline: event.title,
    summary: outcome,
    athleteIds: [next.hero.id, ...event.npcIds],
    clubIds: [next.club.id],
    mountainId: event.mountainId,
    importance: event.importance,
    isBreaking: false,
  }, ...next.livingWorld.news].slice(0, 160) : next.livingWorld.news;

  return {
    ...next,
    log,
    livingWorld: { ...next.livingWorld, news },
    storyState: {
      ...next.storyState,
      events: resolvedEvents,
      arcs: resolvedArcs,
      teamLegacyName: next.permanentTeam.name || next.storyState.teamLegacyName,
      teamReputation: clamp(next.storyState.teamReputation + (choiceId === 'TEAM_INVITE' ? 8 : event.kind === 'MENTOR' ? 4 : event.kind === 'RIVALRY' ? 3 : 1)),
      unreadCount: Math.max(0, next.storyState.unreadCount - 1),
    },
  };
}

export function markCareerStoriesRead(career: CareerState): CareerState {
  if (!career.storyState.unreadCount) return career;
  return { ...career, storyState: { ...career.storyState, unreadCount: 0 } };
}

export function activeCareerStory(career: CareerState) {
  return [...career.storyState.events].reverse().find(event => event.status === 'OPEN') ?? null;
}

export function careerStoryNpc(career: CareerState, id: string) {
  return career.teamRoster.find(member => member.id === id)
    ?? career.livingWorld.athletes.find(person => person.id === id)
    ?? null;
}
