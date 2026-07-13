import { createRng } from './rng';
import { buildExpeditionReport, createClimbTeamStates, enrichRoster, finalizeRosterAfterClimb, memory, teamAverage } from './people';
import { advanceLivingWorld, createLivingWorld, registerHeroExpedition } from './worldSimulation';
import type {
  CalendarEntry,
  CareerDraft,
  CareerLogEntry,
  CareerState,
  ClimbActionPreview,
  PreparationInsight,
  ClimbOrderId,
  ClimbPace,
  ClimbStepResult,
  ClubData,
  ExpeditionPlan,
  ExpeditionReadiness,
  ExpeditionRoute,
  GearDefinition,
  OriginDefinition,
  OriginId,
  QualificationClimb,
  RouteSegment,
  SkillId,
  SkillSet,
  TeamMember,
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
    xp: 18,
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
    xp: 20,
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
    xp: 20,
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
    xp: 17,
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
    xp: 17,
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
    xp: 15,
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

export const GEAR_CATALOG: GearDefinition[] = [
  { id: 'rope', name: 'Основная верёвка', category: 'PROTECTION', description: '50 метров динамической верёвки. Основа связки и спуска.', weightKg: 3.4, unitCost: 72, maxQuantity: 2 },
  { id: 'rock-kit', name: 'Скальный комплект', category: 'PROTECTION', description: 'Закладки, крючья, молоток и станционные петли.', weightKg: 2.6, unitCost: 58, maxQuantity: 2 },
  { id: 'ice-kit', name: 'Ледовый комплект', category: 'PROTECTION', description: 'Ледобуры, инструменты, кошки и запасные темляки.', weightKg: 3.1, unitCost: 64, maxQuantity: 2 },
  { id: 'tent', name: 'Высотная палатка', category: 'SHELTER', description: 'Укрытие для вынужденной ночёвки и ожидания фронта.', weightKg: 3.8, unitCost: 90, maxQuantity: 2 },
  { id: 'stove', name: 'Горелка', category: 'SURVIVAL', description: 'Топит снег, даёт воду и не позволяет группе остаться без тепла.', weightKg: 1.1, unitCost: 36, maxQuantity: 2 },
  { id: 'medkit', name: 'Горная аптечка', category: 'SURVIVAL', description: 'Перевязка, иммобилизация и первые действия при переохлаждении.', weightKg: 1.3, unitCost: 42, maxQuantity: 2 },
  { id: 'radio', name: 'Полевая связь', category: 'COMMUNICATION', description: 'Связь с клубом и нижней группой. Надёжность зависит от эпохи.', weightKg: 1.9, unitCost: 76, maxQuantity: 1 },
  { id: 'bivy', name: 'Бивачные мешки', category: 'SHELTER', description: 'Аварийное укрытие для всей связки.', weightKg: 0.8, unitCost: 28, maxQuantity: 3 },
];

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

function splitGain(total: number, shares: number[]) {
  const values = shares.map(share => Math.round(total * share));
  values[values.length - 1] += total - values.reduce((sum, value) => sum + value, 0);
  return values;
}

function segment(
  id: string,
  name: string,
  terrain: string,
  elevationGain: number,
  baseDurationMinutes: number,
  difficulty: number,
  exposure: number,
  skill: SkillId,
  note: string,
  campPossible: boolean,
  hazard: string,
): RouteSegment {
  return { id, name, terrain, elevationGain, baseDurationMinutes, difficulty, exposure, skill, note, campPossible, hazard };
}

export function getQualificationTarget(world: WorldState) {
  const mountain = [...world.region.mountains].sort((a, b) =>
    (a.elevation * 0.012 + a.technicality + a.remoteness * 0.35) -
    (b.elevation * 0.012 + b.technicality + b.remoteness * 0.35),
  )[0]!;
  const safeUpperLimit = Math.max(3200, world.region.elevationMin + 1650);
  const summitElevation = Math.min(mountain.elevation, safeUpperLimit);
  const subsidiary = summitElevation < mountain.elevation;
  return {
    mountain,
    summitElevation,
    startElevation: Math.max(world.region.elevationMin + 120, summitElevation - 920),
    displayName: subsidiary ? `${mountain.name} / Южная вершина` : mountain.name,
    subsidiary,
  };
}

function routeEraPenalty(world: WorldState) {
  return world.config.eraId === 'PIONEER' ? 8 : world.config.eraId === 'EXPEDITION' ? 3 : 0;
}

function mountainDifficulty(mountain: WorldState['region']['mountains'][number]) {
  return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32;
}


function defaultDescentSegments(route: ExpeditionRoute): RouteSegment[] {
  return [...route.segments].reverse().map((item, index) => ({
    ...item,
    id: `${item.id}-descent`,
    name: index === route.segments.length - 1 ? 'Возвращение к старту' : `Спуск: ${item.name}`,
    baseDurationMinutes: Math.round(item.baseDurationMinutes * .82),
    difficulty: clamp(item.difficulty + 5),
    exposure: clamp(item.exposure + (index < 2 ? 9 : 4)),
    note: item.descentNote ?? `Усталость делает знакомый участок другим. ${item.note}`,
    hazard: index < 2 ? `${item.hazard}; ошибка на спуске` : item.hazard,
    campPossible: item.campPossible,
    linkedAscentSegmentId: item.id,
    noReturn: false,
    safeHaven: item.campPossible,
    decisionId: undefined,
  }));
}

function signatureDecisionTemplates(route: ExpeditionRoute, routeIndex: number) {
  const firstSegment = route.segments[Math.min(1, route.segments.length - 1)]!;
  const keySegment = route.segments[Math.min(3, route.segments.length - 1)]!;
  const prefix = `${route.id}-decision`;
  if (routeIndex === 0) {
    return [
      {
        id: `${prefix}-ribs`, segmentId: firstSegment.id, title: 'Разрушенные рёбра',
        situation: 'Прямая линия короче, но под группой лежит рыхлая порода. Слева есть длинный обход по полке.',
        options: [
          { id: 'direct', title: 'Идти прямо', tone: 'BOLD' as const, description: 'Сэкономить время и быстрее выйти к леднику.', durationModifier: .78, energyModifier: 1.08, riskModifier: .09, resultNote: 'Группа выбрала короткую линию по разрушенным рёбрам.' },
          { id: 'ledge', title: 'Обойти по полке', tone: 'SAFE' as const, description: 'Дольше находиться под склоном, но снизить риск срыва камней.', durationModifier: 1.28, energyModifier: .92, riskModifier: -.07, resultNote: 'Группа ушла на длинную защищённую полку.' },
        ],
      },
      {
        id: `${prefix}-ice`, segmentId: keySegment.id, title: 'Ледовый взлёт',
        situation: 'Крутой лёд можно пройти быстро в движении или потратить верёвку на защищённую линию.',
        options: [
          { id: 'moving', title: 'Двигаться без закрепления', tone: 'BALANCED' as const, description: 'Не тратить верёвку, сохранить обычный темп.', durationModifier: 1, energyModifier: 1, riskModifier: .025, resultNote: 'Связка прошла взлёт без стационарной линии.' },
          { id: 'protected', title: 'Подготовить защищённую линию', tone: 'SAFE' as const, description: 'Нужно не меньше 20 м свободной верёвки. Спуск по этому месту станет безопаснее.', durationModifier: 1.22, energyModifier: .94, riskModifier: -.08, requiresRopeMeters: 20, resultNote: 'Группа заранее подготовила линию для обратного пути.' },
        ],
      },
    ];
  }
  if (routeIndex === 1) {
    return [
      {
        id: `${prefix}-crevasses`, segmentId: firstSegment.id, title: 'Лабиринт трещин',
        situation: 'Старая линия короче, но мосты после снегопада не проверены. Внешняя дуга длиннее и лучше читается.',
        options: [
          { id: 'old-track', title: 'Старая линия', tone: 'BOLD' as const, description: 'Сохранить около часа, принять риск скрытого моста.', durationModifier: .74, energyModifier: 1.03, riskModifier: .11, resultNote: 'Группа пошла по старой линии через закрытые трещины.' },
          { id: 'outer-arc', title: 'Внешняя дуга', tone: 'SAFE' as const, description: 'Потратить время на проверяемый рельеф.', durationModifier: 1.34, energyModifier: .94, riskModifier: -.08, resultNote: 'Группа обошла центр ледника по внешней дуге.' },
        ],
      },
      {
        id: `${prefix}-serac`, segmentId: keySegment.id, title: 'Серачная зона',
        situation: 'Под обломками нельзя стоять. Можно форсировать участок или переждать холодный час у защищённой стенки.',
        options: [
          { id: 'dash', title: 'Форсировать', tone: 'BOLD' as const, description: 'Быстрее выйти из зоны, сильнее нагрузить группу.', durationModifier: .66, energyModifier: 1.3, riskModifier: .065, resultNote: 'Группа форсировала серачную зону без остановки.' },
          { id: 'cold-hour', title: 'Ждать холодный час', tone: 'BALANCED' as const, description: 'Потратить время и часть запасов, снизить вероятность обвала.', durationModifier: 1.38, energyModifier: .88, riskModifier: -.065, resultNote: 'Группа дождалась более холодного часа у защищённой стенки.' },
        ],
      },
    ];
  }
  return [
    {
      id: `${prefix}-couloir`, segmentId: firstSegment.id, title: 'Тёмный кулуар',
      situation: 'Центр кулуара быстрее, но собирает лёд и камни. Правый край требует сложного микста.',
      options: [
        { id: 'center', title: 'Центр кулуара', tone: 'BOLD' as const, description: 'Короткая линия под объективными опасностями.', durationModifier: .72, energyModifier: 1.06, riskModifier: .12, resultNote: 'Связка пошла по центру кулуара.' },
        { id: 'right-mixed', title: 'Правый микст', tone: 'SAFE' as const, description: 'Технически тяжелее, но меньше времени под падающим льдом.', durationModifier: 1.2, energyModifier: 1.1, riskModifier: -.055, resultNote: 'Связка ушла на правый микстовый край.' },
      ],
    },
    {
      id: `${prefix}-wall`, segmentId: keySegment.id, title: 'Северная стена',
      situation: 'После стены простой отход закончится. Можно оставить стационарную линию или сохранить верёвку для верхней части.',
      options: [
        { id: 'free', title: 'Сохранить верёвку', tone: 'BOLD' as const, description: 'Меньше времени сейчас, сложнее аварийный спуск.', durationModifier: .86, energyModifier: 1.08, riskModifier: .07, resultNote: 'Группа прошла стену без оставленной линии.' },
        { id: 'fixed', title: 'Оставить 30 м верёвки', tone: 'SAFE' as const, description: 'Потратить верёвку и время, создать защищённый отход.', durationModifier: 1.28, energyModifier: .96, riskModifier: -.09, requiresRopeMeters: 30, resultNote: 'На стене оставлена стационарная линия.' },
      ],
    },
  ];
}

function enrichRouteForVerticalSlice(route: ExpeditionRoute, routeIndex: number, signatureMountain: boolean): ExpeditionRoute {
  const decisions = signatureMountain ? signatureDecisionTemplates(route, routeIndex) : [];
  const bySegment = new Map(decisions.map(item => [item.segmentId, item.id]));
  const segments = route.segments.map((item, index) => ({
    ...item,
    decisionId: bySegment.get(item.id),
    noReturn: signatureMountain && index >= Math.ceil(route.segments.length * .58),
    safeHaven: item.campPossible,
    descentNote: index >= route.segments.length - 2
      ? 'На обратном пути здесь мало места, а усталость усиливает каждую ошибку.'
      : item.note,
  }));
  const enriched = { ...route, segments };
  return {
    ...enriched,
    isSignature: signatureMountain,
    decisions,
    descentSegments: defaultDescentSegments(enriched),
    routeStory: signatureMountain ? [
      'Нижняя часть позволяет проверить темп и оставить запас до серьёзного рельефа.',
      'Средняя часть содержит выбор линии, который меняет время, риск и обратный путь.',
      'После верхней трети простого отхода нет: вершина требует сохранённого резерва на спуск.',
    ] : undefined,
    descentSummary: signatureMountain
      ? 'Спуск идёт отдельной линией: знакомые места становятся опаснее из-за усталости, снятия страховки и времени без сна.'
      : 'Обратный путь повторяет основные элементы маршрута и становится тяжелее из-за накопленной усталости.',
  };
}

function makeMountainRoutes(world: WorldState, mountain: WorldState['region']['mountains'][number]): ExpeditionRoute[] {
  const eraPenalty = routeEraPenalty(world);
  const totalGain = clamp(Math.round(760 + mountain.prominence * .17 + mountain.remoteness * 2.1), 760, 1650);
  const startElevation = Math.max(world.region.elevationMin + 80, mountain.elevation - totalGain);
  const actualGain = mountain.elevation - startElevation;
  const baseDifficulty = mountain.technicality * .48 + mountain.altitudeSeverity * .32 + mountain.remoteness * .16 + eraPenalty;
  const baseRisk = mountain.altitudeSeverity * .36 + mountain.remoteness * .22 + mountain.technicality * .24;
  const characterTech = mountain.characterId === 'TECHNICAL' ? 9 : 0;
  const characterRisk = mountain.characterId === 'WEATHER' ? 8 : mountain.characterId === 'DESCENT' ? 6 : 0;
  const characterHours = mountain.characterId === 'ENDURANCE' ? 1.18 : 1;
  const slug = mountain.id.replace(/[^a-zA-Z0-9-]/g, '-');

  const ridgeGain = splitGain(actualGain, [.12, .18, .22, .21, .27]);
  const glacierGain = splitGain(actualGain, [.1, .16, .18, .19, .17, .2]);
  const faceGain = splitGain(actualGain, [.08, .17, .25, .24, .26]);

  const ridgeTech = clamp(Math.round(18 + baseDifficulty * .62 + characterTech), 28, 92);
  const glacierTech = clamp(Math.round(15 + baseDifficulty * .56 + characterTech), 25, 90);
  const faceTech = clamp(Math.round(28 + baseDifficulty * .76 + characterTech), 40, 98);
  const ridgeRisk = clamp(Math.round(16 + baseRisk * .55 + characterRisk), 24, 92);
  const glacierRisk = clamp(Math.round(22 + baseRisk * .66 + characterRisk), 30, 96);
  const faceRisk = clamp(Math.round(30 + baseRisk * .76 + characterRisk), 42, 99);
  const altitudeHours = actualGain / 165 + mountain.altitudeSeverity / 10 + mountain.remoteness / 18;

  const routes: ExpeditionRoute[] = [
    {
      id: `${slug}-south-ridge`, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Южный гребень',
      style: 'Классический смешанный маршрут',
      summary: 'Самая читаемая линия массива. Длинный набор, смешанный рельеф и несколько мест, где можно остановить попытку до серьёзной аварии.',
      startElevation, summitElevation: mountain.elevation, estimatedHours: Math.round((8 + altitudeHours) * characterHours), technicality: ridgeTech,
      objectiveRisk: ridgeRisk, recommendedTeamSize: mountain.elevation > 6200 ? 4 : 3,
      requiredGearIds: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit'],
      segments: [
        segment(`${slug}-sr-moraine`, 'Верхняя морена', 'Осыпь и камень', ridgeGain[0]!, 80, clamp(ridgeTech - 22), 14, 'ENDURANCE', 'Длинный набор с грузом. Здесь проще всего заметить неверный темп.', true, 'Сход камней'),
        segment(`${slug}-sr-ribs`, 'Разрушенные рёбра', 'Простые скалы', ridgeGain[1]!, 105, clamp(ridgeTech - 12), 31, 'ROCK', 'Короткие стенки и обязательные станции.', false, 'Срыв камней'),
        segment(`${slug}-sr-glacier`, 'Ледниковый траверс', 'Закрытый ледник', ridgeGain[2]!, 125, clamp(ridgeTech - 8), 35, 'NAVIGATION', 'Трещины читаются плохо. Связка обязана держать дистанцию.', true, 'Трещины'),
        segment(`${slug}-sr-ice`, 'Ледовый взлёт', 'Жёсткий лёд', ridgeGain[3]!, 110, clamp(ridgeTech - 1), 48, 'ICE', 'Крутой участок. Ошибка затрагивает всю связку.', false, 'Срыв'),
        segment(`${slug}-sr-summit`, 'Вершинный гребень', 'Снег и скальные выходы', ridgeGain[4]!, 135, clamp(ridgeTech + 4), 59, 'ROCK', 'Узкий гребень. Ветер и усталость сильнее влияют на спуск.', false, 'Ветер'),
      ],
    },
    {
      id: `${slug}-east-glacier`, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Восточный ледник',
      style: 'Длинная ледниковая линия',
      summary: 'Меньше сложного лазания, больше времени на высоте, закрытых трещин и зависимости от холодного утреннего окна.',
      startElevation: Math.max(world.region.elevationMin + 50, startElevation - 70), summitElevation: mountain.elevation,
      estimatedHours: Math.round((11 + altitudeHours * 1.14) * characterHours), technicality: glacierTech, objectiveRisk: glacierRisk,
      recommendedTeamSize: mountain.elevation > 5600 ? 4 : 3,
      requiredGearIds: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'],
      segments: [
        segment(`${slug}-eg-basin`, 'Ледниковая чаша', 'Снег и морена', glacierGain[0]!, 95, clamp(glacierTech - 18), 16, 'ENDURANCE', 'Тяжёлый подход и ранняя проверка темпа.', true, 'Переохлаждение'),
        segment(`${slug}-eg-labyrinth`, 'Лабиринт трещин', 'Закрытый ледник', glacierGain[1]!, 145, clamp(glacierTech - 4), 40, 'NAVIGATION', 'Нужна точная линия и постоянная работа верёвки.', false, 'Провал в трещину'),
        segment(`${slug}-eg-plateau`, 'Белое плато', 'Открытый ледник', glacierGain[2]!, 150, clamp(glacierTech - 9), 28, 'ENDURANCE', 'Монотонный набор без укрытия от ветра.', true, 'Потеря направления'),
        segment(`${slug}-eg-serac`, 'Серачная зона', 'Лёд и обломки', glacierGain[3]!, 115, clamp(glacierTech + 2), 54, 'ICE', 'Здесь нельзя останавливаться надолго.', false, 'Ледовый обвал'),
        segment(`${slug}-eg-shoulder`, 'Восточное плечо', 'Фирн', glacierGain[4]!, 120, clamp(glacierTech - 1), 45, 'ENDURANCE', 'Наклон умеренный, но высота забирает скорость.', true, 'Лавинная доска'),
        segment(`${slug}-eg-top`, 'Купол', 'Снег и лёд', glacierGain[5]!, 140, clamp(glacierTech + 5), 57, 'NAVIGATION', 'В плохой видимости легко уйти на карниз.', false, 'Карниз'),
      ],
    },
    {
      id: `${slug}-north-line`, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Северная линия',
      style: 'Прямая техническая линия',
      summary: 'Короткая по расстоянию, но жёсткая по технике. Высокая открытость, мало мест для отдыха и тяжёлый отход после ключевой стены.',
      startElevation: Math.max(world.region.elevationMin + 100, startElevation + 40), summitElevation: mountain.elevation,
      estimatedHours: Math.round((7 + altitudeHours * .92) * characterHours), technicality: faceTech, objectiveRisk: faceRisk,
      recommendedTeamSize: mountain.elevation > 6500 ? 4 : 3,
      requiredGearIds: ['rope', 'rock-kit', 'ice-kit', 'medkit', 'bivy'],
      segments: [
        segment(`${slug}-nl-cone`, 'Северный конус', 'Осыпь', faceGain[0]!, 70, clamp(faceTech - 25), 20, 'ENDURANCE', 'Короткий подход под стену.', true, 'Камнепад'),
        segment(`${slug}-nl-couloir`, 'Тёмный кулуар', 'Снег и лёд', faceGain[1]!, 105, clamp(faceTech - 11), 50, 'ICE', 'Узкий кулуар собирает лёд и камни.', false, 'Ледовый обвал'),
        segment(`${slug}-nl-wall`, 'Северная стена', 'Микст и скалы', faceGain[2]!, 165, clamp(faceTech), 71, 'ROCK', 'Ключ маршрута. Отступление после середины сложно.', false, 'Срыв'),
        segment(`${slug}-nl-ramp`, 'Ледовая рампа', 'Крутой лёд', faceGain[3]!, 135, clamp(faceTech - 3), 66, 'ICE', 'Станции требуют времени и точности.', false, 'Разрушение станции'),
        segment(`${slug}-nl-edge`, 'Кромка вершины', 'Смешанный гребень', faceGain[4]!, 125, clamp(faceTech - 6), 73, 'ROCK', 'Открытый финиш без места для лагеря.', false, 'Штормовой ветер'),
      ],
    },
  ];
  const signatureMountain = getQualificationTarget(world).mountain.id === mountain.id;
  return routes.map((route, routeIndex) => enrichRouteForVerticalSlice(route, routeIndex, signatureMountain));
}

function makeRoutes(world: WorldState): ExpeditionRoute[] {
  return [...world.region.mountains]
    .sort((a, b) => mountainDifficulty(a) - mountainDifficulty(b))
    .flatMap(mountain => makeMountainRoutes(world, mountain));
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

function makeWeatherWindows(world: WorldState): WeatherWindow[] {
  const rng = createRng(`${world.config.seed}:career:weather`);
  const cold = world.config.eraId === 'PIONEER' ? -2 : 0;
  return [
    {
      id: 'window-early', label: 'Раннее окно', startsInDays: 4, durationHours: rng.int(17, 23), temperatureC: rng.int(-17, -10) + cold,
      windKmh: rng.int(24, 38), snowfallCm: rng.int(0, 6), stability: rng.int(58, 70),
      description: 'Холодно и жёстко. Снег держится лучше, но ветер остаётся сильным.',
    },
    {
      id: 'window-stable', label: 'Стабильное окно', startsInDays: 9, durationHours: rng.int(28, 39), temperatureC: rng.int(-13, -7) + cold,
      windKmh: rng.int(12, 24), snowfallCm: rng.int(0, 3), stability: rng.int(74, 88),
      description: 'Самое чистое окно. Дольше ждать, зато прогноз устойчивее.',
    },
    {
      id: 'window-warm', label: 'Тёплый разрыв', startsInDays: 15, durationHours: rng.int(20, 30), temperatureC: rng.int(-8, -2) + cold,
      windKmh: rng.int(8, 20), snowfallCm: rng.int(3, 10), stability: rng.int(48, 63),
      description: 'Меньше ветра, но потепление ухудшает снег и ледовые участки.',
    },
  ];
}

function defaultPlan(routes: ExpeditionRoute[], team: TeamMember[], windows: WeatherWindow[]): ExpeditionPlan {
  return {
    routeId: routes[0]!.id,
    weatherWindowId: windows[1]!.id,
    teamMemberIds: team.filter(member => member.required || ['rope-lead', 'medic'].includes(member.id)).map(member => member.id),
    gear: { rope: 1, 'rock-kit': 1, 'ice-kit': 1, tent: 1, stove: 1, medkit: 1, radio: 0, bivy: 1 },
    foodDays: 3,
    fuelUnits: 3,
    ropeMeters: 50,
    acclimatizationDays: 4,
  };
}

function addXp(skills: SkillSet, xpState: Record<SkillId, number>, skill: SkillId, amount: number) {
  const nextSkills = { ...skills };
  const nextXp = { ...xpState };
  let pool = nextXp[skill] + amount;
  let level = nextSkills[skill];
  let threshold = 22 + level * 9;
  while (pool >= threshold && level < 10) {
    pool -= threshold;
    level += 1;
    threshold = 22 + level * 9;
  }
  nextSkills[skill] = level;
  nextXp[skill] = pool;
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

export function createCareer(world: WorldState, draft: CareerDraft): CareerState {
  const origin = ORIGINS[draft.originId];
  const club = makeClub(world);
  const routes = makeRoutes(world);
  const teamRoster = makeTeam(world, club);
  const weatherWindows = makeWeatherWindows(world);
  const career: CareerState = {
    schemaVersion: 9,
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
    expeditionPlan: defaultPlan(routes, teamRoster, weatherWindows),
    reports: [],
    reputationProfile: { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    onboarding: { dismissed: false, completed: false },
    livingWorld: createLivingWorld(world, teamRoster, club),
  };

  career.log.push(careerLog(career, 'CAREER', 'Начало карьеры', `${career.hero.name}, ${career.hero.age} лет. Принят в «${club.name}», ${club.town}.`));
  career.log.push(careerLog(career, 'CLUB', 'Первый инструктор', `${club.mentorName}, ${club.mentorTitle}. Его правило: «${club.doctrine}»`));
  return career;
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
  } as QualificationClimb;
}

function migrateLegacyRouteId(career: any, routes: ExpeditionRoute[]) {
  const previous = career.routes?.find((route: ExpeditionRoute) => route.id === career.expeditionPlan?.routeId);
  if (!previous) return routes[0]!.id;
  const exactStyle = routes.find(route => route.mountainId === previous.mountainId && route.name === previous.name);
  return exactStyle?.id ?? routes.find(route => route.mountainId === previous.mountainId)?.id ?? routes[0]!.id;
}

export function migrateCareerV2(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  const teamRoster = makeTeam(world, career.club);
  const weatherWindows = makeWeatherWindows(world);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    teamRoster,
    weatherWindows,
    expeditionPlan: defaultPlan(routes, teamRoster, weatherWindows),
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    reports: [],
    reputationProfile: { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    livingWorld: createLivingWorld(world, teamRoster, career.club),
  } as CareerState;
}

export function migrateCareerV3(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  const teamRoster = enrichRoster(career.teamRoster ?? makeTeam(world, career.club), world.config.seed, career.year, career.seasonDay);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    teamRoster,
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    reports: career.reports ?? [],
    reputationProfile: career.reputationProfile ?? { leadership: 8, reliability: 12, care: 10, ambition: 14 },
    livingWorld: career.livingWorld ?? createLivingWorld(world, teamRoster, career.club),
  } as CareerState;
}

export function migrateCareerV4(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  const teamRoster = enrichRoster(career.teamRoster ?? makeTeam(world, career.club), world.config.seed, career.year, career.seasonDay);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
    teamRoster,
    livingWorld: career.livingWorld ?? createLivingWorld(world, teamRoster, career.club),
  } as CareerState;
}

export function migrateCareerV5(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState;
}

export function migrateCareerV6(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState;
}

export function migrateCareerV7(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: world.config.seed,
    difficulty: world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState;
}

export function migrateCareerV8(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  return {
    ...career,
    schemaVersion: 9,
    rootSeed: career.rootSeed ?? world.config.seed,
    difficulty: career.difficulty ?? world.config.difficulty,
    onboarding: career.onboarding ?? { dismissed: false, completed: Boolean(career.reports?.length) },
    routes,
    expeditionPlan: { ...career.expeditionPlan, routeId: migrateLegacyRouteId(career, routes) },
    activeClimb: migrateActiveClimbV8(career.activeClimb, routes),
  } as CareerState;
}

export function dismissOnboarding(career: CareerState): CareerState {
  return { ...career, onboarding: { ...career.onboarding, dismissed: true } };
}

export function careerReadiness(career: CareerState) {
  const { hero } = career;
  const skillCore = (hero.skills.ENDURANCE + hero.skills.ROCK + hero.skills.ICE + hero.skills.NAVIGATION) / 4;
  return Math.round(clamp(hero.form * 0.5 + hero.health * 0.18 + (100 - hero.fatigue) * 0.12 + skillCore * 2.8, 0, 100));
}

export function applyTraining(career: CareerState, trainingId: TrainingId): CareerState {
  const action = TRAINING_ACTIONS[trainingId];
  const timeline = advanceDays(career, action.days);
  let skills = { ...career.hero.skills };
  let skillXp = { ...career.hero.skillXp };
  if (action.skill && action.xp) {
    const progressed = addXp(skills, skillXp, action.skill, action.xp);
    skills = progressed.skills;
    skillXp = progressed.skillXp;
  }
  const cost = action.cost;
  const next: CareerState = {
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
      health: clamp(career.hero.health + (trainingId === 'RECOVERY' ? 6 : 0), 0, 100),
      morale: clamp(career.hero.morale + (trainingId === 'RECOVERY' ? 4 : trainingId === 'CLUB_DUTY' ? 3 : 1), 0, 100),
      skills,
      skillXp,
    },
  };
  next.log = [...career.log, careerLog(next, 'TRAINING', action.title, `${action.days} дней работы. ${cost < 0 ? `Заработано ${Math.abs(cost)} кр.` : `Расходы ${cost} кр.`}`)];
  return advanceLivingWorld(next, action.days);
}

