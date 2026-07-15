export type GridPoint = { x: number; y: number };

export type MountainTerrain = 'APPROACH' | 'SCREE' | 'GLACIER' | 'SNOW' | 'RIDGE' | 'ROCK';
export type MountainHazard = 'NONE' | 'CREVASSE_VISIBLE' | 'CREVASSE_HIDDEN' | 'AVALANCHE' | 'ROCKFALL';

export type MountainGridCell = {
  id: string;
  x: number;
  y: number;
  elevation: number;
  normalizedHeight: number;
  slope: number;
  terrain: MountainTerrain;
  hazard: MountainHazard;
  passable: boolean;
  campScore: number;
  windExposure: number;
  sunExposure: number;
};

export type MountainGrid = {
  seed: string;
  name: string;
  size: number;
  startElevation: number;
  summitElevation: number;
  start: GridPoint;
  summit: GridPoint;
  cells: MountainGridCell[];
};

export type GridWeather = {
  hour: number;
  windKmh: number;
  visibility: number;
  snowSoftness: number;
  temperatureC: number;
};

export type GridMoveCost = {
  minutes: number;
  energy: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
};

export const MOUNTAIN_GRID_SIZE = 21;

const terrainTime: Record<MountainTerrain, number> = {
  APPROACH: 1,
  SCREE: 1.35,
  GLACIER: 1.22,
  SNOW: 1.28,
  RIDGE: 1.42,
  ROCK: 1.62,
};

const terrainEnergy: Record<MountainTerrain, number> = {
  APPROACH: 1,
  SCREE: 1.32,
  GLACIER: 1.18,
  SNOW: 1.35,
  RIDGE: 1.42,
  ROCK: 1.58,
};

export const terrainLabels: Record<MountainTerrain, string> = {
  APPROACH: 'Подход',
  SCREE: 'Осыпь',
  GLACIER: 'Ледник',
  SNOW: 'Снег',
  RIDGE: 'Гребень',
  ROCK: 'Скалы',
};

export const hazardLabels: Record<MountainHazard, string> = {
  NONE: 'Не выявлена',
  CREVASSE_VISIBLE: 'Открытая трещина',
  CREVASSE_HIDDEN: 'Возможна скрытая трещина',
  AVALANCHE: 'Лавинный склон',
  ROCKFALL: 'Камнепад',
};

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed: string, x = 0, y = 0, salt = 0) {
  let state = hashString(`${seed}:${x}:${y}:${salt}`) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967295;
}

function gaussian(x: number, y: number, cx: number, cy: number, sx: number, sy: number) {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) * 0.5);
}

function rawHeight(seed: string, x: number, y: number, size: number) {
  const nx = x / (size - 1);
  const ny = y / (size - 1);
  const summit = gaussian(nx, ny, 0.77, 0.14, 0.23, 0.19) * 1.12;
  const shoulder = gaussian(nx, ny, 0.56, 0.34, 0.31, 0.25) * 0.58;
  const westRidge = gaussian(nx, ny, 0.34, 0.48, 0.18, 0.36) * 0.26;
  const valley = gaussian(nx, ny, 0.16, 0.88, 0.32, 0.22) * 0.48;
  const ridgeWave = Math.max(0, 1 - Math.abs(nx - (0.36 + (1 - ny) * 0.38)) / 0.15) * (1 - ny) * 0.2;
  const coarse = (random01(seed, Math.floor(x / 2), Math.floor(y / 2), 11) - 0.5) * 0.1;
  const fine = (random01(seed, x, y, 17) - 0.5) * 0.055;
  const edgeFalloff = clamp((1 - Math.abs(nx - 0.56) * 0.54) * (1 - Math.max(0, ny - 0.82) * 1.4), 0.45, 1);
  return Math.max(0, (summit + shoulder + westRidge + ridgeWave - valley + coarse + fine) * edgeFalloff);
}

