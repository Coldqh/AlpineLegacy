import { authoredMountainHistory, authoredMountainLabels, authoredMountainSummary, generateMountainIdentity } from './mountainAuthorship';
import { createRng } from './rng';
import type { MountainCharacterId, MountainData, RegionData, WorldSeedConfig } from './types';

type PeakProfile = {
  slug: string;
  name: string;
  elevation: number;
  character: MountainCharacterId;
  technicality: number;
  remoteness: number;
  prominence: number;
};

type RealRegionProfile = {
  slug: string;
  country: string;
  name: string;
  rangeName: string;
  subtitle: string;
  climate: string;
  prestige: number;
  elevationMin: number;
  coordinates: string;
  accessReputation: number;
  travelCost: number;
  travelDays: number;
  climbingSeason: string;
  permitNote: string;
  generationProfile: NonNullable<RegionData['generationProfile']>;
  summary: string;
  peaks: PeakProfile[];
};

const REGIONS: RealRegionProfile[] = [
  {
    slug: 'switzerland', country: 'Швейцария', name: 'Швейцарские Альпы', rangeName: 'Альпы', subtitle: 'Клубная школа, ледники и большие северные стены',
    climate: 'альпийский ледниковый', prestige: 72, elevationMin: 900, coordinates: '46°N · 8°E', accessReputation: 0, travelCost: 0, travelDays: 0,
    climbingSeason: 'июнь — сентябрь', permitNote: 'Доступ простой, но приюты и проводники стоят дорого.', generationProfile: 'ALPINE',
    summary: 'Стартовый регион мировой карьеры. Здесь легче найти школу, инструктора и учебную связку, но технические стены быстро наказывают за слабую подготовку.',
    peaks: [
      { slug: 'eiger', name: 'Айгер', elevation: 3967, character: 'TECHNICAL', technicality: 88, remoteness: 34, prominence: 356 },
      { slug: 'jungfrau', name: 'Юнгфрау', elevation: 4158, character: 'WEATHER', technicality: 64, remoteness: 38, prominence: 704 },
      { slug: 'monch', name: 'Мёнх', elevation: 4110, character: 'ENDURANCE', technicality: 58, remoteness: 30, prominence: 591 },
      { slug: 'matterhorn', name: 'Маттерхорн', elevation: 4478, character: 'DESCENT', technicality: 91, remoteness: 42, prominence: 1040 },
      { slug: 'dufourspitze', name: 'Дюфуршпитце', elevation: 4634, character: 'ALTITUDE', technicality: 68, remoteness: 52, prominence: 2165 },
      { slug: 'weisshorn', name: 'Вайсхорн', elevation: 4505, character: 'DESCENT', technicality: 82, remoteness: 57, prominence: 1235 },
    ],
  },
  {
    slug: 'france', country: 'Франция', name: 'Массив Монблана', rangeName: 'Западные Альпы', subtitle: 'Смешанные маршруты, кулуары и быстрые погодные перемены',
    climate: 'влажный альпийский', prestige: 78, elevationMin: 1035, coordinates: '45°N · 7°E', accessReputation: 10, travelCost: 90, travelDays: 2,
    climbingSeason: 'июнь — сентябрь', permitNote: 'Главные расходы — подъёмники, приюты и местная логистика.', generationProfile: 'TECHNICAL',
    summary: 'Плотный район с короткими подходами и серьёзными линиями. Здесь много известных маршрутов, но камнепад, жара и резкие фронты быстро меняют планы.',
    peaks: [
      { slug: 'mont-blanc', name: 'Монблан', elevation: 4806, character: 'ALTITUDE', technicality: 61, remoteness: 35, prominence: 4696 },
      { slug: 'aiguille-verte', name: 'Эгюий-Верт', elevation: 4122, character: 'TECHNICAL', technicality: 84, remoteness: 43, prominence: 689 },
      { slug: 'grandes-jorasses', name: 'Гранд-Жорас', elevation: 4208, character: 'TECHNICAL', technicality: 94, remoteness: 55, prominence: 843 },
      { slug: 'mont-maudit', name: 'Мон-Моди', elevation: 4465, character: 'WEATHER', technicality: 72, remoteness: 41, prominence: 162 },
      { slug: 'aiguille-de-bionnassay', name: 'Эгюий-де-Бьоннассе', elevation: 4052, character: 'DESCENT', technicality: 83, remoteness: 52, prominence: 389 },
      { slug: 'dome-du-gouter', name: 'Дом-дю-Гуте', elevation: 4304, character: 'ENDURANCE', technicality: 52, remoteness: 36, prominence: 58 },
    ],
  },
  {
    slug: 'peru', country: 'Перу', name: 'Кордильера-Бланка', rangeName: 'Анды', subtitle: 'Тропические ледники и высотная техника',
    climate: 'сухой тропический высокогорный', prestige: 84, elevationMin: 3050, coordinates: '9°S · 77°W', accessReputation: 24, travelCost: 240, travelDays: 5,
    climbingSeason: 'май — август', permitNote: 'Нужны транспорт в долины, местные сборы и высотная акклиматизация.', generationProfile: 'GLACIAL',
    summary: 'Высота начинается ещё на подходе. Простые на вид снежные линии сочетаются с трещинами, ледовыми стенами и быстрым ухудшением состояния группы.',
    peaks: [
      { slug: 'pisco', name: 'Писко', elevation: 5752, character: 'ENDURANCE', technicality: 48, remoteness: 58, prominence: 652 },
      { slug: 'alpamayo', name: 'Альпамайо', elevation: 5947, character: 'TECHNICAL', technicality: 88, remoteness: 70, prominence: 447 },
      { slug: 'artesonraju', name: 'Артесонраху', elevation: 6025, character: 'TECHNICAL', technicality: 86, remoteness: 73, prominence: 549 },
      { slug: 'tocllaraju', name: 'Токльяраху', elevation: 6034, character: 'WEATHER', technicality: 69, remoteness: 65, prominence: 734 },
      { slug: 'chopicalqui', name: 'Чопикальки', elevation: 6354, character: 'ALTITUDE', technicality: 76, remoteness: 72, prominence: 734 },
      { slug: 'huascaran', name: 'Уаскаран', elevation: 6768, character: 'ALTITUDE', technicality: 79, remoteness: 77, prominence: 2776 },
    ],
  },
  {
    slug: 'argentina', country: 'Аргентина', name: 'Центральные Анды', rangeName: 'Анды', subtitle: 'Сухая высота, ветер и длинная автономная работа',
    climate: 'сухой континентальный высокогорный', prestige: 82, elevationMin: 2400, coordinates: '32°S · 70°W', accessReputation: 34, travelCost: 310, travelDays: 6,
    climbingSeason: 'декабрь — февраль', permitNote: 'Разрешения и перевозка груза считаются одной экспедиционной статьёй.', generationProfile: 'ARID',
    summary: 'Здесь мало технической защиты от самой высоты. Длинные подходы, ветер и сухой холод требуют дисциплины, воды и сильного экспедиционного ритма.',
    peaks: [
      { slug: 'cerro-plata', name: 'Серро-Плата', elevation: 5968, character: 'ENDURANCE', technicality: 42, remoteness: 57, prominence: 1100 },
      { slug: 'cerro-ramada', name: 'Серро-Рамада', elevation: 6384, character: 'WEATHER', technicality: 59, remoteness: 76, prominence: 714 },
      { slug: 'tupungato', name: 'Тупунгато', elevation: 6570, character: 'ENDURANCE', technicality: 56, remoteness: 84, prominence: 2765 },
      { slug: 'mercedario', name: 'Мерседарио', elevation: 6720, character: 'ALTITUDE', technicality: 63, remoteness: 88, prominence: 3333 },
      { slug: 'bonete-chico', name: 'Бонете-Чико', elevation: 6759, character: 'WEATHER', technicality: 57, remoteness: 91, prominence: 1500 },
      { slug: 'aconcagua', name: 'Аконкагуа', elevation: 6961, character: 'ALTITUDE', technicality: 52, remoteness: 72, prominence: 6961 },
    ],
  },
  {
    slug: 'nepal', country: 'Непал', name: 'Кхумбу', rangeName: 'Гималаи', subtitle: 'Большая высота, ледопады и экспедиции на недели',
    climate: 'муссонный гималайский высокогорный', prestige: 97, elevationMin: 2800, coordinates: '28°N · 87°E', accessReputation: 48, travelCost: 520, travelDays: 9,
    climbingSeason: 'апрель — май / октябрь — ноябрь', permitNote: 'Разрешения, караван и базовый лагерь входят в общий расчёт.', generationProfile: 'HIGH_ALTITUDE',
    summary: 'Гималайская карьера начинается с шеститысячников и заканчивается крупными осадными экспедициями. Акклиматизация и возврат важнее скорости.',
    peaks: [
      { slug: 'island-peak', name: 'Айленд-Пик', elevation: 6189, character: 'ENDURANCE', technicality: 54, remoteness: 64, prominence: 475 },
      { slug: 'lobuche-east', name: 'Лобуче-Ист', elevation: 6119, character: 'TECHNICAL', technicality: 64, remoteness: 66, prominence: 374 },
      { slug: 'ama-dablam', name: 'Ама-Даблам', elevation: 6812, character: 'TECHNICAL', technicality: 94, remoteness: 78, prominence: 1041 },
      { slug: 'pumori', name: 'Пумори', elevation: 7161, character: 'DESCENT', technicality: 84, remoteness: 82, prominence: 1278 },
      { slug: 'lhotse', name: 'Лхоцзе', elevation: 8516, character: 'ALTITUDE', technicality: 87, remoteness: 91, prominence: 610 },
      { slug: 'everest', name: 'Эверест', elevation: 8849, character: 'ALTITUDE', technicality: 82, remoteness: 92, prominence: 8849 },
    ],
  },
  {
    slug: 'pakistan', country: 'Пакистан', name: 'Каракорум', rangeName: 'Каракорум', subtitle: 'Удалённые ледники, огромные стены и жёсткий спуск',
    climate: 'сухой высокогорный ледниковый', prestige: 99, elevationMin: 2200, coordinates: '36°N · 76°E', accessReputation: 62, travelCost: 610, travelDays: 12,
    climbingSeason: 'июнь — август', permitNote: 'Длинный караван, разрешения и автономная логистика делают регион дорогим.', generationProfile: 'HIGH_ALTITUDE',
    summary: 'Самый тяжёлый регион мировой карьеры. Подходы занимают дни, помощь далеко, а техническая сложность не исчезает даже на восьмитысячниках.',
    peaks: [
      { slug: 'spantik', name: 'Спантик', elevation: 7027, character: 'ENDURANCE', technicality: 61, remoteness: 86, prominence: 1187 },
      { slug: 'masherbrum', name: 'Машербрум', elevation: 7821, character: 'TECHNICAL', technicality: 95, remoteness: 94, prominence: 2457 },
      { slug: 'gasherbrum-ii', name: 'Гашербрум II', elevation: 8035, character: 'ALTITUDE', technicality: 76, remoteness: 95, prominence: 1524 },
      { slug: 'broad-peak', name: 'Броуд-Пик', elevation: 8051, character: 'ENDURANCE', technicality: 72, remoteness: 96, prominence: 1701 },
      { slug: 'gasherbrum-i', name: 'Гашербрум I', elevation: 8080, character: 'TECHNICAL', technicality: 89, remoteness: 97, prominence: 2155 },
      { slug: 'k2', name: 'К2', elevation: 8611, character: 'DESCENT', technicality: 99, remoteness: 99, prominence: 4017 },
    ],
  },
];