export function updateExpeditionPlan(career: CareerState, patch: Partial<ExpeditionPlan>): CareerState {
  return { ...career, expeditionPlan: { ...career.expeditionPlan, ...patch } };
}

export function selectRoute(career: CareerState, routeId: string): CareerState {
  const route = career.routes.find(item => item.id === routeId);
  if (!route) return career;
  return updateExpeditionPlan(career, { routeId });
}

export function routesForMountain(career: CareerState, mountainId: string) {
  return career.routes.filter(route => route.mountainId === mountainId);
}

export function selectMountain(career: CareerState, mountainId: string): CareerState {
  const routes = routesForMountain(career, mountainId);
  if (!routes.length) return career;
  const recommended = [...routes].sort((a, b) => (a.objectiveRisk + a.technicality) - (b.objectiveRisk + b.technicality))[0]!;
  return updateExpeditionPlan(career, { routeId: recommended.id });
}

export function selectWeatherWindow(career: CareerState, weatherWindowId: string): CareerState {
  if (!career.weatherWindows.some(item => item.id === weatherWindowId)) return career;
  return updateExpeditionPlan(career, { weatherWindowId });
}

export function toggleTeamMember(career: CareerState, memberId: string): CareerState {
  const member = career.teamRoster.find(item => item.id === memberId);
  if (!member || member.required || member.status !== 'ACTIVE' || member.availability < 45) return career;
  const selected = career.expeditionPlan.teamMemberIds.includes(memberId);
  const nextIds = selected
    ? career.expeditionPlan.teamMemberIds.filter(id => id !== memberId)
    : [...career.expeditionPlan.teamMemberIds, memberId];
  if (nextIds.length > 4) return career;
  return updateExpeditionPlan(career, { teamMemberIds: nextIds });
}

