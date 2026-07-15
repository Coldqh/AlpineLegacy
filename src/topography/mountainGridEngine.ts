export type GridPoint = { x: number; y: number };
export type EntrySide = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type MountainTerrain = 'VALLEY' | 'SCREE' | 'GLACIER' | 'SNOW' | 'ROCK' | 'RIDGE' | 'SUMMIT';
export type MountainHazard = 'NONE' | 'CREVASSE' | 'AVALANCHE' | 'ROCKFALL' | 'CORNICE';
export type LocalStageType = 'APPROACH' | 'MORAINE' | 'GLACIER' | 'SNOWFIELD' | 'ROCK_FACE' | 'RIDGE' | 'SUMMIT';
export type RouteProfile = 'CLASSIC' | 'GLACIER' | 'RIDGE' | 'DIRECT';
export type LocalRouteProfile = 'SAFE' | 'BALANCED' | 'TECHNICAL' | 'DIRECT';
export type LocalSurface = 'FIRM' | 'LOOSE' | 'SOFT' | 'ICE' | 'ROCK' | 'MIXED';

export type MountainCell = {
  x: number;
  y: number;
  elevation: number;
  slope: number;
  aspect: number;
  terrain: MountainTerrain;
  hazard: MountainHazard;
  passable: boolean;
  campQuality: number;
};

export type MountainGrid = {
  seed: string;
  width: number;
  height: number;
  baseElevation: number;
  summitElevation: number;
  relief: number;
  physicalDiameterKm: number;
  cells: MountainCell[];
  summit: GridPoint;
  entries: Record<EntrySide, GridPoint>;
  start: GridPoint;
};

export type MountainRouteOption = {
  id: string;
  name: string;
  difficulty: number;
  difficultyLabel: string;
  side: EntrySide;
  profile: RouteProfile;
  localProfile: LocalRouteProfile;
  description: string;
  route: GridPoint[];
  distanceKm: number;
  ascentMetres: number;
  descentMetres: number;
  hazardCells: number;
  technicalCells: number;
  maxSlope: number;
  stageCount: number;
};

export type StageDefinition = {
  id: string;
  index: number;
  type: LocalStageType;
  title: string;
  subtitle: string;
  globalPoint: GridPoint;
  startElevation: number;
  endElevation: number;
  exposure: number;
  difficulty: number;
  localMapSize: number;
  routeProfile: RouteProfile | 'CUSTOM';
};

export type LocalCell = {
  x: number;
  y: number;
  elevation: number;
  slope: number;
  aspect: number;
  terrain: MountainTerrain;
  hazard: MountainHazard;
  passable: boolean;
  campPossible: boolean;
  ropeRecommended: boolean;
  surface: LocalSurface;
  stability: number;
  exposure: number;
  anchorQuality: number;
  sunlight: number;
  zone: string;
};

export type LocalStageMap = {
  id: string;
  width: number;
  height: number;
  start: GridPoint;
  goal: GridPoint;
  cells: LocalCell[];
  minElevation: number;
  maxElevation: number;
  stageType: LocalStageType;
};

export type GridWeather = {
  windKmh: number;
  visibility: number;
  snowSoftness: number;
  temperatureC: number;
};

