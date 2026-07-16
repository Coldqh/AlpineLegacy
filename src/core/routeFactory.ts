import { detectTerrainModule } from '../content/terrainModules';
import { attachContentMetadata } from './contentPipeline';
import { createRng } from './rng';
import type {
  ExpeditionRoute,
  MountainCharacterId,
  MountainData,
  RouteDecisionPoint,
  RouteGraph,
  RouteGraphNode,
  RouteSegment,
  SkillId,
  WorldState,
} from './types';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function graphForRoute(route: ExpeditionRoute): RouteGraph {
  const nodes: RouteGraphNode[] = [];
  const edges: RouteGraph['edges'] = [];
  const add = (node: RouteGraphNode) => {
    const previous = nodes[nodes.length - 1];
    nodes.push(node);
    if (previous) edges.push({ id: `${previous.id}->${node.id}`, from: previous.id, to: node.id, choiceId: null, conditionTag: null });
  };

  add({ id: `${route.id}:approach`, phase: 'APPROACH', label: 'Подход', segmentId: null, campPossible: false, estimatedMinutes: Math.max(90, Math.round(route.estimatedHours * 7)), requiredActionCount: 2 });
  add({ id: `${route.id}:base`, phase: 'BASE_CAMP', label: 'Базовый лагерь', segmentId: null, campPossible: true, estimatedMinutes: 120, requiredActionCount: 2 });
  if (route.summitElevation >= 5200) {
    add({ id: `${route.id}:acclimatization`, phase: 'ACCLIMATIZATION', label: 'Акклиматизационный выход', segmentId: null, campPossible: true, estimatedMinutes: 360, requiredActionCount: 3 });
    add({ id: `${route.id}:carry`, phase: 'CARRY', label: 'Перенос груза', segmentId: null, campPossible: true, estimatedMinutes: 300, requiredActionCount: 3 });
  }
  for (const segment of route.segments) {
    add({
      id: `${route.id}:ascent:${segment.id}`,
      phase: segment.decisionId ? 'DECISION' : segment.campPossible ? 'CAMP' : segment.exposure >= 52 ? 'HAZARD' : 'TECHNICAL',
      label: segment.name,
      segmentId: segment.id,
      campPossible: segment.campPossible,
      estimatedMinutes: segment.baseDurationMinutes,
      requiredActionCount: segment.decisionId ? 3 : segment.exposure >= 52 ? 3 : 2,
    });
  }
  const summitNodeId = `${route.id}:summit`;
  add({ id: summitNodeId, phase: 'SUMMIT', label: 'Вершина', segmentId: null, campPossible: false, estimatedMinutes: 25, requiredActionCount: 1 });
  for (const segment of route.descentSegments ?? []) {
    add({
      id: `${route.id}:descent:${segment.id}`,
      phase: 'DESCENT',
      label: segment.name,
      segmentId: segment.id,
      campPossible: segment.campPossible,
      estimatedMinutes: segment.baseDurationMinutes,
      requiredActionCount: segment.exposure >= 55 ? 3 : 2,
    });
  }
  const exitNodeId = `${route.id}:exit`;
  add({ id: exitNodeId, phase: 'EXIT', label: 'Возвращение', segmentId: null, campPossible: false, estimatedMinutes: 90, requiredActionCount: 1 });

  for (const decision of route.decisions ?? []) {
    const decisionNode = nodes.find(node => node.segmentId === decision.segmentId);
    if (!decisionNode) continue;
    const outgoing = edges.find(edge => edge.from === decisionNode.id);
    if (!outgoing) continue;
    for (const option of decision.options) {
      edges.push({ id: `${decisionNode.id}:${option.id}`, from: decisionNode.id, to: outgoing.to, choiceId: option.id, conditionTag: option.requiresGearId ?? null });
    }
  }

  return { startNodeId: nodes[0]!.id, summitNodeId, exitNodeId, nodes, edges };
}

function attachGraph(route: ExpeditionRoute): ExpeditionRoute {
  const graph = graphForRoute(route);
  const actionCount = graph.nodes.reduce((sum, node) => sum + node.requiredActionCount, 0);
  return attachContentMetadata({
    ...route,
    graph,
    estimatedDecisionCount: actionCount,
    expectedPlayMinutes: Math.max(20, Math.round(actionCount * 1.05)),
  });
}

function expeditionStartElevation(world: WorldState, mountain: WorldState['region']['mountains'][number], offset = 0) {
  const regionalFloor = Math.min(520, Math.max(0, Math.round(world.region.elevationMin * .16)));
  const accessLift = Math.round((mountain.remoteness * 3.2 + mountain.prominence * .012) / 50) * 50;
  return clamp(regionalFloor + accessLift + offset, 0, 1000);
}