export function setGearQuantity(career: CareerState, gearId: string, quantity: number): CareerState {
  const definition = GEAR_CATALOG.find(item => item.id === gearId);
  if (!definition) return career;
  const value = clamp(Math.round(quantity), 0, definition.maxQuantity);
  return updateExpeditionPlan(career, { gear: { ...career.expeditionPlan.gear, [gearId]: value } });
}

export function applyEquipmentPreset(career: CareerState, preset: 'MINIMUM' | 'RECOMMENDED'): CareerState {
  const route = getSelectedRoute(career);
  const gear: Record<string, number> = {};
  for (const item of GEAR_CATALOG) gear[item.id] = route.requiredGearIds.includes(item.id) ? 1 : 0;
  if (preset === 'RECOMMENDED') {
    gear.rope = Math.max(1, gear.rope ?? 0);
    gear.stove = Math.max(1, gear.stove ?? 0);
    gear.medkit = Math.max(1, gear.medkit ?? 0);
    gear.bivy = Math.max(1, gear.bivy ?? 0);
    if (route.estimatedHours >= 16) gear.tent = Math.max(1, gear.tent ?? 0);
  }
  return updateExpeditionPlan(career, {
    gear,
    foodDays: preset === 'RECOMMENDED' ? Math.max(3, Math.ceil(route.estimatedHours / 24) + 2) : 2,
    fuelUnits: preset === 'RECOMMENDED' ? 3 : 2,
    ropeMeters: route.technicality >= 58 ? 70 : 50,
  });
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
  const consumables = career.expeditionPlan.foodDays * 1.45 + career.expeditionPlan.fuelUnits * .38 + career.expeditionPlan.ropeMeters * .035;
  const teamCount = Math.max(1, selectedTeam(career).length + 1);
  return Math.round((gearWeight + consumables) / teamCount * 10) / 10;
}