export type LocalRouteMetrics = {
  cells: number;
  minutes: number;
  energy: number;
  ascentMetres: number;
  descentMetres: number;
  hazardCells: number;
  technicalCells: number;
  ropeMetresRecommended: number;
  maxSlope: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const pointKey = (point: GridPoint) => `${point.x}:${point.y}`;

function hash(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function noise(seed: string, x: number, y: number) {
  const h = hash(`${seed}:${x}:${y}`);
  return ((h % 100000) / 50000) - 1;
}

function smoothNoise(seed: string, x: number, y: number) {
  const a = noise(seed, x, y);
  const b = noise(seed, x + 1, y);
  const c = noise(seed, x, y + 1);
  const d = noise(seed, x + 1, y + 1);
  return (a + b + c + d) / 4;
}

function odd(value: number) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded + 1 : rounded;
}

export function mountainGridSizeForRelief(relief: number) {
  return clamp(odd(27 + Math.round(relief / 720) * 2), 29, 49);
}

function mountainDiameterForRelief(relief: number) {
  return round1(clamp(4.6 + relief / 620, 5.5, 18.5));
}

function elevationField(seed: string, x: number, y: number, size: number, base: number, summit: number) {
  const center = (size - 1) / 2;
  const nx = (x - center) / center;
  const ny = (y - center) / center;
  const radius = Math.hypot(nx, ny);
  const radial = clamp(1 - radius, 0, 1);
  const angle = Math.atan2(ny, nx);
  const phase = (hash(seed) % 628) / 100;
  const ridge = Math.max(0, Math.cos(angle * 3 + phase) * 0.13 + Math.cos(angle * 5 - phase * 0.7) * 0.075);
  const shoulder = Math.max(0, 1 - Math.abs(radius - 0.46) * 4.2) * 0.085;
  const valleyCut = Math.max(0, Math.cos(angle * 2 - phase * 0.5)) * Math.max(0, 0.62 - radius) * 0.11;
  const rough = smoothNoise(seed, x, y) * 0.06 + smoothNoise(`${seed}:large`, Math.floor(x / 2), Math.floor(y / 2)) * 0.085;
  const normalized = clamp(Math.pow(radial, 1.46) + ridge * radial + shoulder + rough * radial - valleyCut, 0, 1);
  return Math.round(base + normalized * (summit - base));
}

function terrainFor(elevationRatio: number, slope: number, x: number, y: number, size: number): MountainTerrain {
  const center = (size - 1) / 2;
  const angle = Math.atan2(y - center, x - center);
  if (elevationRatio >= 0.972) return 'SUMMIT';
  if (elevationRatio >= 0.78 && slope >= 35) return 'RIDGE';
  if (slope >= 54) return 'ROCK';
  if (elevationRatio >= 0.57 && Math.cos(angle - 0.7) > -0.22) return 'SNOW';
  if (elevationRatio >= 0.31 && Math.sin(angle + 0.6) < 0.5) return 'GLACIER';
  if (elevationRatio >= 0.16) return 'SCREE';
  return 'VALLEY';
}

function hazardFor(seed: string, terrain: MountainTerrain, slope: number, x: number, y: number): MountainHazard {
  const roll = (noise(`${seed}:hazard`, x, y) + 1) / 2;
  if (terrain === 'GLACIER' && roll > 0.76) return 'CREVASSE';
  if (terrain === 'SNOW' && slope > 34 && roll > 0.72) return 'AVALANCHE';
  if (terrain === 'ROCK' && roll > 0.77) return 'ROCKFALL';
  if (terrain === 'RIDGE' && roll > 0.82) return 'CORNICE';
  return 'NONE';
}

function nearestEdgePoint(side: EntrySide, size: number, seed: string): GridPoint {
  const center = Math.floor(size / 2);
  const offset = clamp(Math.round(noise(`${seed}:${side}:entry`, 0, 0) * size * 0.12), -Math.floor(size * 0.16), Math.floor(size * 0.16));
  if (side === 'NORTH') return { x: clamp(center + offset, 1, size - 2), y: 0 };
  if (side === 'EAST') return { x: size - 1, y: clamp(center + offset, 1, size - 2) };
  if (side === 'SOUTH') return { x: clamp(center + offset, 1, size - 2), y: size - 1 };
  return { x: 0, y: clamp(center + offset, 1, size - 2) };
}

export function generateMountainGrid(seed: string, baseElevation = 620, summitElevation = 3480, sizeOrName?: number | string): MountainGrid {
  const relief = Math.max(500, summitElevation - baseElevation);
  const size = typeof sizeOrName === 'number' ? odd(sizeOrName) : mountainGridSizeForRelief(relief);
  const elevations: number[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) elevations.push(elevationField(seed, x, y, size, baseElevation, summitElevation));
  }

  let summitIndex = 0;
  elevations.forEach((value, index) => { if (value > elevations[summitIndex]!) summitIndex = index; });
  const summit = { x: summitIndex % size, y: Math.floor(summitIndex / size) };
  elevations[summitIndex] = summitElevation;

  const at = (x: number, y: number) => elevations[clamp(y, 0, size - 1) * size + clamp(x, 0, size - 1)]!;
  const cells: MountainCell[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const elevation = at(x, y);
      const dxSigned = at(x + 1, y) - at(x - 1, y);
      const dySigned = at(x, y + 1) - at(x, y - 1);
      const slope = clamp(Math.round(Math.hypot(dxSigned, dySigned) / Math.max(18, relief / 145)), 0, 80);
      const aspect = (Math.atan2(dySigned, dxSigned) * 180 / Math.PI + 360) % 360;
      const ratio = (elevation - baseElevation) / Math.max(1, relief);
      const terrain = (x === summit.x && y === summit.y) ? 'SUMMIT' : terrainFor(ratio, slope, x, y, size);
      const hazard = hazardFor(seed, terrain, slope, x, y);
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const passable = edge || slope < 74;
      const campQuality = passable && hazard === 'NONE' && slope <= 17 && ratio > 0.14 && ratio < 0.84
        ? Math.round(100 - slope * 4 - Math.abs(ratio - 0.48) * 28)
        : 0;
      cells.push({ x, y, elevation, slope, aspect, terrain, hazard, passable, campQuality });
    }
  }

  const entries: Record<EntrySide, GridPoint> = {
    NORTH: nearestEdgePoint('NORTH', size, seed),
    EAST: nearestEdgePoint('EAST', size, seed),
    SOUTH: nearestEdgePoint('SOUTH', size, seed),
    WEST: nearestEdgePoint('WEST', size, seed),
  };
  return {
    seed,
    width: size,
    height: size,
    baseElevation,
    summitElevation,
    relief,
    physicalDiameterKm: mountainDiameterForRelief(relief),
    cells,
    summit,
    entries,
    start: entries.SOUTH,
  };
}

export function cellAt(grid: MountainGrid, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= grid.width || point.y >= grid.height) return null;
  return grid.cells[point.y * grid.width + point.x] ?? null;
}

export function isSamePoint(a: GridPoint, b: GridPoint) { return a.x === b.x && a.y === b.y; }
export function isAdjacent(a: GridPoint, b: GridPoint) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1; }
export function cellCanHostCamp(cell: MountainCell) { return cell.campQuality >= 42 && cell.hazard === 'NONE' && cell.passable; }

