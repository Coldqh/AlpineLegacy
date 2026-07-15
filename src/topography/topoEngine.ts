export type TopoPoint = { x: number; y: number };

export type TopoTerrainId = 'VALLEY' | 'SCREE' | 'GLACIER' | 'SNOW' | 'RIDGE' | 'ROCK';

export type TopoTerrainZone = {
  id: string;
  type: TopoTerrainId;
  label: string;
  points: TopoPoint[];
};

export type TopoCrevasse = {
  id: string;
  a: TopoPoint;
  b: TopoPoint;
  hidden: boolean;
};

export type TopoWeather = {
  windKmh: number;
  visibility: number;
  snowSoftness: number;
  temperatureC: number;
};

export const TOPO_MAP_WIDTH = 1000;
export const TOPO_MAP_HEIGHT = 720;
export const TOPO_START: TopoPoint = { x: 92, y: 650 };
export const TOPO_SUMMIT: TopoPoint = { x: 790, y: 92 };
export const TOPO_START_ELEVATION = 820;
export const TOPO_SUMMIT_ELEVATION = 3120;

export const TOPO_TERRAIN_ZONES: TopoTerrainZone[] = [
  {
    id: 'scree-west',
    type: 'SCREE',
    label: 'Западная осыпь',
    points: [
      { x: 88, y: 615 }, { x: 180, y: 490 }, { x: 330, y: 390 }, { x: 430, y: 440 },
      { x: 330, y: 570 }, { x: 190, y: 675 },
    ],
  },
  {
    id: 'glacier-low',
    type: 'GLACIER',
    label: 'Нижний ледник',
    points: [
      { x: 250, y: 635 }, { x: 335, y: 470 }, { x: 500, y: 345 }, { x: 665, y: 330 },
      { x: 605, y: 490 }, { x: 460, y: 620 },
    ],
  },
  {
    id: 'snow-bowl',
    type: 'SNOW',
    label: 'Снежная чаша',
    points: [
      { x: 455, y: 400 }, { x: 600, y: 260 }, { x: 770, y: 190 }, { x: 875, y: 265 },
      { x: 770, y: 405 }, { x: 615, y: 470 },
    ],
  },
  {
    id: 'east-rock',
    type: 'ROCK',
    label: 'Восточные скалы',
    points: [
      { x: 680, y: 565 }, { x: 755, y: 385 }, { x: 900, y: 260 }, { x: 958, y: 365 },
      { x: 900, y: 555 }, { x: 790, y: 650 },
    ],
  },
  {
    id: 'summit-ridge',
    type: 'RIDGE',
    label: 'Северный гребень',
    points: [
      { x: 592, y: 310 }, { x: 655, y: 220 }, { x: 742, y: 124 }, { x: 798, y: 68 },
      { x: 846, y: 112 }, { x: 750, y: 236 }, { x: 665, y: 340 },
    ],
  },
];

export const TOPO_CREVASSES: TopoCrevasse[] = [
  { id: 'cr-visible-1', a: { x: 330, y: 560 }, b: { x: 420, y: 515 }, hidden: false },
  { id: 'cr-visible-2', a: { x: 455, y: 470 }, b: { x: 535, y: 415 }, hidden: false },
  { id: 'cr-hidden-1', a: { x: 380, y: 515 }, b: { x: 470, y: 455 }, hidden: true },
  { id: 'cr-hidden-2', a: { x: 515, y: 410 }, b: { x: 605, y: 372 }, hidden: true },
  { id: 'cr-hidden-3', a: { x: 570, y: 382 }, b: { x: 650, y: 345 }, hidden: true },
];

export const TOPO_CAMP_SITES = [
  { id: 'camp-low', x: 285, y: 505, radius: 52, label: 'Нижняя терраса' },
  { id: 'camp-high', x: 630, y: 300, radius: 46, label: 'Плечо гребня' },
] as const;

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: TopoPoint, b: TopoPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInPolygon(point: TopoPoint, polygon: TopoPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 0.0001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function terrainAt(point: TopoPoint): TopoTerrainId {
  const zone = [...TOPO_TERRAIN_ZONES].reverse().find(item => pointInPolygon(point, item.points));
  return zone?.type ?? 'VALLEY';
}

/**
 * Synthetic topographic field for the prototype. Y is the main altitude axis,
 * while the summit/ridge terms make traverses and side approaches meaningful.
 */
export function elevationAt(point: TopoPoint) {
  const vertical = (TOPO_MAP_HEIGHT - point.y) / (TOPO_MAP_HEIGHT - TOPO_SUMMIT.y);
  const summitDistance = distance(point, TOPO_SUMMIT);
  const summitLift = Math.max(0, 1 - summitDistance / 520) * 170;
  const ridgeLift = Math.max(0, 1 - Math.abs(point.x - (720 - point.y * 0.08)) / 260) * 90;
  return Math.round(clamp(TOPO_START_ELEVATION + vertical * 2150 + summitLift + ridgeLift, TOPO_START_ELEVATION, TOPO_SUMMIT_ELEVATION));
}

export function polylineLength(points: TopoPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1]!, points[i]!);
  return total;
}