export function expeditionCost(career: CareerState) {
  const gearCost = GEAR_CATALOG.reduce((sum, item) => sum + item.unitCost * (career.expeditionPlan.gear[item.id] ?? 0), 0);
  return Math.round(gearCost * .18 + career.expeditionPlan.foodDays * 9 + career.expeditionPlan.fuelUnits * 5);
}

export function expeditionReadiness(career: CareerState): ExpeditionReadiness {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const team = selectedTeam(career);
  const heroBase = careerReadiness(career);
  const primarySkills = route.segments.map(item => career.hero.skills[item.skill]);
  const routeFit = clamp(Math.round(primarySkills.reduce((sum, value) => sum + value, 0) / primarySkills.length * 11 + 24 - route.technicality * .28), 0, 100);
  const teamScore = clamp(Math.round(team.reduce((sum, member) => sum + member.skill * 7 + member.endurance * 4 + member.trust * .22, 0) / Math.max(1, team.length)), 0, 100);
  const missingGear = route.requiredGearIds.filter(id => (career.expeditionPlan.gear[id] ?? 0) <= 0);
  const equipment = clamp(100 - missingGear.length * 23 - Math.max(0, expeditionWeight(career) - 16) * 3, 0, 100);
  const weatherScore = clamp(Math.round(weather.stability - weather.windKmh * .25 - weather.snowfallCm * .7 + weather.durationHours * .4), 0, 100);
  const acclimatization = clamp(career.expeditionPlan.acclimatizationDays * 13 + career.hero.skills.ENDURANCE * 4, 0, 100);
  const total = Math.round(heroBase * .25 + routeFit * .18 + teamScore * .17 + equipment * .18 + weatherScore * .12 + acclimatization * .1);
  const blockers: string[] = [];
  if (missingGear.length) blockers.push(`Не хватает обязательного снаряжения: ${missingGear.map(id => GEAR_CATALOG.find(item => item.id === id)?.name ?? id).join(', ')}`);
  if (team.length + 1 < route.recommendedTeamSize) blockers.push('Группа меньше рекомендованного состава.');
  if (career.expeditionPlan.foodDays < 2) blockers.push('Недостаточный запас еды.');
  if (career.expeditionPlan.fuelUnits < 2) blockers.push('Недостаточный запас топлива.');
  if (career.hero.fatigue > 72) blockers.push('Герой слишком утомлён для выхода.');
  if (career.expeditionPlan.acclimatizationDays < 2) blockers.push('Акклиматизация сорвана.');
  if (expeditionCost(career) > career.hero.money) blockers.push('Не хватает средств на подготовку.');
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
    DESCENT: { tone: (career.expeditionPlan.gear.bivy ?? 0) > 0 && career.expeditionPlan.ropeMeters >= 60 ? 'GOOD' : 'WARNING', title: 'Главная опасность начнётся после вершины', detail: 'Запас верёвки и аварийное укрытие снижают цену медленного спуска. Не планируй выход на нулевом остатке сил.' },
  };
  insights.push(characterInsight[route.mountainCharacterId]);

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