export function getQualificationTarget(world: WorldState) {
  const mountain = [...world.region.mountains].sort((a, b) =>
    (a.elevation * 0.012 + a.technicality + a.remoteness * 0.35) -
    (b.elevation * 0.012 + b.technicality + b.remoteness * 0.35),
  )[0]!;
  return {
    mountain,
    summitElevation: mountain.elevation,
    startElevation: expeditionStartElevation(world, mountain),
    displayName: mountain.name,
    subsidiary: false,
  };
}

function routeEraPenalty(world: WorldState) {
  return world.config.eraId === 'PIONEER' ? 8 : world.config.eraId === 'EXPEDITION' ? 3 : 0;
}

export function mountainDifficulty(mountain: WorldState['region']['mountains'][number]) {
  return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32;
}

export function defaultDescentSegments(route: ExpeditionRoute): RouteSegment[] {
  const descentCharacter = route.mountainCharacterId === 'DESCENT' ? 9 : route.mountainCharacterId === 'WEATHER' ? 5 : 0;
  return [...route.segments].reverse().map((item, index) => ({
    ...item,
    id: `${item.id}-descent`,
    name: index === route.segments.length - 1 ? 'Возвращение к старту' : `Спуск: ${item.name}`,
    baseDurationMinutes: Math.round(item.baseDurationMinutes * (.82 + descentCharacter / 100)),
    difficulty: clamp(item.difficulty + 5 + Math.round(descentCharacter * .45)),
    exposure: clamp(item.exposure + (index < 2 ? 9 : 4) + descentCharacter),
    note: item.descentNote ?? `Усталость меняет знакомый участок. ${item.note}`,
    hazard: index < 2 ? `${item.hazard}; ошибка на спуске` : item.hazard,
    campPossible: item.campPossible,
    linkedAscentSegmentId: item.id,
    noReturn: false,
    safeHaven: item.campPossible,
    decisionId: undefined,
  }));
}

type MotifId =
  | 'APPROACH'
  | 'MORAINE'
  | 'GLACIER_BASIN'
  | 'CREVASSE_FIELD'
  | 'ICEFALL'
  | 'SNOW_COULOIR'
  | 'ROCK_RIBS'
  | 'ROCK_WALL'
  | 'MIXED_RAMP'
  | 'PLATEAU'
  | 'TRAVERSE'
  | 'HIGH_COL'
  | 'FALSE_SUMMIT'
  | 'WIND_GAP'
  | 'RIDGE'
  | 'CORNICE'
  | 'SUMMIT_DOME';

type RouteSlot = 'CLASSIC' | 'SECONDARY' | 'DIRECT';

type MotifDefinition = {
  terrain: string;
  skill: SkillId;
  difficultyDelta: number;
  exposureDelta: number;
  durationWeight: number;
  campPossible: boolean;
  hazard: string;
  name: (mountain: MountainData, routeIndex: number) => string;
  note: (mountain: MountainData) => string;
};

function landmark(mountain: MountainData, index: number) {
  return mountain.identity.landmarkNames[index] ?? mountain.identity.landmarkNames[0] ?? mountain.name;
}