function neighbors(grid: MountainGrid, point: GridPoint) {
  const result: GridPoint[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const next = { x: point.x + dx, y: point.y + dy };
      const cell = cellAt(grid, next);
      if (cell?.passable) result.push(next);
    }
  }
  return result;
}

const GLOBAL_PROFILE: Record<RouteProfile, {
  base: number;
  slope: number;
  uphill: number;
  hazard: number;
  heuristic: number;
  prefer: Partial<Record<MountainTerrain, number>>;
}> = {
  CLASSIC: { base: 10, slope: 0.95, uphill: 0.032, hazard: 72, heuristic: 15, prefer: { VALLEY: -2, SCREE: -1, SNOW: 1 } },
  GLACIER: { base: 10, slope: 0.82, uphill: 0.03, hazard: 48, heuristic: 16, prefer: { GLACIER: -6, SCREE: 1, ROCK: 8 } },
  RIDGE: { base: 11, slope: 0.72, uphill: 0.028, hazard: 42, heuristic: 17, prefer: { RIDGE: -8, ROCK: -4, GLACIER: 7 } },
  DIRECT: { base: 8, slope: 0.34, uphill: 0.02, hazard: 12, heuristic: 28, prefer: { ROCK: -2, RIDGE: -2 } },
};

function pathfind(grid: MountainGrid, start: GridPoint, goal: GridPoint, profile: RouteProfile) {
  const cfg = GLOBAL_PROFILE[profile];
  const key = pointKey;
  const open: GridPoint[] = [start];
  const came = new Map<string, GridPoint>();
  const score = new Map<string, number>([[key(start), 0]]);
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => {
      const aScore = score.get(key(a))! + Math.hypot(a.x - goal.x, a.y - goal.y) * cfg.heuristic;
      const bScore = score.get(key(b))! + Math.hypot(b.x - goal.x, b.y - goal.y) * cfg.heuristic;
      return aScore - bScore;
    });
    const current = open.shift()!;
    if (closed.has(key(current))) continue;
    closed.add(key(current));
    if (isSamePoint(current, goal)) {
      const path = [current];
      let cursor = current;
      while (came.has(key(cursor))) {
        cursor = came.get(key(cursor))!;
        path.push(cursor);
      }
      return path.reverse();
    }

    const currentCell = cellAt(grid, current)!;
    for (const next of neighbors(grid, current)) {
      const nextCell = cellAt(grid, next)!;
      const uphill = Math.max(0, nextCell.elevation - currentCell.elevation);
      const hazardPenalty = nextCell.hazard === 'NONE' ? 0 : cfg.hazard;
      const terrainAdjustment = cfg.prefer[nextCell.terrain] ?? 0;
      const diagonal = next.x !== current.x && next.y !== current.y ? 1.35 : 1;
      const tentative = score.get(key(current))!
        + Math.max(2, cfg.base + nextCell.slope * cfg.slope + uphill * cfg.uphill + hazardPenalty + terrainAdjustment) * diagonal;
      if (tentative < (score.get(key(next)) ?? Infinity)) {
        came.set(key(next), current);
        score.set(key(next), tentative);
        if (!open.some(item => isSamePoint(item, next))) open.push(next);
      }
    }
  }
  return [start];
}

export function findGuidedRoute(grid: MountainGrid, side: EntrySide = 'SOUTH', profile: RouteProfile = 'CLASSIC') {
  return pathfind(grid, grid.entries[side], grid.summit, profile);
}

function routeMetrics(grid: MountainGrid, route: GridPoint[]) {
  let distanceKm = 0;
  let ascentMetres = 0;
  let descentMetres = 0;
  let hazardCells = 0;
  let technicalCells = 0;
  let maxSlope = 0;
  const stepKm = grid.physicalDiameterKm / Math.max(1, grid.width - 1);
  for (let index = 1; index < route.length; index += 1) {
    const previous = cellAt(grid, route[index - 1]!)!;
    const current = cellAt(grid, route[index]!)!;
    const diagonal = route[index - 1]!.x !== route[index]!.x && route[index - 1]!.y !== route[index]!.y;
    distanceKm += stepKm * (diagonal ? Math.SQRT2 : 1);
    const vertical = current.elevation - previous.elevation;
    if (vertical >= 0) ascentMetres += vertical;
    else descentMetres += Math.abs(vertical);
    if (current.hazard !== 'NONE') hazardCells += 1;
    if (current.slope >= 42 || current.terrain === 'ROCK' || current.terrain === 'RIDGE') technicalCells += 1;
    maxSlope = Math.max(maxSlope, current.slope);
  }
  return { distanceKm: round1(distanceKm), ascentMetres, descentMetres, hazardCells, technicalCells, maxSlope };
}

export function stageCountForMountain(grid: MountainGrid, route: GridPoint[] = findGuidedRoute(grid)) {
  const byRelief = Math.round(grid.relief / 430) + 4;
  const byDistance = Math.round(route.length / 9) + 4;
  return clamp(Math.max(byRelief, byDistance), 7, 18);
}

const SIDE_ADJECTIVE: Record<EntrySide, string> = {
  NORTH: 'Северный', EAST: 'Восточный', SOUTH: 'Южный', WEST: 'Западный',
};

