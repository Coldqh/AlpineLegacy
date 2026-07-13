import { createRng } from './rng';
import type {
  CalendarEntry,
  CareerDraft,
  CareerLogEntry,
  CareerState,
  ClimbPace,
  ClimbStepResult,
  ClubData,
  OriginDefinition,
  OriginId,
  QualificationClimb,
  RouteSegment,
  SkillId,
  SkillSet,
  TrainingId,
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

const clubPrefixes = ['Северный', 'Высотный', 'Ледниковый', 'Альпийский', 'Горный', 'Центральный'];
const clubSuffixes = ['клуб', 'союз восходителей', 'альпийское общество', 'горная секция'];
const townsA = ['Брайт', 'Лин', 'Валь', 'Керн', 'Обер', 'Сент', 'Норд', 'Рейн'];
const townsB = ['хоф', 'брюк', 'дорф', 'вик', 'град', 'фельд', 'мар', 'лен'];
const mentorFirst = ['Эрик', 'Марек', 'Илья', 'Анри', 'Томас', 'Леон', 'Виктор', 'Рудольф'];
const mentorLast = ['Райн', 'Морель', 'Келлер', 'Штольц', 'Варден', 'Тарнов', 'Грейв', 'Эллен'];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeClub(world: WorldState): ClubData {
  const rng = createRng(`${world.config.seed}:career:club`);
  const town = `${rng.pick(townsA)}${rng.pick(townsB)}`;
  return {
    id: `club-${world.region.id}`,
    name: `${rng.pick(clubPrefixes)} ${rng.pick(clubSuffixes)}`,
    town,
    foundedYear: world.config.startYear - rng.int(18, Math.min(82, world.worldAge - 4)),
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
  const career: CareerState = {
    schemaVersion: 2,
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
  };

  career.log.push(careerLog(
    career,
    'CAREER',
    'Начало карьеры',
    `${career.hero.name}, ${career.hero.age} лет. Принят в «${club.name}», ${club.town}.`,
  ));
  career.log.push(careerLog(
    career,
    'CLUB',
    'Первый инструктор',
    `${club.mentorName}, ${club.mentorTitle}. Его правило: «${club.doctrine}»`,
  ));
  return career;
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
  const money = clamp(career.hero.money - cost, 0, 99_999);
  const next: CareerState = {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: {
      ...career.hero,
      age: career.hero.age + timeline.ageDelta,
      money,
      form: clamp(career.hero.form + action.form - Math.max(0, career.hero.fatigue - 70) * 0.05, 0, 100),
      fatigue: clamp(career.hero.fatigue + action.fatigue, 0, 100),
      health: clamp(career.hero.health + (trainingId === 'RECOVERY' ? 6 : 0), 0, 100),
      morale: clamp(career.hero.morale + (trainingId === 'RECOVERY' ? 4 : trainingId === 'CLUB_DUTY' ? 3 : 1), 0, 100),
      skills,
      skillXp,
    },
  };
  next.log = [
    ...career.log,
    careerLog(next, 'TRAINING', action.title, `${action.days} дней работы. ${cost < 0 ? `Заработано ${Math.abs(cost)} кр.` : `Расходы ${cost} кр.`}`),
  ];
  return next;
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
    startElevation: Math.max(world.region.elevationMin + 120, summitElevation - 820),
    displayName: subsidiary ? `${mountain.name} / Южная вершина` : mountain.name,
    subsidiary,
  };
}

function makeRoute(world: WorldState, summitElevation: number, startElevation: number): RouteSegment[] {
  const totalGain = summitElevation - startElevation;
  const gains = [0.12, 0.18, 0.22, 0.21, 0.27].map(part => Math.round(totalGain * part));
  gains[gains.length - 1] += totalGain - gains.reduce((sum, value) => sum + value, 0);
  const eraPenalty = world.config.eraId === 'PIONEER' ? 6 : world.config.eraId === 'EXPEDITION' ? 3 : 0;
  return [
    {
      id: 'approach-basin',
      name: 'Верхняя морена',
      terrain: 'Камень и осыпь',
      elevationGain: gains[0]!,
      baseDurationMinutes: 85,
      difficulty: 22 + eraPenalty,
      exposure: 12,
      skill: 'ENDURANCE',
      note: 'Длинный набор с грузом. Ранний перерасход сил ударит по верхней части.',
    },
    {
      id: 'broken-ribs',
      name: 'Разрушенные рёбра',
      terrain: 'Простые скалы',
      elevationGain: gains[1]!,
      baseDurationMinutes: 105,
      difficulty: 30 + eraPenalty,
      exposure: 28,
      skill: 'ROCK',
      note: 'Короткие стенки, осыпь и несколько обязательных станций.',
    },
    {
      id: 'glacier-traverse',
      name: 'Ледниковый траверс',
      terrain: 'Закрытый ледник',
      elevationGain: gains[2]!,
      baseDurationMinutes: 120,
      difficulty: 34 + eraPenalty,
      exposure: 34,
      skill: 'NAVIGATION',
      note: 'Трещины читаются плохо. Связка обязана держать дистанцию.',
    },
    {
      id: 'ice-step',
      name: 'Ледовый взлёт',
      terrain: 'Жёсткий лёд',
      elevationGain: gains[3]!,
      baseDurationMinutes: 95,
      difficulty: 39 + eraPenalty,
      exposure: 45,
      skill: 'ICE',
      note: 'Короткий, но крутой участок. Ошибка здесь означает падение всей связки.',
    },
    {
      id: 'summit-ridge',
      name: 'Вершинный гребень',
      terrain: 'Снег и скальные выходы',
      elevationGain: gains[4]!,
      baseDurationMinutes: 130,
      difficulty: 43 + eraPenalty,
      exposure: 56,
      skill: 'ROCK',
      note: 'Узкий гребень. Ветер и усталость делают обратный путь тяжелее подъёма.',
    },
  ];
}

export function startQualificationClimb(career: CareerState, world: WorldState): CareerState {
  const target = getQualificationTarget(world);
  const { mountain, startElevation, summitElevation } = target;
  const route = makeRoute(world, summitElevation, startElevation);
  const climb: QualificationClimb = {
    id: `qual-${career.id}-${career.completedClimbs + 1}`,
    mountainId: mountain.id,
    mountainName: target.displayName,
    routeName: 'Клубный квалификационный маршрут',
    startElevation,
    summitElevation,
    phase: 'ASCENT',
    segmentIndex: 0,
    moveCount: 0,
    currentElevation: startElevation,
    elapsedMinutes: 0,
    energy: clamp(94 - career.hero.fatigue * 0.3, 62, 96),
    condition: career.hero.health,
    weather: 'Переменная облачность · ветер 18 км/ч',
    route,
    log: [`05:10 — связка вышла с высоты ${startElevation} м к цели ${target.displayName}.`],
    injuries: [],
    earnedReputation: 0,
    earnedMoney: 0,
  };
  return {
    ...career,
    activeClimb: climb,
    log: [...career.log, careerLog(career, 'CLIMB', 'Квалификационное восхождение', `${target.displayName}. Маршрут принят инструктором клуба.`)],
  };
}

function paceData(pace: ClimbPace) {
  if (pace === 'CAUTIOUS') return { time: 1.28, energy: 0.82, risk: -0.035, label: 'осторожно' };
  if (pace === 'FAST') return { time: 0.78, energy: 1.34, risk: 0.075, label: 'быстро' };
  return { time: 1, energy: 1, risk: 0, label: 'ровным темпом' };
}

function clock(minutes: number) {
  const start = 5 * 60 + 10;
  const value = start + minutes;
  const hour = Math.floor(value / 60) % 24;
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function finishClimb(career: CareerState, climb: QualificationClimb): CareerState {
  let skills = { ...career.hero.skills };
  let skillXp = { ...career.hero.skillXp };
  for (const [skill, xp] of [['ENDURANCE', 16], ['ROCK', 20], ['ICE', 12], ['NAVIGATION', 12]] as [SkillId, number][]) {
    const progressed = addXp(skills, skillXp, skill, xp);
    skills = progressed.skills;
    skillXp = progressed.skillXp;
  }
  const reward = 140;
  const reputation = 9;
  const completed: QualificationClimb = {
    ...climb,
    phase: 'COMPLETE',
    earnedMoney: reward,
    earnedReputation: reputation,
    log: [...climb.log, `${clock(climb.elapsedMinutes)} — связка вернулась к исходной точке. Восхождение засчитано.`],
  };
  const next: CareerState = {
    ...career,
    completedClimbs: career.completedClimbs + 1,
    highestElevation: Math.max(career.highestElevation, climb.summitElevation),
    activeClimb: completed,
    hero: {
      ...career.hero,
      reputation: career.hero.reputation + reputation,
      money: career.hero.money + reward,
      form: clamp(career.hero.form - 4, 0, 100),
      fatigue: clamp(career.hero.fatigue + 27, 0, 100),
      health: clamp(career.hero.health - climb.injuries.length * 4, 0, 100),
      injuries: [...career.hero.injuries, ...climb.injuries],
      skills,
      skillXp,
    },
  };
  next.log = [
    ...career.log,
    careerLog(next, 'CLIMB', `Восхождение на ${climb.mountainName}`, `Вершина ${climb.summitElevation} м достигнута. Связка полностью вернулась вниз.`),
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
      segmentIndex: climb.route.length - 1,
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — начат спуск. Вершина больше не считается безопасным местом.`],
    },
  };
}

export function resolveClimbStep(career: CareerState, pace: ClimbPace): ClimbStepResult {
  const climb = career.activeClimb;
  if (!climb || (climb.phase !== 'ASCENT' && climb.phase !== 'DESCENT')) {
    return { career, headline: 'Действие недоступно', detail: 'Связка сейчас не движется по маршруту.', severity: 'WARNING' };
  }

  const segment = climb.route[climb.segmentIndex]!;
  const direction = climb.phase === 'ASCENT' ? 1 : -1;
  const paceMod = paceData(pace);
  const hero = career.hero;
  const skill = hero.skills[segment.skill];
  const descentPenalty = climb.phase === 'DESCENT' ? 6 : 0;
  const fatiguePenalty = (100 - climb.energy) * 0.13 + hero.fatigue * 0.08;
  const ability = skill * 10 + hero.form * 0.28 + climb.energy * 0.16 - fatiguePenalty;
  const target = segment.difficulty + descentPenalty + segment.exposure * 0.08;
  const incidentChance = clamp(0.025 + Math.max(0, target - ability) * 0.012 + paceMod.risk, 0.015, 0.62);
  const rng = createRng(`${career.id}:${climb.id}:${climb.phase}:${climb.moveCount}:${pace}`);

  let duration = Math.round(segment.baseDurationMinutes * paceMod.time * (climb.phase === 'DESCENT' ? 0.82 : 1));
  let energyCost = Math.round((4 + segment.difficulty * 0.08 + segment.exposure * 0.02) * paceMod.energy * (climb.phase === 'DESCENT' ? 0.76 : 1));
  let conditionLoss = 0;
  let headline = `${segment.name} пройден`;
  let detail = `Связка двигалась ${paceMod.label}. Темп сохранён.`;
  let severity: ClimbStepResult['severity'] = 'CALM';
  let newInjury: string | null = null;

  if (rng.chance(incidentChance)) {
    const incidentRoll = rng.next();
    if (incidentRoll < 0.58) {
      const delay = rng.int(22, 58);
      duration += delay;
      energyCost += rng.int(3, 7);
      headline = 'Маршрут забрал время';
      detail = rng.pick([
        'Пришлось перестраивать станцию и искать более надёжную линию.',
        'Связка ушла в сторону и вернулась к основному рельефу после проверки карты.',
        'Один из участников сорвал темп. Группа остановилась и перераспределила груз.',
      ]);
      severity = 'WARNING';
    } else if (incidentRoll < 0.9) {
      newInjury = rng.pick(['Ушиб правого колена', 'Рассечение ладони', 'Растяжение голеностопа']);
      duration += rng.int(28, 70);
      energyCost += rng.int(6, 12);
      conditionLoss = rng.int(5, 11);
      headline = newInjury;
      detail = 'Движение возможно, но спуск потребует меньшего темпа и внимательной страховки.';
      severity = 'DANGER';
    } else {
      const failed: QualificationClimb = {
        ...climb,
        phase: 'FAILED',
        moveCount: climb.moveCount + 1,
        elapsedMinutes: climb.elapsedMinutes + duration + 75,
        energy: clamp(climb.energy - energyCost - 12, 0, 100),
        condition: clamp(climb.condition - 14, 0, 100),
        injuries: [...climb.injuries, 'Травма при срыве'],
        log: [...climb.log, `${clock(climb.elapsedMinutes + duration)} — срыв. Инструктор прекратил восхождение и организовал спуск.`],
      };
      const failedCareer: CareerState = {
        ...career,
        activeClimb: failed,
        hero: {
          ...career.hero,
          health: clamp(career.hero.health - 12, 0, 100),
          fatigue: clamp(career.hero.fatigue + 22, 0, 100),
          injuries: [...career.hero.injuries, 'Травма при срыве'],
        },
        log: [...career.log, careerLog(career, 'INJURY', 'Срыв на квалификационном маршруте', 'Попытка остановлена инструктором. Герой доставлен вниз.')],
      };
      return { career: failedCareer, headline: 'Срыв. Попытка закончена.', detail: 'Группа вернулась без вершины. Сначала потребуется восстановление.', severity: 'DANGER' };
    }
  }

  const elapsedMinutes = climb.elapsedMinutes + duration;
  const energy = clamp(climb.energy - energyCost, 0, 100);
  const condition = clamp(climb.condition - conditionLoss, 0, 100);
  const elevationChange = direction * segment.elevationGain;
  const currentElevation = clamp(climb.currentElevation + elevationChange, climb.startElevation, climb.summitElevation);
  const logLine = `${clock(elapsedMinutes)} — ${segment.name}: ${detail}`;
  const injuries = newInjury ? [...climb.injuries, newInjury] : climb.injuries;

  let nextClimb: QualificationClimb = {
    ...climb,
    moveCount: climb.moveCount + 1,
    elapsedMinutes,
    energy,
    condition,
    currentElevation,
    injuries,
    log: [...climb.log, logLine],
  };

  if (energy <= 5 || condition <= 40) {
    nextClimb = {
      ...nextClimb,
      phase: 'FAILED',
      log: [...nextClimb.log, `${clock(elapsedMinutes)} — инструктор остановил движение из-за состояния участника.`],
    };
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
    return { career: stopped, headline: 'Движение остановлено', detail: 'Резерв сил исчерпан. Клубная группа организовала возвращение.', severity: 'DANGER' };
  }

  if (climb.phase === 'ASCENT') {
    if (climb.segmentIndex >= climb.route.length - 1) {
      nextClimb = {
        ...nextClimb,
        phase: 'SUMMIT',
        currentElevation: climb.summitElevation,
        log: [...nextClimb.log, `${clock(elapsedMinutes)} — вершина ${climb.mountainName}, ${climb.summitElevation} м.`],
      };
      headline = 'Вершина достигнута';
      detail = 'Попытка ещё не завершена. Внизу остаётся весь обратный маршрут.';
      severity = 'SUCCESS';
    } else {
      nextClimb.segmentIndex += 1;
    }
  } else if (climb.segmentIndex <= 0) {
    const completedCareer = finishClimb(career, nextClimb);
    return { career: completedCareer, headline: 'Связка вернулась', detail: 'Квалификационное восхождение засчитано только после полного спуска.', severity: 'SUCCESS' };
  } else {
    nextClimb.segmentIndex -= 1;
  }

  return { career: { ...career, activeClimb: nextClimb }, headline, detail, severity };
}

export function retreatClimb(career: CareerState): CareerState {
  const climb = career.activeClimb;
  if (!climb || !['ASCENT', 'SUMMIT'].includes(climb.phase)) return career;
  const retreated: QualificationClimb = {
    ...climb,
    phase: 'RETREATED',
    elapsedMinutes: climb.elapsedMinutes + 110,
    currentElevation: climb.startElevation,
    energy: clamp(climb.energy - 12, 0, 100),
    log: [...climb.log, `${clock(climb.elapsedMinutes + 110)} — группа развернулась и вернулась к исходной точке.`],
  };
  const next: CareerState = {
    ...career,
    activeClimb: retreated,
    hero: {
      ...career.hero,
      fatigue: clamp(career.hero.fatigue + 16, 0, 100),
      health: clamp(career.hero.health - climb.injuries.length * 3, 0, 100),
      morale: clamp(career.hero.morale - 3, 0, 100),
      injuries: [...career.hero.injuries, ...climb.injuries],
    },
  };
  next.log = [...career.log, careerLog(next, 'CLIMB', 'Отказ от восхождения', `${climb.mountainName}: группа развернулась и вернулась без аварии.`)];
  return next;
}

export function closeClimb(career: CareerState): CareerState {
  if (!career.activeClimb || !['COMPLETE', 'FAILED', 'RETREATED'].includes(career.activeClimb.phase)) return career;
  const timeline = advanceDays(career, 3);
  return {
    ...career,
    year: timeline.year,
    seasonDay: timeline.seasonDay,
    week: timeline.week,
    hero: { ...career.hero, age: career.hero.age + timeline.ageDelta },
    activeClimb: null,
  };
}
