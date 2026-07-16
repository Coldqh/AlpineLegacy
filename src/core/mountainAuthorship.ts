import { createRng } from './rng';
import type { MountainCharacterId, MountainData, MountainFormId, MountainIdentity } from './types';

const FORM_TITLES: Record<MountainFormId, string> = {
  SHARP_PYRAMID: 'острая скально-ледовая пирамида',
  LONG_RIDGE: 'длинный многогребневый массив',
  GLACIER_DOME: 'широкий ледниковый купол',
  BROKEN_MASSIF: 'разрушенный многоярусный массив',
  TWIN_SUMMIT: 'двойная вершина с высокой седловиной',
  ASYMMETRIC_WALL: 'асимметричная вершина с одной тяжёлой стеной',
};

const FORM_OPTIONS: Record<MountainCharacterId, MountainFormId[]> = {
  WEATHER: ['LONG_RIDGE', 'GLACIER_DOME', 'TWIN_SUMMIT'],
  TECHNICAL: ['SHARP_PYRAMID', 'BROKEN_MASSIF', 'ASYMMETRIC_WALL'],
  ENDURANCE: ['LONG_RIDGE', 'BROKEN_MASSIF', 'GLACIER_DOME'],
  ALTITUDE: ['GLACIER_DOME', 'TWIN_SUMMIT', 'LONG_RIDGE'],
  DESCENT: ['ASYMMETRIC_WALL', 'SHARP_PYRAMID', 'TWIN_SUMMIT'],
};

const SIGNATURES: Record<MountainFormId, string[]> = {
  SHARP_PYRAMID: ['вершинный треугольник из чёрного льда', 'узкая верхняя пирамида', 'острый купол над четырьмя рёбрами'],
  LONG_RIDGE: ['гребень, который тянется через весь массив', 'цепь ложных вершин', 'длинное ветровое плечо'],
  GLACIER_DOME: ['широкий белый купол без явного края', 'ледниковое плато под вершиной', 'высокая фирновая чаша'],
  BROKEN_MASSIF: ['ступенчатые бастионы и скрытые цирки', 'система разорванных рёбер', 'каменные ярусы с внутренними ледниками'],
  TWIN_SUMMIT: ['две вершины, разделённые открытой седловиной', 'ложный пик перед главной вершиной', 'двойной купол с узкой перемычкой'],
  ASYMMETRIC_WALL: ['одна пологая сторона и одна тяжёлая стена', 'нависающая северная сторона', 'длинная теневая стена над простым подходом'],
};

const APPROACHES: Record<MountainFormId, string[]> = {
  SHARP_PYRAMID: ['короткий подход выводит прямо под рёбра', 'морена быстро упирается в основание стены'],
  LONG_RIDGE: ['подход длинный и постепенно набирает высоту', 'нижняя долина растягивает группу до начала лазания'],
  GLACIER_DOME: ['путь начинается в широкой ледниковой чаше', 'нижний ледник даёт много места, но плохо показывает расстояние'],
  BROKEN_MASSIF: ['подход проходит через несколько каменных террас', 'линию приходится искать между моренами и боковыми цирками'],
  TWIN_SUMMIT: ['подход выводит к общей седловине массива', 'нижняя часть скрывает главную вершину за ложным пиком'],
  ASYMMETRIC_WALL: ['с безопасной стороны подход прост, под стеной начинается резкий набор', 'нижняя долина заканчивается узким кулуаром'],
};

const MIDDLES: Record<MountainCharacterId, string[]> = {
  WEATHER: ['средняя часть открыта ветру и почти не даёт укрытий', 'плечо собирает облака раньше остального массива'],
  TECHNICAL: ['середина маршрута состоит из связки коротких ключей', 'главные трудности начинаются до верхней трети'],
  ENDURANCE: ['средняя часть длиннее, чем кажется с базы', 'несколько одинаковых по виду участков медленно съедают запас сил'],
  ALTITUDE: ['середина технически понятна, но уже лежит в зоне тяжёлой акклиматизации', 'плато заставляет долго работать на высоте без быстрого набора'],
  DESCENT: ['середина легко читается вверх и плохо — на обратном пути', 'несколько траверсов требуют точного запоминания линии'],
};

const UPPERS: Record<MountainCharacterId, string[]> = {
  WEATHER: ['верхняя часть полностью зависит от короткого погодного окна', 'последний гребень не защищён от ветра'],
  TECHNICAL: ['верх закрывает один чистый технический ключ', 'после ключевой стены остаётся узкий смешанный гребень'],
  ENDURANCE: ['верхняя треть длинная и не даёт быстрого финиша', 'после ложной вершины остаётся полноценный второй набор'],
  ALTITUDE: ['последние метры просты по рельефу и тяжёлы по высоте', 'вершинный купол требует медленного темпа и сохранённой воды'],
  DESCENT: ['вершина открывает сложный и плохо защищённый обратный путь', 'последний участок приходится проходить дважды в состоянии разной усталости'],
};