const DIFFICULTY_LABEL = ['Учебный', 'Умеренный', 'Сложный', 'Тяжёлый', 'Экспертный'];

export function buildMountainRouteOptions(grid: MountainGrid, side: EntrySide): MountainRouteOption[] {
  const reliefBonus = grid.relief >= 6000 ? 1 : grid.relief >= 4300 ? 0.5 : 0;
  const configs: Array<{
    profile: RouteProfile;
    localProfile: LocalRouteProfile;
    name: string;
    baseDifficulty: number;
    description: string;
  }> = [
    {
      profile: 'CLASSIC',
      localProfile: 'SAFE',
      name: `${SIDE_ADJECTIVE[side]} классический путь`,
      baseDifficulty: 2,
      description: 'Больше обходов, хорошие площадки и умеренная техническая работа.',
    },
    {
      profile: 'GLACIER',
      localProfile: 'BALANCED',
      name: `${SIDE_ADJECTIVE[side]} ледниковый маршрут`,
      baseDifficulty: 3,
      description: 'Быстрее набирает высоту через ледник, но требует разведки и верёвки.',
    },
    {
      profile: 'RIDGE',
      localProfile: 'TECHNICAL',
      name: `${SIDE_ADJECTIVE[side]} гребневой траверс`,
      baseDifficulty: 4,
      description: 'Техническая линия по скалам и гребням, устойчивая для возвращения.',
    },
    {
      profile: 'DIRECT',
      localProfile: 'DIRECT',
      name: `${SIDE_ADJECTIVE[side]} директ`,
      baseDifficulty: 5,
      description: 'Короткая линия через самые крутые и открытые участки массива.',
    },
  ];

  return configs.map(config => {
    const route = findGuidedRoute(grid, side, config.profile);
    const metrics = routeMetrics(grid, route);
    const difficulty = clamp(Math.round(config.baseDifficulty + reliefBonus), 1, 5);
    return {
      id: `${grid.seed}:${side}:${config.profile}`,
      name: config.name,
      difficulty,
      difficultyLabel: DIFFICULTY_LABEL[difficulty - 1]!,
      side,
      profile: config.profile,
      localProfile: config.localProfile,
      description: config.description,
      route,
      ...metrics,
      stageCount: stageCountForMountain(grid, route),
    };
  });
}

function stageTypeFor(progress: number, cell: MountainCell): LocalStageType {
  if (progress >= 0.985) return 'SUMMIT';
  if (progress < 0.1) return 'APPROACH';
  if (progress < 0.23) return 'MORAINE';
  if (cell.terrain === 'GLACIER' || progress < 0.46) return 'GLACIER';
  if (cell.terrain === 'SNOW' || progress < 0.65) return 'SNOWFIELD';
  if (cell.terrain === 'ROCK' || progress < 0.83) return 'ROCK_FACE';
  return 'RIDGE';
}

const STAGE_TITLES: Record<LocalStageType, string[]> = {
  APPROACH: ['Подход к массиву', 'Верхняя долина'],
  MORAINE: ['Нижняя морена', 'Разбитая морена', 'Каменистый пояс'],
  GLACIER: ['Язык ледника', 'Ледниковая дуга', 'Разорванный ледник', 'Верхний ледник'],
  SNOWFIELD: ['Нижнее снежное поле', 'Солнечный склон', 'Высотное снежное поле', 'Штурмовой склон'],
  ROCK_FACE: ['Скальный бастион', 'Средняя стена', 'Верхняя стена', 'Предвершинные скалы'],
  RIDGE: ['Выход на гребень', 'Острый гребень', 'Предвершинный гребень'],
  SUMMIT: ['Финальный купол'],
};

export function buildMountainStages(
  grid: MountainGrid,
  side: EntrySide,
  route: GridPoint[] = findGuidedRoute(grid, side),
  routeProfile: RouteProfile | 'CUSTOM' = 'CUSTOM',
): StageDefinition[] {
  const count = stageCountForMountain(grid, route);
  const occurrences = new Map<LocalStageType, number>();
  const stages: StageDefinition[] = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 1 : index / (count - 1);
    const routeIndex = Math.min(route.length - 1, Math.round((route.length - 1) * ratio));
    const previousRatio = index === 0 ? 0 : (index - 1) / (count - 1);
    const previousIndex = Math.min(route.length - 1, Math.round((route.length - 1) * previousRatio));
    const point = route[routeIndex]!;
    const previousPoint = route[previousIndex]!;
    const cell = cellAt(grid, point)!;
    const previousCell = cellAt(grid, previousPoint)!;
    const type = stageTypeFor(ratio, cell);
    const occurrence = occurrences.get(type) ?? 0;
    occurrences.set(type, occurrence + 1);
    const titles = STAGE_TITLES[type];
    const title = titles[Math.min(occurrence, titles.length - 1)]!;
    const exposure = clamp(Math.round(cell.slope * 1.18 + (cell.hazard === 'NONE' ? 0 : 22) + ratio * 15), 0, 100);
    const difficulty = clamp(Math.round(exposure / 24 + ratio * 1.4), 1, 5);
    const localMapSize = clamp(odd(11 + (difficulty >= 4 ? 2 : 0) + (grid.relief >= 5200 && index % 3 === 1 ? 2 : 0)), 11, 15);
    stages.push({
      id: `${grid.seed}:${side}:${routeProfile}:stage:${index + 1}`,
      index,
      type,
      title,
      subtitle: `${previousCell.elevation}–${cell.elevation} м`,
      globalPoint: point,
      startElevation: previousCell.elevation,
      endElevation: cell.elevation,
      exposure,
      difficulty,
      localMapSize,
      routeProfile,
    });
  }
  return stages;
}