function weatherLabel(temperatureC: number, windKmh: number, visibility: number) {
  const sky = visibility < 35 ? 'Белая мгла' : visibility < 60 ? 'Снег и облачность' : visibility < 80 ? 'Переменная облачность' : 'Чистое небо';
  return `${sky} · ${temperatureC}°C · ветер ${windKmh} км/ч`;
}

export function startPlannedClimb(career: CareerState): CareerState {
  const readiness = expeditionReadiness(career);
  if (readiness.blockers.length || readiness.total < 54 || career.activeClimb) return career;
  const route = getSelectedRoute(career);
  const window = getSelectedWeather(career);
  const team = selectedTeam(career);
  const cost = expeditionCost(career);
  const startEnergy = clamp(96 - career.hero.fatigue * .28 - Math.max(0, packWeight(career) - 13) * 1.2, 58, 96);
  const climb: QualificationClimb = {
    id: `exp-${career.id}-${career.completedClimbs + 1}-${route.id}`,
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
    teamCondition: Math.round(team.reduce((sum, member) => sum + member.condition, 0) / Math.max(1, team.length)),
    supplies: {
      foodUnits: career.expeditionPlan.foodDays * (team.length + 1) * 3,
      waterUnits: Math.max(8, (team.length + 1) * 4),
      fuelUnits: career.expeditionPlan.fuelUnits,
    },
    hoursAwake: 0,
    campEstablished: false,
    route: route.segments,
    ascentRoute: route.segments,
    descentRoute: route.descentSegments ?? defaultDescentSegments(route),
    segmentChoices: {},
    routeChoices: [],
    fixedRopeSegmentIds: [],
    ropeMetersRemaining: career.expeditionPlan.ropeMeters,
    caches: [],
    log: [`05:10 — группа вышла на ${route.name}. Высота старта ${route.startElevation} м. Окно: ${window.label}.`],
    injuries: [],
    earnedReputation: 0,
    earnedMoney: 0,
  };
  const timeline = advanceDays(career, window.startsInDays + career.expeditionPlan.acclimatizationDays);
  const next: CareerState = {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    activeClimb: climb,
    hero: { ...career.hero, money: career.hero.money - cost, age: career.hero.age + timeline.ageDelta },
  };
  next.log = [...career.log, careerLog(next, 'EXPEDITION', `Выход на ${route.mountainName}`, `${route.name}. Группа: ${team.length + 1}. Расходы: ${cost} кр. Готовность: ${readiness.total}/100.`)];
  return next;
}

