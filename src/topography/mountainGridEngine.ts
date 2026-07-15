export type GridPoint = { x: number; y: number };
export type EntrySide = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type MountainTerrain = 'VALLEY' | 'SCREE' | 'GLACIER' | 'SNOW' | 'ROCK' | 'RIDGE' | 'SUMMIT';
export type MountainHazard = 'NONE' | 'CREVASSE' | 'AVALANCHE' | 'ROCKFALL' | 'CORNICE';
export type LocalStageType = 'APPROACH' | 'MORAINE' | 'GLACIER' | 'SNOWFIELD' | 'ROCK_FACE' | 'RIDGE' | 'SUMMIT';

export type MountainCell = {
  x: number;
  y: number;
  elevation: number;
  slope: number;
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
  cells: MountainCell[];
  summit: GridPoint;
  entries: Record<EntrySide, GridPoint>;
  start: GridPoint;
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
};

export type LocalCell = {
  x: number;
  y: number;
  elevation: number;
  terrain: MountainTerrain;
  hazard: MountainHazard;
  passable: boolean;
  campPossible: boolean;
  ropeRecommended: boolean;
};

export type LocalStageMap = {
  id: string;
  width: number;
  height: number;
  start: GridPoint;
  goal: GridPoint;
  cells: LocalCell[];
};

export type GridWeather = {
  windKmh: number;
  visibility: number;
  snowSoftness: number;
  temperatureC: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

function elevationField(seed: string, x: number, y: number, size: number, base: number, summit: number) {
  const center = (size - 1) / 2;
  const nx = (x - center) / center;
  const ny = (y - center) / center;
  const radius = Math.hypot(nx, ny);
  const radial = clamp(1 - radius, 0, 1);
  const angle = Math.atan2(ny, nx);
  const ridge = Math.max(0, Math.cos(angle * 3 + hash(seed) % 7) * 0.11 + Math.cos(angle * 5 - 0.8) * 0.07);
  const shoulder = Math.max(0, 1 - Math.abs(radius - 0.45) * 4) * 0.08;
  const rough = smoothNoise(seed, x, y) * 0.055 + smoothNoise(`${seed}:large`, Math.floor(x / 2), Math.floor(y / 2)) * 0.08;
  const normalized = clamp(Math.pow(radial, 1.5) + ridge * radial + shoulder + rough * radial, 0, 1);
  return Math.round(base + normalized * (summit - base));
}

function terrainFor(elevationRatio: number, slope: number, x: number, y: number, size: number): MountainTerrain {
  const center = (size - 1) / 2;
  const angle = Math.atan2(y - center, x - center);
  if (elevationRatio >= 0.965) return 'SUMMIT';
  if (elevationRatio >= 0.79 && slope >= 38) return 'RIDGE';
  if (slope >= 54) return 'ROCK';
  if (elevationRatio >= 0.58 && Math.cos(angle - 0.7) > -0.15) return 'SNOW';
  if (elevationRatio >= 0.35 && Math.sin(angle + 0.6) < 0.45) return 'GLACIER';
  if (elevationRatio >= 0.18) return 'SCREE';
  return 'VALLEY';
}

function hazardFor(seed: string, terrain: MountainTerrain, slope: number, x: number, y: number): MountainHazard {
  const roll = (noise(`${seed}:hazard`, x, y) + 1) / 2;
  if (terrain === 'GLACIER' && roll > 0.7) return 'CREVASSE';
  if (terrain === 'SNOW' && slope > 34 && roll > 0.65) return 'AVALANCHE';
  if (terrain === 'ROCK' && roll > 0.7) return 'ROCKFALL';
  if (terrain === 'RIDGE' && roll > 0.76) return 'CORNICE';
  return 'NONE';
}

function nearestEdgePoint(side: EntrySide, size: number): GridPoint {
  const center = Math.floor(size / 2);
  if (side === 'NORTH') return { x: center, y: 0 };
  if (side === 'EAST') return { x: size - 1, y: center };
  if (side === 'SOUTH') return { x: center, y: size - 1 };
  return { x: 0, y: center };
}

export function generateMountainGrid(seed: string, baseElevation = 620, summitElevation = 3480, sizeOrName: number | string = 33): MountainGrid {
  const size = typeof sizeOrName === 'number' ? sizeOrName : 33;
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
      const dx = Math.abs(at(x + 1, y) - at(x - 1, y));
      const dy = Math.abs(at(x, y + 1) - at(x, y - 1));
      const slope = clamp(Math.round(Math.hypot(dx, dy) / 22), 0, 80);
      const ratio = (elevation - baseElevation) / Math.max(1, summitElevation - baseElevation);
      const terrain = (x === summit.x && y === summit.y) ? 'SUMMIT' : terrainFor(ratio, slope, x, y, size);
      const hazard = hazardFor(seed, terrain, slope, x, y);
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const passable = edge || slope < 73;
      const campQuality = passable && hazard === 'NONE' && slope <= 16 && ratio > 0.16 && ratio < 0.82 ? Math.round(100 - slope * 4 - Math.abs(ratio - 0.48) * 28) : 0;
      cells.push({ x, y, elevation, slope, terrain, hazard, passable, campQuality });
    }
  }

  const entries: Record<EntrySide, GridPoint> = {
    NORTH: nearestEdgePoint('NORTH', size),
    EAST: nearestEdgePoint('EAST', size),
    SOUTH: nearestEdgePoint('SOUTH', size),
    WEST: nearestEdgePoint('WEST', size),
  };
  return { seed, width: size, height: size, baseElevation, summitElevation, cells, summit, entries, start: entries.SOUTH };
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
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (!dx && !dy) continue;
    const next = { x: point.x + dx, y: point.y + dy };
    const cell = cellAt(grid, next);
    if (cell?.passable) result.push(next);
  }
  return result;
}