function defaultTerrain(type: LocalStageType): MountainTerrain {
  if (type === 'APPROACH') return 'VALLEY';
  if (type === 'MORAINE') return 'SCREE';
  if (type === 'GLACIER') return 'GLACIER';
  if (type === 'SNOWFIELD') return 'SNOW';
  if (type === 'ROCK_FACE') return 'ROCK';
  if (type === 'RIDGE') return 'RIDGE';
  return 'SUMMIT';
}

function surfaceFor(terrain: MountainTerrain, hazard: MountainHazard, rough: number): LocalSurface {
  if (terrain === 'GLACIER') return hazard === 'CREVASSE' ? 'SOFT' : 'ICE';
  if (terrain === 'SNOW' || terrain === 'SUMMIT') return rough > 0.58 ? 'SOFT' : 'FIRM';
  if (terrain === 'SCREE') return 'LOOSE';
  if (terrain === 'ROCK' || terrain === 'RIDGE') return 'ROCK';
  return rough > 0.68 ? 'MIXED' : 'FIRM';
}

function lineX(startX: number, goalX: number, y: number, size: number) {
  const progress = 1 - y / Math.max(1, size - 1);
  return startX + (goalX - startX) * progress;
}

function corridorX(startX: number, goalX: number, y: number, size: number, sideSign: number, amplitude: number) {
  const progress = 1 - y / Math.max(1, size - 1);
  return lineX(startX, goalX, y, size) + sideSign * Math.sin(progress * Math.PI) * amplitude;
}

function localTerrainFor(stage: StageDefinition, x: number, y: number, size: number, safeX: number, techX: number): MountainTerrain {
  const defaultType = defaultTerrain(stage.type);
  const nearSafe = Math.abs(x - safeX) <= 1;
  const nearTech = Math.abs(x - techX) <= 1;
  if (stage.type === 'GLACIER') {
    if (x <= 1 || x >= size - 2 || nearSafe) return 'SCREE';
    return 'GLACIER';
  }
  if (stage.type === 'SNOWFIELD') {
    if (nearSafe) return 'RIDGE';
    if (Math.abs(x - techX) <= 1 && y < size - 2) return 'ROCK';
    return 'SNOW';
  }
  if (stage.type === 'ROCK_FACE') {
    if (nearSafe && y % 3 === 0) return 'SCREE';
    return 'ROCK';
  }
  if (stage.type === 'RIDGE') {
    if (nearSafe) return 'ROCK';
    return 'RIDGE';
  }
  if (stage.type === 'MORAINE') return nearTech ? 'ROCK' : 'SCREE';
  if (stage.type === 'APPROACH') return (x + y) % 5 === 0 ? 'SCREE' : 'VALLEY';
  return defaultType;
}

function hazardForLocal(
  stage: StageDefinition,
  x: number,
  y: number,
  size: number,
  directX: number,
  safeX: number,
  rough: number,
): MountainHazard {
  if (stage.type === 'GLACIER') {
    const bandA = Math.round(size * 0.62 + Math.sin(x * 0.8 + stage.index) * 0.8);
    const bandB = Math.round(size * 0.34 + Math.cos(x * 0.65 - stage.index) * 0.7);
    const bridgeA = Math.abs(x - Math.round(safeX)) <= 1;
    const bridgeB = Math.abs(x - Math.round(safeX + (stage.index % 2 ? 1 : -1))) <= 1;
    if ((Math.abs(y - bandA) <= 0 && !bridgeA) || (Math.abs(y - bandB) <= 0 && !bridgeB)) return 'CREVASSE';
  }
  if (stage.type === 'SNOWFIELD') {
    const gully = directX + Math.sin(y * 0.65 + stage.index) * 0.65;
    if (Math.abs(x - gully) <= 1.15 && y > 1 && y < size - 1) return 'AVALANCHE';
  }
  if (stage.type === 'ROCK_FACE') {
    const chute = directX + Math.sin(y * 0.8) * 0.7;
    if (Math.abs(x - chute) <= 0.9 && y > 1 && y < size - 1) return 'ROCKFALL';
  }
  if (stage.type === 'RIDGE' || stage.type === 'SUMMIT') {
    const ridge = directX + Math.sin(y * 0.45) * 0.45;
    if (x > ridge + 1 && x < ridge + 2.3 && y > 0 && y < size - 1) return 'CORNICE';
  }
  if (stage.type === 'MORAINE' && rough > 0.9 && Math.abs(x - directX) < 1.4) return 'ROCKFALL';
  return 'NONE';
}

