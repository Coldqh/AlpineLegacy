import { createRng } from './rng';
import type {
  CareerState,
  ClubData,
  ExpeditionReport,
  LivingWorldState,
  MountainData,
  MemberStatus,
  MountainWorldHistory,
  QualificationClimb,
  SkillId,
  TeamMember,
  WorldAthlete,
  WorldClub,
  WorldExpedition,
  WorldNewsItem,
  WorldRecord,
  WorldState,
} from './types';

const firstNames = ['Арон', 'Мира', 'Илья', 'Софи', 'Леон', 'Нора', 'Эмиль', 'Ада', 'Марк', 'Лина', 'Томас', 'Эльза', 'Рен', 'Кира', 'Ян', 'Майя', 'Оскар', 'Ида', 'Виктор', 'Рут'];
const lastNames = ['Вайс', 'Рейн', 'Корда', 'Моретти', 'Сарин', 'Хольм', 'Дюран', 'Келлер', 'Наварро', 'Стейн', 'Арден', 'Фальк', 'Ривера', 'Торн', 'Эрден', 'Восс'];
const countries = ['Нордваль', 'Аурелия', 'Карден', 'Серрат', 'Эльмар', 'Варния', 'Монтера', 'Ильсен'];
const clubRoots = ['Высотный союз', 'Северная связка', 'Клуб ледовых стен', 'Горное общество', 'Альпийский круг', 'Институт вершины'];
const doctrines = ['Возвращение важнее вершины', 'Скорость сохраняет жизнь', 'Маршрут решает связка', 'Сначала линия, потом амбиции', 'Высота не прощает спешку', 'Каждый участник отвечает за всех'];
const goals = ['первая вершина региона', 'новый маршрут по северной стене', 'скоростное прохождение', 'зимнее восхождение', 'серия высотных вершин', 'возвращение после тяжёлой травмы'];
const injuries = ['повреждение колена', 'обморожение пальцев', 'растяжение плеча', 'трещина ребра', 'высотное истощение', 'повреждение голеностопа'];
const specialties: SkillId[] = ['ENDURANCE', 'ROCK', 'ICE', 'NAVIGATION', 'MEDICINE', 'LEADERSHIP'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function athleteName(seed: string, index: number) {
  const rng = createRng(`${seed}:athlete-name:${index}`);
  return `${rng.pick(firstNames)} ${rng.pick(lastNames)}`;
}

function clubFromCareer(club: ClubData): WorldClub {
  return {
    id: club.id,
    name: club.name,
    country: club.town,
    foundedYear: club.foundedYear,
    prestige: club.standing,
    doctrine: club.doctrine,
    members: 18,
    expeditions: 0,
    summits: 0,
    losses: 0,
  };
}

function createClubs(world: WorldState, club: ClubData): WorldClub[] {
  const rng = createRng(`${world.config.seed}:world-clubs`);
  const clubs: WorldClub[] = [clubFromCareer(club)];
  for (let index = 1; index < 6; index += 1) {
    const country = rng.pick(countries);
    clubs.push({
      id: `world-club-${index}-${world.id}`,
      name: `${rng.pick(clubRoots)} «${country.slice(0, 6)}»`,
      country,
      foundedYear: world.config.startYear - rng.int(8, 67),
      prestige: rng.int(28, 84),
      doctrine: rng.pick(doctrines),
      members: rng.int(12, 44),
      expeditions: rng.int(4, 36),
      summits: rng.int(2, 22),
      losses: rng.int(0, 5),
    });
  }
  return clubs;
}

function athleteFromTeam(member: TeamMember, club: WorldClub): WorldAthlete {
  return {
    id: member.id,
    name: member.name,
    age: member.age,
    country: club.country,
    clubId: club.id,
    status: member.status === 'DEAD' ? 'DEAD' : member.status === 'RETIRED' ? 'RETIRED' : member.status === 'INJURED' ? 'INJURED' : 'ACTIVE',
    specialty: member.specialty,
    skill: member.skill,
    endurance: member.endurance,
    altitude: clamp(member.endurance + Math.round(member.skill / 2), 1, 10),
    caution: member.personality.caution,
    ambition: member.personality.ambition,
    fame: Math.round((member.relationship.respect + member.summits * 9) / 2),
    experience: member.sharedClimbs + member.summits * 2,
    summits: member.summits,
    firstAscents: 0,
    rescues: member.rescues,
    injuries: [...member.injuries],
    knownToHero: true,
    rivalry: member.relationship.rivalry,
    relationshipNote: member.relationship.rivalry > 55 ? 'Считает героя прямым конкурентом.' : member.relationship.trust > 60 ? 'Знаком по клубу и совместным выходам.' : 'Следит за решениями героя со стороны.',
    currentGoal: member.personalGoal,
    lastEvent: 'Готовится к новому сезону.',
  };
}

function generatedAthlete(world: WorldState, clubs: WorldClub[], index: number): WorldAthlete {
  const rng = createRng(`${world.config.seed}:world-athlete:${index}`);
  const club = rng.pick(clubs);
  const age = rng.int(18, 53);
  const skill = rng.int(3, 9);
  const endurance = rng.int(3, 10);
  const fame = clamp(rng.int(2, 58) + Math.max(0, skill - 6) * 8);
  return {
    id: `world-athlete-${index}-${world.id}`,
    name: athleteName(world.config.seed, index),
    age,
    country: club.country,
    clubId: club.id,
    status: 'ACTIVE',
    specialty: rng.pick(specialties),
    skill,
    endurance,
    altitude: rng.int(3, 10),
    caution: rng.int(24, 92),
    ambition: rng.int(25, 96),
    fame,
    experience: rng.int(0, Math.max(3, age - 16)),
    summits: rng.int(0, Math.max(1, Math.round(fame / 12))),
    firstAscents: rng.chance(.12) ? 1 : 0,
    rescues: rng.chance(.18) ? rng.int(1, 3) : 0,
    injuries: rng.chance(.22) ? [rng.pick(injuries)] : [],
    knownToHero: rng.chance(.18),
    rivalry: rng.int(0, 42),
    relationshipNote: 'Известен по клубным отчётам и региональной прессе.',
    currentGoal: rng.pick(goals),
    lastEvent: 'Ведёт подготовку к сезону.',
  };
}

function createRookie(career: CareerState, state: LivingWorldState, index: number): WorldAthlete {
  const rng = createRng(`${career.id}:rookie:${career.year}:${index}:${state.tick}`);
  const club = rng.pick(state.clubs);
  return {
    id: `rookie-${career.year}-${index}-${state.tick}`,
    name: `${rng.pick(firstNames)} ${rng.pick(lastNames)}`,
    age: rng.int(18, 22),
    country: club.country,
    clubId: club.id,
    status: 'ACTIVE',
    specialty: rng.pick(specialties),
    skill: rng.int(2, 5),
    endurance: rng.int(3, 6),
    altitude: rng.int(2, 6),
    caution: rng.int(28, 88),
    ambition: rng.int(42, 98),
    fame: 0,
    experience: 0,
    summits: 0,
    firstAscents: 0,
    rescues: 0,
    injuries: [],
    knownToHero: false,
    rivalry: 0,
    relationshipNote: 'Новое имя в региональном альпинизме.',
    currentGoal: rng.pick(goals),
    lastEvent: 'Начал первую полноценную карьеру.',
  };
}

function initialMountainHistory(mountain: MountainData, startYear: number, index: number): MountainWorldHistory {
  const isHistoricallyKnown = mountain.status === 'Известная клубная цель' || index > 3;
  return {
    mountainId: mountain.id,
    mountainName: mountain.name,
    elevation: mountain.elevation,
    technicality: mountain.technicality,
    altitudeSeverity: mountain.altitudeSeverity,
    prestige: mountain.prestige,
    attempts: isHistoricallyKnown ? 1 + index : 0,
    summits: isHistoricallyKnown ? Math.max(1, index - 2) : 0,
    deaths: 0,
    firstAscentYear: isHistoricallyKnown ? startYear - 8 - index * 2 : null,
    firstAscentAthleteIds: [],
    fastestMinutes: null,
    fastestAthleteId: null,
    winterAscentYear: null,
    currentAttention: mountain.prestige,
  };
}

function baseRecords(athletes: WorldAthlete[], world: WorldState): WorldRecord[] {
  const mostSummits = [...athletes].sort((a, b) => b.summits - a.summits || b.fame - a.fame)[0]!;
  const firstAscents = [...athletes].sort((a, b) => b.firstAscents - a.firstAscents || b.fame - a.fame)[0]!;
  const rescuer = [...athletes].sort((a, b) => b.rescues - a.rescues || b.fame - a.fame)[0]!;
  const highest = world.region.mountains.find((_, index) => index >= 4) ?? world.region.mountains.at(-1)!;
  return [
    { id: 'record-highest', category: 'HIGHEST_SUMMIT', title: 'Высочайшая покорённая вершина', holderAthleteId: mostSummits.id, holderName: mostSummits.name, value: highest.elevation, unit: 'м', mountainId: highest.id, mountainName: highest.name, year: world.config.startYear - 4, description: `Высочайшая подтверждённая вершина текущего поколения — ${highest.name}.` },
    { id: 'record-summits', category: 'MOST_SUMMITS', title: 'Больше всего вершин', holderAthleteId: mostSummits.id, holderName: mostSummits.name, value: mostSummits.summits, unit: 'вершин', mountainId: null, mountainName: null, year: world.config.startYear, description: 'Подтверждённые восхождения в пределах региона.' },
    { id: 'record-firsts', category: 'FIRST_ASCENTS', title: 'Первые восхождения', holderAthleteId: firstAscents.id, holderName: firstAscents.name, value: firstAscents.firstAscents, unit: 'маршрутов', mountainId: null, mountainName: null, year: world.config.startYear, description: 'Количество первых восхождений и новых линий.' },
    { id: 'record-rescues', category: 'RESCUES', title: 'Спасательные выходы', holderAthleteId: rescuer.id, holderName: rescuer.name, value: rescuer.rescues, unit: 'операций', mountainId: null, mountainName: null, year: world.config.startYear, description: 'Успешные спасательные эпизоды в горах.' },
  ];
}

export function createLivingWorld(world: WorldState, roster: TeamMember[], club: ClubData): LivingWorldState {
  const clubs = createClubs(world, club);
  const heroClub = clubs[0]!;
  const rosterAthletes = roster.map(member => athleteFromTeam(member, heroClub));
  const generated = Array.from({ length: 30 }, (_, index) => generatedAthlete(world, clubs, index));
  const athletes = [...rosterAthletes, ...generated];
  return {
    version: 1,
    lastSimulatedYear: world.config.startYear,
    lastSimulatedDay: 1,
    tick: 0,
    athletes,
    clubs,
    mountainHistory: world.region.mountains.map((mountain, index) => initialMountainHistory(mountain, world.config.startYear, index)),
    news: [{ id: `news-opening-${world.id}`, year: world.config.startYear, seasonDay: 1, type: 'CLUB', headline: 'Новый сезон открыт', summary: `${world.region.name} входит в новый сезон. Клубы публикуют планы, а несколько больших вершин остаются без подтверждённого восхождения.`, athleteIds: [], clubIds: clubs.map(item => item.id), mountainId: null, importance: 55, isBreaking: false }],
    expeditions: [],
    records: baseRecords(athletes, world),
  };
}

function updateDerivedRecords(state: LivingWorldState, year: number): WorldRecord[] {
  const eligible = state.athletes.filter(item => item.status !== 'DEAD' && item.status !== 'MISSING');
  const mostSummits = [...eligible].sort((a, b) => b.summits - a.summits || b.fame - a.fame)[0];
  const firsts = [...eligible].sort((a, b) => b.firstAscents - a.firstAscents || b.fame - a.fame)[0];
  const rescues = [...eligible].sort((a, b) => b.rescues - a.rescues || b.fame - a.fame)[0];
  const fixed = state.records.filter(item => !['record-summits', 'record-firsts', 'record-rescues'].includes(item.id));
  if (mostSummits) fixed.push({ id: 'record-summits', category: 'MOST_SUMMITS', title: 'Больше всего вершин', holderAthleteId: mostSummits.id, holderName: mostSummits.name, value: mostSummits.summits, unit: 'вершин', mountainId: null, mountainName: null, year, description: 'Подтверждённые восхождения в пределах региона.' });
  if (firsts) fixed.push({ id: 'record-firsts', category: 'FIRST_ASCENTS', title: 'Первые восхождения', holderAthleteId: firsts.id, holderName: firsts.name, value: firsts.firstAscents, unit: 'маршрутов', mountainId: null, mountainName: null, year, description: 'Количество первых восхождений и новых линий.' });
  if (rescues) fixed.push({ id: 'record-rescues', category: 'RESCUES', title: 'Спасательные выходы', holderAthleteId: rescues.id, holderName: rescues.name, value: rescues.rescues, unit: 'операций', mountainId: null, mountainName: null, year, description: 'Успешные спасательные эпизоды в горах.' });
  return fixed;
}

function simulateTick(career: CareerState, state: LivingWorldState, tickYear: number, tickDay: number): LivingWorldState {
  const rng = createRng(`${career.id}:living-world:${state.tick}:${tickYear}:${tickDay}`);
  let athletes = state.athletes.map(athlete => {
    if (athlete.status === 'INJURED' && rng.chance(.22)) return { ...athlete, status: 'ACTIVE' as const, lastEvent: 'Вернулся к тренировкам после восстановления.' };
    if (athlete.status === 'ACTIVE' && athlete.age >= 48 && rng.chance(.018 + (athlete.age - 48) * .004)) return { ...athlete, status: 'RETIRED' as const, lastEvent: 'Объявил о завершении карьеры.' };
    return athlete;
  });
  let clubs = state.clubs.map(item => ({ ...item }));
  let mountainHistory = state.mountainHistory.map(item => ({ ...item, firstAscentAthleteIds: [...item.firstAscentAthleteIds] }));
  const news = [...state.news];
  const expeditions = [...state.expeditions];
  let records = [...state.records];

  const transferCandidate = athletes.find(item => item.status === 'ACTIVE' && item.knownToHero && item.rivalry >= 48 && rng.chance(.035));
  if (transferCandidate) {
    const currentClub = clubs.find(item => item.id === transferCandidate.clubId);
    const destination = rng.pick(clubs.filter(item => item.id !== transferCandidate.clubId));
    athletes = athletes.map(item => item.id === transferCandidate.id ? { ...item, clubId: destination.id, relationshipNote: `Ушёл из «${currentClub?.name ?? 'старого клуба'}» в «${destination.name}».`, rivalry: clamp(item.rivalry + 8), lastEvent: `Перешёл в клуб «${destination.name}».` } : item);
    news.push({ id: `transfer-${state.tick}-${transferCandidate.id}`, year: tickYear, seasonDay: tickDay, type: 'CLUB', headline: `${transferCandidate.name} сменил клуб`, summary: `Переход в «${destination.name}» усилил конкуренцию за главные цели сезона.`, athleteIds: [transferCandidate.id], clubIds: [transferCandidate.clubId, destination.id], mountainId: null, importance: 54, isBreaking: false });
  }

  if (!athletes.some(item => item.status === 'ACTIVE')) return { ...state, athletes, clubs, mountainHistory, news, expeditions, tick: state.tick + 1, lastSimulatedYear: tickYear, lastSimulatedDay: tickDay };

  const eventCount = rng.int(1, 2);
  for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
    const active = athletes.filter(item => item.status === 'ACTIVE');
    if (active.length === 0) break;
    const leader = rng.pick(active);
    const mountain = rng.pick(mountainHistory);
    const mountainId = mountain.mountainId;
    const mountainName = mountain.mountainName;
    const elevation = mountain.elevation;
    const technicality = mountain.technicality;
    const altitudeSeverity = mountain.altitudeSeverity;
    const historyIndex = mountainHistory.findIndex(item => item.mountainId === mountainId);
    if (historyIndex < 0) continue;
    const history = mountainHistory[historyIndex]!;
    const teammates = active.filter(item => item.id !== leader.id && item.clubId === leader.clubId).slice(0, rng.int(1, 3));
    const teamPower = leader.skill * 7 + leader.endurance * 4 + leader.altitude * 4 + teammates.reduce((sum, item) => sum + item.skill * 2, 0);
    const challenge = technicality * .55 + altitudeSeverity * .45 + rng.int(10, 42);
    const successChance = clamp(44 + (teamPower - challenge) * .42 + leader.ambition * .08 - leader.caution * .03, 8, 88) / 100;
    const tragedyChance = clamp((technicality + altitudeSeverity - teamPower * .55) / 420 + (100 - leader.caution) / 850, .004, .14);
    const succeeded = rng.chance(successChance);
    const tragedy = !succeeded && rng.chance(tragedyChance);
    const failed = !succeeded && !tragedy && rng.chance(.2);
    const outcome = succeeded ? 'SUMMIT' as const : tragedy ? 'TRAGEDY' as const : failed ? 'FAILED' as const : 'RETREAT' as const;
    const firstAscent = succeeded && history.firstAscentYear === null;
    const durationDays = rng.int(3, 18);
    const highestElevation = succeeded ? elevation : Math.round(elevation * rng.int(68, 94) / 100);
    const casualties: string[] = [];
    let headline = '';
    let summary = '';
    let importance = 45;
    let recordId: string | null = null;

    athletes = athletes.map(item => {
      if (item.id !== leader.id && !teammates.some(member => member.id === item.id)) return item;
      if (tragedy && item.id === leader.id && rng.chance(.48)) {
        casualties.push(item.id);
        return { ...item, status: rng.chance(.22) ? 'MISSING' as const : 'DEAD' as const, lastEvent: `Не вернулся с ${mountainName}.` };
      }
      if (!succeeded && rng.chance(.12)) {
        return { ...item, status: 'INJURED' as const, injuries: [...item.injuries, rng.pick(injuries)], lastEvent: `Получил травму на ${mountainName}.` };
      }
      if (succeeded) {
        return { ...item, summits: item.summits + 1, firstAscents: item.firstAscents + (firstAscent ? 1 : 0), fame: clamp(item.fame + (firstAscent ? 16 : 5)), experience: item.experience + 1, lastEvent: `Поднялся на ${mountainName}.` };
      }
      return { ...item, experience: item.experience + 1, fame: clamp(item.fame + (outcome === 'RETREAT' ? 1 : -2)), lastEvent: `Вернулся без вершины с ${mountainName}.` };
    });

    if (succeeded) {
      history.attempts += 1;
      history.summits += 1;
      history.currentAttention = clamp(history.currentAttention + (firstAscent ? 18 : 4));
      if (firstAscent) {
        history.firstAscentYear = tickYear;
        history.firstAscentAthleteIds = [leader.id, ...teammates.map(item => item.id)];
        headline = `${mountainName} покорена впервые`;
        summary = `${leader.name} и команда клуба «${clubs.find(item => item.id === leader.clubId)?.name ?? 'неизвестный клуб'}» подтвердили первое восхождение.`;
        importance = 98;
        recordId = `record-first-ascent-${mountainId}`;
        records = [...records.filter(item => item.id !== recordId), { id: recordId, category: 'FIRST_ASCENTS', title: `Первое восхождение: ${mountainName}`, holderAthleteId: leader.id, holderName: leader.name, value: elevation, unit: 'м', mountainId, mountainName, year: tickYear, description: `Первое подтверждённое восхождение команды клуба «${clubs.find(item => item.id === leader.clubId)?.name ?? 'неизвестный клуб'}».` }];
      } else {
        headline = `${leader.name} достиг вершины ${mountainName}`;
        summary = `Экспедиция завершила маршрут за ${durationDays} дней и вернулась без потерь.`;
        importance = 62;
      }
      const speedMinutes = durationDays * 1440 - rng.int(0, 500);
      if (history.fastestMinutes === null || speedMinutes < history.fastestMinutes) {
        history.fastestMinutes = speedMinutes;
        history.fastestAthleteId = leader.id;
        if (!firstAscent) {
          headline = `Новый рекорд скорости на ${mountainName}`;
          summary = `${leader.name} установил лучшее подтверждённое время региона.`;
          importance = 82;
          recordId = `record-speed-${mountainId}`;
          records = [...records.filter(item => item.id !== recordId), { id: recordId, category: 'SPEED', title: `Скорость: ${mountainName}`, holderAthleteId: leader.id, holderName: leader.name, value: speedMinutes, unit: 'мин', mountainId, mountainName, year: tickYear, description: 'Лучшее подтверждённое полное время экспедиции.' }];
        }
      }
      const highest = records.find(item => item.id === 'record-highest');
      if (!highest || elevation > highest.value) {
        records = [...records.filter(item => item.id !== 'record-highest'), { id: 'record-highest', category: 'HIGHEST_SUMMIT', title: 'Высочайшая покорённая вершина', holderAthleteId: leader.id, holderName: leader.name, value: elevation, unit: 'м', mountainId, mountainName, year: tickYear, description: `Высочайшая подтверждённая вершина текущего поколения — ${mountainName}.` }];
      }
    } else {
      history.attempts += 1;
      if (tragedy) {
        history.deaths += casualties.length;
        history.currentAttention = clamp(history.currentAttention + 12);
        headline = casualties.length ? `Трагедия на ${mountainName}` : `Тяжёлая авария на ${mountainName}`;
        summary = casualties.length ? `Экспедиция ${leader.name} потеряла людей на высоте ${highestElevation} м.` : `Команда эвакуирована после аварии на высоте ${highestElevation} м.`;
        importance = 96;
      } else if (failed) {
        headline = `Экспедиция сорвана на ${mountainName}`;
        summary = `${leader.name} завершил попытку после аварийного эпизода на высоте ${highestElevation} м.`;
        importance = 58;
      } else {
        headline = `${leader.name} развернул команду`;
        summary = `Группа отказалась от вершины ${mountainName} на высоте ${highestElevation} м и вернулась самостоятельно.`;
        importance = 38;
      }
    }

    clubs = clubs.map(club => club.id === leader.clubId ? { ...club, expeditions: club.expeditions + 1, summits: club.summits + (succeeded ? 1 : 0), losses: club.losses + casualties.length, prestige: clamp(club.prestige + (firstAscent ? 7 : succeeded ? 2 : tragedy ? -4 : 0)) } : club);
    mountainHistory[historyIndex] = history;
    const expedition: WorldExpedition = { id: `world-expedition-${state.tick}-${eventIndex}-${leader.id}`, year: tickYear, seasonDay: tickDay, mountainId, mountainName, leaderAthleteId: leader.id, memberAthleteIds: teammates.map(item => item.id), clubId: leader.clubId, outcome, highestElevation, durationDays, casualties, recordId, summary };
    expeditions.push(expedition);
    const item: WorldNewsItem = { id: `world-news-${state.tick}-${eventIndex}-${leader.id}`, year: tickYear, seasonDay: tickDay, type: tragedy ? (casualties.length ? 'DEATH' : 'INJURY') : firstAscent ? 'RECORD' : succeeded ? 'SUMMIT' : outcome === 'RETREAT' ? 'RETREAT' : 'EXPEDITION', headline, summary, athleteIds: [leader.id, ...teammates.map(item => item.id)], clubIds: [leader.clubId], mountainId, importance, isBreaking: importance >= 90 };
    news.push(item);
  }

  const trimmedNews = news.sort((a, b) => b.year - a.year || b.seasonDay - a.seasonDay || b.importance - a.importance).slice(0, 160);
  const next: LivingWorldState = { ...state, athletes, clubs, mountainHistory, news: trimmedNews, expeditions: expeditions.slice(-200), tick: state.tick + 1, lastSimulatedYear: tickYear, lastSimulatedDay: tickDay, records };
  next.records = updateDerivedRecords(next, tickYear);
  return next;
}