function pointId(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

function forceCampScore(x: number, y: number) {
  if ((x === 7 && y === 14) || (x === 13 && y === 8)) return 96;
  return 0;
}

export function generateMountainGrid(
  seed = 'ALPINE-GRID-01',
  startElevation = 620,
  summitElevation = 3480,
  name = 'Кайрн-Валь',
  size = MOUNTAIN_GRID_SIZE,
): MountainGrid {
  const start = { x: 2, y: size - 3 };
  const summit = { x: size - 5, y: 2 };
  const raw = Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    return rawHeight(seed, x, y, size);
  });
  const minRaw = Math.min(...raw);
  const maxRaw = Math.max(...raw);
  const normalized = raw.map(value => clamp((value - minRaw) / Math.max(0.001, maxRaw - minRaw)));

  const elevationAtIndex = (x: number, y: number) => {
    const value = normalized[y * size + x] ?? 0;
    return Math.round(startElevation + value * (summitElevation - startElevation));
  };

  const cells = normalized.map((height, index): MountainGridCell => {
    const x = index % size;
    const y = Math.floor(index / size);
    const neighbours = [
      elevationAtIndex(Math.max(0, x - 1), y),
      elevationAtIndex(Math.min(size - 1, x + 1), y),
      elevationAtIndex(x, Math.max(0, y - 1)),
      elevationAtIndex(x, Math.min(size - 1, y + 1)),
    ];
    const elevation = elevationAtIndex(x, y);
    const slope = Math.max(...neighbours.map(value => Math.abs(value - elevation))) / Math.max(1, summitElevation - startElevation) * 8.2;
    const nx = x / (size - 1);
    const ny = y / (size - 1);
    const glacierBand = nx > 0.28 && nx < 0.64 && ny > 0.34 && ny < 0.78 && slope < 0.43;
    const ridgeBand = height > 0.67 && Math.abs(nx - (0.39 + (1 - ny) * 0.39)) < 0.105;
    let terrain: MountainTerrain = 'APPROACH';
    if (ridgeBand) terrain = 'RIDGE';
    else if (slope > 0.47 || (nx > 0.72 && ny > 0.24 && ny < 0.73)) terrain = 'ROCK';
    else if (glacierBand) terrain = 'GLACIER';
    else if (height > 0.5) terrain = 'SNOW';
    else if (height > 0.2 || slope > 0.24) terrain = 'SCREE';

    const campScoreForced = forceCampScore(x, y);
    const flatness = clamp(1 - slope / 0.42);
    const shelter = clamp(1 - nx * 0.38 - Math.max(0, height - 0.7) * 0.45);
    const campScore = campScoreForced || Math.round(flatness * shelter * 82);
    const passable = slope < 0.74 && !(x === 0 || y === 0 || x === size - 1 || y === size - 1);

    let hazard: MountainHazard = 'NONE';
    if (terrain === 'GLACIER') {
      const roll = random01(seed, x, y, 41);
      if (roll > 0.86) hazard = 'CREVASSE_HIDDEN';
      else if (roll > 0.76) hazard = 'CREVASSE_VISIBLE';
    } else if (terrain === 'SNOW' && slope > 0.3 && nx > 0.5) {
      hazard = 'AVALANCHE';
    } else if ((terrain === 'ROCK' || terrain === 'SCREE') && slope > 0.42 && random01(seed, x, y, 73) > 0.78) {
      hazard = 'ROCKFALL';
    }

    return {
      id: `${x}:${y}`,
      x,
      y,
      elevation,
      normalizedHeight: height,
      slope,
      terrain,
      hazard,
      passable,
      campScore,
      windExposure: clamp(height * 0.72 + (terrain === 'RIDGE' ? 0.32 : 0) + nx * 0.1),
      sunExposure: clamp((1 - ny) * 0.62 + nx * 0.28),
    };
  });

  const patchCell = (point: GridPoint, patch: Partial<MountainGridCell>) => {
    const index = point.y * size + point.x;
    cells[index] = { ...cells[index]!, ...patch };
  };
  const backbone: GridPoint[] = [];
  const addLine = (from: GridPoint, to: GridPoint) => {
    let cursor = { ...from };
    if (!backbone.length || !isSamePoint(backbone[backbone.length - 1]!, cursor)) backbone.push({ ...cursor });
    while (!isSamePoint(cursor, to)) {
      if (cursor.x !== to.x) cursor = { x: cursor.x + Math.sign(to.x - cursor.x), y: cursor.y };
      else cursor = { x: cursor.x, y: cursor.y + Math.sign(to.y - cursor.y) };
      backbone.push({ ...cursor });
    }
  };
  const backbonePoints = [start, { x: 7, y: 18 }, { x: 7, y: 14 }, { x: 11, y: 14 }, { x: 11, y: 10 }, { x: 13, y: 10 }, { x: 13, y: 8 }, { x: 16, y: 8 }, summit];
  for (let index = 1; index < backbonePoints.length; index += 1) addLine(backbonePoints[index - 1]!, backbonePoints[index]!);
  for (const point of backbone) {
    const existing = cells[point.y * size + point.x]!;
    patchCell(point, {
      passable: true,
      hazard: existing.hazard === 'CREVASSE_VISIBLE' ? 'CREVASSE_VISIBLE' : 'NONE',
      slope: Math.min(existing.slope, 0.42),
    });
  }

  patchCell(start, { elevation: startElevation, normalizedHeight: 0, terrain: 'APPROACH', passable: true, hazard: 'NONE', campScore: 88, slope: 0.04 });
  patchCell(summit, { elevation: summitElevation, normalizedHeight: 1, terrain: 'RIDGE', passable: true, hazard: 'NONE', campScore: 0 });
  patchCell({ x: 7, y: 14 }, { passable: true, terrain: 'SCREE', hazard: 'NONE', campScore: 96, slope: 0.1 });
  patchCell({ x: 13, y: 8 }, { passable: true, terrain: 'SNOW', hazard: 'NONE', campScore: 96, slope: 0.12 });

  return { seed, name, size, startElevation, summitElevation, start, summit, cells };
}