const MOTIFS: Record<MotifId, MotifDefinition> = {
  APPROACH: {
    terrain: 'Подходная тропа и долина', skill: 'ENDURANCE', difficultyDelta: -24, exposureDelta: -30, durationWeight: .75, campPossible: true, hazard: 'Потеря темпа',
    name: mountain => `Подход через «${landmark(mountain, 0)}»`,
    note: mountain => `${mountain.identity.approachCharacter}. Здесь группа проверяет груз и рабочий темп.`,
  },
  MORAINE: {
    terrain: 'Морена и разрушенная осыпь', skill: 'ENDURANCE', difficultyDelta: -16, exposureDelta: -18, durationWeight: .8, campPossible: true, hazard: 'Камнепад и растяжение группы',
    name: mountain => `Морена «${landmark(mountain, 0)}»`,
    note: () => 'Неустойчивая порода быстро показывает перегруз и слабую координацию.',
  },
  GLACIER_BASIN: {
    terrain: 'Открытый ледник и фирновая чаша', skill: 'NAVIGATION', difficultyDelta: -10, exposureDelta: -10, durationWeight: 1.05, campPossible: true, hazard: 'Скрытые трещины и потеря направления',
    name: mountain => `Ледник «${landmark(mountain, 1)}»`,
    note: mountain => `${mountain.identity.campPattern}. Дистанцию трудно оценить без стабильного темпа.`,
  },
  CREVASSE_FIELD: {
    terrain: 'Лабиринт закрытых трещин', skill: 'NAVIGATION', difficultyDelta: 0, exposureDelta: 3, durationWeight: 1.05, campPossible: false, hazard: 'Провал снежного моста',
    name: mountain => `Разломы «${landmark(mountain, 1)}»`,
    note: () => 'Связка идёт медленно, постоянно проверяя мосты и возможную дугу обхода.',
  },
  ICEFALL: {
    terrain: 'Ледопад и серачные обломки', skill: 'ICE', difficultyDelta: 8, exposureDelta: 12, durationWeight: .9, campPossible: false, hazard: 'Ледовый обвал',
    name: mountain => `Серачная зона «${landmark(mountain, 1)}»`,
    note: mountain => `${mountain.identity.weatherRule}. В опасной зоне нельзя терять время без причины.`,
  },
  SNOW_COULOIR: {
    terrain: 'Крутой снежный кулуар', skill: 'ICE', difficultyDelta: 4, exposureDelta: 9, durationWeight: .85, campPossible: false, hazard: 'Лавинная доска и падающий лёд',
    name: mountain => `Кулуар «${landmark(mountain, 2)}»`,
    note: () => 'Состояние снега важнее очевидной короткой линии по центру.',
  },
  ROCK_RIBS: {
    terrain: 'Разрушенные скальные рёбра', skill: 'ROCK', difficultyDelta: -2, exposureDelta: 2, durationWeight: .9, campPossible: false, hazard: 'Срыв камней',
    name: mountain => `Рёбра «${landmark(mountain, 2)}»`,
    note: () => 'Короткие стенки требуют аккуратных станций и не прощают растянутой группы.',
  },
  ROCK_WALL: {
    terrain: 'Скальная стена', skill: 'ROCK', difficultyDelta: 13, exposureDelta: 18, durationWeight: 1.1, campPossible: false, hazard: 'Срыв и разрушение станции',
    name: mountain => `Стена «${landmark(mountain, 2)}»`,
    note: mountain => `${mountain.identity.middleCharacter}. После середины стены простой отход заканчивается.`,
  },
  MIXED_RAMP: {
    terrain: 'Смешанная рампа: лёд и скалы', skill: 'ROCK', difficultyDelta: 10, exposureDelta: 13, durationWeight: 1, campPossible: false, hazard: 'Ошибка на смене рельефа',
    name: mountain => `Рампа «${landmark(mountain, 2)}»`,
    note: () => 'Линия постоянно меняет характер, поэтому скорость зависит от работы всей связки.',
  },
  PLATEAU: {
    terrain: 'Высотное снежное плато', skill: 'ENDURANCE', difficultyDelta: -6, exposureDelta: -6, durationWeight: 1.2, campPossible: true, hazard: 'Истощение и потеря ориентиров',
    name: mountain => `Плато «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.middleCharacter}. Рельеф прост, но высота не даёт быстро восстановиться.`,
  },
  TRAVERSE: {
    terrain: 'Длинный смешанный траверс', skill: 'NAVIGATION', difficultyDelta: 3, exposureDelta: 8, durationWeight: 1.15, campPossible: false, hazard: 'Уход с линии и камнепад',
    name: mountain => `Траверс к «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.descentProblem}. Все ориентиры нужно запоминать ещё на подъёме.`,
  },
  HIGH_COL: {
    terrain: 'Высокая седловина и снежная площадка', skill: 'ENDURANCE', difficultyDelta: -4, exposureDelta: 0, durationWeight: .8, campPossible: true, hazard: 'Ветер и переохлаждение',
    name: mountain => `Седловина «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.campPattern}. Это последняя полноценная точка оценки состояния.`,
  },
  FALSE_SUMMIT: {
    terrain: 'Ложная вершина и открытое плечо', skill: 'ENDURANCE', difficultyDelta: 1, exposureDelta: 10, durationWeight: 1.05, campPossible: false, hazard: 'Потеря времени и резерва',
    name: mountain => `Ложная вершина «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.upperCharacter}. После выхода на плечо маршрут ещё не заканчивается.`,
  },
  WIND_GAP: {
    terrain: 'Ветровой провал гребня', skill: 'NAVIGATION', difficultyDelta: 4, exposureDelta: 18, durationWeight: .75, campPossible: false, hazard: 'Порывы и обледенение',
    name: mountain => `Ветровой разрыв «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.weatherRule}. Здесь легко потерять равновесие и нужный выход.`,
  },
  RIDGE: {
    terrain: 'Смешанный вершинный гребень', skill: 'ROCK', difficultyDelta: 7, exposureDelta: 16, durationWeight: .95, campPossible: false, hazard: 'Карниз и штормовой ветер',
    name: mountain => `Гребень «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.upperCharacter}. Узкая линия не даёт группе растянуться.`,
  },
  CORNICE: {
    terrain: 'Снежная кромка и карнизы', skill: 'NAVIGATION', difficultyDelta: 6, exposureDelta: 20, durationWeight: .8, campPossible: false, hazard: 'Обрушение карниза',
    name: mountain => `Кромка «${landmark(mountain, 3)}»`,
    note: () => 'Безопасная линия проходит ниже очевидного края и требует точной навигации.',
  },
  SUMMIT_DOME: {
    terrain: 'Вершинный купол и снег', skill: 'ENDURANCE', difficultyDelta: 2, exposureDelta: 12, durationWeight: .85, campPossible: false, hazard: 'Высота, холод и потеря видимости',
    name: mountain => `Верхний купол «${landmark(mountain, 3)}»`,
    note: mountain => `${mountain.identity.upperCharacter}. На вершине нужно оставить силы на ${mountain.identity.descentProblem}.`,
  },
};

