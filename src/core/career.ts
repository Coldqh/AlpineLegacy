import { createRng } from './rng';
import { analyzeRouteEquipment, equipmentPresetForRoute, equipmentReadinessScore, normalizeRopeGear, ropeMetersFromGear } from './gearPlanning';
import { buildMountainDynamics, routeIsClosed } from './mountainDynamics';
import { buildSchoolExpeditionBoard, daysUntilSchoolDeparture, schoolExpeditionPhase, schoolOfferCanAccept } from './schoolExpeditions';
import {
  addSeasonPreparation,
  createSeasonCampaignPlan,
  normalizeSeasonCampaignPlan,
  recordSeasonExpeditionResult,
  recordSeasonExpeditionStart,
  seasonBudgetLimit,
  seasonCostSupport,
  seasonPreparationBonus,
  seasonRiskReadinessModifier,
  setSeasonBudgetPolicy as setSeasonBudgetPolicyState,
  setSeasonRiskPolicy as setSeasonRiskPolicyState,
  toggleSeasonGoal as toggleSeasonGoalState,
  usePermanentTeamForSeason as usePermanentTeamForSeasonState,
} from './seasonPlanning';
import { defaultDescentSegments, generateRoutesForWorld, getQualificationTarget } from './routeFactory';
export { getQualificationTarget } from './routeFactory';
import { getEntryOrganizations, getOrganization, materializeNpc, organizationToClub, rankAtLeast, rosterForOrganization } from './ecosystem';
import { automaticUnlockedRegions, careerRegion, defaultRouteForRegion, regionTravelCost } from './regionalCareer';
import { buildExpeditionReport, createClimbTeamStates, enrichRoster, finalizeRosterAfterClimb, memory, teamAverage } from './people';
import { advanceLivingWorld, createLivingWorld, hydrateLivingWorld, registerHeroExpedition } from './worldSimulation';
import { createCareerProgression, currentSeasonExpeditionCount, expeditionLimitForTier, hydrateCareerProgression, normalizeCareerProgression, rollCareerSeason, syncCareerProgression } from './progression';
import { advanceCareerStories, createCareerStoryState, hydrateCareerStoryState } from './careerStories';
import { advanceFirstSeasonAfterExpedition, createFirstSeasonState, firstSeasonRankBonus, normalizeFirstSeasonState, refreshFirstSeasonAfterTime } from './firstSeason';
import { createParticipantExpeditionState, evaluateParticipant, getCurrentParticipantNode, getCurrentParticipantScene, leaderPace, resolveParticipantSkill } from './expeditionEngine';
import { beginSimulationDescent, beginSimulationRetreat, createExpeditionSimulation, hydrateExpeditionSimulation, resolveExpeditionEventChoice, resolveExpeditionFieldAction as resolveSimulationFieldAction } from './simulationEngine';
import { beginStrategicDescent, beginStrategicRetreat, createStrategicExpedition, hydrateStrategicExpedition, resolveStrategicRest, resolveStrategicSector } from './strategicEngine';
import {
  createIntegratedExpeditionState,
  normalizeIntegratedExpeditionState,
  integratedTeamCondition,
  integratedTeamEnergy,
  integratedWeatherAt,
  type IntegratedExpeditionState,
  type IntegratedParticipantState,
  type IntegratedSkills,
  type IntegratedPace,
} from './expedition';
export { currentExpeditionStage, previewExpeditionActions } from './simulationEngine';
import type {
  CalendarEntry,
  CareerDraft,
  CareerMembership,
  CareerLogEntry,
  CareerState,
  ClimbActionPreview,
  PreparationInsight,
  ParticipantSceneOption,
  ClimbOrderId,
  ClimbPace,
  ClimbStepResult,
  ClubData,
  ExpeditionApplication,
  ExpeditionOffer,
  ExpeditionPlan,
  ExpeditionFieldActionId,
  ExpeditionRank,
  PermanentTeamStyle,
  SeasonBudgetPolicy,
  SeasonRiskPolicy,
  ExpeditionReadiness,
  StrategicRestId,
  StrategicSectorPlan,
  ExpeditionRoute,
  GearDefinition,
  OriginDefinition,
  OriginId,
  QualificationClimb,
  RegionId,
  RouteSegment,
  SkillId,
  SkillSet,
  TeamMember,
  OrganizationDefinition,
  TrainingId,
  WeatherWindow,
  WorldState,
} from './types';

const zeroSkills = (): SkillSet => ({
  ENDURANCE: 0,
  ROCK: 0,
  ICE: 0,
  NAVIGATION: 0,
  MEDICINE: 0,
  LEADERSHIP: 0,
});

export const ORIGINS: Record<OriginId, OriginDefinition> = {
  CLUB_SCHOOL: {
    id: 'CLUB_SCHOOL',
    title: 'Клубная школа',
    subtitle: 'Дисциплина, связка, работа по правилам.',
    description: 'Ты прошёл через секцию и учебные выезды. Лучше понимаешь темп группы, страховку и приказы руководителя.',
    signature: 'Надёжный участник',
    statLine: 'Выносливость 4 · Лидерство 3 · Лёд 3',
    skills: { ENDURANCE: 4, ROCK: 3, ICE: 3, NAVIGATION: 2, MEDICINE: 2, LEADERSHIP: 3 },
    startingMoney: 420,
    startingForm: 61,
  },
  HIGHLAND_LOCAL: {
    id: 'HIGHLAND_LOCAL',
    title: 'Житель высокогорья',
    subtitle: 'Высота знакома раньше техники.',
    description: 'Ты вырос рядом с перевалами, пастбищами и зимними дорогами. Лучше читаешь рельеф и переносишь долгий набор высоты.',
    signature: 'Высотная устойчивость',
    statLine: 'Выносливость 5 · Навигация 4 · Лёд 3',
    skills: { ENDURANCE: 5, ROCK: 2, ICE: 3, NAVIGATION: 4, MEDICINE: 2, LEADERSHIP: 2 },
    startingMoney: 310,
    startingForm: 68,
  },
  ROCK_SECTION: {
    id: 'ROCK_SECTION',
    title: 'Скальная секция',
    subtitle: 'Сильные руки. Чистая техника. Мало высоты.',
    description: 'Ты пришёл из скалолазания. На камне двигаешься уверенно, но экспедиционный быт и ледовые участки ещё чужие.',
    signature: 'Технический талант',
    statLine: 'Скалы 5 · Выносливость 3 · Навигация 3',
    skills: { ENDURANCE: 3, ROCK: 5, ICE: 2, NAVIGATION: 3, MEDICINE: 2, LEADERSHIP: 2 },
    startingMoney: 360,
    startingForm: 64,
  },
};

export const TRAINING_ACTIONS: Record<TrainingId, {
  title: string;
  label: string;
  description: string;
  days: number;
  cost: number;
  fatigue: number;
  form: number;
  skill?: SkillId;
  xp?: number;
}> = {
  CONDITIONING: {
    title: 'Длинный набор',
    label: 'PHYSICAL / 07 DAYS',
    description: 'Марш-бросок с грузом, подъёмы и восстановление под контролем тренера.',
    days: 7,
    cost: 18,
    fatigue: 13,
    form: 8,
    skill: 'ENDURANCE',
    xp: 12,
  },
  ROCK_PRACTICE: {
    title: 'Скальная школа',
    label: 'TECHNICAL / 06 DAYS',
    description: 'Лазание лидером, организация станций и повторение работы на разрушенной породе.',
    days: 6,
    cost: 26,
    fatigue: 9,
    form: 4,
    skill: 'ROCK',
    xp: 14,
  },
  ICE_PRACTICE: {
    title: 'Ледовый выезд',
    label: 'ICE / 07 DAYS',
    description: 'Кошки, инструменты, ледобуры и движение связки по жёсткому льду.',
    days: 7,
    cost: 34,
    fatigue: 11,
    form: 4,
    skill: 'ICE',
    xp: 14,
  },
  MAP_ROOM: {
    title: 'Карта и погода',
    label: 'FIELD STUDY / 05 DAYS',
    description: 'Разбор маршрутов, фронтов, экспозиций склонов и аварийных отчётов клуба.',
    days: 5,
    cost: 8,
    fatigue: 2,
    form: 0,
    skill: 'NAVIGATION',
    xp: 11,
  },
  FIRST_AID: {
    title: 'Горная медицина',
    label: 'MEDICAL / 05 DAYS',
    description: 'Иммобилизация, переохлаждение, высотные симптомы и организация транспортировки.',
    days: 5,
    cost: 15,
    fatigue: 3,
    form: 0,
    skill: 'MEDICINE',
    xp: 11,
  },
  CLUB_DUTY: {
    title: 'Работа в клубе',
    label: 'CLUB / 06 DAYS',
    description: 'Снаряжение, собрания и помощь старшим группам. Ты становишься заметнее внутри клуба.',
    days: 6,
    cost: -28,
    fatigue: 5,
    form: 1,
    skill: 'LEADERSHIP',
    xp: 10,
  },
  RECOVERY: {
    title: 'Восстановление',
    label: 'REST / 06 DAYS',
    description: 'Сон, питание и лёгкая работа. Форма почти не растёт, зато уходит накопленная усталость.',
    days: 6,
    cost: 12,
    fatigue: -28,
    form: 2,
  },
};

export const SKILL_LABELS: Record<SkillId, string> = {
  ENDURANCE: 'Выносливость',
  ROCK: 'Скалы',
  ICE: 'Лёд',
  NAVIGATION: 'Навигация',
  MEDICINE: 'Медицина',
  LEADERSHIP: 'Лидерство',
};

export { GEAR_CATALOG } from './catalog';
import { GEAR_CATALOG } from './catalog';