export function generateLocalStageMap(stage: StageDefinition, seed: string, explicitSize?: number): LocalStageMap {
  const size = explicitSize ? odd(explicitSize) : stage.localMapSize;
  const center = Math.floor(size / 2);
  const start = {
    x: clamp(center + Math.round(noise(`${seed}:${stage.id}:start`, 0, 0) * 2), 2, size - 3),
    y: size - 1,
  };
  const goal = {
    x: clamp(center + Math.round(noise(`${seed}:${stage.id}:goal`, 0, 0) * 2), 2, size - 3),
    y: 0,
  };
  const sideSign = noise(`${seed}:${stage.id}:side`, 0, 0) >= 0 ? 1 : -1;
  const safeAmplitude = clamp(2.4 + stage.difficulty * 0.35, 2.4, size * 0.34);
  const techAmplitude = clamp(1.25 + stage.difficulty * 0.22, 1.2, size * 0.24);
  const elevations: number[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const progress = 1 - y / Math.max(1, size - 1);
      const directX = lineX(start.x, goal.x, y, size);
      const safeX = corridorX(start.x, goal.x, y, size, sideSign, safeAmplitude);
      const techX = corridorX(start.x, goal.x, y, size, -sideSign, techAmplitude);
      const lateral = (x - center) * (stage.type === 'RIDGE' ? 4.6 : stage.type === 'ROCK_FACE' ? 3.4 : 1.8);
      const gully = -Math.max(0, 38 - Math.abs(x - directX) * 24) * (stage.type === 'SNOWFIELD' || stage.type === 'GLACIER' ? 1 : 0.35);
      const safeBench = Math.max(0, 22 - Math.abs(x - safeX) * 16) * Math.sin(progress * Math.PI * 2.2);
      const wallStep = stage.type === 'ROCK_FACE' && y > size * 0.3 && y < size * 0.68 ? (y < size * 0.5 ? 42 : -22) : 0;
      const rough = smoothNoise(`${seed}:${stage.id}:elevation`, x, y) * 18;
      const elevation = Math.round(stage.startElevation + (stage.endElevation - stage.startElevation) * progress + lateral + gully + safeBench + wallStep + rough);
      elevations.push(elevation);
    }
  }

  const atElevation = (x: number, y: number) => elevations[clamp(y, 0, size - 1) * size + clamp(x, 0, size - 1)]!;
  const cells: LocalCell[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const directX = lineX(start.x, goal.x, y, size);
      const safeX = corridorX(start.x, goal.x, y, size, sideSign, safeAmplitude);
      const techX = corridorX(start.x, goal.x, y, size, -sideSign, techAmplitude);
      const rough = (noise(`${seed}:${stage.id}:rough`, x, y) + 1) / 2;
      const elevation = atElevation(x, y);
      const dx = atElevation(x + 1, y) - atElevation(x - 1, y);
      const dy = atElevation(x, y + 1) - atElevation(x, y - 1);
      const slope = clamp(Math.round(Math.hypot(dx, dy) / Math.max(9, Math.abs(stage.endElevation - stage.startElevation) / 32)), 0, 78);
      const aspect = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const nearSafe = Math.abs(x - safeX) <= 1;
      const nearTech = Math.abs(x - techX) <= 1;
      const nearDirect = Math.abs(x - directX) <= 1;
      const terrain = localTerrainFor(stage, x, y, size, safeX, techX);
      let hazard = hazardForLocal(stage, x, y, size, directX, safeX, rough);
      let passable = true;

      if (stage.type === 'ROCK_FACE') {
        const slab = y > size * 0.2 && y < size * 0.78 && Math.abs(x - center) < size * 0.3;
        passable = !slab || nearSafe || nearTech || nearDirect;
      } else if (stage.type === 'RIDGE') {
        passable = nearSafe || nearTech || nearDirect || Math.abs(x - center) <= 2;
      } else if (stage.type === 'GLACIER') {
        const serac = y > size * 0.42 && y < size * 0.58 && Math.abs(x - center - sideSign * 1.5) < 1.6;
        passable = !serac || nearSafe || nearTech;
      } else if (stage.type === 'SNOWFIELD') {
        const rockIsland = rough > 0.92 && !nearSafe && !nearTech && !nearDirect;
        passable = !rockIsland;
      } else if (stage.type === 'MORAINE') {
        passable = rough > 0.1 || nearSafe || nearTech || nearDirect;
      }

      // The long safe traverse is always physically open, but it is not necessarily the fastest line.
      if (nearSafe) {
        passable = true;
        hazard = 'NONE';
      }
      if (nearTech) passable = true;
      if ((x === start.x && y === start.y) || (x === goal.x && y === goal.y)) {
        passable = true;
        hazard = 'NONE';
      }

      const surface = surfaceFor(terrain, hazard, rough);
      const stabilityBase = surface === 'FIRM' || surface === 'ROCK' ? 82 : surface === 'ICE' ? 68 : surface === 'LOOSE' ? 45 : surface === 'SOFT' ? 34 : 58;
      const stability = clamp(Math.round(stabilityBase - (hazard === 'NONE' ? 0 : 24) - slope * 0.22 + (nearSafe ? 12 : 0)), 5, 100);
      const exposure = clamp(Math.round(slope * 1.05 + (terrain === 'RIDGE' ? 24 : 0) + (hazard === 'NONE' ? 0 : 18)), 0, 100);
      const anchorQuality = clamp(Math.round((terrain === 'ROCK' || terrain === 'RIDGE' ? 78 : terrain === 'GLACIER' ? 58 : 28) + rough * 16 - slope * 0.12), 0, 100);
      const sunlight = clamp(Math.round(50 + Math.cos((aspect - 180) * Math.PI / 180) * 34), 0, 100);
      const campRow = Math.round(size * (stage.index % 2 ? 0.36 : 0.62));
      const campPossible = passable && hazard === 'NONE' && nearSafe && Math.abs(y - campRow) <= 1 && slope <= 25;
      const ropeRecommended = passable && (nearTech || hazard === 'CREVASSE' || slope >= 40 || terrain === 'ROCK' || terrain === 'RIDGE');
      const zone = nearSafe ? 'SAFE_TRAVERSE' : nearTech ? 'TECHNICAL_LINE' : nearDirect ? 'DIRECT_LINE' : 'OPEN_TERRAIN';
      cells.push({
        x,
        y,
        elevation,
        slope,
        aspect,
        terrain,
        hazard,
        passable,
        campPossible,
        ropeRecommended,
        surface,
        stability,
        exposure,
        anchorQuality,
        sunlight,
        zone,
      });
    }
  }

  const minElevation = Math.min(...cells.map(cell => cell.elevation));
  const maxElevation = Math.max(...cells.map(cell => cell.elevation));
  return { id: stage.id, width: size, height: size, start, goal, cells, minElevation, maxElevation, stageType: stage.type };
}