export function polylinePrefix(points: TopoPoint[], travelled: number) {
  if (!points.length) return [];
  if (points.length === 1) return [points[0]!];
  const result: TopoPoint[] = [points[0]!];
  let remaining = Math.max(0, travelled);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = distance(a, b);
    if (remaining >= length) {
      result.push(b);
      remaining -= length;
      continue;
    }
    const t = length <= 0 ? 0 : remaining / length;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    break;
  }
  return result;
}
export function pointAtDistance(points: TopoPoint[], travelled: number) {
  if (!points.length) return TOPO_START;
  if (points.length === 1) return points[0]!;
  let remaining = Math.max(0, travelled);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = distance(a, b);
    if (remaining <= length) {
      const t = length <= 0 ? 0 : remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return points[points.length - 1]!;
}

export function routeGrade(a: TopoPoint, b: TopoPoint) {
  const horizontal = Math.max(1, distance(a, b) * 8.2);
  return Math.abs(elevationAt(b) - elevationAt(a)) / horizontal;
}

export function pathElevationGain(points: TopoPoint[]) {
  let gain = 0;
  for (let i = 1; i < points.length; i += 1) {
    const delta = elevationAt(points[i]!) - elevationAt(points[i - 1]!);
    if (delta > 0) gain += delta;
  }
  return Math.round(gain);
}

function orientation(a: TopoPoint, b: TopoPoint, c: TopoPoint) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

export function segmentsIntersect(a: TopoPoint, b: TopoPoint, c: TopoPoint, d: TopoPoint) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

export function routeCrossesCrevasse(points: TopoPoint[], crevasse: TopoCrevasse) {
  for (let i = 1; i < points.length; i += 1) {
    if (segmentsIntersect(points[i - 1]!, points[i]!, crevasse.a, crevasse.b)) return true;
  }
  return false;
}

export function nearestRoutePointDistance(point: TopoPoint, route: TopoPoint[]) {
  if (!route.length) return Infinity;
  return Math.min(...route.map(item => distance(point, item)));
}

export function canPlaceCamp(point: TopoPoint) {
  return TOPO_CAMP_SITES.some(site => distance(point, site) <= site.radius);
}

export function weatherAt(elapsedMinutes: number): TopoWeather {
  const hour = (5.5 + elapsedMinutes / 60) % 24;
  const daylight = clamp(Math.sin((hour - 6) / 12 * Math.PI), 0, 1);
  const front = clamp((elapsedMinutes - 420) / 360, 0, 1);
  const windKmh = Math.round(17 + Math.sin(elapsedMinutes / 73) * 8 + front * 27);
  const visibility = Math.round(clamp(96 - front * 58 - Math.max(0, windKmh - 34) * 0.7, 18, 100));
  const snowSoftness = Math.round(clamp(daylight * 70 + elapsedMinutes / 36, 4, 100));
  const temperatureC = Math.round(-9 + daylight * 10 - front * 5);
  return { windKmh, visibility, snowSoftness, temperatureC };
}

export function movementFactor(point: TopoPoint, next: TopoPoint, weather: TopoWeather, hasFixedRope: boolean) {
  const terrain = terrainAt(point);
  const terrainFactor: Record<TopoTerrainId, number> = {
    VALLEY: 1,
    SCREE: 0.68,
    GLACIER: 0.78,
    SNOW: clamp(0.9 - weather.snowSoftness / 210, 0.42, 0.86),
    RIDGE: clamp(0.88 - Math.max(0, weather.windKmh - 24) / 90, 0.42, 0.88),
    ROCK: hasFixedRope ? 0.78 : 0.53,
  };
  const grade = routeGrade(point, next);
  const gradeFactor = clamp(1.12 - Math.max(0, grade - 0.12) * 1.22, 0.26, 1.08);
  const visibilityFactor = clamp(0.72 + weather.visibility / 360, 0.72, 1);
  return terrainFactor[terrain] * gradeFactor * visibilityFactor;
}

export function estimateRoute(points: TopoPoint[], elapsedMinutes = 0) {
  if (points.length < 2) return { distance: 0, gain: 0, minutes: 0, maxGrade: 0, crossedCrevasses: [] as string[] };
  const weather = weatherAt(elapsedMinutes);
  let minutes = 0;
  let maxGrade = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = distance(a, b);
    const grade = routeGrade(a, b);
    maxGrade = Math.max(maxGrade, grade);
    const factor = movementFactor(a, b, weather, false);
    minutes += length / Math.max(0.1, factor * 1.1);
  }
  return {
    distance: Math.round(polylineLength(points) * 3.2),
    gain: pathElevationGain(points),
    minutes: Math.round(minutes),
    maxGrade,
    crossedCrevasses: TOPO_CREVASSES.filter(crevasse => routeCrossesCrevasse(points, crevasse)).map(item => item.id),
  };
}

export function formatClock(elapsedMinutes: number) {
  const total = Math.round(5 * 60 + 30 + elapsedMinutes);
  const day = Math.floor(total / 1440) + 1;
  const hour = Math.floor((total % 1440) / 60);
  const minute = total % 60;
  return `Д${day} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function routeToPath(points: TopoPoint[]) {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

export function decimateRoute(points: TopoPoint[], minimumDistance = 8) {
  if (points.length <= 2) return points;
  const result = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (distance(result[result.length - 1]!, points[i]!) >= minimumDistance) result.push(points[i]!);
  }
  result.push(points[points.length - 1]!);
  return result;
}