export function cellAt(grid: MountainGrid, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= grid.size || point.y >= grid.size) return null;
  return grid.cells[point.y * grid.size + point.x] ?? null;
}

export function isSamePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

export function isAdjacent(a: GridPoint, b: GridPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function gridNeighbours(grid: MountainGrid, point: GridPoint) {
  const candidates = [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
  return candidates.filter(candidate => cellAt(grid, candidate)?.passable);
}

export function weatherAtGrid(elapsedMinutes: number): GridWeather {
  const hour = (5.5 + elapsedMinutes / 60) % 24;
  const daylight = clamp(Math.sin((hour - 6) / 12 * Math.PI));
  const front = clamp((elapsedMinutes - 520) / 420);
  const windKmh = Math.round(14 + Math.sin(elapsedMinutes / 81) * 7 + front * 31);
  const visibility = Math.round(clamp(0.98 - front * 0.62 - Math.max(0, windKmh - 38) / 130, 0.18, 1) * 100);
  const snowSoftness = Math.round(clamp(daylight * 0.72 + elapsedMinutes / 1800) * 100);
  const temperatureC = Math.round(-11 + daylight * 12 - front * 5);
  return { hour, windKmh, visibility, snowSoftness, temperatureC };
}

export function moveCost(
  grid: MountainGrid,
  from: GridPoint,
  to: GridPoint,
  weather: GridWeather,
  options: { roped: boolean; fixedRope: boolean; leaderEnergy: number },
): GridMoveCost {
  const a = cellAt(grid, from);
  const b = cellAt(grid, to);
  if (!a || !b || !isAdjacent(from, to)) return { minutes: 9999, energy: 99, severity: 'EXTREME' };
  const gain = b.elevation - a.elevation;
  const vertical = Math.abs(gain);
  const climbFactor = gain > 0 ? 1 + vertical / 190 : 0.82 + vertical / 460;
  const steepFactor = 1 + Math.max(0, b.slope - 0.2) * 1.8;
  const weatherFactor = 1 + Math.max(0, weather.windKmh - 28) / 120 + Math.max(0, 52 - weather.visibility) / 150;
  const snowFactor = b.terrain === 'SNOW' ? 1 + weather.snowSoftness / 210 : 1;
  const ropeFactor = options.fixedRope && (b.terrain === 'ROCK' || b.terrain === 'RIDGE') ? 0.76 : options.roped ? 1.06 : 1;
  const exhaustion = 1 + Math.max(0, 42 - options.leaderEnergy) / 78;
  const minutes = Math.round(11 * terrainTime[b.terrain] * climbFactor * steepFactor * weatherFactor * snowFactor * ropeFactor * exhaustion);
  const energy = Math.max(1, Math.round((1.2 + vertical / 115) * terrainEnergy[b.terrain] * steepFactor * (options.leaderEnergy < 35 ? 1.25 : 1)));
  const danger = b.slope + (b.hazard === 'NONE' ? 0 : 0.24) + Math.max(0, weather.windKmh - 42) / 100 + (options.roped ? -0.08 : 0);
  const severity = danger > 0.85 ? 'EXTREME' : danger > 0.58 ? 'HIGH' : danger > 0.34 ? 'MEDIUM' : 'LOW';
  return { minutes, energy, severity };
}

export function routeCost(grid: MountainGrid, route: GridPoint[], elapsedMinutes = 0) {
  let minutes = 0;
  let energy = 0;
  let hazards = 0;
  for (let index = 1; index < route.length; index += 1) {
    const weather = weatherAtGrid(elapsedMinutes + minutes);
    const cost = moveCost(grid, route[index - 1]!, route[index]!, weather, { roped: true, fixedRope: false, leaderEnergy: 80 });
    minutes += cost.minutes;
    energy += cost.energy;
    const cell = cellAt(grid, route[index]!);
    if (cell?.hazard !== 'NONE') hazards += 1;
  }
  return { minutes, energy, hazards, cells: Math.max(0, route.length - 1) };
}

function pathKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

export function findGuidedRoute(grid: MountainGrid, start = grid.start, target = grid.summit) {
  const open: GridPoint[] = [start];
  const cameFrom = new Map<string, GridPoint>();
  const cost = new Map<string, number>([[pathKey(start), 0]]);
  const heuristic = (point: GridPoint) => Math.abs(point.x - target.x) + Math.abs(point.y - target.y);

  while (open.length) {
    open.sort((a, b) => (cost.get(pathKey(a)) ?? Infinity) + heuristic(a) - ((cost.get(pathKey(b)) ?? Infinity) + heuristic(b)));
    const current = open.shift()!;
    if (isSamePoint(current, target)) {
      const route: GridPoint[] = [current];
      let cursor = current;
      while (!isSamePoint(cursor, start)) {
        const previous = cameFrom.get(pathKey(cursor));
        if (!previous) break;
        route.push(previous);
        cursor = previous;
      }
      return route.reverse();
    }

    for (const next of gridNeighbours(grid, current)) {
      const cell = cellAt(grid, next)!;
      const hazardPenalty = cell.hazard === 'NONE' ? 0 : cell.hazard === 'CREVASSE_VISIBLE' ? 16 : 10;
      const slopePenalty = cell.slope * 12;
      const terrainPenalty = terrainTime[cell.terrain] * 2;
      const nextCost = (cost.get(pathKey(current)) ?? 0) + 1 + hazardPenalty + slopePenalty + terrainPenalty;
      if (nextCost >= (cost.get(pathKey(next)) ?? Infinity)) continue;
      cost.set(pathKey(next), nextCost);
      cameFrom.set(pathKey(next), current);
      if (!open.some(item => isSamePoint(item, next))) open.push(next);
    }
  }
  return [start];
}

export function routeContains(route: GridPoint[], point: GridPoint) {
  return route.some(item => isSamePoint(item, point));
}

export function routeIndexOf(route: GridPoint[], point: GridPoint) {
  return route.findIndex(item => isSamePoint(item, point));
}

export function pointLabel(point: GridPoint) {
  return `${String.fromCharCode(65 + point.x)}${point.y + 1}`;
}

export function slopeLabel(slope: number) {
  if (slope < 0.14) return 'ровно';
  if (slope < 0.28) return 'умеренно';
  if (slope < 0.46) return 'круто';
  return 'очень круто';
}

export function cellCanHostCamp(cell: MountainGridCell | null) {
  return Boolean(cell && cell.passable && cell.campScore >= 90 && cell.hazard === 'NONE');
}

export function compareRouteEfficiency(grid: MountainGrid, first: GridPoint[], second: GridPoint[]) {
  const a = routeCost(grid, first);
  const b = routeCost(grid, second);
  return (a.minutes + a.energy * 5 + a.hazards * 45) - (b.minutes + b.energy * 5 + b.hazards * 45);
}

export function routeToCellIds(route: GridPoint[]) {
  return route.map(pointId);
}
