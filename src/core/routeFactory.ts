import { detectTerrainModule } from '../content/terrainModules';
import { attachContentMetadata } from './contentPipeline';
import type { ExpeditionRoute, RouteGraph, RouteGraphNode, RouteSegment, SkillId, WorldState } from './types';

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

function expeditionStartElevation(world: WorldState, mountain: WorldState['region']['mountains'][number], offset = 0) {
  // An expedition starts at the lower access point, not one kilometre below the summit.
  // Region elevation only nudges the trailhead; the hard cap keeps every generated start readable.
  const regionalFloor = Math.min(520, Math.max(0, Math.round(world.region.elevationMin * .16)));
  const accessLift = Math.round((mountain.remoteness * 3.2 + mountain.prominence * .012) / 50) * 50;
  return clamp(regionalFloor + accessLift + offset, 0, 1000);
}

export function getQualificationTarget(world: WorldState) {
  const mountain = [...world.region.mountains].sort((a, b) =>
    (a.elevation * 0.012 + a.technicality + a.remoteness * 0.35) -
    (b.elevation * 0.012 + b.technicality + b.remoteness * 0.35),
  )[0]!;
  const summitElevation = mountain.elevation;
  return {
    mountain,
    summitElevation,
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
    terrainModuleId: item.terrainModuleId ?? detectTerrainModule(item.terrain).id,
    decisionId: bySegment.get(item.id),
    noReturn: signatureMountain && index >= Math.ceil(route.segments.length * .58),
    safeHaven: item.campPossible,
    descentNote: index >= route.segments.length - 2
      ? 'На обратном пути здесь мало места, а усталость усиливает каждую ошибку.'
      : item.note,
  }));
  const enriched = { ...route, segments };
  return attachGraph({
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
  });
}

function makeMountainRoutes(world: WorldState, mountain: WorldState['region']['mountains'][number]): ExpeditionRoute[] {
  const eraPenalty = routeEraPenalty(world);
  const startElevation = expeditionStartElevation(world, mountain);
  const actualGain = Math.max(1, mountain.elevation - startElevation);
  const baseDifficulty = mountain.technicality * .48 + mountain.altitudeSeverity * .32 + mountain.remoteness * .16 + eraPenalty;
  const baseRisk = mountain.altitudeSeverity * .36 + mountain.remoteness * .22 + mountain.technicality * .24;
  const characterTech = mountain.characterId === 'TECHNICAL' ? 9 : 0;
  const characterRisk = mountain.characterId === 'WEATHER' ? 8 : mountain.characterId === 'DESCENT' ? 6 : 0;
  const characterHours = mountain.characterId === 'ENDURANCE' ? 1.18 : 1;
  const slug = mountain.id.replace(/[^a-zA-Z0-9-]/g, '-');

  const eastStartElevation = expeditionStartElevation(world, mountain, -50);
  const northStartElevation = expeditionStartElevation(world, mountain, 50);
  const ridgeGain = splitGain(mountain.elevation - startElevation, [.12, .18, .22, .21, .27]);
  const glacierGain = splitGain(mountain.elevation - eastStartElevation, [.1, .16, .18, .19, .17, .2]);
  const faceGain = splitGain(mountain.elevation - northStartElevation, [.08, .17, .25, .24, .26]);

  const ridgeTech = clamp(Math.round(18 + baseDifficulty * .62 + characterTech), 28, 92);
  const glacierTech = clamp(Math.round(15 + baseDifficulty * .56 + characterTech), 25, 90);
  const faceTech = clamp(Math.round(28 + baseDifficulty * .76 + characterTech), 40, 98);
  const ridgeRisk = clamp(Math.round(16 + baseRisk * .55 + characterRisk), 24, 92);
  const glacierRisk = clamp(Math.round(22 + baseRisk * .66 + characterRisk), 30, 96);
  const faceRisk = clamp(Math.round(30 + baseRisk * .76 + characterRisk), 42, 99);
  const altitudeHours = actualGain / 165 + mountain.altitudeSeverity / 10 + mountain.remoteness / 18;

  const routes: ExpeditionRoute[] = [
    {
      id: `${slug}-south-ridge`, regionId: world.region.id, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Южный гребень',
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
      id: `${slug}-east-glacier`, regionId: world.region.id, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Восточный ледник',
      style: 'Длинная ледниковая линия',
      summary: 'Меньше сложного лазания, больше времени на высоте, закрытых трещин и зависимости от холодного утреннего окна.',
      startElevation: eastStartElevation, summitElevation: mountain.elevation,
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
      id: `${slug}-north-line`, regionId: world.region.id, mountainId: mountain.id, mountainName: mountain.name, mountainCharacterId: mountain.characterId, name: 'Северная линия',
      style: 'Прямая техническая линия',
      summary: 'Короткая по расстоянию, но жёсткая по технике. Высокая открытость, мало мест для отдыха и тяжёлый отход после ключевой стены.',
      startElevation: northStartElevation, summitElevation: mountain.elevation,
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

export function generateRoutesForWorld(world: WorldState): ExpeditionRoute[] {
  return [...world.region.mountains]
    .sort((a, b) => mountainDifficulty(a) - mountainDifficulty(b))
    .flatMap(mountain => makeMountainRoutes(world, mountain));
}