export function localCellAt(map: LocalStageMap, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return null;
  return map.cells[point.y * map.width + point.x] ?? null;
}

function localNeighbors(map: LocalStageMap, point: GridPoint) {
  const result: GridPoint[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const next = { x: point.x + dx, y: point.y + dy };
      if (localCellAt(map, next)?.passable) result.push(next);
    }
  }
  return result;
}

const LOCAL_PROFILE: Record<LocalRouteProfile, {
  hazard: number;
  slope: number;
  instability: number;
  technical: number;
  heuristic: number;
  safeBonus: number;
}> = {
  SAFE: { hazard: 110, slope: 1.25, instability: 0.8, technical: 16, heuristic: 8, safeBonus: -12 },
  BALANCED: { hazard: 62, slope: 0.9, instability: 0.45, technical: 8, heuristic: 14, safeBonus: -5 },
  TECHNICAL: { hazard: 42, slope: 0.66, instability: 0.35, technical: -8, heuristic: 16, safeBonus: 0 },
  DIRECT: { hazard: 12, slope: 0.28, instability: 0.12, technical: 0, heuristic: 30, safeBonus: 0 },
};

export function findLocalGuidedRoute(map: LocalStageMap, profile: LocalRouteProfile = 'SAFE') {
  const cfg = LOCAL_PROFILE[profile];
  const open: GridPoint[] = [map.start];
  const came = new Map<string, GridPoint>();
  const score = new Map<string, number>([[pointKey(map.start), 0]]);
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => {
      const aScore = score.get(pointKey(a))! + Math.hypot(a.x - map.goal.x, a.y - map.goal.y) * cfg.heuristic;
      const bScore = score.get(pointKey(b))! + Math.hypot(b.x - map.goal.x, b.y - map.goal.y) * cfg.heuristic;
      return aScore - bScore;
    });
    const current = open.shift()!;
    if (closed.has(pointKey(current))) continue;
    closed.add(pointKey(current));
    if (isSamePoint(current, map.goal)) {
      const path = [current];
      let cursor = current;
      while (came.has(pointKey(cursor))) {
        cursor = came.get(pointKey(cursor))!;
        path.push(cursor);
      }
      return path.reverse();
    }

    for (const next of localNeighbors(map, current)) {
      const cell = localCellAt(map, next)!;
      const hazardPenalty = cell.hazard === 'NONE' ? 0 : cfg.hazard;
      const technicalAdjustment = cell.ropeRecommended ? cfg.technical : 0;
      const safeAdjustment = cell.zone === 'SAFE_TRAVERSE' ? cfg.safeBonus : 0;
      const diagonal = next.x !== current.x && next.y !== current.y ? 1.3 : 1;
      const tentative = score.get(pointKey(current))!
        + Math.max(2, 10 + cell.slope * cfg.slope + (100 - cell.stability) * cfg.instability + hazardPenalty + technicalAdjustment + safeAdjustment) * diagonal;
      if (tentative < (score.get(pointKey(next)) ?? Infinity)) {
        came.set(pointKey(next), current);
        score.set(pointKey(next), tentative);
        if (!open.some(item => isSamePoint(item, next))) open.push(next);
      }
    }
  }
  return [map.start];
}

export function weatherAtGrid(elapsedMinutes: number): GridWeather {
  const hour = (5.5 + elapsedMinutes / 60) % 24;
  const sun = clamp(Math.sin((hour - 6) / 12 * Math.PI), 0, 1);
  const front = clamp((elapsedMinutes - 360) / 480, 0, 1);
  return {
    windKmh: Math.round(15 + Math.sin(elapsedMinutes / 77) * 7 + front * 30),
    visibility: Math.round(clamp(100 - front * 62, 18, 100)),
    snowSoftness: Math.round(clamp(8 + sun * 65 + elapsedMinutes / 50, 0, 100)),
    temperatureC: Math.round(-10 + sun * 11 - front * 4),
  };
}