const characterCopy: Record<MountainCharacterId, { title: string; description: string }> = {
  WEATHER: { title: 'Гора погоды', description: 'Короткое окно и ветер определяют весь маршрут.' },
  TECHNICAL: { title: 'Гора техники', description: 'Чистая работа на льду и скалах важнее общей скорости.' },
  ENDURANCE: { title: 'Гора длины', description: 'Подход, лагеря и запас сил определяют успех.' },
  ALTITUDE: { title: 'Гора высоты', description: 'Акклиматизация, вода и темп важнее технической бравады.' },
  DESCENT: { title: 'Гора спуска', description: 'После вершины начинается самая опасная часть экспедиции.' },
};

function cleanSeed(seed: string) {
  return seed.replace(/\W/g, '').slice(0, 10) || 'alpine';
}

function profilePoints(seed: string, character: MountainCharacterId) {
  const rng = createRng(`${seed}:profile`);
  const summitIndex = character === 'ENDURANCE' ? 6 : rng.int(4, 7);
  return Array.from({ length: 11 }, (_, index) => {
    if (index === 0 || index === 10) return { x: index * 10, y: 100 };
    const distance = Math.abs(index - summitIndex);
    const peak = Math.max(0, 1 - distance / 6);
    const asymmetric = character === 'DESCENT' ? (index > summitIndex ? distance * 3 : 0) : 0;
    return { x: index * 10, y: Math.max(8, Math.min(96, Math.round(94 - peak * 78 + asymmetric + rng.int(-7, 7)))) };
  });
}