export function startQualificationClimb(career: CareerState, _world?: WorldState): CareerState {
  return startPlannedClimb(career);
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

function finishClimb(career: CareerState, climb: QualificationClimb): CareerState {
  const successful = climb.summitReached && !climb.retreating;
  let skills = { ...career.hero.skills };
  let skillXp = { ...career.hero.skillXp };
  const xpTable: [SkillId, number][] = successful
    ? [['ENDURANCE', 20], ['ROCK', 18], ['ICE', 16], ['NAVIGATION', 15], ['LEADERSHIP', 8]]
    : [['ENDURANCE', 10], ['NAVIGATION', 8], ['LEADERSHIP', 4]];
  for (const [skill, xp] of xpTable) {
    const progressed = addXp(skills, skillXp, skill, xp);
    skills = progressed.skills;
    skillXp = progressed.skillXp;
  }
  const casualtyPenalty = climb.casualties.length * 18;
  const reward = successful ? Math.max(0, 150 + Math.round(getSelectedRoute(career).objectiveRisk * 1.2) - casualtyPenalty * 3) : 0;
  const reputation = successful ? Math.max(-12, 8 + Math.round(getSelectedRoute(career).technicality / 12) - casualtyPenalty) : climb.retreating ? 1 : -4;
  const completed: QualificationClimb = {
    ...climb,
    phase: successful ? 'COMPLETE' : climb.phase === 'FAILED' ? 'FAILED' : 'RETREATED',
    earnedMoney: reward,
    earnedReputation: reputation,
    currentElevation: climb.startElevation,
    log: [...climb.log, `${clock(climb.elapsedMinutes)} — группа вернулась к исходной точке. ${successful ? 'Восхождение засчитано.' : 'Выход закрыт без вершины.'}`],
  };
  const roster = finalizeRosterAfterClimb(career, completed, successful);
  const report = buildExpeditionReport(career, completed, reputation, reward);
  const careDelta = completed.rescuedMemberIds.length * 7 + (completed.retreating ? 3 : 0) - completed.casualties.length * 12;
  const reliabilityDelta = successful ? 5 : completed.retreating ? 2 : -5;
  const leadershipDelta = Math.round(completed.decisions.filter(item => item.accepted).length * 1.5) - completed.decisions.filter(item => !item.accepted).length * 2;
  const next: CareerState = {
    ...career,
    completedClimbs: career.completedClimbs + (successful ? 1 : 0),
    highestElevation: Math.max(career.highestElevation, climb.summitReached ? climb.summitElevation : climb.currentElevation),
    activeClimb: completed,
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
      money: career.hero.money + reward,
      form: clamp(career.hero.form - 5, 0, 100),
      fatigue: clamp(career.hero.fatigue + 25 + Math.round(climb.elapsedMinutes / 400), 0, 100),
      health: clamp(career.hero.health - climb.injuries.length * 4, 0, 100),
      injuries: [...career.hero.injuries, ...climb.injuries],
      skills,
      skillXp,
    },
  };
  next.log = [
    ...career.log,
    careerLog(next, 'CLIMB', successful ? `Восхождение на ${climb.mountainName}` : `Выход на ${climb.mountainName}`, successful ? `Маршрут «${climb.routeName}» пройден. Группа полностью вернулась.` : 'Группа спустилась без засчитанной вершины.'),
    careerLog(next, 'PRESS', 'Реакция после экспедиции', `${report.clubReaction} ${report.pressReaction}`),
  ];
  return next;
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

export function resolveClimbStep(career: CareerState, pace: ClimbPace): ClimbStepResult {
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
    const completedCareer = finishClimb(career, nextClimb);
    return { career: completedCareer, headline: 'Группа вернулась', detail: nextClimb.summitReached && !nextClimb.retreating ? 'Восхождение засчитано после отдельного спуска.' : 'Отход завершён. Карьера продолжается.', severity: 'SUCCESS' };
  } else {
    nextClimb.segmentIndex += 1;
  }

  return { career: { ...career, activeClimb: nextClimb }, headline, detail, severity };
}

export function establishCamp(career: CareerState): ClimbStepResult {
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

export function closeClimb(career: CareerState): CareerState {
  if (!career.activeClimb || !['COMPLETE', 'FAILED', 'RETREATED'].includes(career.activeClimb.phase)) return career;
  const alreadyReported = career.reports.some(report => report.id === `report-${career.activeClimb!.id}`);
  const climb = career.activeClimb;
  let finalized = alreadyReported ? career : finishClimb(career, climb);
  if (!alreadyReported) {
    const report = finalized.reports[finalized.reports.length - 1];
    if (report) finalized = registerHeroExpedition(finalized, climb, report);
  }
  const timeline = advanceDays(finalized, 3);
  const closed: CareerState = {
    ...finalized,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: { ...finalized.hero, age: finalized.hero.age + timeline.ageDelta },
    activeClimb: null,
  };
  return advanceLivingWorld(closed, 3);
}
