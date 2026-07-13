import { createRng } from './rng';
import { buildExpeditionReport, createClimbTeamStates, enrichRoster, finalizeRosterAfterClimb, memory, teamAverage } from './people';
import type {
  CalendarEntry,
  CareerDraft,
  CareerLogEntry,
  CareerState,
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

function makeRoutes(world: WorldState): ExpeditionRoute[] {
  const target = getQualificationTarget(world);
  const totalGain = target.summitElevation - target.startElevation;
  const eraPenalty = world.config.eraId === 'PIONEER' ? 7 : world.config.eraId === 'EXPEDITION' ? 3 : 0;

  const ridgeGain = splitGain(totalGain, [.12, .18, .22, .21, .27]);
  const glacierGain = splitGain(totalGain, [.1, .16, .18, .19, .17, .2]);
  const faceGain = splitGain(totalGain, [.08, .17, .25, .24, .26]);

  return [
    {
      id: 'south-ridge',
      mountainId: target.mountain.id,
      mountainName: target.displayName,
      name: 'Южный гребень',
      style: 'Классический смешанный маршрут',
      summary: 'Длинный, читаемый и честный маршрут. Ошибки чаще накапливаются через усталость, а не приходят одним ударом.',
      startElevation: target.startElevation,
      summitElevation: target.summitElevation,
      estimatedHours: 14,
      technicality: 42 + eraPenalty,
      objectiveRisk: 36,
      recommendedTeamSize: 3,
      requiredGearIds: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit'],
      segments: [
        segment('sr-moraine', 'Верхняя морена', 'Осыпь и камень', ridgeGain[0]!, 85, 24 + eraPenalty, 12, 'ENDURANCE', 'Длинный набор с грузом. Перерасход сил ударит по верхней части.', true, 'Сход камней'),
        segment('sr-ribs', 'Разрушенные рёбра', 'Простые скалы', ridgeGain[1]!, 110, 32 + eraPenalty, 30, 'ROCK', 'Короткие стенки и обязательные станции.', false, 'Срыв камней'),
        segment('sr-glacier', 'Ледниковый траверс', 'Закрытый ледник', ridgeGain[2]!, 125, 35 + eraPenalty, 34, 'NAVIGATION', 'Трещины читаются плохо. Связка обязана держать дистанцию.', true, 'Трещины'),
        segment('sr-ice', 'Ледовый взлёт', 'Жёсткий лёд', ridgeGain[3]!, 100, 41 + eraPenalty, 47, 'ICE', 'Крутой участок. Ошибка здесь затрагивает всю связку.', false, 'Срыв'),
        segment('sr-summit', 'Вершинный гребень', 'Снег и скальные выходы', ridgeGain[4]!, 135, 45 + eraPenalty, 58, 'ROCK', 'Узкий гребень. Ветер и усталость делают спуск тяжелее.', false, 'Ветер'),
      ],
    },
    {
      id: 'east-glacier',
      mountainId: target.mountain.id,
      mountainName: target.displayName,
      name: 'Восточный ледник',
      style: 'Длинная ледниковая линия',
      summary: 'Меньше сложного лазания, больше времени на высоте, закрытых трещин и зависимости от утреннего холода.',
      startElevation: target.startElevation - 70,
      summitElevation: target.summitElevation,
      estimatedHours: 17,
      technicality: 38 + eraPenalty,
      objectiveRisk: 48,
      recommendedTeamSize: 4,
      requiredGearIds: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'],
      segments: [
        segment('eg-basin', 'Ледниковая чаша', 'Снег и морена', glacierGain[0]!, 95, 23 + eraPenalty, 15, 'ENDURANCE', 'Тяжёлый подход и ранняя проверка темпа.', true, 'Переохлаждение'),
        segment('eg-labyrinth', 'Лабиринт трещин', 'Закрытый ледник', glacierGain[1]!, 145, 36 + eraPenalty, 38, 'NAVIGATION', 'Нужна точная линия и постоянная работа верёвки.', false, 'Провал в трещину'),
        segment('eg-plateau', 'Белое плато', 'Открытый ледник', glacierGain[2]!, 150, 31 + eraPenalty, 27, 'ENDURANCE', 'Монотонный набор высоты без укрытия от ветра.', true, 'Потеря направления'),
        segment('eg-serac', 'Серачная зона', 'Лёд и обломки', glacierGain[3]!, 115, 43 + eraPenalty, 52, 'ICE', 'Здесь нельзя останавливаться надолго.', false, 'Ледовый обвал'),
        segment('eg-shoulder', 'Восточное плечо', 'Фирн', glacierGain[4]!, 120, 39 + eraPenalty, 44, 'ENDURANCE', 'Наклон умеренный, но высота забирает скорость.', true, 'Лавинная доска'),
        segment('eg-top', 'Купол', 'Снег и лёд', glacierGain[5]!, 140, 45 + eraPenalty, 55, 'NAVIGATION', 'В плохой видимости легко уйти на опасный карниз.', false, 'Карниз'),
      ],
    },
    {
      id: 'north-line',
      mountainId: target.mountain.id,
      mountainName: target.displayName,
      name: 'Северная линия',
      style: 'Прямая техническая линия',
      summary: 'Короткая по расстоянию, но требовательная к технике. Высокая открытость и мало мест для отдыха.',
      startElevation: target.startElevation + 40,
      summitElevation: target.summitElevation,
      estimatedHours: 12,
      technicality: 57 + eraPenalty,
      objectiveRisk: 57,
      recommendedTeamSize: 3,
      requiredGearIds: ['rope', 'rock-kit', 'ice-kit', 'medkit', 'bivy'],
      segments: [
        segment('nl-cone', 'Северный конус', 'Осыпь', faceGain[0]!, 70, 28 + eraPenalty, 18, 'ENDURANCE', 'Короткий подход под стену.', true, 'Камнепад'),
        segment('nl-couloir', 'Тёмный кулуар', 'Снег и лёд', faceGain[1]!, 105, 45 + eraPenalty, 49, 'ICE', 'Узкий кулуар собирает лёд и камни.', false, 'Ледовый обвал'),
        segment('nl-wall', 'Северная стена', 'Микст и скалы', faceGain[2]!, 165, 58 + eraPenalty, 69, 'ROCK', 'Ключ маршрута. Отступление после середины сложно.', false, 'Срыв'),
        segment('nl-ramp', 'Ледовая рампа', 'Крутой лёд', faceGain[3]!, 135, 56 + eraPenalty, 64, 'ICE', 'Станции требуют времени и точности.', false, 'Разрушение станции'),
        segment('nl-edge', 'Кромка вершины', 'Смешанный гребень', faceGain[4]!, 125, 52 + eraPenalty, 71, 'ROCK', 'Открытый финиш без места для лагеря.', false, 'Штормовой ветер'),
      ],
    },
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
    schemaVersion: 4,
    id: `career-${world.id}-${draft.name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24) || 'climber'}`,
    worldId: world.id,
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
  };

  career.log.push(careerLog(career, 'CAREER', 'Начало карьеры', `${career.hero.name}, ${career.hero.age} лет. Принят в «${club.name}», ${club.town}.`));
  career.log.push(careerLog(career, 'CLUB', 'Первый инструктор', `${club.mentorName}, ${club.mentorTitle}. Его правило: «${club.doctrine}»`));
  return career;
}

export function migrateCareerV2(career: any, world: WorldState): CareerState {
  const routes = makeRoutes(world);
  const teamRoster = makeTeam(world, career.club);
  const weatherWindows = makeWeatherWindows(world);
  return {
    ...career,
    schemaVersion: 4,
    activeClimb: null,
    routes,
    teamRoster,
    weatherWindows,
    expeditionPlan: defaultPlan(routes, teamRoster, weatherWindows),
    reports: [],
    reputationProfile: { leadership: 8, reliability: 12, care: 10, ambition: 14 },
  } as CareerState;
}

export function migrateCareerV3(career: any, world: WorldState): CareerState {
  const teamRoster = enrichRoster(career.teamRoster ?? makeTeam(world, career.club), world.config.seed, career.year, career.seasonDay);
  const activeClimb = career.activeClimb ? {
    ...career.activeClimb,
    teamStates: career.activeClimb.teamStates ?? createClimbTeamStates(teamRoster.filter(member => career.activeClimb.teamMemberIds.includes(member.id))),
    decisions: career.activeClimb.decisions ?? [],
    casualties: career.activeClimb.casualties ?? [],
    rescuedMemberIds: career.activeClimb.rescuedMemberIds ?? [],
  } : null;
  return {
    ...career,
    schemaVersion: 4,
    teamRoster,
    activeClimb,
    reports: career.reports ?? [],
    reputationProfile: career.reputationProfile ?? { leadership: 8, reliability: 12, care: 10, ambition: 14 },
  } as CareerState;
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
  return next;
}

export function updateExpeditionPlan(career: CareerState, patch: Partial<ExpeditionPlan>): CareerState {
  return { ...career, expeditionPlan: { ...career.expeditionPlan, ...patch } };
}

export function selectRoute(career: CareerState, routeId: string): CareerState {
  const route = career.routes.find(item => item.id === routeId);
  if (!route) return career;
  return updateExpeditionPlan(career, { routeId });
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
  const phase = Math.floor((climb.elapsedMinutes + elapsedDelta) / 240);
  const frontPush = phase > 3 ? (phase - 3) * 2 : 0;
  const temperatureC = clamp(climb.temperatureC + rng.int(-2, 2), -34, 6);
  const windKmh = clamp(climb.windKmh + rng.int(-5, 8) + frontPush, 4, 88);
  const visibility = clamp(climb.visibility + rng.int(-13, 9) - Math.max(0, frontPush - 4), 12, 100);
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

export function beginDescent(career: CareerState): CareerState {
  const climb = career.activeClimb;
  if (!climb || climb.phase !== 'SUMMIT') return career;
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      summitReached: true,
      segmentIndex: climb.route.length - 1,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — начат спуск. Вершина больше не считается безопасным местом.`],
    },
  };
}

export function retreatClimb(career: CareerState): CareerState {
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'SUMMIT'].includes(climb.phase)) return career;
  const segmentIndex = climb.phase === 'SUMMIT' ? climb.route.length - 1 : Math.max(0, climb.segmentIndex - 1);
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      retreating: true,
      summitReached: climb.phase === 'SUMMIT',
      segmentIndex,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — принято решение об отходе. Группа начинает полноценный спуск.`],
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

export function resolveClimbStep(career: CareerState, pace: ClimbPace): ClimbStepResult {
  const climb = career.activeClimb;
  if (!climb || (climb.phase !== 'ASCENT' && climb.phase !== 'DESCENT')) {
    return { career, headline: 'Действие недоступно', detail: 'Группа сейчас не движется по маршруту.', severity: 'WARNING' };
  }

  const segment = climb.route[climb.segmentIndex]!;
  const direction = climb.phase === 'ASCENT' ? 1 : -1;
  const paceMod = paceData(pace);
  const hero = career.hero;
  const skill = hero.skills[segment.skill];
  const descentPenalty = climb.phase === 'DESCENT' ? 7 : 0;
  const fatiguePenalty = (100 - climb.energy) * .13 + hero.fatigue * .08 + climb.hoursAwake * .45;
  const weatherPenalty = Math.max(0, climb.windKmh - 24) * .24 + Math.max(0, 65 - climb.visibility) * .15;
  const teamSupport = Math.max(0, climb.teamCondition - 70) * .12 + climb.teamMemberIds.length * 1.8;
  const packPenalty = Math.max(0, climb.packWeightKg - 13) * .7;
  const ability = skill * 10 + hero.form * .28 + climb.energy * .16 + teamSupport - fatiguePenalty - weatherPenalty - packPenalty;
  const target = segment.difficulty + descentPenalty + segment.exposure * .08;
  let incidentChance = clamp(.02 + Math.max(0, target - ability) * .011 + paceMod.risk, .01, .67);
  if (climb.supplies.waterUnits <= 0) incidentChance += .08;
  if (climb.supplies.foodUnits <= 0) incidentChance += .06;
  const rng = createRng(`${career.id}:${climb.id}:${climb.phase}:${climb.moveCount}:${pace}`);

  let duration = Math.round(segment.baseDurationMinutes * paceMod.time * (climb.phase === 'DESCENT' ? .84 : 1));
  let energyCost = Math.round((4 + segment.difficulty * .078 + segment.exposure * .018 + climb.hoursAwake * .08) * paceMod.energy * (climb.phase === 'DESCENT' ? .8 : 1));
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
  const supplies = consumeSupplies(climb, hours);
  if (supplies.waterUnits === 0) energyCost += 5;
  if (supplies.foodUnits === 0) energyCost += 4;
  const energy = clamp(climb.energy - energyCost, 0, 100);
  const condition = clamp(climb.condition - conditionLoss - (weather.temperatureC < -20 ? 1 : 0), 0, 100);
  const elevationChange = direction * segment.elevationGain;
  const currentElevation = clamp(climb.currentElevation + elevationChange, climb.startElevation, climb.summitElevation);
  const teamEvolution = evolveTeamStates(career, climb, duration, pace, weather.temperatureC < -20 ? 1 : 0);
  const adjustedTeamStates = teamEvolution.states.map(state => state.status === 'ACTIVE' ? { ...state, condition: clamp(state.condition - teamLoss * .35, 0, 100) } : state);
  if (teamEvolution.reveal) {
    detail = `${detail} ${teamEvolution.reveal}`;
    severity = severity === 'CALM' ? 'WARNING' : severity;
  }
  const logLine = `${clock(elapsedMinutes)} — ${segment.name}: ${detail}`;
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
  } else if (climb.segmentIndex <= 0) {
    const completedCareer = finishClimb(career, nextClimb);
    return { career: completedCareer, headline: 'Группа вернулась', detail: nextClimb.summitReached && !nextClimb.retreating ? 'Восхождение засчитано после полного спуска.' : 'Отход завершён. Карьера продолжается.', severity: 'SUCCESS' };
  } else {
    nextClimb.segmentIndex -= 1;
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
  const finalized = alreadyReported ? career : finishClimb(career, career.activeClimb);
  const timeline = advanceDays(finalized, 3);
  return {
    ...finalized,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: { ...finalized.hero, age: finalized.hero.age + timeline.ageDelta },
    activeClimb: null,
  };
}
