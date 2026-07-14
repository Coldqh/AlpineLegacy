import { createRng } from './rng';
import { createWorldEcosystem, hydrateWorldEcosystem } from './ecosystem';
import { generateRoutesForWorld } from './routeFactory';
import type { MountainCharacterId, MountainData, RegionData, WorldSeedConfig, WorldState } from './types';

const regionPrefix = ['Аур', 'Валь', 'Кард', 'Сер', 'Норд', 'Иль', 'Тар', 'Элд', 'Орт', 'Мер'];
const regionSuffix = ['енские горы', 'ский хребет', 'ское нагорье', 'альпийская дуга', 'ские пики'];
const mountainPrefix = ['Аль', 'Дор', 'Кай', 'Мор', 'Сен', 'Тир', 'Вар', 'Эйр', 'Кел', 'Рун', 'Ор', 'Ир'];
const mountainSuffix = ['дан', 'рейн', 'гора', 'вальд', 'сар', 'мор', 'тир', 'лен', 'кар', 'нер'];
const epithets = ['Белая тишина', 'Стена ветров', 'Последний гребень', 'Северный зуб', 'Чёрный лёд', 'Небесный бастион', 'Граница воздуха'];
const climates = ['ледниково-континентальный', 'сухой высокогорный', 'штормовой морской', 'арктический альпийский'];
const massifTypes = ['многогребневый массив', 'ледниковая пирамида', 'скально-ледовая стена', 'широкий высотный купол', 'изолированный пик'];
const dangers = ['лавины и ветровые доски', 'камнепады и разрушенная порода', 'трещины и нестабильные сераки', 'ураганный ветер и белая мгла', 'смешанные скально-ледовые участки'];

const mountainCharacters: Record<MountainCharacterId, { title: string; description: string }> = {
  WEATHER: {
    title: 'Гора погоды',
    description: 'Главный противник — короткие окна, ветер и резкие перемены. Ошибка во времени опаснее слабой техники.',
  },
  TECHNICAL: {
    title: 'Гора техники',
    description: 'Ключевые участки требуют чистого лазания и надёжной страховки. Слабое звено быстро тормозит всю группу.',
  },
  ENDURANCE: {
    title: 'Гора длины',
    description: 'Маршруты забирают часы и запасы. Побеждает группа, которая держит темп и умеет вовремя ставить лагерь.',
  },
  ALTITUDE: {
    title: 'Гора высоты',
    description: 'Даже простые участки становятся тяжёлыми. Акклиматизация, вода и остаток сил решают больше скорости.',
  },
  DESCENT: {
    title: 'Гора спуска',
    description: 'Подъём обманчиво понятен, но обратная дорога открыта ветру и ошибкам. Вершина здесь только половина задачи.',
  },
};

const characterOrder: MountainCharacterId[] = ['WEATHER', 'TECHNICAL', 'ENDURANCE', 'ALTITUDE', 'DESCENT'];

function characterFor(seed: string, index: number) {
  const rng = createRng(`${seed}:mountain-character`);
  const offset = rng.int(0, characterOrder.length - 1);
  const id = characterOrder[(index + offset) % characterOrder.length]!;
  return { id, ...mountainCharacters[id] };
}

export function hydrateWorld(world: WorldState): WorldState {
  const mountains = world.region.mountains.map((mountain, index) => {
    if (mountain.characterId && mountain.characterTitle && mountain.characterDescription) return mountain;
    const character = characterFor(world.config.seed, index);
    return {
      ...mountain,
      characterId: character.id,
      characterTitle: character.title,
      characterDescription: character.description,
    };
  });
  const compatible = { ...world, schemaVersion: 2 as const, region: { ...world.region, mountains } } as WorldState;
  return hydrateWorldEcosystem(compatible);
}


function generateProfile(seed: string, height: number) {
  const rng = createRng(`${seed}:profile`);
  const points = [{ x: 0, y: 100 }];
  const count = 10;
  const summitIndex = rng.int(5, 7);
  for (let i = 1; i < count; i += 1) {
    const x = (i / (count - 1)) * 100;
    const distance = Math.abs(i - summitIndex);
    const summitStrength = Math.max(0, 1 - distance / summitIndex);
    const noise = rng.int(-9, 9);
    const y = Math.max(8, Math.min(95, 92 - summitStrength * (62 + height / 500) + noise));
    points.push({ x, y });
  }
  points[points.length - 1] = { x: 100, y: 100 };
  return points;
}

function mountainName(rng: ReturnType<typeof createRng>) {
  return `${rng.pick(mountainPrefix)}${rng.pick(mountainSuffix)}`;
}