const CAMP_PATTERNS: Record<MountainFormId, Array<Pick<MountainIdentity, 'campPatternId' | 'campPattern'>>> = {
  SHARP_PYRAMID: [
    { campPatternId: 'SPARSE', campPattern: 'одна надёжная площадка внизу; выше возможны только короткие биваки' },
    { campPatternId: 'HIGH_COL', campPattern: 'основной лагерь ставят на высокой седловине перед пирамидой' },
  ],
  LONG_RIDGE: [
    { campPatternId: 'TERRACES', campPattern: 'несколько естественных террас позволяют делить маршрут на длинные дни' },
    { campPatternId: 'BIVOUAC_ONLY', campPattern: 'на гребне нет полноценных площадок, только тесные ночёвки' },
  ],
  GLACIER_DOME: [
    { campPatternId: 'GLACIER_BASINS', campPattern: 'лагеря ставят в ледниковых чашах, далеко от сераков и трещин' },
    { campPatternId: 'TERRACES', campPattern: 'широкие снежные террасы дают хорошие лагеря, но оставляют группу на ветру' },
  ],
  BROKEN_MASSIF: [
    { campPatternId: 'TERRACES', campPattern: 'каменные ярусы дают несколько площадок с разным уровнем защиты' },
    { campPatternId: 'SPARSE', campPattern: 'подходящих мест мало, и пропущенная площадка заставляет идти дальше' },
  ],
  TWIN_SUMMIT: [
    { campPatternId: 'HIGH_COL', campPattern: 'ключевой лагерь ставят на седловине между ложной и главной вершиной' },
    { campPatternId: 'GLACIER_BASINS', campPattern: 'нижний лагерь безопасен, а верхний возможен только в закрытой чаше' },
  ],
  ASYMMETRIC_WALL: [
    { campPatternId: 'SPARSE', campPattern: 'под стеной есть одна площадка; выше группа работает без лагеря' },
    { campPatternId: 'BIVOUAC_ONLY', campPattern: 'после входа в стену остаются только подвесные или аварийные биваки' },
  ],
};

const WEATHER_RULES: Record<MountainCharacterId, string[]> = {
  WEATHER: ['выход нужно закончить до усиления дневного ветра', 'облака закрывают верх после полудня', 'утреннее окно короткое, а шторм приходит без длинного предупреждения'],
  TECHNICAL: ['холод улучшает лёд, но делает станции медленнее', 'после снегопада ключевые скалы долго остаются мокрыми'],
  ENDURANCE: ['погода редко ломается мгновенно, но длительное ухудшение накапливает задержку', 'ветер усиливается по мере выхода на длинный гребень'],
  ALTITUDE: ['ночью стабильно, днём высотный купол быстро закрывает облаками', 'окно широкое внизу и резко сужается выше последнего лагеря'],
  DESCENT: ['погода чаще портится к моменту спуска', 'после полудня обратная сторона массива уходит в тень и обледеневает'],
};

const DESCENT_PROBLEMS: Record<MountainCharacterId, string[]> = {
  WEATHER: ['на спуске группа попадает в усиление ветра и ухудшение видимости', 'обратный путь теряется в облаках раньше подъёмной линии'],
  TECHNICAL: ['ключевые участки требуют повторной работы со станциями', 'спуск по крутым участкам медленнее и сильнее изнашивает верёвку'],
  ENDURANCE: ['длинный выход продолжается после того, как цель уже достигнута', 'на возвращении ложные вершины и траверсы снова отнимают часы'],
  ALTITUDE: ['самая тяжёлая часть спуска проходит до полноценного отдыха ниже', 'усталость и высота сохраняются дольше технических трудностей'],
  DESCENT: ['часть подъёмной линии не читается сверху', 'без заранее оставленных ориентиров группа легко уходит в соседний кулуар'],
};

const LANDMARK_POOLS = {
  lower: ['Каменные ворота', 'Мёртвая морена', 'Сухой цирк', 'Тёмный порог', 'Нижняя терраса', 'Разбитая чаша'],
  ice: ['Белый лабиринт', 'Стеклянное поле', 'Тихий ледник', 'Синие разломы', 'Серачный двор', 'Холодная чаша'],
  rock: ['Чёрные рёбра', 'Ломаный бастион', 'Глухая стена', 'Красная рампа', 'Каменный нож', 'Северный щит'],
  upper: ['Ветровое плечо', 'Последняя кромка', 'Высокая седловина', 'Белый купол', 'Ложная вершина', 'Открытый гребень'],
};

const EPITHETS: Record<MountainCharacterId, string[]> = {
  WEATHER: ['Стена ветров', 'Белая мгла', 'Короткое окно'],
  TECHNICAL: ['Чёрный лёд', 'Ломаный бастион', 'Каменный ключ'],
  ENDURANCE: ['Последний гребень', 'Долгая линия', 'Дальний купол'],
  ALTITUDE: ['Граница воздуха', 'Высокая тишина', 'Белый предел'],
  DESCENT: ['Обратная сторона', 'Цена вершины', 'Путь вниз'],
};