export function advanceLivingWorld(career: CareerState, elapsedDays: number): CareerState {
  if (elapsedDays <= 0) return career;
  let state = career.livingWorld;
  const yearDelta = Math.max(0, career.year - state.lastSimulatedYear);
  if (yearDelta > 0) {
    let athletes = state.athletes.map(item => ({ ...item, age: item.age + yearDelta }));
    for (let yearIndex = 0; yearIndex < yearDelta; yearIndex += 1) {
      athletes = [...athletes, createRookie(career, { ...state, athletes }, yearIndex * 2), createRookie(career, { ...state, athletes }, yearIndex * 2 + 1)];
    }
    state = {
      ...state,
      athletes,
      news: [{ id: `generation-${career.year}-${state.tick}`, year: career.year, seasonDay: 1, type: 'CLUB', headline: 'Новое поколение вошло в сезон', summary: `${yearDelta * 2} молодых альпиниста получили места в региональных клубах. Ветераны стали ещё на год старше.`, athleteIds: athletes.slice(-yearDelta * 2).map(item => item.id), clubIds: [], mountainId: null, importance: 42, isBreaking: false }, ...state.news],
    };
  }
  const ticks = Math.max(1, Math.ceil(elapsedDays / 7));
  for (let index = 0; index < ticks; index += 1) {
    const stepDay = Math.min(career.seasonDay, Math.max(1, state.lastSimulatedDay + Math.ceil(elapsedDays / ticks)));
    state = simulateTick(career, state, career.year, stepDay);
  }
  const syncedRoster = career.teamRoster.map(member => {
    const athlete = state.athletes.find(item => item.id === member.id);
    if (!athlete) return member;
    const status: MemberStatus = athlete.status === 'DEAD' || athlete.status === 'MISSING' ? 'DEAD' : athlete.status === 'RETIRED' ? 'RETIRED' : athlete.status === 'INJURED' ? 'INJURED' : athlete.clubId !== career.club.id ? 'LEFT' : member.status === 'LEFT' ? 'LEFT' : 'ACTIVE';
    return { ...member, status, injuries: [...new Set([...member.injuries, ...athlete.injuries])], availability: status === 'ACTIVE' ? member.availability : 0 };
  });
  return { ...career, teamRoster: syncedRoster, livingWorld: { ...state, lastSimulatedYear: career.year, lastSimulatedDay: career.seasonDay } };
}