function generateMountain(seed: string, index: number, min: number, max: number, startYear: number): MountainData {
  const rng = createRng(`${seed}:mountain:${index}`);
  const elevation = rng.int(min, max);
  const technicality = rng.int(35, 96);
  const altitudeSeverity = Math.round(Math.min(100, 30 + (elevation - min) / Math.max(1, max - min) * 68));
  const remoteness = rng.int(28, 96);
  const prestige = Math.round((technicality + altitudeSeverity + remoteness) / 3);
  const name = mountainName(rng);
  const character = characterFor(seed, index);
  return {
    id: `mtn-${index}-${Math.abs(seed.length * 97 + elevation)}`,
    name,
    epithet: rng.pick(epithets),
    elevation,
    prominence: rng.int(620, Math.max(900, Math.round(elevation * 0.42))),
    technicality,
    altitudeSeverity,
    remoteness,
    prestige,
    climateBand: rng.pick(climates),
    massifType: rng.pick(massifTypes),
    dangerProfile: rng.pick(dangers),
    characterId: character.id,
    characterTitle: character.title,
    characterDescription: character.description,
    status: index === 0 ? 'Главная вершина региона' : rng.pick(['Малоизученная', 'Непокорённая', 'Известная клубная цель', 'Опасная зимняя цель']),
    summary: `${name} — ${rng.pick(massifTypes)} с выраженной высотной нагрузкой. Основные угрозы: ${rng.pick(dangers)}. Успех потребует точного выбора окна, сильной связки и безопасного спуска.`,
    profilePoints: generateProfile(`${seed}:${name}`, elevation),
    history: (() => {
      const firstYear = startYear - rng.int(52, 88);
      const secondYear = firstYear + rng.int(16, 31);
      const thirdYear = Math.min(startYear - 2, secondYear + rng.int(9, 24));
      return [
        `${firstYear} — первая документированная разведка массива.`,
        `${secondYear} — экспедиция достигла высоты ${rng.int(Math.round(elevation * .62), Math.round(elevation * .88))} м и повернула назад.`,
        `${thirdYear} — маршрут по ${rng.pick(['северному гребню', 'западной стене', 'южному леднику'])} вошёл в историю региона.`,
      ];
    })(),
  };
}

export function generateWorld(config: WorldSeedConfig): WorldState {
  const rng = createRng(config.seed);
  const geographyRng = createRng(`${config.seed}:geography`);
  const scale = geographyRng.pick(['ALPINE', 'HIGH', 'EXTREME'] as const);
  const bands = scale === 'ALPINE'
    ? [[4300, 5200], [3500, 4600], [3100, 4200], [2600, 3600], [2200, 3100], [1900, 2800]]
    : scale === 'HIGH'
      ? [[6500, 7800], [5400, 6800], [4700, 6100], [3900, 5200], [3200, 4500], [2600, 3800]]
      : [[7600, 8400], [6500, 7800], [5700, 7100], [4700, 6200], [3600, 5000], [2800, 4200]];
  const mountainCount = rng.int(6, 8);
  const regionName = `${rng.pick(regionPrefix)}${rng.pick(regionSuffix)}`;
  const mountains = Array.from({ length: mountainCount }, (_, index) => {
    const band = bands[Math.min(index, bands.length - 1)]!;
    const extraOffset = index >= bands.length ? -(index - bands.length + 1) * 120 : 0;
    return generateMountain(config.seed, index, band[0] + extraOffset, band[1] + extraOffset, config.startYear);
  }).sort((a, b) => b.elevation - a.elevation);
  mountains.forEach((mountain, index) => {
    if (index === 0) mountain.status = 'Главная вершина региона';
    else if (mountain.status === 'Главная вершина региона') mountain.status = 'Малоизученная';
  });

  const elevationFloor = scale === 'ALPINE' ? rng.int(620, 1250) : scale === 'HIGH' ? rng.int(1100, 1900) : rng.int(1500, 2400);
  const region: RegionData = {
    id: `region-${config.seed.replace(/\W/g, '').slice(0, 10) || 'alpine'}`,
    name: regionName,
    subtitle: rng.pick(['Край ледяных стен', 'Высотная граница', 'Архипелаг камня и снега', 'Северная дуга']),
    climate: rng.pick(climates),
    prestige: rng.int(55, 96),
    elevationMin: elevationFloor,
    elevationMax: mountains[0]!.elevation,
    coordinates: `${rng.int(28, 67)}°${rng.pick(['N', 'S'])} · ${rng.int(12, 142)}°${rng.pick(['E', 'W'])}`,
    summary: `Удалённый горный регион с климатом типа «${rng.pick(climates)}». Здесь формировались отдельные школы восхождений, а главные вершины до сих пор определяют статус целого поколения альпинистов.`,
    history: [
      `${config.startYear - rng.int(75, 98)} — первые картографические записи о хребте.`,
      `${config.startYear - rng.int(42, 63)} — создан первый региональный альпинистский клуб.`,
      `${config.startYear - rng.int(15, 35)} — трагедия на одной из центральных стен изменила местные правила экспедиций.`,
      `${config.startYear} — начинается карьера нового поколения.`,
    ],
    mountains,
  };

  const base = {
    schemaVersion: 2 as const,
    id: `world-${config.seed.replace(/\W/g, '').slice(0, 18) || 'alpine'}-${config.eraId.toLowerCase()}-${config.startYear}`,
    config,
    createdAt: new Date().toISOString(),
    worldAge: rng.int(52, 96),
    region,
  } as Omit<WorldState, 'ecosystem'>;
  const world = { ...base, ecosystem: null as unknown as WorldState['ecosystem'] } as WorldState;
  const routes = generateRoutesForWorld(world);
  world.ecosystem = createWorldEcosystem(world, routes);
  return hydrateWorld(world);
}