export function moveCost(
  grid: MountainGrid,
  from: GridPoint,
  to: GridPoint,
  weather: GridWeather,
  options: { roped: boolean; fixedRope: boolean; leaderEnergy: number },
) {
  const a = cellAt(grid, from)!;
  const b = cellAt(grid, to)!;
  const vertical = Math.abs(b.elevation - a.elevation);
  const terrainFactor: Record<MountainTerrain, number> = { VALLEY: 1, SCREE: 1.3, GLACIER: 1.25, SNOW: 1.35, ROCK: 1.7, RIDGE: 1.45, SUMMIT: 1.1 };
  const weatherFactor = 1 + Math.max(0, 55 - weather.visibility) / 120 + Math.max(0, weather.windKmh - 35) / 140;
  const ropeFactor = options.fixedRope ? 0.72 : options.roped ? 0.92 : 1;
  const fatigueFactor = 1 + Math.max(0, 60 - options.leaderEnergy) / 100;
  const minutes = Math.round((18 + vertical / 8 + b.slope * 0.55) * terrainFactor[b.terrain] * weatherFactor * ropeFactor * fatigueFactor);
  const energy = Math.max(1, Math.round((1.5 + vertical / 85 + b.slope / 24) * terrainFactor[b.terrain] * fatigueFactor));
  return { minutes, energy };
}

export function localMoveCost(
  map: LocalStageMap,
  from: GridPoint,
  to: GridPoint,
  weather: GridWeather,
  options: { fixedRope: boolean; leaderEnergy: number },
) {
  const a = localCellAt(map, from)!;
  const b = localCellAt(map, to)!;
  const vertical = Math.abs(b.elevation - a.elevation);
  const diagonal = from.x !== to.x && from.y !== to.y;
  const terrainFactor: Record<MountainTerrain, number> = { VALLEY: 0.85, SCREE: 1.24, GLACIER: 1.2, SNOW: 1.28, ROCK: 1.55, RIDGE: 1.42, SUMMIT: 1.18 };
  const softSnow = (b.terrain === 'SNOW' || b.terrain === 'SUMMIT') ? Math.max(0, weather.snowSoftness - 38) / 90 : 0;
  const ridgeWind = (b.terrain === 'RIDGE' || b.terrain === 'SUMMIT') ? Math.max(0, weather.windKmh - 30) / 105 : 0;
  const visibility = Math.max(0, 55 - weather.visibility) / 135;
  const fatigue = 1 + Math.max(0, 58 - options.leaderEnergy) / 95;
  const instability = 1 + Math.max(0, 62 - b.stability) / 110;
  const ropeFactor = options.fixedRope ? 0.73 : 1;
  const hazardFactor = b.hazard === 'NONE' ? 1 : 1.25;
  const distanceFactor = diagonal ? 1.18 : 1;
  const minutes = Math.max(5, Math.round((7 + vertical / 10 + b.slope * 0.24) * terrainFactor[b.terrain] * (1 + softSnow + ridgeWind + visibility) * fatigue * instability * ropeFactor * hazardFactor * distanceFactor));
  const energy = Math.max(1, Math.round((1 + vertical / 78 + b.slope / 31) * terrainFactor[b.terrain] * fatigue * instability * (options.fixedRope ? 0.78 : 1)));
  return { minutes, energy };
}

export function evaluateLocalRoute(
  map: LocalStageMap,
  route: GridPoint[],
  weather: GridWeather = weatherAtGrid(0),
  fixedRopes: ReadonlySet<string> = new Set<string>(),
): LocalRouteMetrics {
  let minutes = 0;
  let energy = 0;
  let ascentMetres = 0;
  let descentMetres = 0;
  let hazardCells = 0;
  let technicalCells = 0;
  let ropeMetresRecommended = 0;
  let maxSlope = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = localCellAt(map, route[index - 1]!)!;
    const current = localCellAt(map, route[index]!)!;
    const cost = localMoveCost(map, route[index - 1]!, route[index]!, weather, { fixedRope: fixedRopes.has(pointKey(route[index]!)), leaderEnergy: 85 });
    minutes += cost.minutes;
    energy += cost.energy;
    const vertical = current.elevation - previous.elevation;
    if (vertical >= 0) ascentMetres += vertical;
    else descentMetres += Math.abs(vertical);
    if (current.hazard !== 'NONE') hazardCells += 1;
    if (current.ropeRecommended) technicalCells += 1;
    if (current.ropeRecommended && !fixedRopes.has(pointKey(route[index]!))) ropeMetresRecommended += 20;
    maxSlope = Math.max(maxSlope, current.slope);
  }

  return {
    cells: Math.max(0, route.length - 1),
    minutes,
    energy,
    ascentMetres,
    descentMetres,
    hazardCells,
    technicalCells,
    ropeMetresRecommended,
    maxSlope,
  };
}

export function routeCost(grid: MountainGrid, route: GridPoint[]) {
  let minutes = 0;
  let energy = 0;
  const weather = weatherAtGrid(0);
  for (let index = 1; index < route.length; index += 1) {
    const cost = moveCost(grid, route[index - 1]!, route[index]!, weather, { roped: true, fixedRope: false, leaderEnergy: 90 });
    minutes += cost.minutes;
    energy += cost.energy;
  }
  return { cells: Math.max(0, route.length - 1), minutes, energy };
}