const clubPrefixes = ['Северный', 'Высотный', 'Ледниковый', 'Альпийский', 'Горный', 'Центральный'];
const clubSuffixes = ['клуб', 'союз восходителей', 'альпийское общество', 'горная секция'];
const townsA = ['Брайт', 'Лин', 'Валь', 'Керн', 'Обер', 'Сент', 'Норд', 'Рейн'];
const townsB = ['хоф', 'брюк', 'дорф', 'вик', 'град', 'фельд', 'мар', 'лен'];
const mentorFirst = ['Эрик', 'Марек', 'Илья', 'Анри', 'Томас', 'Леон', 'Виктор', 'Рудольф'];
const mentorLast = ['Райн', 'Морель', 'Келлер', 'Штольц', 'Варден', 'Тарнов', 'Грейв', 'Эллен'];
const memberFirst = ['Мира', 'Йонас', 'Ада', 'Павел', 'Симон', 'Лина', 'Клара', 'Маттео', 'Нора', 'Оскар'];
const memberLast = ['Харт', 'Вейл', 'Краус', 'Роше', 'Берн', 'Соль', 'Дорн', 'Фальк', 'Мерц', 'Восс'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function makeClub(world: WorldState): ClubData {
  const rng = createRng(`${world.config.seed}:career:club`);
  const town = `${rng.pick(townsA)}${rng.pick(townsB)}`;
  return {
    id: `club-${world.region.id}`,
    name: `${rng.pick(clubPrefixes)} ${rng.pick(clubSuffixes)}`,
    town,
    foundedYear: world.config.startYear - rng.int(18, Math.min(82, Math.max(22, world.worldAge - 4))),
    standing: rng.int(42, 78),
    specialty: rng.pick(['длинные ледниковые маршруты', 'скальные гребни', 'зимние выходы', 'подготовка молодых связок']),
    doctrine: rng.pick([
      'Возвращение группы важнее личной вершины.',
      'Сначала техника, потом высота.',
      'Слабое решение на подходе становится аварией наверху.',
      'Руководитель отвечает и за тех, кто спорит с ним.',
    ]),
    mentorName: `${rng.pick(mentorFirst)} ${rng.pick(mentorLast)}`,
    mentorTitle: rng.pick(['старший инструктор', 'руководитель учебных сборов', 'ветеран высотных экспедиций']),
    mentors: [],
  };
}

function makeCalendar(world: WorldState): CalendarEntry[] {
  const rng = createRng(`${world.config.seed}:career:calendar`);
  return [
    { id: 'calendar-briefing', day: 2, type: 'CLUB', title: 'Вводное собрание', note: 'Распределение новичков и проверка личного снаряжения.' },
    { id: 'calendar-rock', day: 17, type: 'TRAINING', title: 'Скальный сбор', note: 'Первый выезд учебных связок.' },
    { id: 'calendar-weather', day: 34, type: 'WEATHER', title: 'Период неустойчивой погоды', note: 'Клуб ожидает серию холодных фронтов.' },
    { id: 'calendar-qual', day: 45, type: 'CLIMB', title: 'Квалификационное восхождение', note: 'Успешное возвращение открывает самостоятельные клубные маршруты.' },
    { id: 'calendar-reserve', day: rng.int(63, 78), type: 'CLUB', title: 'Резервное окно', note: 'Повторная попытка или работа во вспомогательной группе.' },
  ];
}

function makeTeam(world: WorldState, club: ClubData): TeamMember[] {
  const rng = createRng(`${world.config.seed}:career:team`);
  const used = new Set<string>();
  const nextName = () => {
    let value = '';
    while (!value || used.has(value)) value = `${rng.pick(memberFirst)} ${rng.pick(memberLast)}`;
    used.add(value);
    return value;
  };
  const raw = [
    {
      id: 'mentor', name: club.mentorName, age: rng.int(38, 57), role: 'LEADER', specialty: 'LEADERSHIP', skill: rng.int(7, 9), endurance: rng.int(6, 8), trust: 64, condition: 91,
      temperament: 'Сдержанный', note: 'Не ведёт группу к вершине после появления признаков развала.', required: true,
    },
    {
      id: 'rope-lead', name: nextName(), age: rng.int(24, 36), role: 'ROPE_LEAD', specialty: 'ROCK', skill: rng.int(5, 7), endurance: rng.int(5, 7), trust: rng.int(40, 63), condition: rng.int(82, 96),
      temperament: 'Амбициозный', note: 'Силен на камне, но не любит медленный темп.',
    },
    {
      id: 'ice-specialist', name: nextName(), age: rng.int(25, 39), role: 'SUPPORT', specialty: 'ICE', skill: rng.int(5, 7), endurance: rng.int(5, 8), trust: rng.int(44, 68), condition: rng.int(80, 95),
      temperament: 'Методичный', note: 'Требует хорошей страховки и не терпит спешки на льду.',
    },
    {
      id: 'navigator', name: nextName(), age: rng.int(22, 34), role: 'NAVIGATOR', specialty: 'NAVIGATION', skill: rng.int(5, 7), endurance: rng.int(4, 7), trust: rng.int(38, 61), condition: rng.int(84, 97),
      temperament: 'Осторожный', note: 'Раньше замечает изменение видимости и состояние снега.',
    },
    {
      id: 'medic', name: nextName(), age: rng.int(28, 43), role: 'MEDIC', specialty: 'MEDICINE', skill: rng.int(5, 8), endurance: rng.int(4, 6), trust: rng.int(48, 70), condition: rng.int(79, 93),
      temperament: 'Холодный', note: 'Ставит состояние группы выше спортивной цели.',
    },
  ] as unknown as TeamMember[];
  return enrichRoster(raw, world.config.seed, world.config.startYear, 1);
}

function makeWeatherWindows(world: WorldState, regionId = world.ecosystem.content.primaryRegionId): WeatherWindow[] {
  const region = world.ecosystem.content.regions.byId[regionId] ?? world.region;
  const rng = createRng(`${world.config.seed}:career:weather:${region.id}`);
  const profileCold = region.generationProfile === 'HIGH_ALTITUDE' ? -9 : region.generationProfile === 'GLACIAL' ? -4 : region.generationProfile === 'ARID' ? -2 : 0;
  const cold = (world.config.eraId === 'PIONEER' ? -2 : 0) + profileCold;
  const snowScale = region.generationProfile === 'ARID' ? .35 : region.generationProfile === 'HIGH_ALTITUDE' ? .8 : 1;
  return [
    {
      id: 'window-early', label: 'Раннее окно', startsInDays: 4, durationHours: rng.int(17, 23), temperatureC: rng.int(-17, -10) + cold,
      windKmh: rng.int(24, 38), snowfallCm: Math.round(rng.int(0, 6) * snowScale), stability: rng.int(58, 70),
      description: 'Холодно и жёстко. Снег держится лучше, но ветер остаётся сильным.',
    },
    {
      id: 'window-stable', label: 'Стабильное окно', startsInDays: 9, durationHours: rng.int(28, 39), temperatureC: rng.int(-13, -7) + cold,
      windKmh: rng.int(12, 24), snowfallCm: Math.round(rng.int(0, 3) * snowScale), stability: rng.int(74, 88),
      description: 'Самое чистое окно. Дольше ждать, зато прогноз устойчивее.',
    },
    {
      id: 'window-warm', label: 'Тёплый разрыв', startsInDays: 15, durationHours: rng.int(20, 30), temperatureC: rng.int(-8, -2) + cold,
      windKmh: rng.int(8, 20), snowfallCm: Math.round(rng.int(3, 10) * snowScale), stability: rng.int(48, 63),
      description: 'Меньше ветра, но потепление ухудшает снег и ледовые участки.',
    },
  ];
}

function defaultPlan(routes: ExpeditionRoute[], _team: TeamMember[], windows: WeatherWindow[]): ExpeditionPlan {
  return {
    routeId: routes[0]!.id,
    offerId: null,
    leaderNpcId: null,
    playerRole: 'SUPPORT',
    authorityMode: 'PARTICIPANT',
    weatherWindowId: windows[1]!.id,
    teamMemberIds: [],
    gear: { rope: 1, 'rock-kit': 1, 'ice-kit': 1, tent: 1, stove: 1, medkit: 1, radio: 0, bivy: 1 },
    foodDays: 3,
    fuelUnits: 3,
    ropeMeters: 50,
    acclimatizationDays: 4,
  };
}

export function skillXpThreshold(level: number) {
  if (level >= 10) return 1;
  return 70 + level * 35 + Math.max(0, level - 5) * 25;
}

function addXp(skills: SkillSet, xpState: Record<SkillId, number>, skill: SkillId, amount: number) {
  const nextSkills = { ...skills };
  const nextXp = { ...xpState };
  let pool = nextXp[skill] + amount;
  let level = nextSkills[skill];
  let threshold = skillXpThreshold(level);
  while (pool >= threshold && level < 10) {
    pool -= threshold;
    level += 1;
    threshold = skillXpThreshold(level);
  }
  nextSkills[skill] = level;
  nextXp[skill] = level >= 10 ? 0 : pool;
  return { skills: nextSkills, skillXp: nextXp };
}

function careerLog(career: CareerState, type: CareerLogEntry['type'], title: string, description: string): CareerLogEntry {
  return {
    id: `log-${career.year}-${career.seasonDay}-${career.log.length + 1}`,
    year: career.year,
    seasonDay: career.seasonDay,
    type,
    title,
    description,
  };
}

function advanceDays(career: CareerState, days: number): Pick<CareerState, 'year' | 'seasonDay' | 'week'> & { ageDelta: number } {
  let year = career.year;
  let seasonDay = career.seasonDay + days;
  let ageDelta = 0;
  while (seasonDay > 180) {
    seasonDay -= 180;
    year += 1;
    ageDelta += 1;
  }
  return { year, seasonDay, week: Math.floor((seasonDay - 1) / 7) + 1, ageDelta };
}

export function formatSeasonDate(year: number, seasonDay: number) {
  const start = Date.UTC(year, 3, 1);
  const date = new Date(start + (seasonDay - 1) * 86_400_000);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function permissionsForMembership(mode: CareerMembership['mode'], rank: CareerMembership['rank']): CareerMembership['permissions'] {
  const routeRank = ['ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'].includes(rank);
  const teamRank = ['DEPUTY', 'LEADER', 'ORGANIZER'].includes(rank);
  const commandRank = ['DEPUTY', 'LEADER', 'ORGANIZER'].includes(rank);
  return {
    canChooseRoute: mode === 'INDEPENDENT' || routeRank,
    canChooseTeam: mode === 'INDEPENDENT' || teamRank,
    canIssueOrders: mode === 'INDEPENDENT' || commandRank,
    canOrganize: ['LEADER', 'ORGANIZER'].includes(rank),
    canStartSolo: mode === 'INDEPENDENT',
  };
}


const expeditionRankOrder: ExpeditionRank[] = ['NOVICE', 'MEMBER', 'SPECIALIST', 'ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'];
const expeditionRankThresholds: Record<ExpeditionRank, number> = { NOVICE: 0, MEMBER: 8, SPECIALIST: 20, ROPE_LEAD: 38, DEPUTY: 62, LEADER: 92, ORGANIZER: 132 };

export const EXPEDITION_RANK_LABELS: Record<ExpeditionRank, string> = {
  NOVICE: 'Новичок', MEMBER: 'Участник', SPECIALIST: 'Специалист', ROPE_LEAD: 'Ведущий связки', DEPUTY: 'Заместитель', LEADER: 'Руководитель', ORGANIZER: 'Организатор',
};

function rankForPoints(points: number): ExpeditionRank {
  return [...expeditionRankOrder].reverse().find(rank => points >= expeditionRankThresholds[rank]) ?? 'NOVICE';
}

function progressMembership(career: CareerState, climb: QualificationClimb, successful: boolean) {
  const authorityBonus = climb.authorityMode === 'COMMAND' ? 3 : 0;
  const safetyBonus = climb.casualties.length === 0 ? 2 : -8;
  const participantGain = climb.participant?.evaluation?.rankPoints ?? 0;
  const baseGain = participantGain || ((successful ? 7 : climb.retreating ? 3 : 1) + authorityBonus + safetyBonus);
  const gain = Math.max(0, baseGain + firstSeasonRankBonus(climb.purpose));
  const rankPoints = career.membership.rankPoints + gain;
  const rank = rankForPoints(rankPoints);
  return { ...career.membership, rankPoints, rank, authority: career.membership.mode === 'INDEPENDENT' || ['LEADER', 'ORGANIZER'].includes(rank) ? 'COMMAND' as const : 'PARTICIPANT' as const, permissions: permissionsForMembership(career.membership.mode, rank) };
}

function membershipForDraft(world: WorldState, draft: CareerDraft): CareerMembership {
  const entryMode = draft.entryMode ?? 'INDEPENDENT';
  if (entryMode === 'INDEPENDENT') {
    return { mode: 'INDEPENDENT', organizationId: null, rank: 'NOVICE', authority: 'COMMAND', rankPoints: 0, permissions: permissionsForMembership('INDEPENDENT', 'NOVICE') };
  }
  const organizations = getEntryOrganizations(world);
  const requestedOrganizationId = draft.organizationId ?? null;
  const organizationId = getOrganization(world, requestedOrganizationId)?.acceptsNovices ? requestedOrganizationId : organizations[0]?.id ?? null;
  return { mode: 'ORGANIZATION', organizationId, rank: 'NOVICE', authority: 'PARTICIPANT', rankPoints: 0, permissions: permissionsForMembership('ORGANIZATION', 'NOVICE') };
}

function independentClub(world: WorldState): ClubData {
  return {
    id: `independent-${world.region.id}`,
    name: 'Независимый альпинист',
    town: world.region.name,
    foundedYear: world.config.startYear,
    standing: 12,
    specialty: 'самостоятельные выходы и поиск временных связок',
    doctrine: 'Ты отвечаешь только за свои решения и сам оплачиваешь каждую ошибку.',
    mentorName: 'Нет постоянного руководителя',
    mentorTitle: 'самостоятельная карьера',
    mentors: [],
  };
}

function legacyMembership(world: WorldState, career: any): CareerMembership {
  const matching = getOrganization(world, career?.membership?.organizationId ?? career?.club?.id) ?? getEntryOrganizations(world)[0] ?? null;
  const mode: CareerMembership['mode'] = career?.membership?.mode === 'INDEPENDENT' ? 'INDEPENDENT' : 'ORGANIZATION';
  const organizationId = mode === 'INDEPENDENT' ? null : matching?.id ?? null;
  const rank = career?.membership?.rank ?? 'LEADER';
  return {
    mode,
    organizationId,
    rank,
    authority: mode === 'INDEPENDENT' || ['LEADER', 'ORGANIZER'].includes(rank) ? 'COMMAND' : 'PARTICIPANT',
    rankPoints: career?.membership?.rankPoints ?? 60,
    permissions: permissionsForMembership(mode, rank),
  };
}

export function hydrateCareerFoundation(career: any, world: WorldState, preserveLegacyAuthority = true): CareerState {
  const membership = career.membership ?? (preserveLegacyAuthority ? legacyMembership(world, career) : membershipForDraft(world, { name: career.hero?.name ?? '', age: career.hero?.age ?? 20, originId: career.hero?.originId ?? 'CLUB_SCHOOL', entryMode: 'ORGANIZATION', organizationId: null }));
  const ecosystemRoutes = world.ecosystem?.content?.routes?.allIds?.map(id => world.ecosystem.content.routes.byId[id]).filter((route): route is ExpeditionRoute => Boolean(route)) ?? [];
  const routes = ecosystemRoutes.length ? ecosystemRoutes : generateRoutesForWorld(world);
  const organization = getOrganization(world, membership.organizationId);
  const club = membership.mode === 'INDEPENDENT' ? independentClub(world) : organizationToClub(organization, world);
  const teamRoster = enrichRoster(career.teamRoster?.length ? career.teamRoster : rosterForOrganization(world, membership.organizationId), world.config.seed, career.year ?? world.config.startYear, career.seasonDay ?? 1);
  const activeClimbBase = career.activeClimb ? {
    ...career.activeClimb,
    expeditionOfferId: career.activeClimb.expeditionOfferId ?? career.selectedOfferId ?? career.expeditionPlan?.offerId ?? null,
    leaderNpcId: career.activeClimb.leaderNpcId ?? teamRoster.find((member: TeamMember) => member.role === 'LEADER')?.id ?? null,
    playerRole: career.activeClimb.playerRole ?? 'LEADER',
    authorityMode: career.activeClimb.authorityMode ?? (membership.permissions.canIssueOrders ? 'COMMAND' : 'PARTICIPANT'),
    participant: career.activeClimb.participant ?? null,
    simulation: career.activeClimb.simulation ?? null,
    strategic: career.activeClimb.strategic ?? null,
    topo: career.activeClimb.topo ?? null,
  } as QualificationClimb : null;
  const activeRoute = activeClimbBase ? routes.find((route: ExpeditionRoute) => route.id === activeClimbBase.routeId) ?? routes[0] : null;
  const activeRelative = activeClimbBase
    ? Math.max(0, activeClimbBase.strategic
      ? activeClimbBase.currentElevation - activeClimbBase.startElevation
      : activeClimbBase.simulation?.relativeElevation ?? activeClimbBase.currentElevation - activeClimbBase.startElevation)
    : 0;
  const normalizedActiveClimb = activeClimbBase && activeRoute ? {
    ...activeClimbBase,
    startElevation: activeRoute.startElevation,
    summitElevation: activeRoute.summitElevation,
    currentElevation: Math.min(activeRoute.summitElevation, activeRoute.startElevation + activeRelative),
    route: activeRoute.segments,
    ascentRoute: activeRoute.segments,
    descentRoute: activeRoute.descentSegments ?? defaultDescentSegments(activeRoute),
  } : activeClimbBase;
  const activeClimb = normalizedActiveClimb && activeRoute ? { ...normalizedActiveClimb, simulation: normalizedActiveClimb.simulation ? hydrateExpeditionSimulation(normalizedActiveClimb, activeRoute) : null, strategic: hydrateStrategicExpedition(normalizedActiveClimb, activeRoute) } : normalizedActiveClimb;
  const foundation = {
    ...career,
    schemaVersion: 22,
    club,
    routes,
    teamRoster,
    membership: { ...membership, permissions: permissionsForMembership(membership.mode, membership.rank) },
    selectedOfferId: career.selectedOfferId ?? career.expeditionPlan?.offerId ?? null,
    applications: career.applications ?? [],
    knownNpcIds: career.knownNpcIds ?? teamRoster.map((member: TeamMember) => member.id),
    recoveryDays: Math.max(0, Math.round(career.recoveryDays ?? 0)),
    permanentTeam: career.permanentTeam ?? { name: `${career.hero?.name ?? 'Альпинист'} · связка`, style: 'BALANCED', memberIds: [], createdYear: career.year ?? world.config.startYear, createdDay: career.seasonDay ?? 1, cohesion: 24, climbs: 0, summits: 0, rescues: 0, losses: 0 },
    acceptedOffer: career.acceptedOffer ?? null,
    currentRegionId: career.currentRegionId && world.ecosystem.content.regions.byId[career.currentRegionId]
      ? career.currentRegionId
      : world.ecosystem.content.primaryRegionId,
    unlockedRegionIds: career.unlockedRegionIds ?? [world.ecosystem.content.primaryRegionId],
    travelHistory: career.travelHistory ?? [],
    resolvedSchoolOfferIds: career.resolvedSchoolOfferIds ?? [],
    storyState: career.storyState ?? null as unknown as CareerState['storyState'],
    firstSeason: career.firstSeason ?? null as unknown as CareerState['firstSeason'],
    expeditionPlan: normalizeRopeGear({
      ...defaultPlan(routes, teamRoster, career.weatherWindows?.length ? career.weatherWindows : makeWeatherWindows(world)),
      ...career.expeditionPlan,
      gear: { ...defaultPlan(routes, teamRoster, career.weatherWindows?.length ? career.weatherWindows : makeWeatherWindows(world)).gear, ...(career.expeditionPlan?.gear ?? {}) },
      offerId: career.expeditionPlan?.offerId ?? null,
      leaderNpcId: career.expeditionPlan?.leaderNpcId ?? null,
      playerRole: career.expeditionPlan?.playerRole ?? (membership.mode === 'INDEPENDENT' ? 'LEADER' : 'SUPPORT'),
      authorityMode: career.expeditionPlan?.authorityMode ?? (membership.permissions.canIssueOrders ? 'COMMAND' : 'PARTICIPANT'),
    }),
    livingWorld: hydrateLivingWorld(world, teamRoster, club, career.livingWorld),
    activeClimb,
  } as CareerState;
  foundation.unlockedRegionIds = automaticUnlockedRegions(world, foundation);
  const regionalRoute = foundation.routes.find(route => route.id === foundation.expeditionPlan.routeId && route.regionId === foundation.currentRegionId)
    ?? defaultRouteForRegion(foundation, foundation.currentRegionId)
    ?? foundation.routes[0]!;
  foundation.expeditionPlan = { ...foundation.expeditionPlan, routeId: regionalRoute.id };
  foundation.weatherWindows = career.weatherWindows?.length ? career.weatherWindows : makeWeatherWindows(world, foundation.currentRegionId);
  foundation.seasonPlan = normalizeSeasonCampaignPlan(foundation);
  foundation.storyState = hydrateCareerStoryState(foundation, career.storyState);
  foundation.firstSeason = normalizeFirstSeasonState(foundation);
  return hydrateCareerProgression(foundation);
}

export function createCareer(world: WorldState, draft: CareerDraft): CareerState {
  const origin = ORIGINS[draft.originId];
  const membership = membershipForDraft(world, draft);
  const organization = getOrganization(world, membership.organizationId);
  const club = membership.mode === 'INDEPENDENT' ? independentClub(world) : organizationToClub(organization, world);
  const routes = world.ecosystem.content.routes.allIds.map(id => world.ecosystem.content.routes.byId[id]).filter((route): route is ExpeditionRoute => Boolean(route));
  const teamRoster = rosterForOrganization(world, membership.organizationId);
  const weatherWindows = makeWeatherWindows(world);
  const career: CareerState = {
    schemaVersion: 22,
    id: `career-${world.id}-${draft.name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24) || 'climber'}`,
    worldId: world.id,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    createdAt: new Date().toISOString(),
    year: world.config.startYear,
    seasonDay: 1,
    week: 1,
    hero: {
      id: `hero-${world.config.seed}-${draft.age}`,
      name: draft.name.trim() || 'Новый альпинист',
      age: draft.age,
      originId: origin.id,
      originTitle: origin.title,
      startYear: world.config.startYear,
      health: 100,
      form: origin.startingForm,
      fatigue: 8,
      morale: 74,
      reputation: 0,
      money: origin.startingMoney,
      skills: { ...origin.skills },
      skillXp: zeroSkills(),
      injuries: [],
    },
    club,
    calendar: makeCalendar(world),
    log: [],
    completedClimbs: 0,
    highestElevation: world.region.elevationMin,
    activeClimb: null,
    routes,
    teamRoster,
    weatherWindows,
    expeditionPlan: { ...defaultPlan(routes, teamRoster, weatherWindows), playerRole: membership.mode === 'INDEPENDENT' ? 'LEADER' : 'SUPPORT', authorityMode: membership.mode === 'INDEPENDENT' ? 'COMMAND' : 'PARTICIPANT' },
    reports: [],
    reputationProfile: { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    onboarding: { dismissed: false, completed: false, careerStep: 0, expeditionStep: 0 },
    livingWorld: createLivingWorld(world, teamRoster, club),
    progression: null as unknown as CareerState['progression'],
    membership,
    selectedOfferId: null,
    applications: [],
    knownNpcIds: teamRoster.map(member => member.id),
    recoveryDays: 0,
    permanentTeam: { name: `${draft.name.trim() || 'Новый альпинист'} · связка`, style: 'BALANCED', memberIds: [], createdYear: world.config.startYear, createdDay: 1, cohesion: 24, climbs: 0, summits: 0, rescues: 0, losses: 0 },
    acceptedOffer: null,
    seasonPlan: null as unknown as CareerState['seasonPlan'],
    currentRegionId: world.ecosystem.content.primaryRegionId,
    unlockedRegionIds: [world.ecosystem.content.primaryRegionId],
    travelHistory: [],
    resolvedSchoolOfferIds: [],
    storyState: null as unknown as CareerState['storyState'],
    firstSeason: null as unknown as CareerState['firstSeason'],
  };

  career.expeditionPlan = normalizeRopeGear({
    ...career.expeditionPlan,
    ...equipmentPresetForRoute(routes[0]!, career.expeditionPlan, 1, 'MINIMUM'),
  });

  const opening = membership.mode === 'INDEPENDENT'
    ? 'Начата независимая карьера. Постоянной команды и гарантированных мест в экспедициях нет.'
    : `Принят новичком в «${club.name}». Команды пока нет: сначала нужно получить место в чужой экспедиции.`;
  career.seasonPlan = createSeasonCampaignPlan(career);
  career.storyState = createCareerStoryState(career);
  career.firstSeason = createFirstSeasonState(career);
  career.log.push(careerLog(career, 'CAREER', 'Начало карьеры', `${career.hero.name}, ${career.hero.age} лет. ${opening}`));
  career.log.push(careerLog(career, 'CLUB', membership.mode === 'INDEPENDENT' ? 'Самостоятельный путь' : 'Первый инструктор', membership.mode === 'INDEPENDENT' ? club.doctrine : `${club.mentorName}, ${club.mentorTitle}. Его правило: «${club.doctrine}»`));
  career.progression = createCareerProgression(career);
  return advanceCareerStories(syncCareerProgression(career), true);
}

function migrateActiveClimbV8(active: any, routes: ExpeditionRoute[]): QualificationClimb | null {
  if (!active) return null;
  const route = routes.find(item => item.id === active.routeId) ?? routes[0]!;
  const ascentRoute = route.segments;
  const descentRoute = route.descentSegments ?? defaultDescentSegments(route);
  const wasLegacyDescent = active.phase === 'DESCENT' && !active.descentRoute;
  const segmentIndex = wasLegacyDescent
    ? clamp(descentRoute.length - 1 - (active.segmentIndex ?? 0), 0, descentRoute.length - 1)
    : active.segmentIndex ?? 0;
  const currentRoute = active.phase === 'DESCENT' ? descentRoute : ascentRoute;
  return {
    ...active,
    route: currentRoute,
    ascentRoute,
    descentRoute,
    segmentIndex,
    segmentChoices: active.segmentChoices ?? {},
    routeChoices: active.routeChoices ?? [],
    fixedRopeSegmentIds: active.fixedRopeSegmentIds ?? [],
    ropeMetersRemaining: active.ropeMetersRemaining ?? 0,
    caches: active.caches ?? [],
    teamStates: active.teamStates ?? [],
    decisions: active.decisions ?? [],
    casualties: active.casualties ?? [],
    rescuedMemberIds: active.rescuedMemberIds ?? [],
    participant: active.participant ?? null,
    simulation: active.simulation ?? null,
    topo: active.topo ?? null,
  } as QualificationClimb;
}

function migrateLegacyRouteId(career: any, routes: ExpeditionRoute[]) {
  const previous = career.routes?.find((route: ExpeditionRoute) => route.id === career.expeditionPlan?.routeId);
  if (!previous) return routes[0]!.id;
  const exactStyle = routes.find(route => route.mountainId === previous.mountainId && route.name === previous.name);
  return exactStyle?.id ?? routes.find(route => route.mountainId === previous.mountainId)?.id ?? routes[0]!.id;
}

export function migrateCareerV2(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  const teamRoster = makeTeam(world, career.club);
  const weatherWindows = makeWeatherWindows(world);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    teamRoster,
    weatherWindows,
    expeditionPlan: { ...defaultPlan(routes, teamRoster, weatherWindows), playerRole: 'LEADER', authorityMode: 'COMMAND' },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    reports: [],
    reputationProfile: { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    livingWorld: createLivingWorld(world, teamRoster, career.club),
  } as CareerState);
}

export function migrateCareerV3(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  const teamRoster = enrichRoster(career.teamRoster ?? makeTeam(world, career.club), world.config.seed, career.year, career.seasonDay);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    teamRoster,
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    reports: career.reports ?? [],
    reputationProfile: career.reputationProfile ?? { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    livingWorld: career.livingWorld ?? createLivingWorld(world, teamRoster, career.club),
  } as CareerState);
}

export function migrateCareerV4(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  const teamRoster = enrichRoster(career.teamRoster ?? makeTeam(world, career.club), world.config.seed, career.year, career.seasonDay);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    teamRoster,
    livingWorld: career.livingWorld ?? createLivingWorld(world, teamRoster, career.club),
  } as CareerState);
}

export function migrateCareerV5(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState);
}

export function migrateCareerV6(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState);
}

export function migrateCareerV7(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState);
}