function mountainFor(config: WorldSeedConfig, region: RealRegionProfile, regionId: string, peak: PeakProfile, index: number): MountainData {
  const rng = createRng(`${config.seed}:real-region:${region.slug}:${peak.slug}`);
  const character = characterCopy[peak.character];
  const identity = generateMountainIdentity(`${config.seed}:${region.slug}`, index, peak.character);
  const labels = authoredMountainLabels(identity, peak.character);
  const altitudeSeverity = Math.max(22, Math.min(100, Math.round(18 + peak.elevation / 105)));
  const technicality = Math.max(20, Math.min(100, peak.technicality + rng.int(-3, 3)));
  const remoteness = Math.max(15, Math.min(100, peak.remoteness + rng.int(-3, 3)));
  const prestige = Math.round((technicality + altitudeSeverity + remoteness + region.prestige) / 4);
  return {
    id: `mtn-${cleanSeed(config.seed)}-${region.slug}-${peak.slug}`,
    regionId,
    name: peak.name,
    epithet: labels.epithet,
    elevation: peak.elevation,
    prominence: peak.prominence,
    technicality,
    altitudeSeverity,
    remoteness,
    prestige,
    climateBand: region.climate,
    massifType: labels.massifType,
    dangerProfile: labels.dangerProfile,
    characterId: peak.character,
    characterTitle: character.title,
    characterDescription: character.description,
    identity,
    status: index === region.peaks.length - 1 ? 'Главная вершина региона' : index <= 1 ? 'Известная клубная цель' : 'Серьёзная международная цель',
    summary: authoredMountainSummary(peak.name, identity, labels.dangerProfile),
    profilePoints: profilePoints(`${config.seed}:${region.slug}:${peak.slug}`, peak.character),
    history: authoredMountainHistory(`${config.seed}:${region.slug}:${peak.slug}`, config.startYear, peak.elevation, identity),
  };
}