const DANGER_LABELS: Record<MountainCharacterId, string[]> = {
  WEATHER: ['ураганный ветер, белая мгла и резкое закрытие окна', 'обледенение, порывы и потеря ориентиров'],
  TECHNICAL: ['разрушенная порода, крутой лёд и сложные станции', 'смешанные стены, камнепад и ограниченный отход'],
  ENDURANCE: ['длинные переходы, истощение запасов и поздний спуск', 'растянутый маршрут, холодные ночёвки и потеря темпа'],
  ALTITUDE: ['высотная болезнь, обезвоживание и медленное восстановление', 'длительная работа выше лагерей и недостаточная акклиматизация'],
  DESCENT: ['неочевидный спуск, обледенение и ошибки после вершины', 'сложная навигация вниз и перегруженные станции'],
};

function uniquePicks(rng: ReturnType<typeof createRng>, pools: string[][], count: number) {
  const result: string[] = [];
  const available = pools.flat();
  while (result.length < count && available.length) {
    const picked = rng.pick(available);
    if (!result.includes(picked)) result.push(picked);
    available.splice(available.indexOf(picked), 1);
  }
  return result;
}

export function generateMountainIdentity(seed: string, index: number, characterId: MountainCharacterId): MountainIdentity {
  const rng = createRng(`${seed}:authored-mountain:${index}:${characterId}`);
  const formId = rng.pick(FORM_OPTIONS[characterId]);
  const camp = rng.pick(CAMP_PATTERNS[formId]);
  const landmarkPools = formId === 'GLACIER_DOME'
    ? [LANDMARK_POOLS.lower, LANDMARK_POOLS.ice, LANDMARK_POOLS.ice, LANDMARK_POOLS.upper]
    : formId === 'ASYMMETRIC_WALL' || formId === 'SHARP_PYRAMID'
      ? [LANDMARK_POOLS.lower, LANDMARK_POOLS.rock, LANDMARK_POOLS.rock, LANDMARK_POOLS.upper]
      : [LANDMARK_POOLS.lower, LANDMARK_POOLS.ice, LANDMARK_POOLS.rock, LANDMARK_POOLS.upper];
  const landmarkNames = uniquePicks(rng, landmarkPools, 4);
  return {
    formId,
    formTitle: FORM_TITLES[formId],
    signatureFeature: rng.pick(SIGNATURES[formId]),
    approachCharacter: rng.pick(APPROACHES[formId]),
    middleCharacter: rng.pick(MIDDLES[characterId]),
    upperCharacter: rng.pick(UPPERS[characterId]),
    campPatternId: camp.campPatternId,
    campPattern: camp.campPattern,
    weatherRule: rng.pick(WEATHER_RULES[characterId]),
    descentProblem: rng.pick(DESCENT_PROBLEMS[characterId]),
    landmarkNames,
    generationSignature: `${formId}:${characterId}:${landmarkNames.join('|')}`,
  };
}

export function authoredMountainLabels(identity: MountainIdentity, characterId: MountainCharacterId) {
  return {
    massifType: identity.formTitle,
    dangerProfile: DANGER_LABELS[characterId][Math.abs(identity.generationSignature.length) % DANGER_LABELS[characterId].length]!,
    epithet: EPITHETS[characterId][Math.abs(identity.generationSignature.length + identity.landmarkNames[0]!.length) % EPITHETS[characterId].length]!,
  };
}

export function authoredMountainSummary(name: string, identity: MountainIdentity, dangerProfile: string) {
  return `${name} — ${identity.formTitle}. Узнаваемая черта: ${identity.signatureFeature}. ${identity.approachCharacter}. Лагеря: ${identity.campPattern}. Главные угрозы: ${dangerProfile}. На обратном пути ${identity.descentProblem}.`;
}

export function authoredMountainHistory(
  seed: string,
  startYear: number,
  elevation: number,
  identity: MountainIdentity,
) {
  const rng = createRng(`${seed}:history:${identity.generationSignature}`);
  const firstYear = startYear - rng.int(54, 91);
  const secondYear = firstYear + rng.int(12, 27);
  const thirdYear = Math.min(startYear - 2, secondYear + rng.int(8, 23));
  const [lower, middle, upper] = identity.landmarkNames;
  return [
    `${firstYear} — разведчики впервые описали ${lower} и подтвердили существование верхнего массива.`,
    `${secondYear} — группа достигла высоты ${rng.int(Math.round(elevation * .58), Math.round(elevation * .84))} м у участка «${middle}», но не нашла безопасной ночёвки.`,
    `${thirdYear} — линия через «${upper}» стала первым известным маршрутом; отчёт отдельно предупреждал, что ${identity.descentProblem}.`,
  ];
}

export function hydrateMountainIdentity(seed: string, index: number, mountain: MountainData): MountainData {
  const identity = mountain.identity ?? generateMountainIdentity(seed, index, mountain.characterId);
  const labels = authoredMountainLabels(identity, mountain.characterId);
  return {
    ...mountain,
    identity,
    massifType: mountain.identity ? mountain.massifType : labels.massifType,
    dangerProfile: mountain.identity ? mountain.dangerProfile : labels.dangerProfile,
    epithet: mountain.identity ? mountain.epithet : labels.epithet,
    summary: mountain.identity ? mountain.summary : authoredMountainSummary(mountain.name, identity, labels.dangerProfile),
  };
}