function pathfind(grid: MountainGrid, start: GridPoint, goal: GridPoint) {
  const key = (p: GridPoint) => `${p.x}:${p.y}`;
  const open: GridPoint[] = [start];
  const came = new Map<string, GridPoint>();
  const score = new Map<string, number>([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => (score.get(key(a))! + Math.hypot(a.x - goal.x, a.y - goal.y) * 18) - (score.get(key(b))! + Math.hypot(b.x - goal.x, b.y - goal.y) * 18));
    const current = open.shift()!;
    if (isSamePoint(current, goal)) {
      const path = [current];
      let cursor = current;
      while (came.has(key(cursor))) { cursor = came.get(key(cursor))!; path.push(cursor); }
      return path.reverse();
    }
    const currentCell = cellAt(grid, current)!;
    for (const next of neighbors(grid, current)) {
      const nextCell = cellAt(grid, next)!;
      const uphill = Math.max(0, nextCell.elevation - currentCell.elevation);
      const hazardPenalty = nextCell.hazard === 'NONE' ? 0 : 35;
      const tentative = score.get(key(current))! + 10 + nextCell.slope * 0.7 + uphill * 0.035 + hazardPenalty;
      if (tentative < (score.get(key(next)) ?? Infinity)) {
        came.set(key(next), current);
        score.set(key(next), tentative);
        if (!open.some(item => isSamePoint(item, next))) open.push(next);
      }
    }
  }
  return [start];
}

export function findGuidedRoute(grid: MountainGrid, side: EntrySide = 'SOUTH') {
  return pathfind(grid, grid.entries[side], grid.summit);
}

export function buildMountainStages(grid: MountainGrid, side: EntrySide): StageDefinition[] {
  const route = findGuidedRoute(grid, side);
  const ratios = [0, 0.16, 0.33, 0.5, 0.68, 0.84, 1];
  const types: LocalStageType[] = ['APPROACH', 'MORAINE', 'GLACIER', 'SNOWFIELD', 'ROCK_FACE', 'RIDGE', 'SUMMIT'];
  const titles = ['Подход к массиву', 'Моренный пояс', 'Ледниковая ступень', 'Снежное поле', 'Скальная стена', 'Верхний гребень', 'Выход на вершину'];
  return ratios.map((ratio, index) => {
    const routeIndex = Math.min(route.length - 1, Math.round((route.length - 1) * ratio));
    const point = route[routeIndex]!;
    const cell = cellAt(grid, point)!;
    const previousRatio = index === 0 ? 0 : ratios[index - 1]!;
    const previousPoint = route[Math.min(route.length - 1, Math.round((route.length - 1) * previousRatio))]!;
    const previousCell = cellAt(grid, previousPoint)!;
    return {
      id: `${grid.seed}:${side}:stage:${index + 1}`,
      index,
      type: types[index]!,
      title: titles[index]!,
      subtitle: `${previousCell.elevation}–${cell.elevation} м`,
      globalPoint: point,
      startElevation: previousCell.elevation,
      endElevation: cell.elevation,
      exposure: clamp(Math.round(cell.slope * 1.25 + (cell.hazard === 'NONE' ? 0 : 20)), 0, 100),
    };
  });
}

