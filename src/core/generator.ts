import { createRng } from './rng';
import type { MountainData, RegionData, WorldSeedConfig, WorldState } from './types';

const regionPrefix = ['Аур', 'Валь', 'Кард', 'Сер', 'Норд', 'Иль', 'Тар', 'Элд', 'Орт', 'Мер'];
const regionSuffix = ['енские горы', 'ский хребет', 'ское нагорье', 'альпийская дуга', 'ские пики'];
const mountainPrefix = ['Аль', 'Дор', 'Кай', 'Мор', 'Сен', 'Тир', 'Вар', 'Эйр', 'Кел', 'Рун', 'Ор', 'Ир'];
const mountainSuffix = ['дан', 'рейн', 'гора', 'вальд', 'сар', 'мор', 'тир', 'лен', 'кар', 'нер'];
const epithets = ['Белая тишина', 'Стена ветров', 'Последний гребень', 'Северный зуб', 'Чёрный лёд', 'Небесный бастион', 'Граница воздуха'];
const climates = ['ледниково-континентальный', 'сухой высокогорный', 'штормовой морской', 'арктический альпийский'];
const massifTypes = ['многогребневый массив', 'ледниковая пирамида', 'скально-ледовая стена', 'широкий высотный купол', 'изолированный пик'];
const dangers = ['лавины и ветровые доски', 'камнепады и разрушенная порода', 'трещины и нестабильные сераки', 'ураганный ветер и белая мгла', 'смешанные скально-ледовые участки'];

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

function generateMountain(seed: string, index: number, min: number, max: number): MountainData {
  const rng = createRng(`${seed}:mountain:${index}`);
  const elevation = rng.int(min, max);
  const technicality = rng.int(35, 96);
  const altitudeSeverity = Math.round(Math.min(100, 30 + (elevation - min) / Math.max(1, max - min) * 68));
  const remoteness = rng.int(28, 96);
  const prestige = Math.round((technicality + altitudeSeverity + remoteness) / 3);
  const name = mountainName(rng);
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
    status: index === 0 ? 'Главная вершина региона' : rng.pick(['Малоизученная', 'Непокорённая', 'Известная клубная цель', 'Опасная зимняя цель']),
    summary: `${name} — ${rng.pick(massifTypes)} с выраженной высотной нагрузкой. Основные угрозы: ${rng.pick(dangers)}. Успех потребует точного выбора окна, сильной связки и безопасного спуска.`,
    profilePoints: generateProfile(`${seed}:${name}`, elevation),
    history: [
      `${rng.int(1910, 1948)} — первая документированная разведка массива.`,
      `${rng.int(1949, 1977)} — экспедиция достигла высоты ${rng.int(Math.round(elevation * .62), Math.round(elevation * .88))} м и повернула назад.`,
      `${rng.int(1978, 2008)} — маршрут по ${rng.pick(['северному гребню', 'западной стене', 'южному леднику'])} вошёл в историю региона.`,
    ],
  };
}

export function generateWorld(config: WorldSeedConfig): WorldState {
  const rng = createRng(config.seed);
  const baseMin = config.eraId === 'PIONEER' ? 3100 : config.eraId === 'EXPEDITION' ? 4200 : 4800;
  const baseMax = config.eraId === 'PIONEER' ? 6400 : config.eraId === 'EXPEDITION' ? 7600 : 8200;
  const mountainCount = rng.int(5, 7);
  const regionName = `${rng.pick(regionPrefix)}${rng.pick(regionSuffix)}`;
  const mountains = Array.from({ length: mountainCount }, (_, index) =>
    generateMountain(config.seed, index, baseMin + index * 90, baseMax - index * 25),
  ).sort((a, b) => b.elevation - a.elevation);
  mountains.forEach((mountain, index) => {
    if (index === 0) mountain.status = 'Главная вершина региона';
    else if (mountain.status === 'Главная вершина региона') mountain.status = 'Малоизученная';
  });

  const region: RegionData = {
    id: `region-${config.seed.replace(/\W/g, '').slice(0, 10) || 'alpine'}`,
    name: regionName,
    subtitle: rng.pick(['Край ледяных стен', 'Высотная граница', 'Архипелаг камня и снега', 'Северная дуга']),
    climate: rng.pick(climates),
    prestige: rng.int(55, 96),
    elevationMin: rng.int(1200, 2300),
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

  return {
    id: `world-${Date.now()}`,
    config,
    createdAt: new Date().toISOString(),
    worldAge: rng.int(52, 96),
    region,
  };
}