export function registerHeroExpedition(career: CareerState, climb: QualificationClimb, report: ExpeditionReport): CareerState {
  const state = career.livingWorld;
  const historyIndex = state.mountainHistory.findIndex(item => item.mountainId === climb.mountainId);
  const mountainHistory = state.mountainHistory.map(item => ({ ...item, firstAscentAthleteIds: [...item.firstAscentAthleteIds] }));
  const successful = report.outcome === 'SUMMIT';
  let firstAscent = false;
  if (historyIndex >= 0) {
    const history = mountainHistory[historyIndex]!;
    history.attempts += 1;
    if (successful) {
      history.summits += 1;
      if (history.firstAscentYear === null) {
        firstAscent = true;
        history.firstAscentYear = career.year;
        history.firstAscentAthleteIds = [career.hero.id, ...report.teamMemberIds];
      }
    }
    history.deaths += report.casualties.length;
    history.currentAttention = clamp(history.currentAttention + (firstAscent ? 20 : successful ? 7 : report.casualties.length ? 14 : 2));
    mountainHistory[historyIndex] = history;
  }
  const importance = firstAscent ? 100 : successful ? 78 : report.casualties.length ? 96 : 48;
  const newsItem: WorldNewsItem = {
    id: `hero-news-${report.id}`,
    year: career.year,
    seasonDay: career.seasonDay,
    type: firstAscent ? 'RECORD' : successful ? 'SUMMIT' : report.casualties.length ? 'DEATH' : 'RETREAT',
    headline: firstAscent ? `${career.hero.name} открыл историю ${climb.mountainName}` : successful ? `${career.hero.name} вернулся с вершины ${climb.mountainName}` : `${career.hero.name} завершил попытку на ${climb.mountainName}`,
    summary: firstAscent ? `Первое подтверждённое восхождение прошло по маршруту «${climb.routeName}».` : `${report.clubReaction} ${report.pressReaction}`,
    athleteIds: [career.hero.id, ...report.teamMemberIds],
    clubIds: [career.club.id],
    mountainId: climb.mountainId,
    importance,
    isBreaking: importance >= 90,
  };
  const expedition: WorldExpedition = {
    id: `world-${report.id}`,
    year: career.year,
    seasonDay: career.seasonDay,
    mountainId: climb.mountainId,
    mountainName: climb.mountainName,
    leaderAthleteId: career.hero.id,
    memberAthleteIds: report.teamMemberIds,
    clubId: career.club.id,
    outcome: successful ? 'SUMMIT' : report.casualties.length ? 'TRAGEDY' : report.outcome === 'FAILED' ? 'FAILED' : 'RETREAT',
    highestElevation: report.highestElevation,
    durationDays: Math.max(1, Math.ceil(report.elapsedMinutes / 1440)),
    casualties: report.casualties,
    recordId: firstAscent ? `record-first-ascent-${climb.mountainId}` : null,
    summary: newsItem.summary,
  };
  const clubs = state.clubs.map(club => club.id === career.club.id ? { ...club, expeditions: club.expeditions + 1, summits: club.summits + (successful ? 1 : 0), losses: club.losses + report.casualties.length, prestige: clamp(club.prestige + (firstAscent ? 8 : successful ? 3 : report.casualties.length ? -4 : 0)) } : club);
  let records = state.records;
  if (firstAscent) {
    records = [...records, { id: `record-first-ascent-${climb.mountainId}`, category: 'FIRST_ASCENTS', title: `Первое восхождение: ${climb.mountainName}`, holderAthleteId: career.hero.id, holderName: career.hero.name, value: climb.summitElevation, unit: 'м', mountainId: climb.mountainId, mountainName: climb.mountainName, year: career.year, description: `Первое подтверждённое восхождение по маршруту «${climb.routeName}».` }];
  }
  return {
    ...career,
    livingWorld: {
      ...state,
      clubs,
      mountainHistory,
      news: [newsItem, ...state.news].slice(0, 160),
      expeditions: [...state.expeditions, expedition].slice(-200),
      records,
    },
  };
}