function localTerrain(type: LocalStageType): MountainTerrain {
  if (type === 'APPROACH') return 'VALLEY';
  if (type === 'MORAINE') return 'SCREE';
  if (type === 'GLACIER') return 'GLACIER';
  if (type === 'SNOWFIELD') return 'SNOW';
  if (type === 'ROCK_FACE') return 'ROCK';
  if (type === 'RIDGE') return 'RIDGE';
  return 'SUMMIT';
}

export function generateLocalStageMap(stage: StageDefinition, seed: string, size = 11): LocalStageMap {
  const cells: LocalCell[] = [];
  const start = { x: Math.floor(size / 2), y: size - 1 };
  const goal = { x: Math.floor(size / 2), y: 0 };
  const terrain = localTerrain(stage.type);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const progress = 1 - y / Math.max(1, size - 1);
      const elevation = Math.round(stage.startElevation + (stage.endElevation - stage.startElevation) * progress + noise(`${seed}:${stage.id}:e`, x, y) * 18);
      const corridor = Math.abs(x - size / 2 - Math.sin(y * 0.9 + stage.index) * 1.5);
      const rough = (noise(`${seed}:${stage.id}:r`, x, y) + 1) / 2;
      let passable = corridor < 4.8 || rough > 0.2;
      if ((x === start.x && y === start.y) || (x === goal.x && y === goal.y)) passable = true;
      let hazard: MountainHazard = 'NONE';
      if (stage.type === 'GLACIER' && rough > 0.78 && y > 1 && y < size - 1) hazard = 'CREVASSE';
      if (stage.type === 'SNOWFIELD' && rough > 0.82) hazard = 'AVALANCHE';
      if (stage.type === 'ROCK_FACE' && rough > 0.84) hazard = 'ROCKFALL';
      if (stage.type === 'RIDGE' && rough > 0.86) hazard = 'CORNICE';
      const campPossible = passable && hazard === 'NONE' && rough < 0.28 && y > 1 && y < size - 2;
      const ropeRecommended = ['GLACIER', 'ROCK_FACE', 'RIDGE'].includes(stage.type) && (hazard !== 'NONE' || rough > 0.58);
      cells.push({ x, y, elevation, terrain, hazard, passable, campPossible, ropeRecommended });
    }
  }
  return { id: stage.id, width: size, height: size, start, goal, cells };
}

export function localCellAt(map: LocalStageMap, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return null;
  return map.cells[point.y * map.width + point.x] ?? null;
}

export function findLocalGuidedRoute(map: LocalStageMap) {
  const queue: GridPoint[] = [map.start];
  const previous = new Map<string, GridPoint>();
  const seen = new Set<string>([`${map.start.x}:${map.start.y}`]);
  while (queue.length) {
    const current = queue.shift()!;
    if (isSamePoint(current, map.goal)) {
      const path = [current];
      let cursor = current;
      while (previous.has(`${cursor.x}:${cursor.y}`)) { cursor = previous.get(`${cursor.x}:${cursor.y}`)!; path.push(cursor); }
      return path.reverse();
    }
    const options: GridPoint[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const next = { x: current.x + dx, y: current.y + dy };
      const cell = localCellAt(map, next);
      if (cell?.passable) options.push(next);
    }
    options.sort((a, b) => (a.y + Math.abs(a.x - map.goal.x) * 0.3) - (b.y + Math.abs(b.x - map.goal.x) * 0.3));
    for (const next of options) {
      const id = `${next.x}:${next.y}`;
      if (seen.has(id)) continue;
      seen.add(id); previous.set(id, current); queue.push(next);
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

export function moveCost(grid: MountainGrid, from: GridPoint, to: GridPoint, weather: GridWeather, options: { roped: boolean; fixedRope: boolean; leaderEnergy: number }) {
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

export function routeCost(grid: MountainGrid, route: GridPoint[]) {
  let minutes = 0;
  let energy = 0;
  const weather = weatherAtGrid(0);
  for (let index = 1; index < route.length; index += 1) {
    const cost = moveCost(grid, route[index - 1]!, route[index]!, weather, { roped: true, fixedRope: false, leaderEnergy: 90 });
    minutes += cost.minutes; energy += cost.energy;
  }
  return { cells: Math.max(0, route.length - 1), minutes, energy };
}