type RouteRecipe = {
  slot: RouteSlot;
  idSuffix: 'south-ridge' | 'east-glacier' | 'north-line';
  startOffset: number;
  archetype: string;
  style: string;
  name: (mountain: MountainData) => string;
  summary: (mountain: MountainData) => string;
  motifs: MotifId[];
  difficultyBias: number;
  riskBias: number;
  durationBias: number;
  gear: string[];
};

const CHARACTER_RECIPES: Record<MountainCharacterId, RouteRecipe[]> = {
  WEATHER: [
    { slot: 'CLASSIC', idSuffix: 'south-ridge', startOffset: 0, archetype: 'SHELTERED_LINE', style: 'Защищённая смешанная линия', name: mountain => `Защищённый путь через «${landmark(mountain, 0)}»`, summary: mountain => `Линия использует внутренние террасы и выходит на верх только в районе «${landmark(mountain, 3)}». Она длиннее прямого пути, но лучше переживает раннее ухудшение погоды.`, motifs: ['APPROACH', 'MORAINE', 'GLACIER_BASIN', 'ROCK_RIBS', 'HIGH_COL', 'WIND_GAP', 'RIDGE'], difficultyBias: -6, riskBias: -5, durationBias: 1.08, gear: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit', 'bivy'] },
    { slot: 'SECONDARY', idSuffix: 'east-glacier', startOffset: -50, archetype: 'WEATHER_GLACIER', style: 'Ледниковая дуга', name: mountain => `Ледниковая дуга «${landmark(mountain, 1)}»`, summary: mountain => `Широкая линия с хорошими лагерями, но весь верх лежит на открытом плато. ${mountain.identity.weatherRule}.`, motifs: ['APPROACH', 'GLACIER_BASIN', 'CREVASSE_FIELD', 'PLATEAU', 'FALSE_SUMMIT', 'CORNICE', 'SUMMIT_DOME'], difficultyBias: 0, riskBias: 2, durationBias: 1.18, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'DIRECT', idSuffix: 'north-line', startOffset: 50, archetype: 'WINDWARD_RIDGE', style: 'Ветровая прямая линия', name: mountain => `Ветровой гребень «${landmark(mountain, 3)}»`, summary: mountain => `Короткая линия быстро набирает высоту и почти не даёт укрытий. Ошибка во времени оставляет группу на гребне в момент усиления ветра.`, motifs: ['APPROACH', 'SNOW_COULOIR', 'MIXED_RAMP', 'WIND_GAP', 'RIDGE', 'CORNICE'], difficultyBias: 8, riskBias: 13, durationBias: .88, gear: ['rope', 'rock-kit', 'ice-kit', 'medkit', 'bivy'] },
  ],
  TECHNICAL: [
    { slot: 'CLASSIC', idSuffix: 'south-ridge', startOffset: 0, archetype: 'MIXED_RIBS', style: 'Смешанные рёбра', name: mountain => `Рёбра «${landmark(mountain, 2)}»`, summary: mountain => `Маршрут собирает несколько коротких технических ключей вместо одной большой стены. ${mountain.identity.campPattern}.`, motifs: ['APPROACH', 'MORAINE', 'ROCK_RIBS', 'GLACIER_BASIN', 'MIXED_RAMP', 'HIGH_COL', 'RIDGE'], difficultyBias: -2, riskBias: -2, durationBias: 1.03, gear: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit'] },
    { slot: 'SECONDARY', idSuffix: 'east-glacier', startOffset: -50, archetype: 'ICE_LINE', style: 'Ледовая техническая линия', name: mountain => `Ледовая линия «${landmark(mountain, 1)}»`, summary: mountain => `Трещины, ледопад и крутая верхняя рампа требуют сильной ледовой связки. Хорошая техника сокращает время под объективными опасностями.`, motifs: ['APPROACH', 'GLACIER_BASIN', 'CREVASSE_FIELD', 'ICEFALL', 'MIXED_RAMP', 'CORNICE', 'SUMMIT_DOME'], difficultyBias: 5, riskBias: 6, durationBias: 1.06, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'DIRECT', idSuffix: 'north-line', startOffset: 50, archetype: 'PRIMARY_WALL', style: 'Прямая стеновая линия', name: mountain => `Стена «${landmark(mountain, 2)}»`, summary: mountain => `Самая короткая и тяжёлая линия массива. После входа в стену лагерь и простой отход исчезают, а верх приходится искать через смешанный рельеф.`, motifs: ['APPROACH', 'SNOW_COULOIR', 'ROCK_WALL', 'MIXED_RAMP', 'WIND_GAP', 'RIDGE'], difficultyBias: 14, riskBias: 14, durationBias: .94, gear: ['rope', 'rock-kit', 'ice-kit', 'medkit', 'bivy'] },
  ],
  ENDURANCE: [
    { slot: 'CLASSIC', idSuffix: 'south-ridge', startOffset: 0, archetype: 'LONG_CLASSIC', style: 'Длинный классический маршрут', name: mountain => `Большой путь через «${landmark(mountain, 0)}»`, summary: mountain => `Маршрут делится на логичные лагеря, но каждый день остаётся длинным. Главная задача — не потратить резерв до верхнего гребня.`, motifs: ['APPROACH', 'MORAINE', 'GLACIER_BASIN', 'PLATEAU', 'HIGH_COL', 'FALSE_SUMMIT', 'RIDGE', 'SUMMIT_DOME'], difficultyBias: -7, riskBias: -4, durationBias: 1.3, gear: ['rope', 'rock-kit', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'SECONDARY', idSuffix: 'east-glacier', startOffset: -50, archetype: 'BASIN_CIRCUIT', style: 'Ледниковый обход массива', name: mountain => `Большая дуга «${landmark(mountain, 1)}»`, summary: mountain => `Технически спокойная дуга проходит через несколько чаш и плато. Расстояние, высота лагерей и расход топлива важнее одного сложного участка.`, motifs: ['APPROACH', 'GLACIER_BASIN', 'CREVASSE_FIELD', 'PLATEAU', 'TRAVERSE', 'HIGH_COL', 'FALSE_SUMMIT', 'SUMMIT_DOME'], difficultyBias: -3, riskBias: 0, durationBias: 1.42, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'DIRECT', idSuffix: 'north-line', startOffset: 50, archetype: 'SKYLINE_TRAVERSE', style: 'Длинный высотный траверс', name: mountain => `Траверс «${landmark(mountain, 3)}»`, summary: mountain => `Линия быстрее выходит наверх, но потом долго идёт по ложным вершинам. Отступление возможно, но не возвращает потраченное время и силы.`, motifs: ['APPROACH', 'ROCK_RIBS', 'TRAVERSE', 'FALSE_SUMMIT', 'WIND_GAP', 'RIDGE', 'SUMMIT_DOME'], difficultyBias: 5, riskBias: 8, durationBias: 1.17, gear: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit', 'bivy'] },
  ],
  ALTITUDE: [
    { slot: 'CLASSIC', idSuffix: 'south-ridge', startOffset: 0, archetype: 'CAMP_ROUTE', style: 'Многоэтапная высотная линия', name: mountain => `Лагерный путь через «${landmark(mountain, 3)}»`, summary: mountain => `Самая надёжная линия строится вокруг последовательных ночёвок и переносов груза. Технические места короткие, но всё происходит на большой высоте.`, motifs: ['APPROACH', 'MORAINE', 'GLACIER_BASIN', 'PLATEAU', 'HIGH_COL', 'FALSE_SUMMIT', 'SUMMIT_DOME'], difficultyBias: -8, riskBias: -3, durationBias: 1.34, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'SECONDARY', idSuffix: 'east-glacier', startOffset: -50, archetype: 'HIGH_PLATEAU', style: 'Высотное ледниковое плато', name: mountain => `Белое плато «${landmark(mountain, 1)}»`, summary: mountain => `Длинная открытая линия с небольшим числом технических ключей. Она требует сильной акклиматизации и точного контроля воды.`, motifs: ['APPROACH', 'GLACIER_BASIN', 'CREVASSE_FIELD', 'PLATEAU', 'PLATEAU', 'CORNICE', 'SUMMIT_DOME'], difficultyBias: -2, riskBias: 3, durationBias: 1.25, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'DIRECT', idSuffix: 'north-line', startOffset: 50, archetype: 'SUMMIT_PUSH', style: 'Быстрый высотный штурм', name: mountain => `Прямая к «${landmark(mountain, 3)}»`, summary: mountain => `Короткая линия экономит расстояние, но пропускает удобные лагеря. Слабая акклиматизация превращает верхний склон в главную опасность.`, motifs: ['APPROACH', 'SNOW_COULOIR', 'MIXED_RAMP', 'PLATEAU', 'FALSE_SUMMIT', 'SUMMIT_DOME'], difficultyBias: 6, riskBias: 12, durationBias: .91, gear: ['rope', 'ice-kit', 'stove', 'medkit', 'bivy'] },
  ],
  DESCENT: [
    { slot: 'CLASSIC', idSuffix: 'south-ridge', startOffset: 0, archetype: 'MEMORY_ROUTE', style: 'Классическая линия с отдельным спуском', name: mountain => `Путь ориентиров «${landmark(mountain, 0)}»`, summary: mountain => `Подъём читается уверенно, но траверсы и развилки нужно запоминать. ${mountain.identity.descentProblem}.`, motifs: ['APPROACH', 'MORAINE', 'ROCK_RIBS', 'TRAVERSE', 'HIGH_COL', 'RIDGE', 'SUMMIT_DOME'], difficultyBias: -4, riskBias: 2, durationBias: 1.08, gear: ['rope', 'rock-kit', 'ice-kit', 'stove', 'medkit', 'bivy'] },
    { slot: 'SECONDARY', idSuffix: 'east-glacier', startOffset: -50, archetype: 'HANGING_GLACIER', style: 'Ледниковая линия с тяжёлым возвращением', name: mountain => `Висячий ледник «${landmark(mountain, 1)}»`, summary: mountain => `Подъём проходит по понятному леднику, но на спуске снежные мосты и сераки выглядят иначе. Защищённые точки нужно готовить заранее.`, motifs: ['APPROACH', 'GLACIER_BASIN', 'CREVASSE_FIELD', 'ICEFALL', 'PLATEAU', 'CORNICE', 'SUMMIT_DOME'], difficultyBias: 0, riskBias: 8, durationBias: 1.13, gear: ['rope', 'ice-kit', 'tent', 'stove', 'medkit', 'bivy'] },
    { slot: 'DIRECT', idSuffix: 'north-line', startOffset: 50, archetype: 'ONE_WAY_FACE', style: 'Стеновая линия с отдельным отходом', name: mountain => `Северный щит «${landmark(mountain, 2)}»`, summary: mountain => `Прямой подъём заканчивается на вершине, но спуск по стене слишком дорог. Группа должна сохранить силы для длинного выхода по соседнему гребню.`, motifs: ['APPROACH', 'SNOW_COULOIR', 'ROCK_WALL', 'MIXED_RAMP', 'WIND_GAP', 'RIDGE'], difficultyBias: 12, riskBias: 16, durationBias: 1.02, gear: ['rope', 'rock-kit', 'ice-kit', 'medkit', 'bivy'] },
  ],
};

function splitGain(total: number, weights: number[]) {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const values = weights.map(weight => Math.round(total * weight / Math.max(1, weightTotal)));
  values[values.length - 1] += total - values.reduce((sum, value) => sum + value, 0);
  return values;
}

function decisionForSegment(route: ExpeditionRoute, segment: RouteSegment, index: number): RouteDecisionPoint {
  const id = `${route.id}-decision-${index + 1}`;
  const normalized = `${segment.terrain} ${segment.hazard}`.toLowerCase();
  if (normalized.includes('трещин') || normalized.includes('ледник')) {
    return {
      id, segmentId: segment.id, title: segment.name,
      situation: 'Прямая линия короче, но снежные мосты не проверены. По краю рельеф читается лучше, зато группа дольше остаётся на высоте.',
      options: [
        { id: 'probe', title: 'Проверять прямую линию', tone: 'BALANCED', description: 'Идти медленно в связке и проверять каждый подозрительный мост.', durationModifier: 1.08, energyModifier: 1, riskModifier: -.025, requiresGearId: 'rope', resultNote: 'Группа прошла участок по проверенной прямой линии.' },
        { id: 'outer-arc', title: 'Внешняя дуга', tone: 'SAFE', description: 'Потратить больше времени на хорошо читаемый край ледника.', durationModifier: 1.28, energyModifier: .96, riskModifier: -.075, resultNote: 'Группа обошла центральную зону по внешней дуге.' },
      ],
    };
  }
  if (normalized.includes('стен') || normalized.includes('скал') || normalized.includes('микст') || normalized.includes('рёбр')) {
    return {
      id, segmentId: segment.id, title: segment.name,
      situation: 'Прямая линия быстрее, но станции придётся собирать на ходу. Боковая полка длиннее и позволяет оставить защищённый путь для спуска.',
      options: [
        { id: 'direct', title: 'Прямая линия', tone: 'BOLD', description: 'Сэкономить время и сохранить верёвку для верхней части.', durationModifier: .82, energyModifier: 1.1, riskModifier: .085, resultNote: 'Связка выбрала прямую техническую линию.' },
        { id: 'protected', title: 'Защищённая полка', tone: 'SAFE', description: 'Потратить 25 м верёвки и подготовить обратный путь.', durationModifier: 1.22, energyModifier: .97, riskModifier: -.08, requiresRopeMeters: 25, resultNote: 'Группа оставила защищённую линию для возвращения.' },
      ],
    };
  }
  if (normalized.includes('лавин') || normalized.includes('снег') || normalized.includes('кулуар')) {
    return {
      id, segmentId: segment.id, title: segment.name,
      situation: 'Слой ещё холодный, но солнце уже касается склона. Можно быстро пересечь центр или уйти на длинный каменный край.',
      options: [
        { id: 'cross-now', title: 'Пересечь сейчас', tone: 'BOLD', description: 'Сократить время на склоне, сильнее нагрузить группу.', durationModifier: .72, energyModifier: 1.22, riskModifier: .055, resultNote: 'Группа форсировала снежный склон одним рывком.' },
        { id: 'rock-edge', title: 'Каменный край', tone: 'SAFE', description: 'Дольше двигаться по неровному рельефу, снизить лавинный риск.', durationModifier: 1.3, energyModifier: 1.03, riskModifier: -.075, resultNote: 'Группа обошла центр склона по каменному краю.' },
      ],
    };
  }
  if (normalized.includes('греб') || normalized.includes('карниз') || normalized.includes('ветр') || normalized.includes('кромк')) {
    return {
      id, segmentId: segment.id, title: segment.name,
      situation: 'По самой кромке быстрее, но ветер и карнизы не оставляют запаса. Ниже гребня рельеф тяжелее, зато линия защищена.',
      options: [
        { id: 'crest', title: 'По кромке', tone: 'BOLD', description: 'Сохранить время и принять открытость ветру.', durationModifier: .78, energyModifier: 1.05, riskModifier: .1, resultNote: 'Группа осталась на открытой кромке гребня.' },
        { id: 'lee-side', title: 'Подветренный склон', tone: 'SAFE', description: 'Идти медленнее по смешанному рельефу под гребнем.', durationModifier: 1.24, energyModifier: 1.04, riskModifier: -.07, resultNote: 'Группа ушла под кромку на защищённую сторону.' },
      ],
    };
  }
  return {
    id, segmentId: segment.id, title: segment.name,
    situation: 'До следующей безопасной точки ещё несколько часов. Можно сохранить рабочий темп или сделать ранний лагерь и потерять часть погодного окна.',
    options: [
      { id: 'continue', title: 'Продолжить', tone: 'BALANCED', description: 'Сохранить план и прийти к следующей площадке в текущем окне.', durationModifier: 1, energyModifier: 1.08, riskModifier: .025, resultNote: 'Группа продолжила движение без дополнительной ночёвки.' },
      { id: 'early-camp', title: 'Ранний лагерь', tone: 'SAFE', description: 'Потратить время и запасы, восстановить группу перед верхом.', durationModifier: 1.36, energyModifier: .82, riskModifier: -.06, requiresGearId: 'bivy', resultNote: 'Группа поставила ранний лагерь перед верхней частью.' },
    ],
  };
}

function decisionIndexes(segments: RouteSegment[]) {
  const candidates = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment, index }) => index > 0 && index < segments.length - 1 && !segment.campPossible);
  if (!candidates.length) return [];
  const first = candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * .28))]!;
  const second = candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * .72))]!;
  return first.index === second.index ? [first.index] : [first.index, second.index];
}