export function migrateCareerV8(career: any, world: WorldState): CareerState {
  const routes = generateRoutesForWorld(world);
  return hydrateCareerProgression({
    ...career,
    schemaVersion: 10,
    rootSeed: career.rootSeed ?? world.config.seed,
    difficulty: career.difficulty ?? world.config.difficulty,
    onboarding: { dismissed: false, completed: Boolean(career.reports?.length), careerStep: 0, expeditionStep: 0, ...(career.onboarding ?? {}) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState);
}

export function migrateCareerV10(career: any, world: WorldState): CareerState {
  return hydrateCareerFoundation(career, world, true);
}

export function dismissOnboarding(career: CareerState): CareerState {
  return { ...career, onboarding: { ...career.onboarding, dismissed: true } };
}

export function setCareerTutorialStep(career: CareerState, step: number): CareerState {
  return { ...career, onboarding: { ...career.onboarding, careerStep: clamp(Math.round(step), 0, 4) } };
}

export function careerReadiness(career: CareerState) {
  const { hero } = career;
  const skillCore = (hero.skills.ENDURANCE + hero.skills.ROCK + hero.skills.ICE + hero.skills.NAVIGATION) / 4;
  return Math.round(clamp(hero.form * 0.5 + hero.health * 0.18 + (100 - hero.fatigue) * 0.12 + skillCore * 2.8, 0, 100));
}

export function applyTraining(career: CareerState, trainingId: TrainingId): CareerState {
  const action = TRAINING_ACTIONS[trainingId];
  if (career.recoveryDays > 0 && trainingId !== 'RECOVERY') {
    return {
      ...career,
      log: [...career.log, careerLog(career, 'INJURY', 'Тренировка отложена', `Организм ещё восстанавливается после экспедиции: ${career.recoveryDays} дн.`)],
    };
  }
  const timeline = advanceDays(career, action.days);
  let skills = { ...career.hero.skills };
  let skillXp = { ...career.hero.skillXp };
  const mentor = action.skill
    ? career.club.mentors.find(item => item.specialty === action.skill) ?? career.club.mentors[0]
    : undefined;
  const mentorBonus = action.skill && mentor ? 2 : 0;
  if (action.skill && action.xp) {
    const progressed = addXp(skills, skillXp, action.skill, action.xp + mentorBonus);
    skills = progressed.skills;
    skillXp = progressed.skillXp;
  }
  const cost = action.cost;
  let next: CareerState = {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: {
      ...career.hero,
      age: career.hero.age + timeline.ageDelta,
      money: clamp(career.hero.money - cost, 0, 99_999),
      form: clamp(career.hero.form + action.form - Math.max(0, career.hero.fatigue - 70) * 0.05, 0, 100),
      fatigue: clamp(career.hero.fatigue + action.fatigue, 0, 100),
      health: clamp(career.hero.health + (trainingId === 'RECOVERY' ? 10 : 0), 0, 100),
      morale: clamp(career.hero.morale + (trainingId === 'RECOVERY' ? 4 : trainingId === 'CLUB_DUTY' ? 3 : 1), 0, 100),
      skills,
      skillXp,
      injuries: trainingId === 'RECOVERY' && career.recoveryDays <= action.days ? [] : career.hero.injuries,
    },
    recoveryDays: Math.max(0, career.recoveryDays - action.days),
  };
  next.log = [...career.log, careerLog(next, 'TRAINING', action.title, `${action.days} дней работы${mentor ? ` под руководством ${mentor.name}` : ''}. ${cost < 0 ? `Заработано ${Math.abs(cost)} кр.` : `Расходы ${cost} кр.`}`)];
  const prepared = addSeasonPreparation(next, trainingId === 'RECOVERY' ? Math.ceil(action.days * .35) : action.days);
  const advanced = advanceLivingWorld(prepared, action.days);
  const progressed = timeline.year > career.year ? rollCareerSeason(career, advanced) : syncCareerProgression(advanced);
  return refreshFirstSeasonAfterTime(advanceCareerStories(progressed));
}

export function waitForSchoolDeparture(world: WorldState, career: CareerState): CareerState {
  const offer = career.acceptedOffer;
  if (!offer || !career.selectedOfferId || offer.scheduleStatus === 'CANCELLED') return career;
  const days = Math.max(0, (offer.departureDay ?? career.seasonDay) - career.seasonDay);
  let next = career;
  if (days > 0) {
    const timeline = advanceDays(career, days);
    next = {
      ...career,
      year: timeline.year,
      seasonDay: timeline.seasonDay,
      week: timeline.week,
      hero: {
        ...career.hero,
        age: career.hero.age + timeline.ageDelta,
        fatigue: clamp(career.hero.fatigue - Math.max(2, days * .6), 0, 100),
        form: clamp(career.hero.form + Math.min(4, days * .18), 0, 100),
        morale: clamp(career.hero.morale + 1, 0, 100),
      },
      recoveryDays: Math.max(0, career.recoveryDays - days),
    };
    next = addSeasonPreparation(next, Math.max(1, days));
    next.log = [...career.log, careerLog(next, 'EXPEDITION', 'Ожидание выхода', `Прошло ${days} дн. Школа завершила набор, подготовку груза и ожидание погодного окна.`)];
    next = advanceLivingWorld(next, days);
    if (timeline.year > career.year) next = rollCareerSeason(career, next);
    next = advanceCareerStories(next);
  }
  const currentOffer = buildSchoolExpeditionBoard(world, next).find(item => item.id === offer.id) ?? { ...offer, phase: schoolExpeditionPhase(offer, next.seasonDay), preparationProgress: 100 };
  next = { ...next, acceptedOffer: currentOffer };

  // A school expedition owns the preparation plan. Waiting to departure must not leave
  // the player on a second hidden checklist after the calendar has already advanced.
  next = applyEquipmentPreset(next, 'RECOMMENDED');
  const route = getSelectedRoute(next);
  const acclimatizationDays = route.summitElevation >= 6500 ? 7 : route.summitElevation >= 5000 ? 5 : 3;
  const bestWindow = [...next.weatherWindows].sort((a, b) => b.stability - a.stability || a.startsInDays - b.startsInDays)[0];
  next = updateExpeditionPlan(next, {
    acclimatizationDays: Math.max(next.expeditionPlan.acclimatizationDays, acclimatizationDays),
    weatherWindowId: bestWindow?.id ?? next.expeditionPlan.weatherWindowId,
  });

  const started = startPlannedClimb(next);
  return started.activeClimb ? started : syncCareerProgression(next);
}

export function travelToRegion(world: WorldState, career: CareerState, regionId: RegionId): CareerState {
  if (career.activeClimb || regionId === career.currentRegionId) return career;
  const region = world.ecosystem.content.regions.byId[regionId];
  if (!region) return career;
  const unlocked = new Set(automaticUnlockedRegions(world, career));
  if (!unlocked.has(regionId)) return career;
  const cost = regionTravelCost(world, region);
  const days = Math.max(1, region.travelDays ?? 2);
  if (career.hero.money < cost) return career;
  const route = defaultRouteForRegion(career, regionId);
  if (!route) return career;
  const from = careerRegion(world, career);
  const timeline = advanceDays(career, days);
  const weatherWindows = makeWeatherWindows(world, regionId);
  const coreIds = career.permanentTeam.memberIds.filter(id => career.teamRoster.some(member => member.id === id && member.status === 'ACTIVE' && member.availability >= 45));
  let next: CareerState = {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: {
      ...career.hero,
      age: career.hero.age + timeline.ageDelta,
      money: Math.max(0, career.hero.money - cost),
      fatigue: clamp(career.hero.fatigue + Math.max(2, Math.round(days * .7)), 0, 100),
      morale: clamp(career.hero.morale + 2, 0, 100),
    },
    recoveryDays: Math.max(0, career.recoveryDays - days),
    currentRegionId: regionId,
    unlockedRegionIds: [...new Set([...career.unlockedRegionIds, ...unlocked, regionId])],
    travelHistory: [...career.travelHistory, {
      id: `travel-${career.year}-${career.seasonDay}-${regionId}-${career.travelHistory.length + 1}`,
      fromRegionId: from.id,
      toRegionId: regionId,
      year: career.year,
      seasonDay: career.seasonDay,
      days,
      cost,
    }],
    weatherWindows,
    selectedOfferId: null,
    acceptedOffer: null,
    expeditionPlan: {
      ...career.expeditionPlan,
      routeId: route.id,
      weatherWindowId: weatherWindows[0]!.id,
      offerId: null,
      leaderNpcId: null,
      playerRole: career.membership.mode === 'INDEPENDENT' ? 'LEADER' : 'SUPPORT',
      authorityMode: career.membership.mode === 'INDEPENDENT' ? 'COMMAND' : career.membership.authority,
      teamMemberIds: coreIds,
    },
  };
  next.seasonPlan = createSeasonCampaignPlan(next);
  next.log = [...career.log, careerLog(next, 'CAREER', `Переезд: ${region.country ?? region.name}`, `${from.name} → ${region.name}. Дорога ${days} дн., расходы ${cost} кр. Теперь доступны местные школы, маршруты и погодные окна.`)];
  const advanced = advanceLivingWorld(next, days);
  const progressed = timeline.year > career.year ? rollCareerSeason(career, advanced) : syncCareerProgression(advanced);
  return advanceCareerStories(progressed);
}

export function updateExpeditionPlan(career: CareerState, patch: Partial<ExpeditionPlan>): CareerState {
  const nextGear = patch.gear ? { ...career.expeditionPlan.gear, ...patch.gear } : { ...career.expeditionPlan.gear };
  if (patch.ropeMeters !== undefined && !patch.gear) nextGear.rope = Math.max(0, Math.min(4, Math.ceil(patch.ropeMeters / 50)));
  const plan = normalizeRopeGear({ ...career.expeditionPlan, ...patch, gear: nextGear });
  return { ...career, expeditionPlan: plan };
}

export function schoolExpeditionBoard(world: WorldState, career: CareerState, allSchools = false): ExpeditionOffer[] {
  const homeOrganization = getOrganization(world, career.membership.organizationId);
  const awayFromHome = Boolean(homeOrganization && homeOrganization.regionId !== career.currentRegionId);
  const resolved = new Set(career.resolvedSchoolOfferIds ?? []);
  return buildSchoolExpeditionBoard(world, career)
    .filter(offer => {
      const route = world.ecosystem.content.routes.byId[offer.routeId];
      return route?.regionId === career.currentRegionId;
    })
    .filter(offer => !resolved.has(offer.id))
    .filter(offer => allSchools || awayFromHome || career.membership.mode === 'INDEPENDENT' || offer.organizationId === career.membership.organizationId)
    .filter(offer => {
      if (allSchools || offer.id === career.selectedOfferId) return true;
      return ['ANNOUNCED', 'RECRUITING', 'PREPARING', 'WEATHER_HOLD'].includes(schoolExpeditionPhase(offer, career.seasonDay));
    });
}

export function availableExpeditionOffers(world: WorldState, career: CareerState): ExpeditionOffer[] {
  return schoolExpeditionBoard(world, career)
    .filter(offer => rankAtLeast(career.membership.rank, offer.requiredRank))
    .filter(offer => schoolOfferCanAccept(offer, career.seasonDay) || offer.id === career.selectedOfferId);
}

export function applicationForOffer(career: CareerState, offerId: string) {
  return [...career.applications].reverse().find(application => application.offerId === offerId) ?? null;
}

export function applyToExpeditionOffer(world: WorldState, career: CareerState, offerId: string): CareerState {
  const offer = availableExpeditionOffers(world, career).find(item => item.id === offerId);
  if (!offer) return career;
  const previous = applicationForOffer(career, offerId);
  if (previous?.status === 'ACCEPTED') return acceptScheduledExpeditionOffer(world, career, offerId);
  const route = world.ecosystem.content.routes.byId[offer.routeId];
  if (!route) return career;
  const roleSkill: Record<TeamMember['role'], SkillId> = { LEADER: 'LEADERSHIP', ROPE_LEAD: 'ROCK', MEDIC: 'MEDICINE', NAVIGATOR: 'NAVIGATION', SUPPORT: 'ENDURANCE' };
  const skill = career.hero.skills[roleSkill[offer.playerRole]];
  const rng = createRng(`${career.rootSeed}:application:${career.year}:${career.seasonDay}:${offer.id}:${career.applications.length}`);
  const score = Math.round(46 + skill * 6 + career.membership.rankPoints * .35 + career.hero.reputation * .25 + rng.int(-9, 11));
  const accepted = score >= 58 || (!career.applications.some(item => item.status === 'ACCEPTED') && offer.requiredRank === 'NOVICE' && score >= 51);
  const application: ExpeditionApplication = {
    id: `application-${offer.id}-${career.year}-${career.seasonDay}-${career.applications.length + 1}`,
    offerId,
    status: accepted ? 'ACCEPTED' : 'REJECTED',
    score,
    reason: accepted
      ? `Руководитель подтвердил место. Твоя роль: ${offer.playerRole}.`
      : score >= 48 ? 'Руководитель выбрал участника с большим опытом в этой роли.' : 'Навыки и репутация пока ниже требований группы.',
    appliedYear: career.year,
    appliedDay: career.seasonDay,
  };
  const withApplication = {
    ...career,
    applications: [...career.applications, application],
    log: [...career.log, careerLog(career, 'EXPEDITION', accepted ? 'Заявка принята' : 'Заявка отклонена', `${route.mountainName} · ${route.name}. ${application.reason}`)],
  };
  return accepted ? acceptScheduledExpeditionOffer(world, withApplication, offerId) : withApplication;
}

function acceptOfferState(world: WorldState, career: CareerState, offerId: string, scheduled: boolean): CareerState {
  const boardOffer = schoolExpeditionBoard(world, career, true).find(item => item.id === offerId) ?? availableExpeditionOffers(world, career).find(item => item.id === offerId);
  if (!boardOffer) return career;
  const offer: ExpeditionOffer = scheduled ? boardOffer : { ...boardOffer, phase: 'DEPARTING', departureDay: career.seasonDay, recruitmentClosesDay: career.seasonDay, expectedReturnDay: Math.min(180, career.seasonDay + 8) };
  const route = world.ecosystem.content.routes.byId[offer.routeId];
  if (!route) return career;
  const participantIds = [offer.leaderNpcId, ...offer.memberNpcIds].filter((id): id is string => Boolean(id));
  const known = [...new Set([...career.knownNpcIds, ...participantIds])];
  const guestMembers = participantIds
    .filter(id => !career.teamRoster.some(member => member.id === id))
    .map(id => materializeNpc(world, id))
    .filter((member): member is TeamMember => Boolean(member));
  const existingApplication = applicationForOffer(career, offer.id);
  const acceptedApplication: ExpeditionApplication = existingApplication?.status === 'ACCEPTED' ? existingApplication : {
    id: `application-${offer.id}-${career.year}-${career.seasonDay}-${career.applications.length + 1}`, offerId: offer.id, status: 'ACCEPTED', score: 100, reason: 'Место подтверждено.', appliedYear: career.year, appliedDay: career.seasonDay,
  };
  const acceptedCareer: CareerState = {
    ...career,
    applications: existingApplication?.status === 'ACCEPTED' ? career.applications : [...career.applications, acceptedApplication],
    selectedOfferId: offer.id,
    acceptedOffer: offer,
    knownNpcIds: known,
    teamRoster: guestMembers.length ? [...career.teamRoster, ...guestMembers] : career.teamRoster,
    expeditionPlan: { ...career.expeditionPlan, routeId: route.id, offerId: offer.id, leaderNpcId: offer.leaderNpcId, playerRole: offer.playerRole, authorityMode: offer.authority, teamMemberIds: participantIds },
    log: [...career.log, careerLog(career, 'EXPEDITION', scheduled ? 'Место в плане школы подтверждено' : 'Принято место в экспедиции', `${route.mountainName} · ${route.name}. ${scheduled && offer.departureDay ? `Выход запланирован на день ${offer.departureDay}.` : `Роль: ${offer.playerRole}.`}`)],
  };
  return applyEquipmentPreset(acceptedCareer, 'RECOMMENDED');
}

function acceptScheduledExpeditionOffer(world: WorldState, career: CareerState, offerId: string): CareerState {
  return acceptOfferState(world, career, offerId, true);
}

export function acceptExpeditionOffer(world: WorldState, career: CareerState, offerId: string): CareerState {
  return acceptOfferState(world, career, offerId, false);
}

export function leaveExpeditionOffer(career: CareerState): CareerState {
  return {
    ...career,
    selectedOfferId: null,
    acceptedOffer: null,
    expeditionPlan: {
      ...career.expeditionPlan,
      offerId: null,
      leaderNpcId: null,
      playerRole: career.membership.mode === 'INDEPENDENT' ? 'LEADER' : 'SUPPORT',
      authorityMode: career.membership.permissions.canIssueOrders ? 'COMMAND' : 'PARTICIPANT',
      teamMemberIds: [],
    },
  };
}

export function setSeasonRiskPolicy(career: CareerState, policy: SeasonRiskPolicy) {
  return setSeasonRiskPolicyState(career, policy);
}

export function setSeasonBudgetPolicy(career: CareerState, policy: SeasonBudgetPolicy) {
  return setSeasonBudgetPolicyState(career, policy);
}

export function toggleSeasonGoal(career: CareerState, routeId: string) {
  return toggleSeasonGoalState(career, routeId);
}

export function usePermanentTeamForSeason(career: CareerState) {
  return usePermanentTeamForSeasonState(career);
}

export function seasonBudgetRemaining(career: CareerState) {
  const plan = normalizeSeasonCampaignPlan(career);
  return Math.max(0, plan.reserveCredits - plan.spentCredits);
}

export function canControlExpedition(career: CareerState) {
  return career.expeditionPlan.authorityMode === 'COMMAND' || career.membership.permissions.canIssueOrders;
}

export function selectRoute(career: CareerState, routeId: string): CareerState {
  if (!career.membership.permissions.canChooseRoute) return career;
  const route = career.routes.find(item => item.id === routeId);
  if (!route || routeIsClosed(career, route)) return career;
  const cleared = leaveExpeditionOffer(career);
  const permanentIds = cleared.permanentTeam.memberIds.filter(id => { const member = cleared.teamRoster.find(item => item.id === id); return member?.status === 'ACTIVE' && member.availability >= 45; }).slice(0, 4);
  return updateExpeditionPlan(cleared, { routeId, playerRole: 'LEADER', authorityMode: 'COMMAND', teamMemberIds: permanentIds });
}

export function routesForMountain(career: CareerState, mountainId: string) {
  return career.routes.filter(route => route.mountainId === mountainId);
}

export function selectMountain(career: CareerState, mountainId: string): CareerState {
  if (!career.membership.permissions.canChooseRoute) return career;
  const routes = routesForMountain(career, mountainId);
  if (!routes.length) return career;
  const available = routes.filter(route => !routeIsClosed(career, route));
  const recommended = [...(available.length ? available : routes)].sort((a, b) => (a.objectiveRisk + a.technicality) - (b.objectiveRisk + b.technicality))[0]!;
  return updateExpeditionPlan(leaveExpeditionOffer(career), { routeId: recommended.id, playerRole: 'LEADER', authorityMode: 'COMMAND' });
}

export function selectWeatherWindow(career: CareerState, weatherWindowId: string): CareerState {
  if (!career.weatherWindows.some(item => item.id === weatherWindowId)) return career;
  return updateExpeditionPlan(career, { weatherWindowId });
}

export function toggleTeamMember(career: CareerState, memberId: string): CareerState {
  if (!career.membership.permissions.canChooseTeam) return career;
  const member = career.teamRoster.find(item => item.id === memberId);
  if (!member || member.required || member.status !== 'ACTIVE' || member.availability < 45) return career;
  const selected = career.expeditionPlan.teamMemberIds.includes(memberId);
  const nextIds = selected
    ? career.expeditionPlan.teamMemberIds.filter(id => id !== memberId)
    : [...career.expeditionPlan.teamMemberIds, memberId];
  if (nextIds.length > 4) return career;
  return updateExpeditionPlan(career, { teamMemberIds: nextIds });
}

export function togglePermanentTeamMember(career: CareerState, memberId: string): CareerState {
  const member = career.teamRoster.find(item => item.id === memberId);
  if (!member || member.status !== 'ACTIVE') return career;
  const active = career.permanentTeam.memberIds.includes(memberId);
  const memberIds = active ? career.permanentTeam.memberIds.filter(id => id !== memberId) : [...career.permanentTeam.memberIds, memberId].slice(0, 5);
  return { ...career, permanentTeam: { ...career.permanentTeam, memberIds, cohesion: clamp(career.permanentTeam.cohesion + (active ? -3 : 2), 0, 100) } };
}

export function saveCurrentAsPermanentTeam(career: CareerState): CareerState {
  if (!career.membership.permissions.canChooseTeam) return career;
  const memberIds = career.expeditionPlan.teamMemberIds.filter(id => { const member = career.teamRoster.find(item => item.id === id); return member?.status === 'ACTIVE'; }).slice(0, 5);
  return { ...career, permanentTeam: { ...career.permanentTeam, memberIds, cohesion: memberIds.length >= 2 ? Math.max(career.permanentTeam.cohesion, 30) : career.permanentTeam.cohesion } };
}

export function setPermanentTeamStyle(career: CareerState, style: PermanentTeamStyle): CareerState {
  return { ...career, permanentTeam: { ...career.permanentTeam, style } };
}

export function usePermanentTeam(career: CareerState): CareerState {
  if (!career.membership.permissions.canChooseTeam) return career;
  const memberIds = career.permanentTeam.memberIds.filter(id => { const member = career.teamRoster.find(item => item.id === id); return member?.status === 'ACTIVE' && member.availability >= 45; }).slice(0, 4);
  return updateExpeditionPlan(career, { teamMemberIds: memberIds });
}

export function setGearQuantity(career: CareerState, gearId: string, quantity: number): CareerState {
  const definition = GEAR_CATALOG.find(item => item.id === gearId);
  if (!definition) return career;
  const value = clamp(Math.round(quantity), 0, definition.maxQuantity);
  return updateExpeditionPlan(career, { gear: { ...career.expeditionPlan.gear, [gearId]: value } });
}

export function applyEquipmentPreset(career: CareerState, preset: 'MINIMUM' | 'RECOMMENDED'): CareerState {
  const route = getSelectedRoute(career);
  const teamSize = selectedTeam(career).length + 1;
  return updateExpeditionPlan(career, equipmentPresetForRoute(route, career.expeditionPlan, teamSize, preset));
}

export function getSelectedRoute(career: CareerState) {
  return career.routes.find(route => route.id === career.expeditionPlan.routeId) ?? career.routes[0]!;
}

export function getSelectedWeather(career: CareerState) {
  return career.weatherWindows.find(window => window.id === career.expeditionPlan.weatherWindowId) ?? career.weatherWindows[0]!;
}

export function selectedTeam(career: CareerState) {
  return career.teamRoster.filter(member => career.expeditionPlan.teamMemberIds.includes(member.id) && member.status === 'ACTIVE' && member.availability >= 45);
}

export function expeditionWeight(career: CareerState) {
  const gearWeight = GEAR_CATALOG.reduce((sum, item) => sum + item.weightKg * (career.expeditionPlan.gear[item.id] ?? 0), 0);
  const consumables = career.expeditionPlan.foodDays * 1.45 + career.expeditionPlan.fuelUnits * .38;
  const teamCount = Math.max(1, selectedTeam(career).length + 1);
  return Math.round((gearWeight + consumables) / teamCount * 10) / 10;
}

export function expeditionCost(career: CareerState) {
  const route = getSelectedRoute(career);
  const gearCost = GEAR_CATALOG.reduce((sum, item) => sum + item.unitCost * (career.expeditionPlan.gear[item.id] ?? 0), 0);
  const teamSize = selectedTeam(career).length + 1;
  const transport = 12 + Math.ceil(route.estimatedHours / 8) * 5;
  const permit = route.expeditionScale === 'GIANT' ? 65 : route.expeditionScale === 'MAJOR' ? 35 : 15;
  const insurance = Math.round(teamSize * Math.max(3, route.objectiveRisk / 14));
  const participantPay = career.membership.mode === 'INDEPENDENT' ? Math.round(Math.max(0, teamSize - 1) * (8 + route.technicality * .1)) : 0;
  const raw = Math.round(gearCost * .15 + career.expeditionPlan.foodDays * 9 + career.expeditionPlan.fuelUnits * 5 + transport + permit + insurance + participantPay);
  return seasonCostSupport(career, route.id, raw);
}

export function expeditionReadiness(career: CareerState): ExpeditionReadiness {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const team = selectedTeam(career);
  const soloPlan = career.expeditionPlan.offerId?.includes('independent-solo') || (career.membership.mode === 'INDEPENDENT' && team.length === 0);
  const scheduledSchoolPlan = Boolean(career.acceptedOffer && career.membership.mode !== 'INDEPENDENT');
  const heroBase = careerReadiness(career);
  const primarySkills = route.segments.map(item => career.hero.skills[item.skill]);
  const seasonPreparation = seasonPreparationBonus(career, route.id);
  const routeFit = clamp(Math.round(primarySkills.reduce((sum, value) => sum + value, 0) / primarySkills.length * 11 + 24 - route.technicality * .28 + seasonPreparation), 0, 100);
  const permanentCount = team.filter(member => career.permanentTeam.memberIds.includes(member.id)).length;
  const cohesionBonus = permanentCount >= 2 ? career.permanentTeam.cohesion * .12 : 0;
  const teamScore = soloPlan
    ? clamp(Math.round(heroBase * .62 + career.hero.skills.LEADERSHIP * 4), 0, 100)
    : clamp(Math.round(team.reduce((sum, member) => sum + member.skill * 7 + member.endurance * 4 + member.trust * .22, 0) / Math.max(1, team.length) + cohesionBonus), 0, 100);
  const equipmentAnalysis = analyzeRouteEquipment(route, career.expeditionPlan, team.length + 1);
  const missingGear = route.requiredGearIds.filter(id => (career.expeditionPlan.gear[id] ?? 0) <= 0);
  const equipment = Math.min(equipmentReadinessScore(equipmentAnalysis, expeditionWeight(career)), clamp(100 - missingGear.length * 23, 0, 100));
  const dynamics = buildMountainDynamics(career, route.mountainId, route.id);
  const weatherScore = clamp(Math.round(weather.stability + dynamics.stabilityDelta - (weather.windKmh + dynamics.windDelta) * .25 - weather.snowfallCm * .7 + weather.durationHours * .4), 0, 100);
  const acclimatization = clamp(career.expeditionPlan.acclimatizationDays * 13 + career.hero.skills.ENDURANCE * 4, 0, 100);
  const seasonPlan = normalizeSeasonCampaignPlan(career);
  const total = Math.round(heroBase * .25 + routeFit * .18 + teamScore * .17 + equipment * .18 + weatherScore * .12 + acclimatization * .1 + seasonRiskReadinessModifier(seasonPlan.riskPolicy));
  const blockers: string[] = [];
  if (career.acceptedOffer && career.membership.mode !== 'INDEPENDENT') {
    const phase = schoolExpeditionPhase(career.acceptedOffer, career.seasonDay);
    const untilDeparture = daysUntilSchoolDeparture(career.acceptedOffer, career.seasonDay);
    if (career.acceptedOffer.scheduleStatus === 'CANCELLED') blockers.push(`План школы отменён: ${career.acceptedOffer.cancellationReason ?? 'выбери другую экспедицию'}.`);
    else if (untilDeparture > 0) blockers.push(`Школьная экспедиция ещё готовится. До выхода ${untilDeparture} дн.`);
    else if (phase === 'ON_ROUTE' || phase === 'RECOVERING') blockers.push('Ты пропустил выход этой группы. Выбери новый план школы.');
  }
  if (!career.selectedOfferId && !career.membership.permissions.canOrganize && !career.membership.permissions.canStartSolo) blockers.push('Сначала получи место в чужой экспедиции.');
  if (dynamics.status === 'CLOSED') blockers.push(`Маршрут временно закрыт: ${dynamics.closureReason ?? dynamics.seasonSummary}`);
  if (missingGear.length) blockers.push(`Не хватает обязательного снаряжения: ${missingGear.map(id => GEAR_CATALOG.find(item => item.id === id)?.name ?? id).join(', ')}`);
  if (equipmentAnalysis.plannedRopeMeters < equipmentAnalysis.minimumRopeMeters) blockers.push(`Верёвки меньше минимума: ${equipmentAnalysis.plannedRopeMeters}/${equipmentAnalysis.minimumRopeMeters} м.`);
  if (career.expeditionPlan.foodDays < equipmentAnalysis.minimumFoodDays) blockers.push(`Еды меньше минимума: ${career.expeditionPlan.foodDays}/${equipmentAnalysis.minimumFoodDays} дн.`);
  if (career.expeditionPlan.fuelUnits < equipmentAnalysis.minimumFuelUnits) blockers.push(`Топлива меньше минимума: ${career.expeditionPlan.fuelUnits}/${equipmentAnalysis.minimumFuelUnits}.`);
  if (equipmentAnalysis.expectedNights > 0 && (career.expeditionPlan.gear.tent ?? 0) <= 0 && (career.expeditionPlan.gear.bivy ?? 0) <= 0) blockers.push('На маршруте ожидается ночёвка, но нет ни палатки, ни аварийного бивака.');
  if (!soloPlan && !scheduledSchoolPlan && team.length + 1 < route.recommendedTeamSize) blockers.push('Группа меньше рекомендованного состава.');
  if (soloPlan && route.objectiveRisk > 62) blockers.push('Этот маршрут слишком опасен для одиночного выхода.');
  if (career.recoveryDays > 0) blockers.push(`Герой восстанавливается ещё ${career.recoveryDays} дн.`);
  if (career.hero.fatigue > 72) blockers.push('Герой слишком утомлён для выхода.');
  if (career.expeditionPlan.acclimatizationDays < 2) blockers.push('Акклиматизация сорвана.');
  const plannedCost = expeditionCost(career);
  if (!scheduledSchoolPlan && plannedCost > career.hero.money) blockers.push('Не хватает средств на подготовку.');
  if (!scheduledSchoolPlan && seasonPlan.spentCredits + plannedCost > seasonPlan.reserveCredits) blockers.push('Сезонный бюджет исчерпан. Измени бюджет или выбери более дешёвую цель.');
  if (!scheduledSchoolPlan && seasonPlan.riskPolicy === 'CAUTIOUS' && route.objectiveRisk > 82) blockers.push('Маршрут выше допустимого риска сезона. Измени риск-политику или цель.');
  const progression = normalizeCareerProgression(career);
  if (currentSeasonExpeditionCount(career) >= expeditionLimitForTier(progression.tier)) blockers.push('Лимит экспедиций сезона исчерпан.');
  return { total: clamp(total, 0, 100), hero: heroBase, routeFit, team: teamScore, equipment, weather: weatherScore, acclimatization, blockers };
}

export function preparationInsights(career: CareerState): PreparationInsight[] {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const insights: PreparationInsight[] = [];

  const characterInsight: Record<ExpeditionRoute['mountainCharacterId'], PreparationInsight> = {
    WEATHER: { tone: weather.stability >= 68 ? 'GOOD' : 'WARNING', title: 'Эта гора решается временем выхода', detail: `Стабильность выбранного окна ${weather.stability}/100. На этой вершине ожидание и ранний старт важнее лишнего участника.` },
    TECHNICAL: { tone: readiness.routeFit >= 62 ? 'GOOD' : 'DANGER', title: 'Эта гора проверяет технику', detail: `Соответствие маршруту ${readiness.routeFit}/100. Слабые скальные или ледовые навыки резко увеличат задержки на ключевых участках.` },
    ENDURANCE: { tone: career.expeditionPlan.foodDays >= 3 && weight <= 17 ? 'GOOD' : 'WARNING', title: 'Эта гора забирает время и запасы', detail: `Запас еды: ${career.expeditionPlan.foodDays} дн., груз: ${weight.toFixed(1)} кг/чел. Длинный день без лагеря быстро съест резерв.` },
    ALTITUDE: { tone: career.expeditionPlan.acclimatizationDays >= 4 ? 'GOOD' : 'DANGER', title: 'Эта гора проверяет высоту', detail: `Акклиматизация: ${career.expeditionPlan.acclimatizationDays} дн. Ниже 4 дней расход сил выше даже на простом рельефе.` },
    DESCENT: { tone: (career.expeditionPlan.gear.bivy ?? 0) > 0 && ropeMetersFromGear(career.expeditionPlan.gear) >= 50 ? 'GOOD' : 'WARNING', title: 'Главная опасность начнётся после вершины', detail: 'Запас верёвки и аварийное укрытие снижают цену медленного спуска. Не планируй выход на нулевом остатке сил.' },
  };
  insights.push(characterInsight[route.mountainCharacterId]);

  const dynamics = buildMountainDynamics(career, route.mountainId, route.id);
  insights.push({ tone: dynamics.status === 'CLOSED' ? 'DANGER' : dynamics.status === 'CAUTION' ? 'WARNING' : 'GOOD', title: `${dynamics.seasonTitle}: маршрут ${dynamics.statusLabel}`, detail: dynamics.closureReason ?? dynamics.seasonSummary });

  if (weight > 18) insights.push({ tone: 'DANGER', title: 'Группа перегружена', detail: `При ${weight.toFixed(1)} кг на человека каждый участок потребует больше сил. Убери лишнее или расширь состав.` });
  else if (weight > 15.5) insights.push({ tone: 'WARNING', title: 'Груз замедлит группу', detail: `${weight.toFixed(1)} кг на человека — рабочая, но тяжёлая загрузка. Быстрый темп станет опаснее.` });
  else insights.push({ tone: 'GOOD', title: 'Вес распределён нормально', detail: `${weight.toFixed(1)} кг на человека не создаёт отдельного штрафа к темпу.` });

  if (readiness.blockers.length) insights.push({ tone: 'DANGER', title: 'Выход пока запрещён', detail: readiness.blockers[0]! });
  else insights.push({ tone: 'GOOD', title: 'Критических ошибок в плане нет', detail: 'Оставшийся риск связан с горой и решениями на маршруте, а не с пропущенным обязательным пунктом.' });
  return insights;
}

function packWeight(career: CareerState) {
  return expeditionWeight(career);
}


function integratedSkillsFromHero(skills: SkillSet): IntegratedSkills {
  return {
    ENDURANCE: skills.ENDURANCE,
    ROCK: skills.ROCK,
    ICE: skills.ICE,
    NAVIGATION: skills.NAVIGATION,
    MEDICINE: skills.MEDICINE,
    LEADERSHIP: skills.LEADERSHIP,
  };
}

function integratedSkillsFromMember(member: TeamMember): IntegratedSkills {
  const profile = member.skills ?? {
    ENDURANCE: member.endurance,
    ROCK: member.specialty === 'ROCK' ? member.skill : Math.max(1, member.skill - 2),
    ICE: member.specialty === 'ICE' ? member.skill : Math.max(1, member.skill - 2),
    NAVIGATION: member.specialty === 'NAVIGATION' ? member.skill : Math.max(1, member.skill - 2),
    MEDICINE: member.specialty === 'MEDICINE' ? member.skill : Math.max(1, member.skill - 3),
    LEADERSHIP: member.specialty === 'LEADERSHIP' ? member.skill : Math.max(1, Math.round(member.trust / 18)),
  };
  return {
    ENDURANCE: clamp(profile.ENDURANCE, 1, 10),
    ROCK: clamp(profile.ROCK, 1, 10),
    ICE: clamp(profile.ICE, 1, 10),
    NAVIGATION: clamp(profile.NAVIGATION, 1, 10),
    MEDICINE: clamp(profile.MEDICINE, 1, 10),
    LEADERSHIP: clamp(profile.LEADERSHIP, 1, 10),
  };
}

function integratedParticipants(career: CareerState, team: TeamMember[], startEnergy: number): IntegratedParticipantState[] {
  const hero: IntegratedParticipantState = {
    id: career.hero.id,
    memberId: null,
    name: career.hero.name,
    role: career.expeditionPlan.authorityMode === 'COMMAND' ? 'Ведущий' : career.expeditionPlan.authorityMode === 'SPECIALIST' ? 'Специалист' : 'Участник',
    specialty: SKILL_LABELS[Object.entries(career.hero.skills).sort((a, b) => b[1] - a[1])[0]![0] as SkillId],
    energy: startEnergy,
    condition: career.hero.health,
    fatigue: career.hero.fatigue,
    morale: career.hero.morale,
    trust: 100,
    skills: integratedSkillsFromHero(career.hero.skills),
    status: 'ACTIVE',
    injury: career.hero.injuries.at(-1) ?? null,
    loadKg: 0,
    carryCapacityKg: 0,
  };
  const members = team.map((member): IntegratedParticipantState => ({
    id: `topo-${member.id}`,
    memberId: member.id,
    name: member.name,
    role: member.role === 'LEADER' ? 'Ведущий' : member.role === 'MEDIC' ? 'Медик' : member.role === 'NAVIGATOR' ? 'Навигатор' : member.role === 'ROPE_LEAD' ? 'Первый в связке' : 'Участник',
    specialty: SKILL_LABELS[member.specialty],
    energy: clamp(74 + member.endurance * 3 - Math.max(0, 80 - member.condition) * .35, 45, 100),
    condition: member.condition,
    fatigue: clamp(24 - member.endurance * 2, 3, 28),
    morale: member.morale,
    trust: member.trust,
    skills: integratedSkillsFromMember(member),
    status: member.status === 'DEAD' ? 'DEAD' : member.status === 'INJURED' ? 'INJURED' : 'ACTIVE',
    injury: member.injuries.at(-1) ?? null,
    loadKg: 0,
    carryCapacityKg: 0,
  }));
  if (career.expeditionPlan.authorityMode === 'COMMAND') return [hero, ...members].map((participant, index, list) => ({ ...participant, role: index === 0 ? 'Ведущий' : index === list.length - 1 ? 'Замыкающий' : participant.role }));
  const leaderIndex = members.findIndex(participant => participant.memberId === career.expeditionPlan.leaderNpcId || participant.role === 'Ведущий');
  const ordered = leaderIndex >= 0 ? [members[leaderIndex]!, hero, ...members.filter((_, index) => index !== leaderIndex)] : [members[0] ?? hero, ...(members.length ? [hero, ...members.slice(1)] : [])];
  return ordered.map((participant, index, list) => ({ ...participant, role: index === 0 ? 'Ведущий' : index === list.length - 1 ? 'Замыкающий' : participant.role }));
}

function createCareerIntegratedExpedition(
  career: CareerState,
  climbId: string,
  route: ExpeditionRoute,
  window: WeatherWindow,
  team: TeamMember[],
  supplies: QualificationClimb['supplies'],
  startEnergy: number,
  ropeMeters = ropeMetersFromGear(career.expeditionPlan.gear),
) {
  const gear = career.expeditionPlan.gear;
  const entrySide = route.id.endsWith('east-glacier') ? 'EAST' : route.id.endsWith('north-line') ? 'NORTH' : 'SOUTH';
  const integrated = createIntegratedExpeditionState({
    seed: climbId,
    difficulty: career.difficulty,
    authority: career.expeditionPlan.authorityMode,
    entrySide,
    routeChoice: 'AUTO',
    ropeMeters,
    campKits: Math.max(0, gear.tent ?? 0),
    participants: integratedParticipants(career, team, startEnergy),
    supplies,
    gear: {
      ropeCondition: (gear.rope ?? 0) > 0 ? 100 : 0,
      hardwareCondition: Math.min((gear['rock-kit'] ?? 0) > 0 ? 100 : 20, (gear['ice-kit'] ?? 0) > 0 ? 100 : 20),
      rockHardwareCondition: (gear['rock-kit'] ?? 0) > 0 ? 100 : 20,
      iceHardwareCondition: (gear['ice-kit'] ?? 0) > 0 ? 100 : 20,
      shelterCondition: (gear.tent ?? 0) + (gear.bivy ?? 0) > 0 ? 100 : 0,
      stoveCondition: (gear.stove ?? 0) > 0 ? 100 : 0,
      radioCondition: (gear.radio ?? 0) > 0 ? 100 : 0,
      medkitCharges: Math.max(0, (gear.medkit ?? 0) * 3),
      oxygenUnits: 0,
      lostWeightKg: 0,
    },
    packWeightKg: packWeight(career),
    acclimatizationDays: career.expeditionPlan.acclimatizationDays,
    hasMedkit: (gear.medkit ?? 0) > 0,
    hasStove: (gear.stove ?? 0) > 0,
    hasBivy: (gear.bivy ?? 0) > 0 || (gear.tent ?? 0) > 0,
    weatherWindow: {
      temperatureC: window.temperatureC,
      windKmh: window.windKmh,
      snowfallCm: window.snowfallCm,
      stability: window.stability,
      durationHours: window.durationHours,
    },
    startElevation: route.startElevation,
    summitElevation: route.summitElevation,
  });
  const permanentCount = team.filter(member => career.permanentTeam.memberIds.includes(member.id)).length;
  if (permanentCount < 2) return integrated;
  const pace: IntegratedPace = career.permanentTeam.style === 'CAUTIOUS' ? 'CAUTIOUS' : career.permanentTeam.style === 'AGGRESSIVE' ? 'FAST' : 'STEADY';
  const cohesion = career.permanentTeam.cohesion;
  return {
    ...integrated,
    pace,
    participants: integrated.participants.map(participant => participant.memberId && career.permanentTeam.memberIds.includes(participant.memberId) ? { ...participant, trust: clamp(participant.trust + cohesion * .08), morale: clamp(participant.morale + cohesion * .05), energy: clamp(participant.energy + cohesion * .035) } : participant),
    message: `${career.permanentTeam.name}: привычный состав выходит в темпе «${pace === 'CAUTIOUS' ? 'осторожный' : pace === 'FAST' ? 'быстрый' : 'рабочий'}».`,
  };
}

function weatherLabel(temperatureC: number, windKmh: number, visibility: number) {
  const sky = visibility < 35 ? 'Белая мгла' : visibility < 60 ? 'Снег и облачность' : visibility < 80 ? 'Переменная облачность' : 'Чистое небо';
  return `${sky} · ${temperatureC}°C · ветер ${windKmh} км/ч`;
}

export function startPlannedClimb(career: CareerState): CareerState {
  const readiness = expeditionReadiness(career);
  const hardBlockers = readiness.blockers;
  if (hardBlockers.length || readiness.total < 54 || career.activeClimb) return career;
  const route = getSelectedRoute(career);
  const window = getSelectedWeather(career);
  const team = selectedTeam(career);
  const schoolPlan = Boolean(career.acceptedOffer && career.membership.mode !== 'INDEPENDENT');
  const cost = schoolPlan ? 0 : expeditionCost(career);
  const startEnergy = clamp(96 - career.hero.fatigue * .28 - Math.max(0, packWeight(career) - 13) * 1.2, 58, 96);
  const simulation = createExpeditionSimulation(route);
  const strategic = createStrategicExpedition(route);
  const plannedDays = Math.max(career.expeditionPlan.foodDays, Math.ceil(strategic.baselineMinutes / 1440) + 1);
  const groupSize = team.length + 1;
  const climb: QualificationClimb = {
    id: `exp-${career.id}-${career.completedClimbs + 1}-${route.id}`,
    expeditionOfferId: career.expeditionPlan.offerId,
    leaderNpcId: career.expeditionPlan.leaderNpcId,
    playerRole: career.expeditionPlan.playerRole,
    authorityMode: career.expeditionPlan.authorityMode,
    purpose: career.acceptedOffer?.purpose ?? 'SUMMIT',
    mountainId: route.mountainId,
    mountainName: route.mountainName,
    routeId: route.id,
    routeName: route.name,
    routeStyle: route.style,
    startElevation: route.startElevation,
    summitElevation: route.summitElevation,
    phase: 'ASCENT',
    summitReached: false,
    retreating: false,
    segmentIndex: 0,
    moveCount: 0,
    currentElevation: route.startElevation,
    elapsedMinutes: 0,
    energy: startEnergy,
    condition: career.hero.health,
    weather: weatherLabel(window.temperatureC, window.windKmh, 86),
    temperatureC: window.temperatureC,
    windKmh: window.windKmh,
    visibility: 86,
    weatherStep: 0,
    packWeightKg: packWeight(career),
    teamMemberIds: team.map(member => member.id),
    teamStates: createClimbTeamStates(team),
    decisions: [],
    casualties: [],
    rescuedMemberIds: [],
    teamCondition: team.length ? Math.round(team.reduce((sum, member) => sum + member.condition, 0) / team.length) : career.hero.health,
    supplies: {
      foodUnits: Math.max(career.expeditionPlan.foodDays, plannedDays) * groupSize * 3,
      waterUnits: Math.max(12, groupSize * Math.max(6, plannedDays * 4)),
      fuelUnits: Math.max(career.expeditionPlan.fuelUnits * 2, plannedDays * 3),
    },
    hoursAwake: 0,
    campEstablished: false,
    route: route.segments,
    ascentRoute: route.segments,
    descentRoute: route.descentSegments ?? defaultDescentSegments(route),
    segmentChoices: {},
    routeChoices: [],
    fixedRopeSegmentIds: [],
    ropeMetersRemaining: ropeMetersFromGear(career.expeditionPlan.gear),
    caches: [],
    log: [`05:10 — ${career.expeditionPlan.authorityMode === 'COMMAND' ? 'группа' : 'экспедиция под руководством другого альпиниста'} вышла на ${route.name}. Твоя роль: ${career.expeditionPlan.playerRole}. Высота старта ${route.startElevation} м. Окно: ${window.label}.`],
    injuries: [],
    earnedReputation: 0,
    earnedMoney: 0,
    participant: career.expeditionPlan.authorityMode === 'PARTICIPANT' ? createParticipantExpeditionState(route) : null,
    simulation,
    strategic,
    topo: null,
  };
  climb.topo = createCareerIntegratedExpedition(career, climb.id, route, window, team, climb.supplies, startEnergy, climb.ropeMetersRemaining);
  if (climb.participant && climb.strategic) {
    climb.participant.targetActions = climb.strategic.ascentSectors.length + climb.strategic.descentSectors.length;
  }
  const timeline = advanceDays(career, schoolPlan ? 0 : window.startsInDays + career.expeditionPlan.acclimatizationDays);
  let next: CareerState = {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    activeClimb: climb,
    hero: { ...career.hero, money: career.hero.money - cost, age: career.hero.age + timeline.ageDelta },
  };
  next = recordSeasonExpeditionStart(next, route.id, cost);
  next.log = [...career.log, careerLog(next, 'EXPEDITION', `Выход на ${route.mountainName}`, `${route.name}. Группа: ${team.length + 1}. Расходы: ${cost} кр. Готовность: ${readiness.total}/100.`)];
  return timeline.year > career.year ? rollCareerSeason(career, next) : syncCareerProgression(next);
}

export function startQualificationClimb(career: CareerState, _world?: WorldState): CareerState {
  return startPlannedClimb(career);
}


export function ensureIntegratedExpedition(career: CareerState): CareerState {
  const climb = career.activeClimb;
  if (!climb || ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase)) return career;
  if (climb.topo) {
    const normalized = normalizeIntegratedExpeditionState(climb.topo);
    return normalized === climb.topo ? career : { ...career, activeClimb: { ...climb, topo: normalized } };
  }
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  const window = getSelectedWeather(career);
  const team = career.teamRoster.filter(member => climb.teamMemberIds.includes(member.id));
  const source: CareerState = {
    ...career,
    expeditionPlan: {
      ...career.expeditionPlan,
      authorityMode: climb.authorityMode,
      playerRole: climb.playerRole,
      leaderNpcId: climb.leaderNpcId,
      teamMemberIds: climb.teamMemberIds,
      ropeMeters: climb.ropeMetersRemaining,
    },
  };
  const topo = createCareerIntegratedExpedition(source, climb.id, route, window, team, climb.supplies, climb.energy, climb.ropeMetersRemaining);
  return { ...career, activeClimb: { ...climb, topo } };
}

export function persistIntegratedExpedition(career: CareerState, topo: IntegratedExpeditionState): CareerState {
  const climb = career.activeClimb;
  if (!climb || climb.id !== topo.seed) return career;
  const weather = integratedWeatherAt(topo);
  const heroState = topo.participants.find(participant => participant.memberId === null) ?? topo.participants[0];
  const teamByMemberId = new Map(topo.participants.filter(participant => participant.memberId).map(participant => [participant.memberId!, participant]));
  const teamStates = climb.teamStates.map(state => {
    const participant = teamByMemberId.get(state.memberId);
    if (!participant) return state;
    return {
      ...state,
      condition: participant.condition,
      fatigue: participant.fatigue,
      morale: participant.morale,
      status: participant.status === 'DEAD' ? 'DEAD' as const : participant.status === 'INCAPACITATED' ? 'INCAPACITATED' as const : 'ACTIVE' as const,
      visibleInjury: participant.injury,
      summitReached: topo.summitReached,
    };
  });
  const fixedRopeSegmentIds = Object.entries(topo.infrastructure).flatMap(([stageId, infra]) => infra.ropes.map(point => `${stageId}:${point}`));
  const nextClimb: QualificationClimb = {
    ...climb,
    topo,
    phase: topo.phase,
    summitReached: topo.summitReached,
    retreating: topo.retreating,
    currentElevation: topo.currentElevation,
    elapsedMinutes: topo.elapsedMinutes,
    moveCount: topo.actionSerial,
    energy: heroState?.energy ?? integratedTeamEnergy(topo),
    condition: heroState?.condition ?? integratedTeamCondition(topo),
    teamCondition: integratedTeamCondition(topo),
    teamStates,
    supplies: { ...topo.supplies },
    hoursAwake: topo.elapsedMinutes / 60,
    campEstablished: Object.values(topo.infrastructure).some(infra => infra.camps.length > 0),
    ropeMetersRemaining: topo.ropeMeters,
    fixedRopeSegmentIds,
    weather: weatherLabel(weather.temperatureC, weather.windKmh, weather.visibility),
    temperatureC: weather.temperatureC,
    windKmh: weather.windKmh,
    visibility: weather.visibility,
    weatherStep: Math.floor(topo.elapsedMinutes / 60),
    injuries: [...topo.injuries],
    casualties: [...topo.casualties],
    rescuedMemberIds: [...topo.rescuedMemberIds],
  };
  return { ...career, activeClimb: nextClimb };
}

function paceData(pace: ClimbPace) {
  if (pace === 'CAUTIOUS') return { time: 1.28, energy: .82, risk: -.035, label: 'осторожно' };
  if (pace === 'FAST') return { time: .78, energy: 1.34, risk: .075, label: 'быстро' };
  return { time: 1, energy: 1, risk: 0, label: 'ровным темпом' };
}

function mountainActionMultipliers(route: ExpeditionRoute, phase: QualificationClimb['phase']) {
  return {
    duration: route.mountainCharacterId === 'ENDURANCE' ? 1.18 : route.mountainCharacterId === 'DESCENT' && phase === 'DESCENT' ? 1.12 : 1,
    energy: route.mountainCharacterId === 'ALTITUDE' ? 1.2 : 1,
    risk: route.mountainCharacterId === 'WEATHER' ? .045 : route.mountainCharacterId === 'TECHNICAL' ? .035 : route.mountainCharacterId === 'DESCENT' && phase === 'DESCENT' ? .07 : 0,
  };
}

export function getCurrentRouteDecision(career: CareerState) {
  const climb = career.activeClimb;
  if (!climb || climb.phase !== 'ASCENT') return null;
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  const segment = climb.route[climb.segmentIndex];
  if (!segment?.decisionId || climb.segmentChoices[segment.decisionId]) return null;
  return route.decisions?.find(item => item.id === segment.decisionId) ?? null;
}

export function chooseRouteDecision(career: CareerState, optionId: string): ClimbStepResult {
  const climb = career.activeClimb;
  const decision = getCurrentRouteDecision(career);
  if (!climb || !decision) return { career, headline: 'Решение недоступно', detail: 'На текущем участке нет открытого выбора линии.', severity: 'WARNING' };
  const option = decision.options.find(item => item.id === optionId);
  if (!option) return { career, headline: 'Линия не найдена', detail: 'Выбери один из доступных вариантов.', severity: 'WARNING' };
  if (option.requiresGearId && (career.expeditionPlan.gear[option.requiresGearId] ?? 0) <= 0) {
    return { career, headline: 'Не хватает снаряжения', detail: 'Эта линия недоступна с текущим комплектом.', severity: 'DANGER' };
  }
  if (option.requiresRopeMeters && climb.ropeMetersRemaining < option.requiresRopeMeters) {
    return { career, headline: 'Не хватает верёвки', detail: `Нужно ${option.requiresRopeMeters} м, осталось ${climb.ropeMetersRemaining} м.`, severity: 'DANGER' };
  }
  const duration = option.requiresRopeMeters ? 45 : 15;
  const segment = climb.route[climb.segmentIndex]!;
  const elapsedMinutes = climb.elapsedMinutes + duration;
  const usesFixedLine = Boolean(option.requiresRopeMeters);
  const nextClimb: QualificationClimb = {
    ...climb,
    elapsedMinutes,
    hoursAwake: climb.hoursAwake + duration / 60,
    segmentChoices: { ...climb.segmentChoices, [decision.id]: option.id },
    routeChoices: [...climb.routeChoices, { decisionId: decision.id, optionId: option.id, title: option.title, note: option.resultNote, elapsedMinutes }],
    fixedRopeSegmentIds: usesFixedLine ? [...new Set([...climb.fixedRopeSegmentIds, segment.id])] : climb.fixedRopeSegmentIds,
    ropeMetersRemaining: climb.ropeMetersRemaining - (option.requiresRopeMeters ?? 0),
    log: [...climb.log, `${clock(elapsedMinutes)} — ${decision.title}: ${option.resultNote}`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: option.title, detail: option.resultNote, severity: option.tone === 'BOLD' ? 'WARNING' : option.tone === 'SAFE' ? 'SUCCESS' : 'CALM' };
}

export function fixRope(career: CareerState): ClimbStepResult {
  if (career.activeClimb?.simulation) return resolveSimulationFieldAction(career, 'FIX_ROPE');
  const climb = career.activeClimb;
  if (!climb || climb.phase !== 'ASCENT') return { career, headline: 'Верёвка недоступна', detail: 'Стационарную линию можно оставить только на подъёме.', severity: 'WARNING' };
  const segment = climb.route[climb.segmentIndex]!;
  if (climb.fixedRopeSegmentIds.includes(segment.id)) return { career, headline: 'Линия уже закреплена', detail: 'Этот участок уже подготовлен для обратного пути.', severity: 'CALM' };
  if (segment.exposure < 38 && segment.difficulty < 48) return { career, headline: 'Закрепление не требуется', detail: 'На этом участке верёвка даст мало пользы и только увеличит время.', severity: 'WARNING' };
  if (climb.ropeMetersRemaining < 20) return { career, headline: 'Не хватает верёвки', detail: `Нужно 20 м, осталось ${climb.ropeMetersRemaining} м.`, severity: 'DANGER' };
  const duration = 50;
  const weather = evolveWeather(career, climb, duration);
  const elapsedMinutes = climb.elapsedMinutes + duration;
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes,
    hoursAwake: climb.hoursAwake + duration / 60,
    energy: clamp(climb.energy - 3),
    ropeMetersRemaining: climb.ropeMetersRemaining - 20,
    fixedRopeSegmentIds: [...climb.fixedRopeSegmentIds, segment.id],
    log: [...climb.log, `${clock(elapsedMinutes)} — на участке «${segment.name}» оставлено 20 м стационарной верёвки.`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: 'Линия закреплена', detail: 'Потрачено 20 м верёвки и 50 минут. Риск на этом участке при спуске снижен.', severity: 'SUCCESS' };
}

export function leaveCache(career: CareerState): ClimbStepResult {
  const climb = career.activeClimb;
  if (!climb || climb.phase !== 'ASCENT') return { career, headline: 'Закладка недоступна', detail: 'Запас оставляют на подъёме и забирают при возвращении.', severity: 'WARNING' };
  const segment = climb.route[climb.segmentIndex]!;
  if (!segment.campPossible) return { career, headline: 'Нет безопасного места', detail: 'На текущем участке закладку может сорвать или потерять.', severity: 'WARNING' };
  if (climb.caches.some(item => item.segmentId === segment.id && !item.recovered)) return { career, headline: 'Закладка уже есть', detail: 'На этой высоте уже оставлен запас.', severity: 'CALM' };
  if (climb.supplies.foodUnits < 6 || climb.supplies.waterUnits < 5 || climb.supplies.fuelUnits < 2) {
    return { career, headline: 'Запас слишком мал', detail: 'Для закладки нужно оставить 4 еды, 3 воды и 1 топливо, сохранив рабочий резерв наверх.', severity: 'DANGER' };
  }
  const duration = 30;
  const elapsedMinutes = climb.elapsedMinutes + duration;
  const cache = { id: `cache-${climb.id}-${climb.caches.length + 1}`, segmentId: segment.id, elevation: climb.currentElevation, foodUnits: 4, waterUnits: 3, fuelUnits: 1, recovered: false };
  const nextClimb: QualificationClimb = {
    ...climb,
    elapsedMinutes,
    hoursAwake: climb.hoursAwake + .5,
    packWeightKg: Math.max(4, Math.round((climb.packWeightKg - 1.2) * 10) / 10),
    supplies: { foodUnits: climb.supplies.foodUnits - 4, waterUnits: climb.supplies.waterUnits - 3, fuelUnits: climb.supplies.fuelUnits - 1 },
    caches: [...climb.caches, cache],
    log: [...climb.log, `${clock(elapsedMinutes)} — на ${climb.currentElevation} м оставлена закладка для спуска.`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: 'Закладка оставлена', detail: 'Рюкзаки стали легче. Запас автоматически будет найден на спуске, если группа вернётся этой высотой.', severity: 'SUCCESS' };
}

function calculateClimbAction(career: CareerState, pace: ClimbPace) {
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'DESCENT'].includes(climb.phase)) return null;
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  const segment = climb.route[climb.segmentIndex]!;
  if (segment.decisionId && !climb.segmentChoices[segment.decisionId]) return null;
  const paceMod = paceData(pace);
  const skill = career.hero.skills[segment.skill];
  const descentPenalty = climb.phase === 'DESCENT' ? 7 : 0;
  const fatiguePenalty = (100 - climb.energy) * .13 + career.hero.fatigue * .08 + climb.hoursAwake * .45;
  const weatherPenalty = Math.max(0, climb.windKmh - 24) * .24 + Math.max(0, 65 - climb.visibility) * .15;
  const teamSupport = Math.max(0, climb.teamCondition - 70) * .12 + climb.teamMemberIds.length * 1.8;
  const packPenalty = Math.max(0, climb.packWeightKg - 13) * .7;
  const ability = skill * 10 + career.hero.form * .28 + climb.energy * .16 + teamSupport - fatiguePenalty - weatherPenalty - packPenalty;
  const target = segment.difficulty + descentPenalty + segment.exposure * .08;
  const mountain = mountainActionMultipliers(route, climb.phase);
  const decision = segment.decisionId ? route.decisions?.find(item => item.id === segment.decisionId) : null;
  const optionId = segment.decisionId ? climb.segmentChoices[segment.decisionId] : null;
  const choice = decision?.options.find(item => item.id === optionId);
  const fixedAscentId = segment.linkedAscentSegmentId ?? segment.id;
  const fixedProtection = climb.fixedRopeSegmentIds.includes(fixedAscentId);
  let incidentChance = clamp(.02 + Math.max(0, target - ability) * .011 + paceMod.risk + mountain.risk + (choice?.riskModifier ?? 0) - (fixedProtection ? .085 : 0), .01, .78);
  if (climb.supplies.waterUnits <= 0) incidentChance += .08;
  if (climb.supplies.foodUnits <= 0) incidentChance += .06;
  const durationMinutes = Math.round(segment.baseDurationMinutes * paceMod.time * mountain.duration * (choice?.durationModifier ?? 1) * (fixedProtection && climb.phase === 'DESCENT' ? .82 : 1));
  const energyCost = Math.round((4 + segment.difficulty * .078 + segment.exposure * .018 + climb.hoursAwake * .08) * paceMod.energy * (climb.phase === 'DESCENT' ? .8 : 1) * mountain.energy * (choice?.energyModifier ?? 1));
  const teamSize = climb.teamMemberIds.length + 1;
  const hours = durationMinutes / 60;
  const foodCost = Math.max(1, Math.ceil(hours / 5)) * Math.max(1, Math.ceil(teamSize / 2));
  const waterCost = Math.max(1, Math.ceil(hours / 4)) * Math.max(1, Math.ceil(teamSize / 3));
  return { route, segment, paceMod, incidentChance: clamp(incidentChance, .01, .9), durationMinutes, energyCost, foodCost, waterCost, fixedProtection, choice };
}

export function previewClimbAction(career: CareerState, pace: ClimbPace): ClimbActionPreview | null {
  const value = calculateClimbAction(career, pace);
  if (!value) return null;
  const risk = Math.round(value.incidentChance * 100);
  const riskLabel: ClimbActionPreview['riskLabel'] = risk < 10 ? 'НИЗКИЙ' : risk < 23 ? 'СРЕДНИЙ' : risk < 42 ? 'ВЫСОКИЙ' : 'КРИТИЧЕСКИЙ';
  const summary = pace === 'CAUTIOUS'
    ? 'Меньше шанс ошибки, но больше времени под погодой.'
    : pace === 'FAST'
      ? 'Быстрее покинешь участок, но сильнее устанешь и дороже заплатишь за ошибку.'
      : 'Ровный компромисс без дополнительной защиты и без форсирования.';
  return { pace, durationMinutes: value.durationMinutes, energyCost: value.energyCost, incidentRisk: risk, foodCost: value.foodCost, waterCost: value.waterCost, riskLabel, summary };
}

function clock(minutes: number) {
  const start = 5 * 60 + 10;
  const value = start + minutes;
  const day = Math.floor(value / 1440);
  const hour = Math.floor(value / 60) % 24;
  const minute = value % 60;
  return `${day > 0 ? `D${day + 1} ` : ''}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function evolveWeather(career: CareerState, climb: QualificationClimb, elapsedDelta: number) {
  const rng = createRng(`${career.id}:${climb.id}:weather:${climb.weatherStep}:${Math.floor((climb.elapsedMinutes + elapsedDelta) / 90)}`);
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  const volatile = route.mountainCharacterId === 'WEATHER';
  const phase = Math.floor((climb.elapsedMinutes + elapsedDelta) / 240);
  const frontPush = phase > 3 ? (phase - 3) * (volatile ? 3 : 2) : 0;
  const temperatureC = clamp(climb.temperatureC + rng.int(volatile ? -4 : -2, volatile ? 3 : 2), -36, 8);
  const windKmh = clamp(climb.windKmh + rng.int(volatile ? -8 : -5, volatile ? 14 : 8) + frontPush, 4, 96);
  const visibility = clamp(climb.visibility + rng.int(volatile ? -20 : -13, volatile ? 13 : 9) - Math.max(0, frontPush - 4), 8, 100);
  return {
    temperatureC,
    windKmh,
    visibility,
    weatherStep: climb.weatherStep + 1,
    weather: weatherLabel(temperatureC, windKmh, visibility),
  };
}

function consumeSupplies(climb: QualificationClimb, hours: number) {
  const teamSize = climb.teamMemberIds.length + 1;
  const foodCost = Math.max(1, Math.ceil(hours / 5)) * Math.max(1, Math.ceil(teamSize / 2));
  const waterCost = Math.max(1, Math.ceil(hours / 4)) * Math.max(1, Math.ceil(teamSize / 3));
  return {
    foodUnits: Math.max(0, climb.supplies.foodUnits - foodCost),
    waterUnits: Math.max(0, climb.supplies.waterUnits - waterCost),
    fuelUnits: climb.supplies.fuelUnits,
  };
}

function evolveTeamStates(career: CareerState, climb: QualificationClimb, duration: number, pace: ClimbPace, coldPenalty: number) {
  const rng = createRng(`${career.id}:${climb.id}:people:${climb.moveCount}:${pace}`);
  let reveal: string | null = null;
  const paceFatigue = pace === 'FAST' ? 1.35 : pace === 'CAUTIOUS' ? .78 : 1;
  const states = climb.teamStates.map(state => {
    if (state.status !== 'ACTIVE') return state;
    const member = career.teamRoster.find(item => item.id === state.memberId);
    if (!member) return state;
    const hours = duration / 60;
    const fatigueGain = Math.max(1, hours * (5.2 - member.endurance * .38) * paceFatigue);
    const fatigue = clamp(state.fatigue + fatigueGain, 0, 100);
    const strain = Math.max(0, fatigue - 62) * .045 + coldPenalty + rng.int(0, 2);
    const condition = clamp(state.condition - strain, 0, 100);
    let moraleDelta = 0;
    if (pace === 'FAST') moraleDelta += member.personality.ambition > 65 ? 2 : member.personality.caution > 70 ? -3 : 0;
    if (pace === 'CAUTIOUS') moraleDelta += member.personality.caution > 65 ? 2 : member.personality.ambition > 75 ? -2 : 0;
    let visibleInjury = state.visibleInjury;
    let hiddenInjury = state.hiddenInjury;
    if (!visibleInjury && hiddenInjury && (condition < 70 || fatigue > 64) && rng.chance(.42)) {
      visibleInjury = hiddenInjury;
      reveal = `${member.name} признался: ${hiddenInjury.toLowerCase()}.`;
    }
    const status = condition < 18 ? 'INCAPACITATED' as const : state.status;
    return { ...state, fatigue, condition, morale: clamp(state.morale + moraleDelta), visibleInjury, hiddenInjury, status };
  });
  return { states, teamCondition: teamAverage(states), reveal };
}

function expeditionSkillPractice(career: CareerState, climb: QualificationClimb, route: ExpeditionRoute): Partial<Record<SkillId, number>> {
  const elapsedHours = Math.max(1, climb.elapsedMinutes / 60);
  const segments = [...route.segments, ...(route.descentSegments ?? [])];
  const completedRatio = climb.topo
    ? Math.max(.2, Math.min(1, Object.keys(climb.topo.completedStagePaths).length / Math.max(1, segments.length)))
    : climb.summitReached ? 1 : .55;
  const segmentCount = (skill: SkillId) => segments.filter(segment => segment.skill === skill).length;
  const revealed = climb.topo ? Object.values(climb.topo.infrastructure).reduce((sum, item) => sum + item.revealed.length, 0) : 0;
  const medicalEvents = climb.topo?.incidents.filter(item => ['FALL', 'FROSTBITE', 'ALTITUDE', 'EXHAUSTION', 'RESCUE'].includes(item.type)).length ?? climb.injuries.length;
  const practice: Partial<Record<SkillId, number>> = {
    ENDURANCE: Math.round(Math.min(32, 4 + elapsedHours * .72 + Math.max(0, climb.topo?.nightsSlept ?? 0) * 2)),
    ROCK: Math.round(Math.min(26, segmentCount('ROCK') * 4.5 * completedRatio)),
    ICE: Math.round(Math.min(26, segmentCount('ICE') * 4.5 * completedRatio)),
    NAVIGATION: Math.round(Math.min(24, 3 + revealed * .3 + segmentCount('NAVIGATION') * 4 * completedRatio)),
    MEDICINE: Math.round(Math.min(22, medicalEvents * 4 + climb.rescuedMemberIds.length * 7 + (career.expeditionPlan.playerRole === 'MEDIC' ? 3 : 0))),
    LEADERSHIP: Math.round(Math.min(24, (climb.authorityMode === 'COMMAND' ? 5 : 2) + climb.decisions.length * 2 + (climb.retreating ? 3 : 0) + (climb.casualties.length ? 0 : 2))),
  };
  return Object.fromEntries(Object.entries(practice).filter(([, value]) => (value ?? 0) > 0)) as Partial<Record<SkillId, number>>;
}

function expeditionRecoveryDays(climb: QualificationClimb, route: ExpeditionRoute) {
  const hero = climb.topo?.participants.find(participant => participant.memberId === null);
  const fatigue = hero?.fatigue ?? Math.min(100, 25 + climb.elapsedMinutes / 300);
  const conditionLoss = 100 - (hero?.condition ?? Math.max(40, 100 - climb.injuries.length * 8));
  const sleepDebt = Math.max(0, (climb.topo?.minutesSinceSleep ?? climb.hoursAwake * 60) - 840) / 180;
  return clamp(Math.round(2 + climb.elapsedMinutes / 900 + route.objectiveRisk / 24 + fatigue / 18 + conditionLoss / 15 + sleepDebt + climb.injuries.length * 4), 3, 45);
}

function expeditionMaintenanceCost(climb: QualificationClimb, route: ExpeditionRoute) {
  const gear = climb.topo?.gear;
  const wear = gear ? (100 - gear.ropeCondition) + (100 - gear.hardwareCondition) + (100 - gear.shelterCondition) * .35 + gear.lostWeightKg * 8 : route.technicality * .4;
  return Math.max(8, Math.round(10 + wear * .42 + route.objectiveRisk * .18));
}

function finishClimb(career: CareerState, climb: QualificationClimb): CareerState {
  const successful = climb.summitReached && !climb.retreating;
  let skills = { ...career.hero.skills };
  let skillXp = { ...career.hero.skillXp };
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  const skillPractice = expeditionSkillPractice(career, climb, route);
  for (const [skill, xp] of Object.entries(skillPractice) as Array<[SkillId, number]>) {
    const progressed = addXp(skills, skillXp, skill, xp);
    skills = progressed.skills;
    skillXp = progressed.skillXp;
  }
  const casualtyPenalty = climb.casualties.length * 18;
  const sponsorBonus = successful ? (normalizeCareerProgression(career).sponsor?.summitBonus ?? 0) : 0;
  const grossReward = successful ? Math.max(0, 150 + Math.round(getSelectedRoute(career).objectiveRisk * 1.2) - casualtyPenalty * 3 + sponsorBonus) : 0;
  const rescueCost = climb.topo?.rescueCost ?? 0;
  const maintenanceCost = expeditionMaintenanceCost(climb, route);
  const recoveryDays = expeditionRecoveryDays(climb, route);
  const reward = grossReward - rescueCost - maintenanceCost;
  const reputation = successful ? Math.max(-12, 8 + Math.round(getSelectedRoute(career).technicality / 12) - casualtyPenalty) : climb.retreating ? 1 : -4;
  const participantEvaluation = climb.participant
    ? climb.participant.evaluation ?? evaluateParticipant(climb.participant, successful, climb.casualties.length)
    : null;
  const completed: QualificationClimb = {
    ...climb,
    phase: successful ? 'COMPLETE' : climb.phase === 'FAILED' ? 'FAILED' : 'RETREATED',
    earnedMoney: reward,
    earnedReputation: reputation,
    participant: climb.participant ? { ...climb.participant, evaluation: participantEvaluation } : null,
    currentElevation: climb.startElevation,
    log: [...climb.log, `${clock(climb.elapsedMinutes)} — группа вернулась к исходной точке. ${successful ? 'Восхождение засчитано.' : 'Выход закрыт без вершины.'}${rescueCost > 0 ? ` Спасательная операция обошлась в ${rescueCost} кр.` : ''}`],
  };
  const roster = finalizeRosterAfterClimb(career, completed, successful);
  const report = {
    ...buildExpeditionReport(career, completed, reputation, reward),
    participantEvaluation: participantEvaluation ?? undefined,
    technicality: route.technicality,
    temperatureC: completed.temperatureC,
    authorityMode: completed.authorityMode,
    rescuedCount: completed.rescuedMemberIds.length,
    recoveryDays,
    maintenanceCost,
    skillPractice,
    purpose: completed.purpose ?? 'SUMMIT',
    mentorEvaluation: successful ? 'Наставник отметил уверенное возвращение группы.' : completed.retreating ? 'Безопасный отход засчитан как полезный опыт.' : 'Выход потребует подробного разбора с инструктором.',
  };
  const heroExpeditionState = completed.topo?.participants.find(participant => participant.memberId === null);
  const heroInjuries = heroExpeditionState?.injury && !career.hero.injuries.includes(heroExpeditionState.injury)
    ? [heroExpeditionState.injury]
    : [];
  const careDelta = completed.rescuedMemberIds.length * 7 + (completed.retreating ? 3 : 0) - completed.casualties.length * 12;
  const reliabilityDelta = successful ? 5 : completed.retreating ? 2 : -5;
  const leadershipDelta = Math.round(completed.decisions.filter(item => item.accepted).length * 1.5) - completed.decisions.filter(item => !item.accepted).length * 2;
  const membership = progressMembership(career, completed, successful);
  const permanentParticipants = career.permanentTeam.memberIds.filter(id => completed.teamMemberIds.includes(id));
  const permanentLosses = completed.casualties.filter(id => career.permanentTeam.memberIds.includes(id)).length;
  const permanentTeam = permanentParticipants.length >= 2 ? {
    ...career.permanentTeam,
    climbs: career.permanentTeam.climbs + 1,
    summits: career.permanentTeam.summits + (successful ? 1 : 0),
    rescues: career.permanentTeam.rescues + completed.rescuedMemberIds.filter(id => career.permanentTeam.memberIds.includes(id)).length,
    losses: career.permanentTeam.losses + permanentLosses,
    cohesion: clamp(career.permanentTeam.cohesion + (successful ? 6 : completed.retreating ? 2 : -3) - permanentLosses * 18, 0, 100),
    memberIds: career.permanentTeam.memberIds.filter(id => !completed.casualties.includes(id)),
  } : career.permanentTeam;
  let next: CareerState = {
    ...career,
    completedClimbs: career.completedClimbs + (successful ? 1 : 0),
    highestElevation: Math.max(career.highestElevation, climb.topo?.highestElevation ?? (climb.summitReached ? climb.summitElevation : climb.currentElevation)),
    activeClimb: completed,
    membership,
    permanentTeam,
    recoveryDays,
    teamRoster: roster,
    reports: [...career.reports, report],
    onboarding: { ...career.onboarding, completed: true },
    reputationProfile: {
      leadership: clamp(career.reputationProfile.leadership + leadershipDelta),
      reliability: clamp(career.reputationProfile.reliability + reliabilityDelta),
      care: clamp(career.reputationProfile.care + careDelta),
      ambition: clamp(career.reputationProfile.ambition + (successful ? 6 : completed.retreating ? -1 : 0)),
    },
    hero: {
      ...career.hero,
      reputation: Math.max(0, career.hero.reputation + reputation),
      money: Math.max(0, career.hero.money + reward),
      form: clamp(career.hero.form - 5, 0, 100),
      fatigue: heroExpeditionState ? clamp(heroExpeditionState.fatigue + 12, 0, 100) : clamp(career.hero.fatigue + 25 + Math.round(climb.elapsedMinutes / 400), 0, 100),
      health: heroExpeditionState ? clamp(heroExpeditionState.condition, 0, 100) : clamp(career.hero.health - climb.injuries.length * 4, 0, 100),
      injuries: [...career.hero.injuries, ...(heroExpeditionState ? heroInjuries : climb.injuries)],
      skills,
      skillXp,
    },
  };
  const promotionLog = membership.rank !== career.membership.rank ? [careerLog(next, 'CLUB', `Новый ранг: ${EXPEDITION_RANK_LABELS[membership.rank]}`, 'Полномочия расширены после подтверждённых экспедиций.')] : [];
  next.log = [
    ...career.log,
    ...promotionLog,
    careerLog(next, 'CLIMB', successful ? `Восхождение на ${climb.mountainName}` : `Выход на ${climb.mountainName}`, successful ? `Маршрут «${climb.routeName}» пройден. Группа полностью вернулась.` : 'Группа спустилась без засчитанной вершины.'),
    careerLog(next, 'PRESS', 'Реакция после экспедиции', `${report.clubReaction} ${report.pressReaction}`),
    careerLog(next, 'INJURY', 'Восстановление после выхода', `${recoveryDays} дн. без тяжёлой подготовки. Обслуживание снаряжения: ${maintenanceCost} кр.`),
  ];
  const previousSeasonStage = normalizeFirstSeasonState(career).stage;
  const seasonAdvanced = advanceFirstSeasonAfterExpedition(next, completed, report);
  next = seasonAdvanced;
  const stageRankFloor = previousSeasonStage === 'FIRST_OUTING' ? expeditionRankThresholds.MEMBER
    : previousSeasonStage === 'SKILL_TEST' ? expeditionRankThresholds.SPECIALIST
      : 0;
  if (stageRankFloor > next.membership.rankPoints) {
    const rankPoints = stageRankFloor;
    const rank = rankForPoints(rankPoints);
    next = {
      ...next,
      membership: {
        ...next.membership,
        rankPoints,
        rank,
        authority: next.membership.mode === 'INDEPENDENT' || ['DEPUTY', 'LEADER', 'ORGANIZER'].includes(rank) ? 'COMMAND' : 'PARTICIPANT',
        permissions: permissionsForMembership(next.membership.mode, rank),
      },
      log: [...next.log, careerLog(next, 'CLUB', `Новый ранг: ${EXPEDITION_RANK_LABELS[rank]}`, previousSeasonStage === 'FIRST_OUTING' ? 'Первый учебный выход закрыт. Теперь школа доверяет тебе полноценное место в связке.' : 'Второй выход подтвердил специальность. Ты допущен к главной экспедиции сезона.')],
    };
  }
  if (!career.firstSeason?.graduated && next.firstSeason.graduated) {
    const rankPoints = Math.max(next.membership.rankPoints, expeditionRankThresholds.ROPE_LEAD);
    const rank = rankForPoints(rankPoints);
    next = {
      ...next,
      membership: {
        ...next.membership,
        rankPoints,
        rank,
        authority: next.membership.mode === 'INDEPENDENT' || ['DEPUTY', 'LEADER', 'ORGANIZER'].includes(rank) ? 'COMMAND' : 'PARTICIPANT',
        permissions: permissionsForMembership(next.membership.mode, rank),
      },
      log: [...next.log, careerLog(next, 'CLUB', 'Первый сезон завершён', 'Учебный цикл закрыт. Школа допускает тебя к выбору сложных линий и самостоятельной работе ведущим связки.')],
    };
  }
  return recordSeasonExpeditionResult(next, climb.routeId, successful);
}

function descentRouteFor(career: CareerState, climb: QualificationClimb) {
  const route = career.routes.find(item => item.id === climb.routeId) ?? getSelectedRoute(career);
  return route.descentSegments ?? defaultDescentSegments(route);
}

function descentStartIndex(climb: QualificationClimb, descentRoute: RouteSegment[]) {
  const total = Math.max(1, climb.summitElevation - climb.startElevation);
  const remainingDrop = Math.max(0, climb.currentElevation - climb.startElevation);
  const progressFromSummit = 1 - remainingDrop / total;
  return clamp(Math.floor(progressFromSummit * descentRoute.length), 0, Math.max(0, descentRoute.length - 1));
}

export function beginDescent(career: CareerState): CareerState {
  if (career.activeClimb?.strategic?.status === 'SUMMIT') return beginStrategicDescent(career);
  if (career.activeClimb?.simulation?.status === 'SUMMIT') return beginSimulationDescent(career);
  if (career.activeClimb?.strategic) return beginStrategicDescent(career);
  if (career.activeClimb?.simulation) return beginSimulationDescent(career);
  const climb = career.activeClimb;
  if (!climb || climb.phase !== 'SUMMIT') return career;
  const descentRoute = descentRouteFor(career, climb);
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      summitReached: true,
      route: descentRoute,
      descentRoute,
      segmentIndex: 0,
      campEstablished: false,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — начат отдельный спусковой маршрут. Вершина больше не считается безопасным местом.`],
    },
  };
}