export function buildRealRegions(config: WorldSeedConfig): RegionData[] {
  const baseId = `region-${cleanSeed(config.seed)}`;
  return REGIONS.map((profile, regionIndex) => {
    const id = regionIndex === 0 ? baseId : `${baseId}-${profile.slug}`;
    const mountains = profile.peaks.map((peak, index) => mountainFor(config, profile, id, peak, index)).sort((a, b) => a.elevation - b.elevation);
    return {
      id,
      country: profile.country,
      rangeName: profile.rangeName,
      name: profile.name,
      subtitle: profile.subtitle,
      climate: profile.climate,
      prestige: profile.prestige,
      elevationMin: profile.elevationMin,
      elevationMax: Math.max(...mountains.map(mountain => mountain.elevation)),
      coordinates: profile.coordinates,
      accessReputation: profile.accessReputation,
      travelCost: profile.travelCost,
      travelDays: profile.travelDays,
      climbingSeason: profile.climbingSeason,
      permitNote: profile.permitNote,
      generationProfile: profile.generationProfile,
      summary: profile.summary,
      history: [
        `${config.startYear - 70} — региональные клубы начали вести систематические журналы маршрутов.`,
        `${config.startYear - 34} — спасательные службы и школы согласовали общие правила выхода.`,
        `${config.startYear} — начинается новый международный сезон.`,
      ],
      mountains,
      mountainIds: mountains.map(mountain => mountain.id),
      organizationIds: [],
    };
  });
}

export function regionProfiles() {
  return REGIONS.map(profile => ({ ...profile, peaks: profile.peaks.map(peak => ({ ...peak })) }));
}