function routeStoryFor(mountain: MountainData, recipe: RouteRecipe, segments: RouteSegment[]) {
  const firstCamp = segments.find(segment => segment.campPossible && segment.skill !== 'ENDURANCE') ?? segments.find(segment => segment.campPossible);
  const key = [...segments].sort((a, b) => b.difficulty + b.exposure - (a.difficulty + a.exposure))[0]!;
  return [
    `${mountain.identity.approachCharacter}. Нижняя часть выводит к ${firstCamp?.name ?? segments[1]?.name ?? segments[0]!.name}.`,
    `Характер линии «${recipe.archetype}» определяет участок ${key.name}: здесь маршрут требует главного навыка и меняет запас на спуск.`,
    `${mountain.identity.upperCharacter}. После вершины ${mountain.identity.descentProblem}.`,
  ];
}

function makeRoute(world: WorldState, mountain: MountainData, recipe: RouteRecipe, routeIndex: number, signatureMountain: boolean): ExpeditionRoute {
  const eraPenalty = routeEraPenalty(world);
  const startElevation = expeditionStartElevation(world, mountain, recipe.startOffset);
  const actualGain = Math.max(1, mountain.elevation - startElevation);
  const baseDifficulty = mountain.technicality * .5 + mountain.altitudeSeverity * .23 + mountain.remoteness * .12 + eraPenalty + recipe.difficultyBias;
  const baseRisk = mountain.altitudeSeverity * .34 + mountain.remoteness * .21 + mountain.technicality * .25 + recipe.riskBias;
  const characterDifficulty = mountain.characterId === 'TECHNICAL' ? 7 : mountain.characterId === 'ALTITUDE' ? 2 : 0;
  const characterRisk = mountain.characterId === 'WEATHER' ? 8 : mountain.characterId === 'DESCENT' ? 7 : 0;
  const gains = splitGain(actualGain, recipe.motifs.map(id => MOTIFS[id].durationWeight));
  const slug = mountain.id.replace(/[^a-zA-Z0-9-]/g, '-');
  const routeId = `${slug}-${recipe.idSuffix}`;
  const rng = createRng(`${world.config.seed}:${mountain.id}:${recipe.slot}:authored-route`);

  const segments = recipe.motifs.map((motifId, index): RouteSegment => {
    const motif = MOTIFS[motifId];
    const altitudeDuration = 1 + mountain.altitudeSeverity / 260;
    const durationVariance = .93 + rng.next() * .14;
    const difficulty = clamp(Math.round(baseDifficulty + motif.difficultyDelta + characterDifficulty + (routeIndex === 2 ? 3 : 0)), 18, 99);
    const exposure = clamp(Math.round(baseRisk + motif.exposureDelta + characterRisk + (routeIndex === 2 ? 4 : 0)), 8, 99);
    return {
      id: `${routeId}-${index + 1}-${motifId.toLowerCase()}`,
      name: motif.name(mountain, routeIndex),
      terrain: motif.terrain,
      elevationGain: gains[index]!,
      baseDurationMinutes: Math.max(55, Math.round(82 * motif.durationWeight * recipe.durationBias * altitudeDuration * durationVariance)),
      difficulty,
      exposure,
      skill: motif.skill,
      note: motif.note(mountain),
      campPossible: motif.campPossible,
      hazard: motif.hazard,
      terrainModuleId: detectTerrainModule(motif.terrain).id,
      safeHaven: motif.campPossible,
    };
  });

  const provisional: ExpeditionRoute = {
    id: routeId,
    regionId: mountain.regionId ?? world.region.id,
    mountainId: mountain.id,
    mountainName: mountain.name,
    mountainCharacterId: mountain.characterId,
    mountainFormId: mountain.identity.formId,
    routeArchetype: recipe.archetype,
    signatureFeature: mountain.identity.signatureFeature,
    campRhythm: mountain.identity.campPattern,
    name: recipe.name(mountain),
    style: recipe.style,
    summary: recipe.summary(mountain),
    startElevation,
    summitElevation: mountain.elevation,
    estimatedHours: 1,
    technicality: clamp(Math.round(segments.reduce((sum, segment) => sum + segment.difficulty, 0) / segments.length)),
    objectiveRisk: clamp(Math.round(segments.reduce((sum, segment) => sum + segment.exposure, 0) / segments.length)),
    recommendedTeamSize: mountain.elevation > 6500 || recipe.slot === 'DIRECT' ? 4 : 3,
    requiredGearIds: recipe.gear,
    segments,
    isSignature: signatureMountain,
    routeStory: [],
    descentSummary: '',
  };

  const decisions = decisionIndexes(segments).map((segmentIndex, index) => decisionForSegment(provisional, segments[segmentIndex]!, index));
  const decisionBySegment = new Map(decisions.map(decision => [decision.segmentId, decision.id]));
  const noReturnRatio = mountain.characterId === 'DESCENT' || recipe.slot === 'DIRECT' ? .52 : .68;
  const enrichedSegments = segments.map((segment, index) => ({
    ...segment,
    decisionId: decisionBySegment.get(segment.id),
    noReturn: index >= Math.ceil(segments.length * noReturnRatio),
    descentNote: index >= segments.length - 2
      ? `Верхний участок проходится повторно при накопленной усталости; ${mountain.identity.descentProblem}.`
      : segment.campPossible
        ? `На спуске это возможная точка остановки. ${mountain.identity.campPattern}.`
        : `Сверху линия читается иначе. ${segment.note}`,
  }));
  const estimatedHours = Math.max(7, Math.round((enrichedSegments.reduce((sum, segment) => sum + segment.baseDurationMinutes, 0) / 60 + mountain.remoteness / 24) * 10) / 10);
  const route: ExpeditionRoute = {
    ...provisional,
    estimatedHours,
    segments: enrichedSegments,
    decisions,
    routeStory: routeStoryFor(mountain, recipe, enrichedSegments),
    descentSummary: `${mountain.identity.descentProblem}. ${recipe.slot === 'DIRECT' ? 'Прямой подъём не означает прямого возвращения: часть линии приходится обходить.' : 'Нижние ориентиры и места лагерей нужно запомнить до выхода наверх.'}`,
  };
  return attachGraph({ ...route, descentSegments: defaultDescentSegments(route) });
}

function makeMountainRoutes(world: WorldState, mountain: MountainData): ExpeditionRoute[] {
  const signatureMountain = getQualificationTarget(world).mountain.id === mountain.id;
  return CHARACTER_RECIPES[mountain.characterId].map((recipe, routeIndex) => makeRoute(world, mountain, recipe, routeIndex, signatureMountain));
}

export function generateRoutesForWorld(world: WorldState, mountains: MountainData[] = world.region.mountains): ExpeditionRoute[] {
  return [...mountains]
    .sort((a, b) => mountainDifficulty(a) - mountainDifficulty(b))
    .flatMap(mountain => makeMountainRoutes(world, mountain));
}
