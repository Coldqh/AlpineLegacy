import { GEAR_CATALOG } from './catalog';
import { createRng } from './rng';
import { generateRoutesForWorld, mountainDifficulty } from './routeFactory';
import type {
  CareerMembership,
  ClubData,
  EntityTable,
  ExpeditionOffer,
  ExpeditionRank,
  ExpeditionRoute,
  GearDefinition,
  MountainData,
  MountainRuntimeState,
  NpcDefinition,
  NpcRuntimeState,
  OrganizationDefinition,
  OrganizationKind,
  OrganizationRuntimeState,
  PersonMemory,
  PersonalityProfile,
  RegionData,
  RelationshipProfile,
  SkillId,
  TeamMember,
  TeamRole,
  WorldEcosystem,
  WorldState,
} from './types';

const firstNames = ['Эрик', 'Мира', 'Йонас', 'Ада', 'Павел', 'Симон', 'Лина', 'Клара', 'Маттео', 'Нора', 'Оскар', 'Ида', 'Анри', 'Виктор', 'Рут', 'Леон', 'Софи', 'Марек'];
const lastNames = ['Морель', 'Харт', 'Вейл', 'Краус', 'Роше', 'Берн', 'Соль', 'Дорн', 'Фальк', 'Мерц', 'Восс', 'Келлер', 'Штольц', 'Варден'];
const organizationRoots = ['Северный альпийский клуб', 'Высотное общество', 'Экспедиционный корпус', 'Бюро горных проводников', 'Союз ледовых маршрутов'];
const headquartersA = ['Брайт', 'Лин', 'Валь', 'Керн', 'Обер', 'Сент', 'Норд', 'Рейн'];
const headquartersB = ['хоф', 'брюк', 'дорф', 'вик', 'град', 'фельд', 'мар', 'лен'];
const doctrines = [
  'Возвращение группы важнее личной вершины.',
  'Сначала техника, потом высота.',
  'Решение на подходе определяет весь маршрут.',
  'Каждый участник отвечает за связку.',
  'Скорость допустима только при сохранённом отходе.',
];
const specialties = ['ледниковые экспедиции', 'скальные стены', 'длинные высотные маршруты', 'обучение новичков', 'спасательные работы'];
const goals = ['первая серьёзная вершина', 'новый маршрут', 'зимнее восхождение', 'работа ведущим связки', 'возвращение после травмы', 'место в сильной экспедиции'];
const temperaments = ['Сдержанный', 'Амбициозный', 'Методичный', 'Осторожный', 'Холодный'];
const hiddenIssues = ['Скрывает боль в колене', 'Плохо спал перед выходом', 'Боится открытых гребней', 'Слишком быстро теряет воду', null];
const skillOrder: SkillId[] = ['ENDURANCE', 'ROCK', 'ICE', 'NAVIGATION', 'MEDICINE', 'LEADERSHIP'];
const roleOrder: TeamRole[] = ['LEADER', 'ROPE_LEAD', 'MEDIC', 'NAVIGATOR', 'SUPPORT', 'SUPPORT'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function entityTable<T extends { id: string }>(items: T[]): EntityTable<T> {
  const byId: Record<string, T> = {};
  const allIds: string[] = [];
  for (const item of items) {
    if (byId[item.id]) throw new Error(`Duplicate entity id: ${item.id}`);
    byId[item.id] = item;
    allIds.push(item.id);
  }
  return { byId, allIds };
}

export function tableValues<T extends { id: string }>(table: EntityTable<T>): T[] {
  return table.allIds.map(id => table.byId[id]).filter((item): item is T => Boolean(item));
}

function personality(rng: ReturnType<typeof createRng>, temperament: string): PersonalityProfile {
  const base = temperament === 'Амбициозный'
    ? { caution: 38, ambition: 84, discipline: 61, loyalty: 48, empathy: 42, ego: 73 }
    : temperament === 'Методичный'
      ? { caution: 72, ambition: 53, discipline: 86, loyalty: 68, empathy: 58, ego: 35 }
      : temperament === 'Осторожный'
        ? { caution: 88, ambition: 38, discipline: 72, loyalty: 65, empathy: 61, ego: 28 }
        : temperament === 'Холодный'
          ? { caution: 74, ambition: 45, discipline: 83, loyalty: 57, empathy: 66, ego: 31 }
          : { caution: 67, ambition: 51, discipline: 81, loyalty: 72, empathy: 55, ego: 34 };
  const jitter = (value: number) => clamp(value + rng.int(-9, 9));
  return {
    caution: jitter(base.caution), ambition: jitter(base.ambition), discipline: jitter(base.discipline),
    loyalty: jitter(base.loyalty), empathy: jitter(base.empathy), ego: jitter(base.ego),
  };
}

function relationship(rng: ReturnType<typeof createRng>, trust: number): RelationshipProfile {
  return {
    trust,
    respect: clamp(trust + rng.int(-12, 8)),
    bond: rng.int(8, 28),
    rivalry: rng.int(0, 24),
    resentment: 0,
    debt: 0,
  };
}

function organizationKind(index: number): OrganizationKind {
  if (index < 2) return 'ALPINE_CLUB';
  if (index < 4) return 'EXPEDITION_COMPANY';
  return 'GUIDE_BUREAU';
}

function createOrganizations(world: Pick<WorldState, 'id' | 'config' | 'worldAge' | 'region'>): OrganizationDefinition[] {
  const rng = createRng(`${world.config.seed}:ecosystem:organizations`);
  const region = world.region;
  return Array.from({ length: 5 }, (_, index) => {
    const kind = organizationKind(index);
    const id = `org-${region.id}-${index + 1}`;
    return {
      id,
      regionId: region.id,
      kind,
      name: `${organizationRoots[index]!} «${region.name.split(' ')[0]}»`,
      headquarters: `${rng.pick(headquartersA)}${rng.pick(headquartersB)}`,
      foundedYear: world.config.startYear - rng.int(10, Math.min(88, Math.max(18, world.worldAge - 3))),
      prestige: rng.int(kind === 'EXPEDITION_COMPANY' ? 52 : 34, kind === 'GUIDE_BUREAU' ? 76 : 88),
      doctrine: doctrines[index % doctrines.length]!,
      specialty: specialties[index % specialties.length]!,
      acceptsNovices: index !== 3,
      memberNpcIds: [],
    };
  });
}

function createNpcs(world: Pick<WorldState, 'config' | 'region'>, organizations: OrganizationDefinition[]): NpcDefinition[] {
  const names = new Set<string>();
  const result: NpcDefinition[] = [];
  const perOrganization = 12;
  for (const [organizationIndex, organization] of organizations.entries()) {
    for (let localIndex = 0; localIndex < perOrganization; localIndex += 1) {
      const index = organizationIndex * perOrganization + localIndex;
      const rng = createRng(`${world.config.seed}:ecosystem:npc:${index}`);
      let name = '';
      while (!name || names.has(name)) name = `${rng.pick(firstNames)} ${rng.pick(lastNames)}`;
      names.add(name);
      const role = localIndex === 0 ? 'LEADER' : roleOrder[(localIndex + organizationIndex) % roleOrder.length]!;
      const specialty = role === 'LEADER' ? 'LEADERSHIP' : skillOrder[(localIndex + organizationIndex) % skillOrder.length]!;
      const temperament = rng.pick(temperaments);
      const id = `npc-${organization.id}-${localIndex + 1}`;
      result.push({
        id,
        regionId: world.region.id,
        organizationId: organization.id,
        name,
        birthYear: world.config.startYear - rng.int(role === 'LEADER' ? 36 : 20, role === 'LEADER' ? 58 : 44),
        role,
        specialty,
        skill: rng.int(role === 'LEADER' ? 7 : 4, role === 'LEADER' ? 9 : 8),
        endurance: rng.int(4, 9),
        temperament,
        note: role === 'LEADER' ? organization.doctrine : `${organization.specialty}. ${rng.pick(['Надёжен в плохую погоду.', 'Не любит медленный темп.', 'Силен в технической работе.', 'Хорошо держит высоту.', 'Ставит безопасность выше результата.'])}`,
        personality: personality(rng, temperament),
        personalGoal: rng.pick(goals),
      });
      organization.memberNpcIds.push(id);
    }
  }
  return result;
}

function createNpcRuntime(world: Pick<WorldState, 'config'>, npc: NpcDefinition): NpcRuntimeState {
  const rng = createRng(`${world.config.seed}:ecosystem:npc-state:${npc.id}`);
  const trust = rng.int(28, 58);
  const firstMemory: PersonMemory = {
    id: `memory-${npc.id}-known`,
    year: world.config.startYear,
    seasonDay: 1,
    type: 'FIRST_MEETING',
    title: 'Первое знакомство',
    description: 'Вы знаете друг друга по собранию или общей тренировке. Доверие ещё не заработано.',
    trustDelta: 0,
    respectDelta: 0,
    resentmentDelta: 0,
  };
  return {
    id: npc.id,
    status: 'ACTIVE',
    condition: rng.int(78, 98),
    morale: rng.int(65, 92),
    trust,
    injuries: [],
    hiddenIssue: rng.pick(hiddenIssues),
    availability: rng.int(70, 100),
    relationship: relationship(rng, trust),
    memories: [firstMemory],
    sharedClimbs: 0,
    summits: 0,
    rescues: 0,
    refusals: 0,
  };
}

const rankOrder: ExpeditionRank[] = ['NOVICE', 'MEMBER', 'SPECIALIST', 'ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'];
export function rankAtLeast(actual: ExpeditionRank, required: ExpeditionRank) {
  return rankOrder.indexOf(actual) >= rankOrder.indexOf(required);
}

function createOffers(world: Pick<WorldState, 'config'>, routes: ExpeditionRoute[], organizations: OrganizationDefinition[], npcs: NpcDefinition[]): ExpeditionOffer[] {
  const sortedRoutes = [...routes].sort((a, b) => (a.objectiveRisk + a.technicality) - (b.objectiveRisk + b.technicality));
  const byOrganization = new Map(organizations.map(org => [org.id, npcs.filter(npc => npc.organizationId === org.id)]));
  const offers: ExpeditionOffer[] = [];
  organizations.forEach((organization, organizationIndex) => {
    const members = byOrganization.get(organization.id) ?? [];
    const leader = members.find(npc => npc.role === 'LEADER') ?? members[0] ?? null;
    for (let offerIndex = 0; offerIndex < 2; offerIndex += 1) {
      const route = sortedRoutes[(organizationIndex * 2 + offerIndex) % Math.max(1, Math.min(sortedRoutes.length, 12))]!;
      const crew = members.filter(npc => npc.id !== leader?.id).slice(offerIndex * 3, offerIndex * 3 + Math.max(2, route.recommendedTeamSize - 1));
      offers.push({
        id: `offer-${organization.id}-${offerIndex + 1}`,
        organizationId: organization.id,
        routeId: route.id,
        leaderNpcId: leader?.id ?? null,
        memberNpcIds: crew.map(npc => npc.id),
        playerRole: offerIndex === 0 ? 'SUPPORT' : 'NAVIGATOR',
        requiredRank: offerIndex === 0 ? 'NOVICE' : 'MEMBER',
        authority: 'PARTICIPANT',
        solo: false,
        status: 'OPEN',
        opensOnDay: 1,
        expiresOnDay: 60 + organizationIndex * 7,
      });
    }
  });
  const soloRoute = sortedRoutes.find(route => route.recommendedTeamSize <= 3) ?? sortedRoutes[0]!;
  offers.push({
    id: `offer-independent-solo-${soloRoute.id}`,
    organizationId: null,
    routeId: soloRoute.id,
    leaderNpcId: null,
    memberNpcIds: [],
    playerRole: 'LEADER',
    requiredRank: 'NOVICE',
    authority: 'COMMAND',
    solo: true,
    status: 'OPEN',
    opensOnDay: 1,
    expiresOnDay: 180,
  });
  return offers;
}

function fingerprint(worldId: string, counts: number[]) {
  const value = `${worldId}:${counts.join(':')}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `eco-${(hash >>> 0).toString(16)}`;
}

export function createWorldEcosystem(world: Pick<WorldState, 'id' | 'config' | 'worldAge' | 'region'>, routes = generateRoutesForWorld(world as WorldState)): WorldEcosystem {
  const organizations = createOrganizations(world);
  const npcs = createNpcs(world, organizations);
  const mountains = world.region.mountains.map(mountain => ({
    ...mountain,
    regionId: world.region.id,
    routeIds: routes.filter(route => route.mountainId === mountain.id).map(route => route.id),
  }));
  const region: RegionData = {
    ...world.region,
    mountainIds: mountains.map(mountain => mountain.id),
    organizationIds: organizations.map(organization => organization.id),
    mountains,
  };
  const offers = createOffers(world, routes, organizations, npcs);
  const ecosystem: WorldEcosystem = {
    schemaVersion: 1,
    contentFingerprint: fingerprint(world.id, [1, mountains.length, routes.length, organizations.length, npcs.length]),
    content: {
      version: 1,
      primaryRegionId: region.id,
      regions: entityTable([region]),
      mountains: entityTable(mountains),
      routes: entityTable(routes),
      organizations: entityTable(organizations),
      npcs: entityTable(npcs),
      gear: entityTable(GEAR_CATALOG.map(item => ({ ...item })) as GearDefinition[]),
    },
    runtime: {
      version: 1,
      mountains: entityTable(mountains.map(mountain => ({
        id: mountain.id,
        attempts: 0,
        summits: 0,
        deaths: 0,
        firstAscentYear: null,
        routeAvailability: Object.fromEntries((mountain.routeIds ?? []).map(routeId => [routeId, 'OPEN' as const])),
      } satisfies MountainRuntimeState))),
      organizations: entityTable(organizations.map(organization => ({
        id: organization.id,
        prestige: organization.prestige,
        funds: organization.prestige * 120,
        expeditions: 0,
        summits: 0,
        losses: 0,
      } satisfies OrganizationRuntimeState))),
      npcs: entityTable(npcs.map(npc => createNpcRuntime(world, npc))),
      expeditionOffers: entityTable(offers),
    },
  };
  const report = validateWorldEcosystem(ecosystem);
  if (!report.valid) throw new Error(`Invalid world ecosystem: ${report.errors.join('; ')}`);
  return ecosystem;
}

export function hydrateWorldEcosystem(world: WorldState): WorldState {
  const routes = world.ecosystem?.content?.routes?.allIds?.length
    ? tableValues(world.ecosystem.content.routes)
    : generateRoutesForWorld(world);
  const ecosystem = world.ecosystem?.schemaVersion === 1 ? world.ecosystem : createWorldEcosystem(world, routes);
  const primaryRegion = ecosystem.content.regions.byId[ecosystem.content.primaryRegionId] ?? world.region;
  const mountains = (primaryRegion.mountainIds ?? ecosystem.content.mountains.allIds)
    .map(id => ecosystem.content.mountains.byId[id])
    .filter((item): item is MountainData => Boolean(item));
  return {
    ...world,
    schemaVersion: 2,
    ecosystem,
    region: { ...primaryRegion, mountains },
  };
}

export function getPrimaryRegion(world: WorldState) {
  return world.ecosystem.content.regions.byId[world.ecosystem.content.primaryRegionId] ?? world.region;
}

export function getRegionMountains(world: WorldState, regionId = world.ecosystem.content.primaryRegionId) {
  const region = world.ecosystem.content.regions.byId[regionId];
  if (!region) return [];
  return (region.mountainIds ?? []).map(id => world.ecosystem.content.mountains.byId[id]).filter((item): item is MountainData => Boolean(item));
}

export function getMountain(world: WorldState, mountainId: string) {
  return world.ecosystem.content.mountains.byId[mountainId] ?? null;
}

export function getRoute(world: WorldState, routeId: string) {
  return world.ecosystem.content.routes.byId[routeId] ?? null;
}

export function getRoutesForMountain(world: WorldState, mountainId: string) {
  const mountain = getMountain(world, mountainId);
  return (mountain?.routeIds ?? []).map(id => getRoute(world, id)).filter((item): item is ExpeditionRoute => Boolean(item));
}

export function getOrganizations(world: WorldState) {
  return tableValues(world.ecosystem.content.organizations);
}

export function getEntryOrganizations(world: WorldState) {
  return getOrganizations(world).filter(organization => organization.acceptsNovices);
}

export function getOrganization(world: WorldState, organizationId: string | null) {
  return organizationId ? world.ecosystem.content.organizations.byId[organizationId] ?? null : null;
}

export function organizationToClub(organization: OrganizationDefinition | null, world: WorldState): ClubData {
  const fallback = getEntryOrganizations(world)[0]!;
  const source = organization ?? fallback;
  const mentor = source.memberNpcIds.map(id => world.ecosystem.content.npcs.byId[id]).find(npc => npc?.role === 'LEADER');
  return {
    id: source.id,
    name: source.name,
    town: source.headquarters,
    foundedYear: source.foundedYear,
    standing: source.prestige,
    specialty: source.specialty,
    doctrine: source.doctrine,
    mentorName: mentor?.name ?? 'Старший инструктор',
    mentorTitle: source.kind === 'EXPEDITION_COMPANY' ? 'руководитель экспедиций' : source.kind === 'GUIDE_BUREAU' ? 'старший проводник' : 'старший инструктор',
  };
}

export function materializeNpc(world: WorldState, npcId: string): TeamMember | null {
  const definition = world.ecosystem.content.npcs.byId[npcId];
  const state = world.ecosystem.runtime.npcs.byId[npcId];
  if (!definition || !state) return null;
  return {
    id: definition.id,
    name: definition.name,
    age: Math.max(18, world.config.startYear - definition.birthYear),
    role: definition.role,
    specialty: definition.specialty,
    skill: definition.skill,
    endurance: definition.endurance,
    trust: state.relationship.trust,
    condition: state.condition,
    temperament: definition.temperament,
    note: definition.note,
    morale: state.morale,
    status: state.status,
    injuries: [...state.injuries],
    hiddenIssue: state.hiddenIssue,
    personalGoal: definition.personalGoal,
    personality: { ...definition.personality },
    relationship: { ...state.relationship },
    memories: [...state.memories],
    sharedClimbs: state.sharedClimbs,
    summits: state.summits,
    rescues: state.rescues,
    refusals: state.refusals,
    availability: state.availability,
  };
}

export function rosterForOrganization(world: WorldState, organizationId: string | null) {
  if (!organizationId) {
    return tableValues(world.ecosystem.content.npcs).filter(npc => npc.role !== 'LEADER').slice(0, 4).map(npc => materializeNpc(world, npc.id)!).filter(Boolean);
  }
  const organization = getOrganization(world, organizationId);
  return (organization?.memberNpcIds ?? []).map(id => materializeNpc(world, id)).filter((item): item is TeamMember => Boolean(item));
}

export function offersForMembership(world: WorldState, membership: CareerMembership, seasonDay = 1) {
  return tableValues(world.ecosystem.runtime.expeditionOffers)
    .filter(offer => offer.status === 'OPEN' && offer.opensOnDay <= seasonDay && offer.expiresOnDay >= seasonDay)
    .filter(offer => membership.mode === 'INDEPENDENT' ? true : offer.organizationId === membership.organizationId)
    .filter(offer => rankAtLeast(membership.rank, offer.requiredRank));
}

export interface EcosystemValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: { regions: number; mountains: number; routes: number; organizations: number; npcs: number; offers: number };
}

export function validateWorldEcosystem(ecosystem: WorldEcosystem): EcosystemValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { content, runtime } = ecosystem;
  const tableChecks = [
    ['regions', content.regions], ['mountains', content.mountains], ['routes', content.routes], ['organizations', content.organizations], ['npcs', content.npcs],
    ['runtime mountains', runtime.mountains], ['runtime organizations', runtime.organizations], ['runtime npcs', runtime.npcs], ['offers', runtime.expeditionOffers],
  ] as const;
  for (const [label, table] of tableChecks) {
    const ids = new Set(table.allIds);
    if (ids.size !== table.allIds.length) errors.push(`${label}: duplicate allIds`);
    for (const id of table.allIds) if (!table.byId[id]) errors.push(`${label}: missing ${id}`);
    for (const id of Object.keys(table.byId)) if (!ids.has(id)) errors.push(`${label}: orphan ${id}`);
  }
  if (!content.regions.byId[content.primaryRegionId]) errors.push('primary region does not exist');
  for (const mountain of tableValues(content.mountains)) {
    if (!mountain.regionId || !content.regions.byId[mountain.regionId]) errors.push(`mountain ${mountain.id}: missing region`);
    for (const routeId of mountain.routeIds ?? []) if (!content.routes.byId[routeId]) errors.push(`mountain ${mountain.id}: missing route ${routeId}`);
  }
  for (const route of tableValues(content.routes)) {
    if (!content.mountains.byId[route.mountainId]) errors.push(`route ${route.id}: missing mountain ${route.mountainId}`);
    if (!route.graph) {
      errors.push(`route ${route.id}: missing graph`);
      continue;
    }
    const nodeIds = new Set(route.graph.nodes.map(node => node.id));
    if (!nodeIds.has(route.graph.startNodeId) || !nodeIds.has(route.graph.summitNodeId) || !nodeIds.has(route.graph.exitNodeId)) errors.push(`route ${route.id}: invalid graph anchors`);
    for (const edge of route.graph.edges) if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`route ${route.id}: broken edge ${edge.id}`);
    const reachable = new Set<string>([route.graph.startNodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of route.graph.edges) if (reachable.has(edge.from) && !reachable.has(edge.to)) { reachable.add(edge.to); changed = true; }
    }
    if (!reachable.has(route.graph.summitNodeId)) errors.push(`route ${route.id}: summit unreachable`);
    if (!reachable.has(route.graph.exitNodeId)) errors.push(`route ${route.id}: exit unreachable`);
    if ((route.expectedPlayMinutes ?? 0) < 18) warnings.push(`route ${route.id}: play estimate too short`);
  }
  for (const organization of tableValues(content.organizations)) {
    if (!content.regions.byId[organization.regionId]) errors.push(`organization ${organization.id}: missing region`);
    for (const npcId of organization.memberNpcIds) if (!content.npcs.byId[npcId]) errors.push(`organization ${organization.id}: missing npc ${npcId}`);
  }
  for (const npc of tableValues(content.npcs)) if (npc.organizationId && !content.organizations.byId[npc.organizationId]) errors.push(`npc ${npc.id}: missing organization`);
  for (const offer of tableValues(runtime.expeditionOffers)) {
    if (!content.routes.byId[offer.routeId]) errors.push(`offer ${offer.id}: missing route`);
    if (offer.organizationId && !content.organizations.byId[offer.organizationId]) errors.push(`offer ${offer.id}: missing organization`);
    if (offer.leaderNpcId && !content.npcs.byId[offer.leaderNpcId]) errors.push(`offer ${offer.id}: missing leader`);
    for (const npcId of offer.memberNpcIds) if (!content.npcs.byId[npcId]) errors.push(`offer ${offer.id}: missing member ${npcId}`);
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      regions: content.regions.allIds.length,
      mountains: content.mountains.allIds.length,
      routes: content.routes.allIds.length,
      organizations: content.organizations.allIds.length,
      npcs: content.npcs.allIds.length,
      offers: runtime.expeditionOffers.allIds.length,
    },
  };
}

export function routeDifficultyOrder(world: WorldState) {
  return tableValues(world.ecosystem.content.routes).sort((a, b) => {
    const am = world.ecosystem.content.mountains.byId[a.mountainId];
    const bm = world.ecosystem.content.mountains.byId[b.mountainId];
    return (am ? mountainDifficulty(am) : 0) - (bm ? mountainDifficulty(bm) : 0) || a.objectiveRisk - b.objectiveRisk;
  });
}