export function retreatClimb(career: CareerState): CareerState {
  if (career.activeClimb?.strategic) return beginStrategicRetreat(career);
  if (career.activeClimb?.simulation) return beginSimulationRetreat(career);
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'SUMMIT'].includes(climb.phase)) return career;
  const descentRoute = descentRouteFor(career, climb);
  const segmentIndex = climb.phase === 'SUMMIT' ? 0 : descentStartIndex(climb, descentRoute);
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      retreating: true,
      summitReached: climb.phase === 'SUMMIT',
      route: descentRoute,
      descentRoute,
      segmentIndex,
      campEstablished: false,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — принято решение об отходе. Группа переходит на спусковую линию с текущей высоты.`],
    },
  };
}

export function issueClimbOrder(career: CareerState, order: ClimbOrderId): ClimbStepResult {
  const climb = career.activeClimb;
  if (climb && climb.authorityMode !== 'COMMAND') {
    return { career, headline: 'Ты не руководитель', detail: 'В этой экспедиции ты можешь выполнить приказ, предложить решение или отказаться, но не командовать всей группой.', severity: 'WARNING' };
  }
  if (!climb || !['ASCENT', 'DESCENT'].includes(climb.phase)) {
    return { career, headline: 'Приказ недоступен', detail: 'Группа сейчас не движется по маршруту.', severity: 'WARNING' };
  }
  const active = climb.teamStates.filter(state => state.status === 'ACTIVE');
  if (!active.length) return { career, headline: 'Некому выполнять приказ', detail: 'В рабочем состоянии не осталось участников.', severity: 'DANGER' };
  const rng = createRng(`${career.id}:${climb.id}:order:${climb.decisions.length}:${order}`);
  const weakest = [...active].sort((a, b) => a.condition - b.condition)[0]!;
  const member = career.teamRoster.find(item => item.id === weakest.memberId)!;
  let accepted = true;
  let duration = 35;
  let headline = 'Приказ принят';
  let detail = '';
  let severity: ClimbStepResult['severity'] = 'CALM';
  let teamStates: QualificationClimb['teamStates'] = climb.teamStates.map(state => ({ ...state, helperForMemberId: null }));
  let teamRoster = career.teamRoster;
  let targetId: string | null = weakest.memberId;

  if (order === 'SLOW_DOWN') {
    duration = 45;
    teamStates = teamStates.map(state => {
      if (state.status !== 'ACTIVE') return state;
      const person = career.teamRoster.find(item => item.id === state.memberId)!;
      return {
        ...state,
        condition: clamp(state.condition + 2, 0, 100),
        morale: clamp(state.morale + (person.personality.caution > 60 ? 3 : person.personality.ambition > 75 ? -2 : 1), 0, 100),
      };
    });
    teamRoster = teamRoster.map(person => climb.teamMemberIds.includes(person.id)
      ? memory(person, career, 'ORDER', 'Темп снижен', 'Ты остановил гонку и приказал группе двигаться плотнее.', person.personality.caution > 60 ? 2 : 0, 1, person.personality.ambition > 78 ? 1 : 0)
      : person);
    targetId = null;
    detail = 'Связки собрались плотнее. Группа потеряла время, но получила небольшой запас состояния.';
  }

  if (order === 'PRESS_ON') {
    const score = member.relationship.trust + member.personality.discipline * .35 + member.personality.ambition * .3 - member.personality.caution * .35 - (100 - weakest.condition) * .38 - member.relationship.resentment * .25 + rng.int(-8, 8);
    accepted = score >= 35;
    duration = 20;
    if (accepted) {
      teamStates = teamStates.map(state => state.status === 'ACTIVE' ? {
        ...state,
        fatigue: clamp(state.fatigue + 5, 0, 100),
        morale: clamp(state.morale + (career.teamRoster.find(item => item.id === state.memberId)!.personality.ambition > 60 ? 3 : -2), 0, 100),
      } : state);
      teamRoster = teamRoster.map(person => person.id === member.id ? memory(person, career, 'ORDER', 'Приказ продолжать', 'Ты потребовал не терять темп, несмотря на состояние группы.', -1, 2, person.personality.caution > 65 ? 3 : 0) : person);
      detail = `${member.name} подчинился. Темп сохранён, усталость группы выросла.`;
      severity = 'WARNING';
    } else {
      teamStates = teamStates.map(state => state.memberId === member.id ? { ...state, morale: clamp(state.morale - 5), refusedOrders: state.refusedOrders + 1 } : state);
      teamRoster = teamRoster.map(person => person.id === member.id ? {
        ...memory(person, career, 'REFUSAL', 'Отказ продолжать', `${person.name} отказался выполнять приказ о продолжении движения.`, -5, -1, 5),
        refusals: person.refusals + 1,
      } : person);
      headline = `${member.name} отказался`;
      detail = 'Состояние и отношение к риску оказались сильнее твоего авторитета.';
      severity = 'DANGER';
    }
  }

  if (order === 'TURN_BACK_WEAKEST') {
    const score = member.personality.caution * .42 + member.relationship.trust * .25 + (100 - weakest.condition) * .5 - member.personality.ambition * .42 - member.personality.ego * .18 + rng.int(-7, 7);
    accepted = score >= 34;
    duration = 35;
    if (accepted) {
      teamStates = teamStates.map(state => state.memberId === member.id ? { ...state, status: 'TURNED_BACK', morale: clamp(state.morale + (member.personality.caution > 60 ? 2 : -7)) } : state);
      teamRoster = teamRoster.map(person => person.id === member.id ? memory(person, career, 'RETREAT', 'Приказ спускаться', 'Ты снял его с маршрута до того, как состояние стало аварийным.', person.personality.caution > 60 ? 4 : -4, 3, person.personality.ambition > 65 ? 7 : 0) : person);
      detail = `${member.name} прекратил подъём. Группа продолжает без него.`;
      severity = 'WARNING';
    } else {
      teamStates = teamStates.map(state => state.memberId === member.id ? { ...state, refusedOrders: state.refusedOrders + 1, morale: clamp(state.morale - 4) } : state);
      teamRoster = teamRoster.map(person => person.id === member.id ? {
        ...memory(person, career, 'REFUSAL', 'Отказ спускаться', `${person.name} отказался покинуть маршрут и потребовал продолжения.`, -6, -2, 8),
        refusals: person.refusals + 1,
      } : person);
      headline = `${member.name} не уходит`;
      detail = 'Приказ расколол группу. Он считает, что ещё способен идти вверх.';
      severity = 'DANGER';
    }
  }

  if (order === 'ASSIGN_HELPER') {
    const target = climb.teamStates.filter(state => ['ACTIVE', 'INCAPACITATED'].includes(state.status) && (state.visibleInjury || state.condition < 67)).sort((a, b) => a.condition - b.condition)[0];
    if (!target) return { career, headline: 'Помощь не требуется', detail: 'У группы нет выявленного участника, которому нужна поддержка.', severity: 'CALM' };
    const helperState = [...active].filter(state => state.memberId !== target.memberId).sort((a, b) => {
      const am = career.teamRoster.find(item => item.id === a.memberId)!;
      const bm = career.teamRoster.find(item => item.id === b.memberId)!;
      return (bm.personality.empathy + b.condition) - (am.personality.empathy + a.condition);
    })[0];
    if (!helperState) return { career, headline: 'Нет свободного напарника', detail: 'Оставшийся состав не позволяет выделить сопровождающего.', severity: 'DANGER' };
    const targetMember = career.teamRoster.find(item => item.id === target.memberId)!;
    const helper = career.teamRoster.find(item => item.id === helperState.memberId)!;
    targetId = target.memberId;
    duration = 60;
    teamStates = teamStates.map(state => state.memberId === target.memberId
      ? { ...state, condition: clamp(state.condition + 7), morale: clamp(state.morale + 6), status: 'ACTIVE' }
      : state.memberId === helper.id
        ? { ...state, fatigue: clamp(state.fatigue + 8), helperForMemberId: target.memberId }
        : state);
    teamRoster = teamRoster.map(person => {
      if (person.id === targetMember.id) {
        const remembered = memory(person, career, 'RESCUE', 'Получил помощь', `${helper.name} снял часть груза и помог удержать движение.`, 5, 4, -2);
        return { ...remembered, relationship: { ...remembered.relationship, debt: clamp(remembered.relationship.debt + 8) } };
      }
      if (person.id === helper.id) return { ...memory(person, career, 'LOYALTY', 'Остался рядом', `Ты назначил его помогать ${targetMember.name}.`, 3, 4, 0), rescues: person.rescues + 1 };
      return person;
    });
    detail = `${helper.name} помогает ${targetMember.name}. Темп снизился, но состояние стабилизировано.`;
    severity = 'SUCCESS';
  }

  const elapsedMinutes = climb.elapsedMinutes + duration;
  const decision = {
    id: `decision-${climb.id}-${climb.decisions.length + 1}`,
    order,
    memberId: targetId,
    accepted,
    description: detail,
    elapsedMinutes,
  };
  const nextClimb = {
    ...climb,
    elapsedMinutes,
    hoursAwake: climb.hoursAwake + duration / 60,
    teamStates,
    teamCondition: teamAverage(teamStates),
    decisions: [...climb.decisions, decision],
    rescuedMemberIds: order === 'ASSIGN_HELPER' && accepted && targetId ? [...new Set([...climb.rescuedMemberIds, targetId])] : climb.rescuedMemberIds,
    log: [...climb.log, `${clock(elapsedMinutes)} — ${detail}`],
  };
  return { career: { ...career, activeClimb: nextClimb, teamRoster }, headline, detail, severity };
}

function fieldTexture(segment: RouteSegment, climb: QualificationClimb, temperatureC: number, windKmh: number, visibility: number, pace: ClimbPace, rng: ReturnType<typeof createRng>) {
  if (visibility <= 25) return rng.pick([
    'Метки исчезают в белой пелене. Связка двигается по голосу и натяжению верёвки.',
    'Передний участник видит только несколько метров склона. Ошибка линии сразу отнимает время.',
  ]);
  if (windKmh >= 55) return rng.pick([
    'Порывы сбивают дыхание и заставляют людей останавливаться перед каждым открытым местом.',
    'На гребне слышен только ветер. Команды передают жестами.',
  ]);
  if (temperatureC <= -22) return 'Пальцы быстро теряют чувствительность. Каждая операция со страховкой занимает больше времени.';
  if (climb.supplies.waterUnits <= 3) return 'Фляги почти пусты. Люди экономят глотки и начинают двигаться суше.';
  if (climb.hoursAwake >= 12) return 'Разговоров почти нет. Ошибки появляются в простых действиях: узлах, карабинах, порядке движения.';
  if (segment.terrain.toLowerCase().includes('лед')) return 'Под кошками звенит жёсткий лёд. Каждая точка страховки проверяется дважды.';
  if (segment.terrain.toLowerCase().includes('скал')) return 'Камень холодный и ломкий. Крупные блоки приходится проверять перед каждым движением.';
  if (pace === 'FAST') return 'Темп высокий. Группа быстро выигрывает высоту, но паузы на проверку почти исчезли.';
  if (pace === 'CAUTIOUS') return 'Связка идёт короткими отрезками и постоянно проверяет точки. Время уходит, контроль остаётся.';
  return 'Движение ровное. Люди держат дистанцию и не тратят силы на лишние рывки.';
}

export function resolveParticipantAction(career: CareerState, optionId: string): ClimbStepResult {
  if (career.activeClimb?.simulation) return resolveExpeditionEventChoice(career, optionId);
  const climb = career.activeClimb;
  const participant = climb?.participant;
  const scene = getCurrentParticipantScene(career);
  const node = getCurrentParticipantNode(career);
  if (!climb || !participant || !scene || !node || climb.authorityMode !== 'PARTICIPANT') {
    return { career, headline: 'Личное решение недоступно', detail: 'Эта экспедиция не использует режим участника.', severity: 'WARNING' };
  }
  const selected = scene.options.find(optionValue => optionValue.id === optionId);
  if (!selected) return { career, headline: 'Решение не найдено', detail: '', severity: 'WARNING' };
  const skillResult = resolveParticipantSkill(career, selected);
  const failedCheck = Boolean(selected.skill) && !skillResult.success;
  const scale = failedCheck ? -.45 : 1;
  const signedEffect = (value: number) => value >= 0 ? value * scale : value;
  const ordersReceived = participant.ordersReceived + (scene.kind === 'ORDER' ? 1 : 0);
  const ordersObeyed = participant.ordersObeyed + (scene.kind === 'ORDER' && selected.tone === 'OBEY' ? 1 : 0);
  const ordersRefused = participant.ordersRefused + (scene.kind === 'ORDER' && selected.tone === 'REFUSE' ? 1 : 0);
  const elapsedMinutes = climb.elapsedMinutes + selected.advanceMinutes;
  const detail = failedCheck
    ? `${selected.detail} Навыка не хватило: решение выполнено плохо.`
    : `${selected.detail}${selected.skill ? ' Работа выполнена уверенно.' : ''}`;
  const decision = {
    id: `participant-${climb.id}-${participant.totalActions + 1}`,
    sceneId: scene.id,
    nodeId: node.id,
    optionId: selected.id,
    optionTitle: selected.title,
    tone: selected.tone,
    success: !failedCheck,
    detail,
    elapsedMinutes,
  } as const;
  const nextParticipant = {
    ...participant,
    nodeActionIndex: participant.nodeActionIndex + 1,
    totalActions: participant.totalActions + 1,
    leaderTrust: clamp(participant.leaderTrust + signedEffect(selected.leaderTrustDelta) - (failedCheck ? 1 : 0)),
    groupTrust: clamp(participant.groupTrust + signedEffect(selected.groupTrustDelta)),
    discipline: participant.discipline + signedEffect(selected.disciplineDelta),
    initiative: participant.initiative + signedEffect(selected.initiativeDelta),
    care: participant.care + signedEffect(selected.careDelta),
    competence: participant.competence + signedEffect(selected.competenceDelta) - (failedCheck ? 1 : 0),
    rankPointsEarned: participant.rankPointsEarned + Math.max(0, selected.rankDelta + (failedCheck ? 0 : 1)),
    ordersReceived,
    ordersObeyed,
    ordersRefused,
    decisions: [...participant.decisions, decision],
  };
  const personalClimb: QualificationClimb = {
    ...climb,
    elapsedMinutes,
    hoursAwake: climb.hoursAwake + selected.advanceMinutes / 60,
    energy: clamp(climb.energy + selected.energyDelta * .55 - (failedCheck ? 1 : 0)),
    condition: clamp(climb.condition + selected.conditionDelta - (failedCheck ? 1 : 0)),
    teamCondition: clamp(climb.teamCondition + signedEffect(selected.teamDelta)),
    supplies: climb.supplies,
    participant: nextParticipant,
    log: [...climb.log, `${clock(elapsedMinutes)} — ${scene.title}: ${selected.title}. ${detail}`],
  };
  let nextCareer: CareerState = { ...career, activeClimb: personalClimb };
  if (personalClimb.energy <= 4 || personalClimb.condition <= 30) {
    return {
      career: { ...nextCareer, activeClimb: { ...personalClimb, phase: 'FAILED', log: [...personalClimb.log, `${clock(elapsedMinutes)} — личное состояние больше не позволяет продолжать.`] } },
      headline: 'Ты больше не можешь продолжать',
      detail: 'Экспедиция вынуждена организовать твой отход.',
      severity: 'DANGER',
    };
  }
  if (nextParticipant.nodeActionIndex < node.requiredActionCount) {
    return { career: nextCareer, headline: selected.title, detail, severity: failedCheck ? 'WARNING' : selected.tone === 'REFUSE' ? 'WARNING' : 'CALM' };
  }

  const advanceParticipant = (target: CareerState, extra: Partial<QualificationClimb['participant']> = {}) => {
    const active = target.activeClimb;
    if (!active?.participant) return target;
    return {
      ...target,
      activeClimb: {
        ...active,
        participant: {
          ...active.participant,
          graphNodeIndex: active.participant.graphNodeIndex + 1,
          nodeActionIndex: 0,
          ...extra,
        },
      },
    };
  };

  const restParticipantGroup = (target: CareerState, recovery: number, label: string) => {
    const active = target.activeClimb;
    if (!active) return target;
    const teamSize = Math.max(1, active.teamMemberIds.length + 1);
    const restedStates = active.teamStates.map(state => state.status === 'ACTIVE' ? {
      ...state,
      condition: clamp(state.condition + Math.round(recovery * .32)),
      fatigue: clamp(state.fatigue - recovery),
      morale: clamp(state.morale + 2),
    } : state);
    const restMinutes = recovery >= 28 ? 6 * 60 : 3 * 60;
    return {
      ...target,
      activeClimb: {
        ...active,
        elapsedMinutes: active.elapsedMinutes + restMinutes,
        energy: clamp(active.energy + recovery),
        condition: clamp(active.condition + Math.round(recovery * .12)),
        teamStates: restedStates,
        teamCondition: teamAverage(restedStates),
        supplies: {
          foodUnits: Math.max(0, active.supplies.foodUnits - Math.max(1, Math.ceil(teamSize / 2))),
          waterUnits: Math.max(0, active.supplies.waterUnits - Math.max(1, Math.ceil(teamSize / 3))),
          fuelUnits: Math.max(0, active.supplies.fuelUnits - (recovery >= 28 ? 1 : 0)),
        },
        hoursAwake: 0,
        campEstablished: true,
        log: [...active.log, `${clock(active.elapsedMinutes + restMinutes)} — ${label}. Группа отдохнула и проверила снаряжение.`],
      },
    };
  };

  if (node.phase === 'SUMMIT') {
    nextCareer = beginDescent(nextCareer);
    nextCareer = advanceParticipant(nextCareer);
    return { career: nextCareer, headline: 'Начинается спуск', detail: 'Руководитель перестроил связки. Личные решения продолжаются на обратном пути.', severity: 'SUCCESS' };
  }

  if (node.phase === 'EXIT') {
    const active = nextCareer.activeClimb!;
    const successful = active.summitReached && !active.retreating;
    const evaluation = evaluateParticipant(active.participant!, successful, active.casualties.length);
    const evaluated = { ...active, participant: { ...active.participant!, routeComplete: true, evaluation } };
    const finished = finishClimb({ ...nextCareer, activeClimb: evaluated }, evaluated);
    return { career: finished, headline: evaluation.title, detail: evaluation.summary, severity: evaluation.grade === 'A' || evaluation.grade === 'B' ? 'SUCCESS' : evaluation.grade === 'E' ? 'DANGER' : 'WARNING' };
  }

  if (node.segmentId) {
    const routeDecision = getCurrentRouteDecision(nextCareer);
    if (routeDecision) {
      const pace = leaderPace(nextCareer, selected.pace ?? 'STEADY');
      const ordered = pace === 'CAUTIOUS'
        ? routeDecision.options.find(optionValue => optionValue.tone === 'SAFE') ?? routeDecision.options[0]
        : pace === 'FAST'
          ? routeDecision.options.find(optionValue => optionValue.tone === 'BOLD') ?? routeDecision.options[0]
          : routeDecision.options.find(optionValue => optionValue.tone === 'BALANCED') ?? routeDecision.options[0];
      if (ordered) nextCareer = chooseRouteDecision(nextCareer, ordered.id).career;
    }
    if (node.campPossible && nextCareer.activeClimb && (nextCareer.activeClimb.hoursAwake >= 6 || nextCareer.activeClimb.energy <= 48)) {
      nextCareer = restParticipantGroup(nextCareer, node.phase === 'CAMP' ? 32 : 24, `Лагерь на этапе «${node.label}»`);
    }
    const movement = resolveClimbStep(nextCareer, leaderPace(nextCareer, selected.pace ?? 'STEADY'));
    const movementCareer = movement.career;
    const advanced = movementCareer.activeClimb?.phase && !['FAILED', 'RETREATED', 'COMPLETE'].includes(movementCareer.activeClimb.phase)
      ? advanceParticipant(movementCareer)
      : movementCareer;
    return { ...movement, career: advanced, detail: `${detail} ${movement.detail}`.trim() };
  }

  nextCareer = advanceParticipant(nextCareer);
  if (node.phase === 'BASE_CAMP') nextCareer = restParticipantGroup(nextCareer, 24, 'Работа базового лагеря завершена');
  if (node.phase === 'ACCLIMATIZATION') nextCareer = restParticipantGroup(nextCareer, 30, 'Акклиматизационный цикл завершён');
  return { career: nextCareer, headline: `${node.label} завершён`, detail, severity: failedCheck ? 'WARNING' : 'CALM' };
}

export function resolveClimbStep(career: CareerState, pace: ClimbPace): ClimbStepResult {
  if (career.activeClimb?.simulation) {
    const action: ExpeditionFieldActionId = pace === 'CAUTIOUS' ? 'MOVE_CAUTIOUS' : pace === 'FAST' ? 'MOVE_FAST' : 'MOVE_STEADY';
    return resolveSimulationFieldAction(career, action);
  }
  const climb = career.activeClimb;
  if (!climb || (climb.phase !== 'ASCENT' && climb.phase !== 'DESCENT')) {
    return { career, headline: 'Действие недоступно', detail: 'Группа сейчас не движется по маршруту.', severity: 'WARNING' };
  }

  const pendingDecision = getCurrentRouteDecision(career);
  if (pendingDecision) return { career, headline: 'Сначала выбери линию', detail: pendingDecision.situation, severity: 'WARNING' };
  const forecast = calculateClimbAction(career, pace)!;
  const segment = forecast.segment;
  const direction = climb.phase === 'ASCENT' ? 1 : -1;
  const paceMod = forecast.paceMod;
  const hero = career.hero;
  let incidentChance = forecast.incidentChance;
  const rng = createRng(`${career.id}:${climb.id}:${climb.phase}:${climb.moveCount}:${pace}`);

  let duration = forecast.durationMinutes;
  let energyCost = forecast.energyCost;
  let conditionLoss = 0;
  let teamLoss = rng.int(0, 2);
  let headline = `${segment.name} пройден`;
  let detail = `Группа двигалась ${paceMod.label}. Темп сохранён.`;
  let severity: ClimbStepResult['severity'] = 'CALM';
  let newInjury: string | null = null;

  if (rng.chance(incidentChance)) {
    const incidentRoll = rng.next();
    if (incidentRoll < .54) {
      const delay = rng.int(25, 75);
      duration += delay;
      energyCost += rng.int(3, 8);
      teamLoss += rng.int(1, 4);
      headline = 'Маршрут забрал время';
      detail = rng.pick([
        `Опасность «${segment.hazard}» заставила перестроить движение и проверить страховку.`,
        'Группа потеряла линию и вернулась к основной части маршрута после сверки карты.',
        'Один участник сорвал темп. Груз пришлось перераспределить.',
      ]);
      severity = 'WARNING';
    } else if (incidentRoll < .9) {
      newInjury = rng.pick(['Ушиб правого колена', 'Рассечение ладони', 'Растяжение голеностопа', 'Лёгкое обморожение пальцев']);
      duration += rng.int(35, 85);
      energyCost += rng.int(7, 13);
      conditionLoss = rng.int(5, 12);
      teamLoss += rng.int(3, 7);
      headline = newInjury;
      detail = 'Движение возможно, но дальнейший маршрут потребует меньшего темпа и внимательной страховки.';
      severity = 'DANGER';
    } else {
      const weather = evolveWeather(career, climb, duration + 90);
      const activeVictims = climb.teamStates.filter(state => state.status === 'ACTIVE').sort((a, b) => a.condition - b.condition);
      const victim = activeVictims[0];
      const fatal = Boolean(victim && segment.exposure >= 55 && rng.chance(.2));
      const victimName = victim ? career.teamRoster.find(item => item.id === victim.memberId)?.name ?? victim.memberId : null;
      const failedStates = climb.teamStates.map(state => state.memberId === victim?.memberId ? {
        ...state,
        status: fatal ? 'DEAD' as const : 'INCAPACITATED' as const,
        condition: fatal ? 0 : Math.max(8, state.condition - 35),
        visibleInjury: fatal ? 'Смертельная травма при срыве' : 'Тяжёлая травма при срыве',
      } : state);
      const failed: QualificationClimb = {
        ...climb,
        ...weather,
        phase: 'FAILED',
        moveCount: climb.moveCount + 1,
        elapsedMinutes: climb.elapsedMinutes + duration + 90,
        energy: clamp(climb.energy - energyCost - 12, 0, 100),
        condition: clamp(climb.condition - 16, 0, 100),
        teamCondition: teamAverage(failedStates),
        teamStates: failedStates,
        casualties: fatal && victim ? [...climb.casualties, victim.memberId] : climb.casualties,
        injuries: [...climb.injuries, 'Травма при срыве'],
        log: [...climb.log, `${clock(climb.elapsedMinutes + duration)} — тяжёлый инцидент. ${fatal && victimName ? `${victimName} погиб.` : 'Пострадавший обездвижен.'} Экспедиция прекратила движение и вызвала помощь.`],
      };
      const failedCareer: CareerState = {
        ...career,
        activeClimb: failed,
        hero: {
          ...career.hero,
          health: clamp(career.hero.health - 13, 0, 100),
          fatigue: clamp(career.hero.fatigue + 24, 0, 100),
          injuries: [...career.hero.injuries, 'Травма при срыве'],
        },
        log: [...career.log, careerLog(career, 'INJURY', `Авария: ${segment.name}`, 'Экспедиция прекращена. Группа доставлена вниз с помощью клуба.')],
      };
      return { career: failedCareer, headline: 'Авария. Экспедиция закончена.', detail: 'Группа вернулась без вершины. Сначала потребуется восстановление.', severity: 'DANGER' };
    }
  }

  const elapsedMinutes = climb.elapsedMinutes + duration;
  const weather = evolveWeather(career, climb, duration);
  const hours = duration / 60;
  let supplies = consumeSupplies(climb, hours);
  if (supplies.waterUnits === 0) energyCost += 5;
  if (supplies.foodUnits === 0) energyCost += 4;
  const energy = clamp(climb.energy - energyCost, 0, 100);
  const condition = clamp(climb.condition - conditionLoss - (weather.temperatureC < -20 ? 1 : 0), 0, 100);
  const elevationChange = direction * segment.elevationGain;
  const currentElevation = clamp(climb.currentElevation + elevationChange, climb.startElevation, climb.summitElevation);
  let caches = climb.caches;
  let recoveredCacheNote = '';
  if (climb.phase === 'DESCENT') {
    const recovered = climb.caches.filter(cache => !cache.recovered && currentElevation <= cache.elevation);
    if (recovered.length) {
      supplies = recovered.reduce((state, cache) => ({
        foodUnits: state.foodUnits + cache.foodUnits,
        waterUnits: state.waterUnits + cache.waterUnits,
        fuelUnits: state.fuelUnits + cache.fuelUnits,
      }), supplies);
      const recoveredIds = new Set(recovered.map(cache => cache.id));
      caches = climb.caches.map(cache => recoveredIds.has(cache.id) ? { ...cache, recovered: true } : cache);
      recoveredCacheNote = ` Найдена закладка: +${recovered.reduce((sum, cache) => sum + cache.foodUnits, 0)} еды, +${recovered.reduce((sum, cache) => sum + cache.waterUnits, 0)} воды.`;
    }
  }
  const teamEvolution = evolveTeamStates(career, climb, duration, pace, weather.temperatureC < -20 ? 1 : 0);
  const adjustedTeamStates = teamEvolution.states.map(state => state.status === 'ACTIVE' ? { ...state, condition: clamp(state.condition - teamLoss * .35, 0, 100) } : state);
  if (teamEvolution.reveal) {
    detail = `${detail} ${teamEvolution.reveal}`;
    severity = severity === 'CALM' ? 'WARNING' : severity;
  }
  detail = `${detail} ${fieldTexture(segment, climb, weather.temperatureC, weather.windKmh, weather.visibility, pace, rng)}`;
  const logLine = `${clock(elapsedMinutes)} — ${segment.name}: ${detail}${recoveredCacheNote}`;
  const injuries = newInjury ? [...climb.injuries, newInjury] : climb.injuries;

  let nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    moveCount: climb.moveCount + 1,
    elapsedMinutes,
    energy,
    condition,
    teamCondition: teamAverage(adjustedTeamStates),
    teamStates: adjustedTeamStates,
    currentElevation,
    injuries,
    supplies,
    caches,
    hoursAwake: climb.hoursAwake + hours,
    campEstablished: false,
    log: [...climb.log, logLine],
  };

  if (energy <= 5 || condition <= 36 || nextClimb.teamCondition <= 34) {
    nextClimb = { ...nextClimb, phase: 'FAILED', log: [...nextClimb.log, `${clock(elapsedMinutes)} — движение остановлено: группа потеряла рабочее состояние.`] };
    const stopped: CareerState = {
      ...career,
      activeClimb: nextClimb,
      hero: {
        ...hero,
        health: clamp(hero.health - 8 - injuries.length * 2, 0, 100),
        fatigue: clamp(hero.fatigue + 28, 0, 100),
        injuries: [...hero.injuries, ...injuries],
      },
    };
    return { career: stopped, headline: 'Движение остановлено', detail: 'Резерв сил исчерпан. Клуб организовал возвращение.', severity: 'DANGER' };
  }

  if (climb.phase === 'ASCENT') {
    if (climb.segmentIndex >= climb.route.length - 1) {
      nextClimb = {
        ...nextClimb,
        phase: 'SUMMIT',
        summitReached: true,
        currentElevation: climb.summitElevation,
        teamStates: nextClimb.teamStates.map(state => state.status === 'ACTIVE' ? { ...state, summitReached: true } : state),
        log: [...nextClimb.log, `${clock(elapsedMinutes)} — вершина ${climb.mountainName}, ${climb.summitElevation} м.`],
      };
      headline = 'Вершина достигнута';
      detail = 'Экспедиция ещё не завершена. Внизу остаётся весь обратный маршрут.';
      severity = 'SUCCESS';
    } else {
      nextClimb.segmentIndex += 1;
    }
  } else if (climb.segmentIndex >= climb.route.length - 1) {
    if (nextClimb.participant) {
      nextClimb = {
        ...nextClimb,
        currentElevation: nextClimb.startElevation,
        log: [...nextClimb.log, `${clock(elapsedMinutes)} — группа вышла к безопасному рельефу. Остался разбор и возвращение.`],
      };
      return { career: { ...career, activeClimb: nextClimb }, headline: 'Опасный спуск закончен', detail: 'Экспедиция ещё не закрыта. Руководитель собирает итоговый разбор.', severity: 'SUCCESS' };
    }
    const completedCareer = finishClimb(career, nextClimb);
    return { career: completedCareer, headline: 'Группа вернулась', detail: nextClimb.summitReached && !nextClimb.retreating ? 'Восхождение засчитано после отдельного спуска.' : 'Отход завершён. Карьера продолжается.', severity: 'SUCCESS' };
  } else {
    nextClimb.segmentIndex += 1;
  }

  return { career: { ...career, activeClimb: nextClimb }, headline, detail, severity };
}

export function establishCamp(career: CareerState): ClimbStepResult {
  if (career.activeClimb?.simulation) return resolveSimulationFieldAction(career, 'MAKE_CAMP');
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'DESCENT'].includes(climb.phase)) return { career, headline: 'Лагерь недоступен', detail: 'Группа не находится на маршруте.', severity: 'WARNING' };
  const segment = climb.route[climb.segmentIndex]!;
  if (!segment.campPossible) return { career, headline: 'Площадки нет', detail: 'На текущем участке нельзя безопасно поставить лагерь.', severity: 'WARNING' };
  if (climb.supplies.fuelUnits <= 0 || climb.supplies.foodUnits <= 0) return { career, headline: 'Нет ресурсов', detail: 'Для лагеря нужны топливо и еда.', severity: 'DANGER' };
  const duration = 7 * 60;
  const weather = evolveWeather(career, climb, duration);
  const teamSize = climb.teamMemberIds.length + 1;
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes: climb.elapsedMinutes + duration,
    energy: clamp(climb.energy + 34, 0, 100),
    condition: clamp(climb.condition + 5, 0, 100),
    teamStates: climb.teamStates.map(state => state.status === 'ACTIVE' ? {
      ...state,
      condition: clamp(state.condition + 13),
      fatigue: clamp(state.fatigue - 36),
      morale: clamp(state.morale + 3),
    } : state),
    teamCondition: teamAverage(climb.teamStates.map(state => state.status === 'ACTIVE' ? { ...state, condition: clamp(state.condition + 13) } : state)),
    supplies: {
      foodUnits: Math.max(0, climb.supplies.foodUnits - teamSize),
      waterUnits: Math.max(0, climb.supplies.waterUnits - Math.ceil(teamSize / 2)),
      fuelUnits: climb.supplies.fuelUnits - 1,
    },
    hoursAwake: 0,
    campEstablished: true,
    weatherStep: climb.weatherStep + 1,
    log: [...climb.log, `${clock(climb.elapsedMinutes + duration)} — лагерь снят после семи часов отдыха.`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: 'Группа отдохнула', detail: 'Силы восстановлены, но погода и время продолжили движение.', severity: 'CALM' };
}

export function meltSnow(career: CareerState): ClimbStepResult {
  if (career.activeClimb?.simulation) return resolveSimulationFieldAction(career, 'MELT_SNOW');
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'DESCENT'].includes(climb.phase)) return { career, headline: 'Действие недоступно', detail: '', severity: 'WARNING' };
  if (climb.supplies.fuelUnits <= 0) return { career, headline: 'Топливо закончилось', detail: 'Получить воду из снега больше нельзя.', severity: 'DANGER' };
  const duration = 50;
  const weather = evolveWeather(career, climb, duration);
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes: climb.elapsedMinutes + duration,
    supplies: { ...climb.supplies, fuelUnits: climb.supplies.fuelUnits - 1, waterUnits: climb.supplies.waterUnits + 5 },
    hoursAwake: climb.hoursAwake + duration / 60,
    log: [...climb.log, `${clock(climb.elapsedMinutes + duration)} — группа потратила топливо и получила запас воды.`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: 'Вода готова', detail: 'Пять условных запасов воды добавлены. Потрачена одна единица топлива.', severity: 'CALM' };
}

export function waitWeather(career: CareerState): ClimbStepResult {
  if (career.activeClimb?.simulation) return resolveSimulationFieldAction(career, 'REST_SHORT');
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'DESCENT'].includes(climb.phase)) return { career, headline: 'Действие недоступно', detail: '', severity: 'WARNING' };
  const duration = 3 * 60;
  const weather = evolveWeather(career, climb, duration);
  const supplies = consumeSupplies(climb, 3);
  const improved = weather.windKmh < climb.windKmh || weather.visibility > climb.visibility;
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes: climb.elapsedMinutes + duration,
    energy: clamp(climb.energy + 5, 0, 100),
    supplies,
    hoursAwake: climb.hoursAwake + 3,
    log: [...climb.log, `${clock(climb.elapsedMinutes + duration)} — группа ждала три часа. ${improved ? 'Условия улучшились.' : 'Окно не открылось.'}`],
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: improved ? 'Условия улучшились' : 'Погода держит группу', detail: 'Прошло три часа. Запасы и время потрачены.', severity: improved ? 'CALM' : 'WARNING' };
}


export function resolveExpeditionFieldAction(career: CareerState, actionId: ExpeditionFieldActionId): ClimbStepResult {
  return resolveSimulationFieldAction(career, actionId);
}

export function resolveStrategicSectorPlan(career: CareerState, plan: StrategicSectorPlan): ClimbStepResult {
  return resolveStrategicSector(career, plan);
}

export function resolveStrategicRestChoice(career: CareerState, choice: StrategicRestId): ClimbStepResult {
  return resolveStrategicRest(career, choice);
}

export function closeClimb(career: CareerState): CareerState {
  if (!career.activeClimb || !['COMPLETE', 'FAILED', 'RETREATED'].includes(career.activeClimb.phase)) return career;
  const alreadyReported = career.reports.some(report => report.id === `report-${career.activeClimb!.id}`);
  const climb = career.activeClimb;
  let finalized = alreadyReported ? career : finishClimb(career, climb);
  if (!alreadyReported) {
    const report = finalized.reports[finalized.reports.length - 1];
    if (report) finalized = registerHeroExpedition(finalized, climb, report);
  }
  finalized = syncCareerProgression(finalized);
  const timeline = advanceDays(finalized, 3);
  const resolvedSchoolOfferIds = climb.expeditionOfferId
    ? [...new Set([...(finalized.resolvedSchoolOfferIds ?? []), climb.expeditionOfferId])]
    : finalized.resolvedSchoolOfferIds ?? [];
  const closed: CareerState = {
    ...finalized,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: { ...finalized.hero, age: finalized.hero.age + timeline.ageDelta },
    activeClimb: null,
    selectedOfferId: null,
    acceptedOffer: null,
    resolvedSchoolOfferIds,
    seasonPlan: finalized.seasonPlan,
  };
  const advanced = advanceLivingWorld(closed, 3);
  const settled = timeline.year > finalized.year ? rollCareerSeason(finalized, advanced) : syncCareerProgression(advanced);
  const normalized = { ...settled, seasonPlan: normalizeSeasonCampaignPlan(settled) };
  return advanceCareerStories(normalized, true);
}
