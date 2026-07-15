import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cellAt,
  cellCanHostCamp,
  findGuidedRoute,
  generateMountainGrid,
  gridNeighbours,
  hazardLabels,
  isAdjacent,
  isSamePoint,
  moveCost,
  pointLabel,
  routeCost,
  routeIndexOf,
  slopeLabel,
  terrainLabels,
  weatherAtGrid,
  type GridPoint,
  type MountainGrid,
  type MountainGridCell,
} from './mountainGridEngine';

type Authority = 'COMMAND' | 'PARTICIPANT' | 'SPECIALIST';
type ViewMode = 'MODEL' | 'MAP';
type Phase = 'ASCENT' | 'DESCENT' | 'COMPLETE';
type MapTool = 'ROUTE' | 'INSPECT' | 'SCOUT';
type TimeScale = 1 | 3 | 6;

type Participant = {
  id: string;
  name: string;
  specialty: string;
  energy: number;
  condition: number;
};

type SimulationState = {
  phase: Phase;
  paused: boolean;
  timeScale: TimeScale;
  elapsedMinutes: number;
  current: GridPoint;
  route: GridPoint[];
  trail: GridPoint[];
  segmentProgress: number;
  participants: Participant[];
  roped: boolean;
  ropeSpacing: 10 | 15 | 20;
  ropeMetres: number;
  fixedRopeCellIds: string[];
  campCellIds: string[];
  revealedHazardCellIds: string[];
  summitReached: boolean;
  message: string;
};

type Props = {
  onExit: () => void;
  authority?: Authority;
  seed?: string;
  mountainName?: string;
  startElevation?: number;
  summitElevation?: number;
  allowRegenerate?: boolean;
};

const initialParticipants: Participant[] = [
  { id: 'ilya', name: 'Илья Морен', specialty: 'Ледовик', energy: 100, condition: 100 },
  { id: 'nora', name: 'Нора Вальд', specialty: 'Навигатор', energy: 100, condition: 100 },
  { id: 'tomas', name: 'Томас Рейн', specialty: 'Поддержка', energy: 100, condition: 100 },
];

const terrainColor: Record<MountainGridCell['terrain'], string> = {
  APPROACH: '#7e8c74',
  SCREE: '#8c7f6e',
  GLACIER: '#9cc7d1',
  SNOW: '#d8e1de',
  RIDGE: '#c9c4b8',
  ROCK: '#625e59',
};

function formatTime(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);
  if (days > 0) return `${days} д ${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч ${mins} мин`;
  return `${mins} мин`;
}

function clock(minutes: number) {
  const total = 330 + minutes;
  const day = Math.floor(total / 1440) + 1;
  const value = total % 1440;
  return `День ${day} · ${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function statusLabel(value: number) {
  if (value >= 75) return 'свежий';
  if (value >= 50) return 'рабочий';
  if (value >= 28) return 'устал';
  return 'на пределе';
}

function cellId(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

function cellClass(cell: MountainGridCell, selected: boolean, current: boolean, route: boolean, travelled: boolean, camp: boolean, fixedRope: boolean, revealed: boolean) {
  const classes = ['mg-cell', `terrain-${cell.terrain.toLowerCase()}`];
  if (!cell.passable) classes.push('is-blocked');
  if (selected) classes.push('is-selected');
  if (current) classes.push('is-current');
  if (route) classes.push('is-route');
  if (travelled) classes.push('is-travelled');
  if (camp) classes.push('has-camp');
  if (fixedRope) classes.push('has-rope');
  if (revealed && cell.hazard !== 'NONE') classes.push('has-hazard');
  return classes.join(' ');
}

function MountainModelCanvas({
  grid,
  route,
  trail,
  current,
  camps,
  fixedRopes,
}: {
  grid: MountainGrid;
  route: GridPoint[];
  trail: GridPoint[];
  current: GridPoint;
  camps: string[];
  fixedRopes: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [camera, setCamera] = useState({ yaw: -0.72, pitch: 0.72, zoom: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(rect.width, rect.height);
    };

    const project = (x: number, y: number, elevation: number, width: number, height: number) => {
      const centre = (grid.size - 1) / 2;
      const px = (x - centre) * 20;
      const pz = (y - centre) * 20;
      const py = (elevation - grid.startElevation) / Math.max(1, grid.summitElevation - grid.startElevation) * 270;
      const cos = Math.cos(camera.yaw);
      const sin = Math.sin(camera.yaw);
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      const pitchCos = Math.cos(camera.pitch);
      const pitchSin = Math.sin(camera.pitch);
      const ry = py * pitchCos - rz * pitchSin;
      const depth = py * pitchSin + rz * pitchCos;
      const perspective = 1 / Math.max(0.55, 1 + depth / 1050);
      return {
        x: width * 0.5 + rx * camera.zoom * perspective,
        y: height * 0.73 - ry * camera.zoom * perspective,
        depth,
      };
    };

    const draw = (width: number, height: number) => {
      context.clearRect(0, 0, width, height);
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#182326');
      gradient.addColorStop(1, '#d7d3c9');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const quads: Array<{ points: Array<{ x: number; y: number }>; depth: number; cell: MountainGridCell }> = [];
      for (let y = 0; y < grid.size - 1; y += 1) {
        for (let x = 0; x < grid.size - 1; x += 1) {
          const a = cellAt(grid, { x, y })!;
          const b = cellAt(grid, { x: x + 1, y })!;
          const c = cellAt(grid, { x: x + 1, y: y + 1 })!;
          const d = cellAt(grid, { x, y: y + 1 })!;
          const projected = [
            project(a.x, a.y, a.elevation, width, height),
            project(b.x, b.y, b.elevation, width, height),
            project(c.x, c.y, c.elevation, width, height),
            project(d.x, d.y, d.elevation, width, height),
          ];
          quads.push({ points: projected, depth: projected.reduce((sum, point) => sum + point.depth, 0) / 4, cell: a });
        }
      }
      quads.sort((a, b) => b.depth - a.depth);

      for (const quad of quads) {
        context.beginPath();
        context.moveTo(quad.points[0]!.x, quad.points[0]!.y);
        for (const point of quad.points.slice(1)) context.lineTo(point.x, point.y);
        context.closePath();
        const shade = Math.round(quad.cell.normalizedHeight * 26);
        context.fillStyle = terrainColor[quad.cell.terrain];
        context.globalAlpha = quad.cell.passable ? 0.78 + shade / 180 : 0.34;
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = 'rgba(21, 30, 31, .18)';
        context.lineWidth = 0.7;
        context.stroke();
      }

      const drawRoute = (points: GridPoint[], stroke: string, widthValue: number, dash: number[] = []) => {
        if (points.length < 2) return;
        context.save();
        context.beginPath();
        points.forEach((point, index) => {
          const cell = cellAt(grid, point)!;
          const projected = project(point.x, point.y, cell.elevation + 22, width, height);
          if (index === 0) context.moveTo(projected.x, projected.y);
          else context.lineTo(projected.x, projected.y);
        });
        context.strokeStyle = stroke;
        context.lineWidth = widthValue;
        context.setLineDash(dash);
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.stroke();
        context.restore();
      };

      drawRoute(trail, 'rgba(244, 194, 88, .7)', 2.5, [5, 5]);
      drawRoute(route, '#f2ce71', 4);

      const drawMarker = (point: GridPoint, fill: string, radius: number, label?: string) => {
        const cell = cellAt(grid, point)!;
        const projected = project(point.x, point.y, cell.elevation + 30, width, height);
        context.beginPath();
        context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = '#132023';
        context.lineWidth = 2;
        context.stroke();
        if (label) {
          context.fillStyle = '#eef2ec';
          context.font = '700 11px sans-serif';
          context.fillText(label, projected.x + 10, projected.y - 8);
        }
      };

      drawMarker(grid.start, '#d6d3c6', 5, `${grid.startElevation} м`);
      drawMarker(grid.summit, '#f1c862', 7, `${grid.summitElevation} м`);
      camps.forEach(id => {
        const [x, y] = id.split(':').map(Number);
        drawMarker({ x, y }, '#d88e54', 5, 'Лагерь');
      });
      fixedRopes.forEach(id => {
        const [x, y] = id.split(':').map(Number);
        drawMarker({ x, y }, '#75b6c0', 4);
      });
      drawMarker(current, '#f5f1e6', 8, 'Группа');

      context.fillStyle = 'rgba(8, 16, 18, .66)';
      context.fillRect(16, 16, 220, 56);
      context.fillStyle = '#edf0e8';
      context.font = '700 12px sans-serif';
      context.fillText('Вращение: перетащи модель', 30, 39);
      context.font = '11px sans-serif';
      context.fillStyle = '#bdc8c4';
      context.fillText('Колесо / жест: приблизить', 30, 58);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [camera, camps, current, fixedRopes, grid, route, trail]);

  return (
    <canvas
      ref={canvasRef}
      className="mg-model-canvas"
      onPointerDown={event => {
        dragRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!dragRef.current) return;
        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        dragRef.current = { x: event.clientX, y: event.clientY };
        setCamera(value => ({
          ...value,
          yaw: value.yaw + dx * 0.008,
          pitch: Math.max(0.34, Math.min(1.14, value.pitch + dy * 0.006)),
        }));
      }}
      onPointerUp={event => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onWheel={event => {
        event.preventDefault();
        setCamera(value => ({ ...value, zoom: Math.max(0.62, Math.min(1.72, value.zoom - event.deltaY * 0.0012)) }));
      }}
    />
  );
}

function makeInitialState(grid: MountainGrid, authority: Authority): SimulationState {
  const guided = authority !== 'COMMAND' ? findGuidedRoute(grid) : [grid.start];
  const visibleHazards = grid.cells.filter(cell => cell.hazard === 'CREVASSE_VISIBLE').map(cell => cell.id);
  return {
    phase: 'ASCENT',
    paused: true,
    timeScale: 1,
    elapsedMinutes: 0,
    current: grid.start,
    route: guided,
    trail: [grid.start],
    segmentProgress: 0,
    participants: initialParticipants.map(item => ({ ...item })),
    roped: authority !== 'COMMAND',
    ropeSpacing: 15,
    ropeMetres: 120,
    fixedRopeCellIds: [],
    campCellIds: [],
    revealedHazardCellIds: visibleHazards,
    summitReached: false,
    message: authority !== 'COMMAND'
      ? 'Руководитель выдал готовый путь. Ты управляешь связкой, порядком людей и локальной безопасностью.'
      : 'Осмотри 3D-модель, затем открой карту и проложи путь по соседним квадратам.',
  };
}

export function TopoExpeditionPrototype({
  onExit,
  authority = 'COMMAND',
  seed = 'ALPINE-GRID-01',
  mountainName = 'Кайрн-Валь',
  startElevation = 620,
  summitElevation = 3480,
  allowRegenerate = true,
}: Props) {
  const [variant, setVariant] = useState(0);
  const grid = useMemo(
    () => generateMountainGrid(`${seed}:grid:${variant}`, startElevation, summitElevation, mountainName),
    [mountainName, seed, startElevation, summitElevation, variant],
  );
  const [view, setView] = useState<ViewMode>('MODEL');
  const [tool, setTool] = useState<MapTool>('ROUTE');
  const [selected, setSelected] = useState<GridPoint>(grid.start);
  const [mapZoom, setMapZoom] = useState(1);
  const draggingRouteRef = useRef(false);
  const [sim, setSim] = useState<SimulationState>(() => makeInitialState(grid, authority));
  const simRef = useRef(sim);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => { simRef.current = sim; }, [sim]);

  const reset = useCallback((nextGrid = grid) => {
    const state = makeInitialState(nextGrid, authority);
    setSim(state);
    setSelected(nextGrid.start);
    setTool('ROUTE');
    setView('MODEL');
  }, [authority, grid]);

  useEffect(() => {
    reset(grid);
  }, [grid, reset]);

  const weather = weatherAtGrid(sim.elapsedMinutes);
  const currentCell = cellAt(grid, sim.current)!;
  const selectedCell = cellAt(grid, selected)!;
  const nextCell = sim.route.length > 1 ? cellAt(grid, sim.route[1]!) : null;
  const routeSummary = routeCost(grid, sim.route, sim.elapsedMinutes);
  const routeIds = useMemo(() => new Set(sim.route.map(cellId)), [sim.route]);
  const trailIds = useMemo(() => new Set(sim.trail.map(cellId)), [sim.trail]);
  const currentId = cellId(sim.current);
  const atCamp = sim.campCellIds.includes(currentId);
  const canBuildCamp = cellCanHostCamp(currentCell) && !atCamp;
  const canFixRope = (currentCell.terrain === 'ROCK' || currentCell.terrain === 'RIDGE')
    && !sim.fixedRopeCellIds.includes(currentId)
    && sim.ropeMetres >= 20;

  const applyCellArrival = useCallback((state: SimulationState, destination: GridPoint, energyCost: number) => {
    const destinationCell = cellAt(grid, destination)!;
    const liveWeather = weatherAtGrid(state.elapsedMinutes);
    const id = destinationCell.id;
    const leaderLoss = energyCost;
    const participants = state.participants.map((participant, index) => ({
      ...participant,
      energy: Math.max(0, participant.energy - Math.max(1, Math.round(leaderLoss * (index === 0 ? 1 : 0.62)))),
    }));
    let paused = false;
    let message = `${terrainLabels[destinationCell.terrain]} ${pointLabel(destination)} пройден. Набор до ${destinationCell.elevation} м.`;
    let revealed = state.revealedHazardCellIds;
    let current = destination;
    let route = state.route.slice(1);
    let phase = state.phase;
    let summitReached = state.summitReached;
    let trail = [...state.trail, destination];

    if (destinationCell.hazard === 'CREVASSE_HIDDEN' && !revealed.includes(id)) {
      revealed = [...revealed, id];
      paused = true;
      if (state.roped) {
        message = 'Связка обнаружила скрытую трещину и удержала ведущего. Пауза: измени путь или продолжи после проверки.';
        participants[0] = { ...participants[0]!, energy: Math.max(0, participants[0]!.energy - 5) };
      } else {
        message = 'Ведущий провалился в скрытую трещину. Без связки состояние группы ухудшилось.';
        participants[0] = {
          ...participants[0]!,
          energy: Math.max(0, participants[0]!.energy - 14),
          condition: Math.max(0, participants[0]!.condition - 18),
        };
      }
    } else if (destinationCell.hazard === 'AVALANCHE' && liveWeather.snowSoftness >= 72) {
      paused = true;
      message = 'Снег просел под нагрузкой. Склон размягчён солнцем: группа остановлена до изменения пути или похолодания.';
      participants.forEach((participant, index) => {
        participants[index] = { ...participant, energy: Math.max(0, participant.energy - 5) };
      });
    } else if (destinationCell.hazard === 'ROCKFALL' && liveWeather.windKmh >= 42) {
      paused = true;
      message = 'На квадрат сошла каменная осыпь. Нужно переждать или изменить будущий маршрут.';
      participants[0] = { ...participants[0]!, condition: Math.max(0, participants[0]!.condition - 7) };
    }

    if (isSamePoint(destination, grid.summit) && state.phase === 'ASCENT') {
      paused = true;
      phase = 'DESCENT';
      summitReached = true;
      message = authority !== 'COMMAND'
        ? 'Вершина достигнута. Руководитель ведёт группу обратно по подготовленной линии.'
        : 'Вершина достигнута. Теперь проложи спуск до стартовой клетки.';
      route = authority !== 'COMMAND' ? [...trail].reverse() : [grid.summit];
      trail = [...trail];
    } else if (isSamePoint(destination, grid.start) && state.phase === 'DESCENT') {
      paused = true;
      phase = 'COMPLETE';
      route = [grid.start];
      message = 'Группа вернулась к старту. Экспедиция завершена физическим спуском.';
    } else if (route.length <= 1 && phase !== 'COMPLETE') {
      paused = true;
      message = phase === 'ASCENT'
        ? 'Проведённая линия закончилась. Поставь паузу и продолжи маршрут к вершине.'
        : 'Линия спуска закончилась. Продолжи путь к старту.';
    }

    return {
      ...state,
      phase,
      paused,
      elapsedMinutes: state.elapsedMinutes,
      current,
      route: route.length ? route : [current],
      trail,
      segmentProgress: 0,
      participants,
      revealedHazardCellIds: revealed,
      summitReached,
      message,
    };
  }, [authority, grid]);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      const deltaSeconds = Math.min(0.12, (now - previous) / 1000);
      lastFrameRef.current = now;
      const current = simRef.current;
      if (!current.paused && current.phase !== 'COMPLETE' && current.route.length > 1) {
        const next = current.route[1]!;
        const fixedRope = current.fixedRopeCellIds.includes(cellId(next));
        const cost = moveCost(grid, current.current, next, weatherAtGrid(current.elapsedMinutes), {
          roped: current.roped,
          fixedRope,
          leaderEnergy: current.participants[0]!.energy,
        });
        const gameMinutes = deltaSeconds * 3.2 * current.timeScale;
        const progress = current.segmentProgress + gameMinutes / Math.max(1, cost.minutes);
        if (progress >= 1) {
          setSim(state => applyCellArrival(state, next, cost.energy));
        } else {
          setSim(state => ({ ...state, elapsedMinutes: state.elapsedMinutes + gameMinutes, segmentProgress: progress }));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyCellArrival, grid]);

  const appendRoutePoint = (point: GridPoint) => {
    if (authority !== 'COMMAND' || !sim.paused || sim.phase === 'COMPLETE' || tool !== 'ROUTE') return;
    const cell = cellAt(grid, point);
    if (!cell?.passable) {
      setSim(state => ({ ...state, message: 'Этот квадрат непроходим: выбери соседний участок рельефа.' }));
      return;
    }
    setSim(state => {
      const route = state.route.length ? state.route : [state.current];
      const existing = routeIndexOf(route, point);
      if (existing >= 0) return { ...state, route: route.slice(0, existing + 1), segmentProgress: 0, message: 'Будущий маршрут сокращён до выбранной клетки.' };
      const last = route[route.length - 1]!;
      if (!isAdjacent(last, point)) return state;
      return { ...state, route: [...route, point], message: `${pointLabel(point)} добавлен в план. Можно продолжать линию по соседним квадратам.` };
    });
  };

  const handleCell = (point: GridPoint, fromDrag = false) => {
    setSelected(point);
    if (tool === 'ROUTE') {
      if (!fromDrag || draggingRouteRef.current) appendRoutePoint(point);
      return;
    }
    if (tool === 'SCOUT') {
      if (!sim.paused) return;
      const neighbours = [point, ...gridNeighbours(grid, point)];
      const ids = neighbours.map(cellId);
      setSim(state => ({
        ...state,
        elapsedMinutes: state.elapsedMinutes + 35,
        revealedHazardCellIds: [...new Set([...state.revealedHazardCellIds, ...ids])],
        message: `Разведан квадрат ${pointLabel(point)} и соседний рельеф. Потрачено 35 минут.`,
      }));
    }
  };

  const reorder = (index: number, direction: -1 | 1) => {
    if (!sim.paused) return;
    setSim(state => {
      const target = index + direction;
      if (target < 0 || target >= state.participants.length) return state;
      const participants = [...state.participants];
      [participants[index], participants[target]] = [participants[target]!, participants[index]!];
      return { ...state, participants, message: `${participants[0]!.name} теперь идёт первым и прокладывает след.` };
    });
  };

  const toggleMovement = () => {
    setSim(state => {
      if (state.phase === 'COMPLETE') return state;
      if (state.route.length < 2) return { ...state, paused: true, message: 'Сначала добавь хотя бы одну соседнюю клетку маршрута.' };
      return { ...state, paused: !state.paused, message: state.paused ? 'Группа начала движение по запланированным клеткам.' : 'Активная пауза. Маршрут и команды можно изменить.' };
    });
  };

  const buildCamp = () => {
    if (!sim.paused || !canBuildCamp) return;
    setSim(state => ({
      ...state,
      elapsedMinutes: state.elapsedMinutes + 95,
      campCellIds: [...state.campCellIds, currentId],
      participants: state.participants.map(item => ({ ...item, energy: Math.min(100, item.energy + 8) })),
      message: `Лагерь поставлен на ${pointLabel(state.current)}. Площадка остаётся опорной точкой подъёма и спуска.`,
    }));
  };

  const restAtCamp = () => {
    if (!sim.paused || !atCamp) return;
    setSim(state => ({
      ...state,
      elapsedMinutes: state.elapsedMinutes + 360,
      participants: state.participants.map(item => ({ ...item, energy: Math.min(100, item.energy + 54), condition: Math.min(100, item.condition + 4) })),
      message: 'Шесть часов сна восстановили рабочий резерв. Погода продолжала меняться.',
    }));
  };

  const fixRope = () => {
    if (!sim.paused || !canFixRope) return;
    setSim(state => ({
      ...state,
      elapsedMinutes: state.elapsedMinutes + 50,
      ropeMetres: state.ropeMetres - 20,
      fixedRopeCellIds: [...state.fixedRopeCellIds, currentId],
      message: `На ${pointLabel(state.current)} закреплено 20 м верёвки. Повторное прохождение станет быстрее и надёжнее.`,
    }));
  };

  const routeTarget = sim.phase === 'ASCENT' ? grid.summit : grid.start;
  const routeReady = sim.route.length > 1;

  return (
    <main className="mg-shell">
      <header className="mg-header">
        <button className="mg-exit" onClick={onExit}>← Выйти</button>
        <div>
          <span>ALPINE LEGACY · MOUNTAIN GRID 0.7.1</span>
          <h1>{grid.name}</h1>
        </div>
        <div className="mg-header-state">
          <strong>{sim.phase === 'ASCENT' ? 'Подъём' : sim.phase === 'DESCENT' ? 'Спуск' : 'Завершено'}</strong>
          <span>{currentCell.elevation} м · {clock(sim.elapsedMinutes)}</span>
        </div>
      </header>

      <nav className="mg-view-tabs" aria-label="Режим просмотра">
        <button className={view === 'MODEL' ? 'is-active' : ''} onClick={() => setView('MODEL')}>3D-модель</button>
        <button className={view === 'MAP' ? 'is-active' : ''} onClick={() => setView('MAP')}>Карта этапов</button>
      </nav>

      {view === 'MODEL' ? (
        <section className="mg-model-screen">
          <div className="mg-model-stage">
            <MountainModelCanvas
              grid={grid}
              route={sim.route}
              trail={sim.trail}
              current={sim.current}
              camps={sim.campCellIds}
              fixedRopes={sim.fixedRopeCellIds}
            />
            <div className="mg-model-overlay">
              <span>ПРОЦЕДУРНАЯ 3D-МОДЕЛЬ</span>
              <h2>{grid.startElevation} → {grid.summitElevation} м</h2>
              <p>Осмотри форму массива, гребни, ледник и крутые стены. Затем открой квадратную развёртку и задай реальный путь.</p>
              <button onClick={() => setView('MAP')}>Открыть карту этапов →</button>
            </div>
          </div>
          <aside className="mg-model-aside">
            <section>
              <span>КАК ЧИТАТЬ МОДЕЛЬ</span>
              <p>Светлые поверхности — снег и ледник. Тёмные — скалы. Высокий узкий рельеф образует гребни. Проведённый маршрут появляется на модели жёлтой линией.</p>
            </section>
            <section className="mg-terrain-legend">
              {(Object.keys(terrainLabels) as Array<keyof typeof terrainLabels>).map(id => <div key={id}><i style={{ background: terrainColor[id] }} /><span>{terrainLabels[id]}</span></div>)}
            </section>
            {allowRegenerate && (
              <button className="mg-secondary" onClick={() => setVariant(value => value + 1)}>Сгенерировать другую форму</button>
            )}
          </aside>
        </section>
      ) : (
        <section className="mg-map-screen">
          <div className="mg-map-column">
            <div className="mg-map-summary">
              <div><span>Сейчас</span><strong>{pointLabel(sim.current)} · {currentCell.elevation} м</strong></div>
              <div><span>Цель</span><strong>{pointLabel(routeTarget)} · {sim.phase === 'ASCENT' ? grid.summitElevation : grid.startElevation} м</strong></div>
              <div><span>Будущий путь</span><strong>{Math.max(0, sim.route.length - 1)} этапов · {formatTime(routeSummary.minutes)}</strong></div>
              <div><span>Погода</span><strong>{weather.windKmh} км/ч · обзор {weather.visibility}%</strong></div>
            </div>

            <div className="mg-map-toolbar">
              <div className="mg-tools">
                <button className={tool === 'ROUTE' ? 'is-active' : ''} onClick={() => setTool('ROUTE')} disabled={authority !== 'COMMAND' || !sim.paused}>Маршрут</button>
                <button className={tool === 'INSPECT' ? 'is-active' : ''} onClick={() => setTool('INSPECT')}>Осмотр</button>
                <button className={tool === 'SCOUT' ? 'is-active' : ''} onClick={() => setTool('SCOUT')} disabled={!sim.paused}>Разведка</button>
              </div>
              <div className="mg-zoom-controls">
                <button onClick={() => setMapZoom(value => Math.max(0.72, value - 0.1))}>−</button>
                <span>{Math.round(mapZoom * 100)}%</span>
                <button onClick={() => setMapZoom(value => Math.min(1.35, value + 0.1))}>+</button>
              </div>
            </div>

            <div className="mg-grid-viewport">
              <div
                className="mg-grid"
                style={{ '--grid-size': grid.size, '--map-zoom': mapZoom } as React.CSSProperties}
                onPointerLeave={() => { draggingRouteRef.current = false; }}
                onPointerUp={() => { draggingRouteRef.current = false; }}
                onPointerCancel={() => { draggingRouteRef.current = false; }}
              >
                {grid.cells.map(cell => {
                  const point = { x: cell.x, y: cell.y };
                  const id = cell.id;
                  const revealed = sim.revealedHazardCellIds.includes(id) || cell.hazard !== 'CREVASSE_HIDDEN';
                  const route = routeIds.has(id);
                  const travelled = trailIds.has(id);
                  const current = id === currentId;
                  const selectedValue = isSamePoint(selected, point);
                  const camp = sim.campCellIds.includes(id);
                  const fixedRope = sim.fixedRopeCellIds.includes(id);
                  const heightShade = Math.round(cell.normalizedHeight * 30);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={cellClass(cell, selectedValue, current, route, travelled, camp, fixedRope, revealed)}
                      style={{ '--height-shade': `${heightShade}%` } as React.CSSProperties}
                      onPointerDown={event => {
                        event.preventDefault();
                        draggingRouteRef.current = tool === 'ROUTE';
                        handleCell(point);
                      }}
                      onPointerEnter={() => handleCell(point, true)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') handleCell(point); }}
                      aria-label={`${pointLabel(point)}, ${terrainLabels[cell.terrain]}, ${cell.elevation} метров`}
                    >
                      {cell.x % 5 === 0 && cell.y % 5 === 0 && <small>{cell.elevation}</small>}
                      {route && <i className="mg-route-node" />}
                      {current && <b className="mg-group-marker">3</b>}
                      {camp && <b className="mg-camp-marker">▲</b>}
                      {fixedRope && <b className="mg-rope-marker">≋</b>}
                      {revealed && cell.hazard !== 'NONE' && <b className="mg-hazard-marker">!</b>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mg-timebar">
              <button className="mg-play" onClick={toggleMovement} disabled={sim.phase === 'COMPLETE'}>{sim.paused ? '▶ Запустить' : 'Ⅱ Пауза'}</button>
              {[1, 3, 6].map(value => <button key={value} className={sim.timeScale === value ? 'is-active' : ''} onClick={() => setSim(state => ({ ...state, timeScale: value as TimeScale }))}>×{value}</button>)}
              <div className="mg-segment-progress"><span style={{ width: `${Math.round(sim.segmentProgress * 100)}%` }} /></div>
              <strong>{sim.paused ? 'Активная пауза' : nextCell ? `Движение к ${pointLabel(nextCell)}` : 'Нет следующего этапа'}</strong>
            </div>
          </div>

          <aside className="mg-side">
            <section className="mg-message">
              <span>{sim.paused ? 'ПАУЗА' : `ДВИЖЕНИЕ ×${sim.timeScale}`}</span>
              <p>{sim.message}</p>
            </section>

            <section className="mg-panel">
              <div className="mg-panel-head"><span>ВЫБРАННЫЙ КВАДРАТ</span><strong>{pointLabel(selected)}</strong></div>
              <div className="mg-cell-card">
                <strong>{terrainLabels[selectedCell.terrain]}</strong>
                <span>{selectedCell.elevation} м · склон {slopeLabel(selectedCell.slope)}</span>
                <p>{sim.revealedHazardCellIds.includes(selectedCell.id) || selectedCell.hazard !== 'CREVASSE_HIDDEN' ? hazardLabels[selectedCell.hazard] : 'Данных об опасности нет.'}</p>
                <small>{cellCanHostCamp(selectedCell) ? 'Подходит для лагеря.' : 'Площадка для лагеря плохая.'}</small>
              </div>
              {authority === 'COMMAND' && tool === 'ROUTE' && <p className="mg-hint">Зажми и веди по соседним квадратам. Нажатие на уже выбранную клетку обрезает будущий маршрут.</p>}
              {authority !== 'COMMAND' && <p className="mg-hint">Общий путь задан руководителем. Ты управляешь порядком людей, связкой и инфраструктурой на текущей клетке.</p>}
            </section>

            <section className="mg-panel">
              <div className="mg-panel-head"><span>ГРУППА</span><strong>{sim.roped ? `Связка ${sim.ropeSpacing} м` : 'Без связки'}</strong></div>
              <div className="mg-team">
                {sim.participants.map((participant, index) => (
                  <article key={participant.id}>
                    <b>{index + 1}</b>
                    <div><strong>{participant.name}</strong><span>{index === 0 ? 'Ведущий' : participant.specialty} · {statusLabel(participant.energy)}</span></div>
                    <div><button onClick={() => reorder(index, -1)} disabled={!sim.paused || index === 0}>↑</button><button onClick={() => reorder(index, 1)} disabled={!sim.paused || index === sim.participants.length - 1}>↓</button></div>
                  </article>
                ))}
              </div>
              <div className="mg-rope-controls">
                <button className={sim.roped ? 'is-active' : ''} onClick={() => setSim(state => ({ ...state, paused: true, roped: !state.roped, message: state.roped ? 'Связка распущена.' : 'Участники соединены основной верёвкой.' }))}>{sim.roped ? 'Распустить' : 'Создать связку'}</button>
                <select value={sim.ropeSpacing} onChange={event => setSim(state => ({ ...state, ropeSpacing: Number(event.target.value) as 10 | 15 | 20 }))} disabled={!sim.paused || !sim.roped}>
                  <option value={10}>10 м</option><option value={15}>15 м</option><option value={20}>20 м</option>
                </select>
              </div>
            </section>

            <section className="mg-panel">
              <div className="mg-panel-head"><span>ТЕКУЩАЯ КЛЕТКА</span><strong>{terrainLabels[currentCell.terrain]}</strong></div>
              <div className="mg-action-grid">
                <button onClick={buildCamp} disabled={!sim.paused || !canBuildCamp}>Поставить лагерь</button>
                <button onClick={restAtCamp} disabled={!sim.paused || !atCamp}>Отдых 6 часов</button>
                <button onClick={fixRope} disabled={!sim.paused || !canFixRope}>Закрепить 20 м</button>
                <button onClick={() => setTool('SCOUT')} disabled={!sim.paused}>Разведать район</button>
              </div>
              <div className="mg-resource-line"><span>Верёвка</span><strong>{sim.ropeMetres} м</strong><span>Лагеря</span><strong>{sim.campCellIds.length}</strong></div>
            </section>

            <section className="mg-panel mg-goal-panel">
              <div className="mg-panel-head"><span>ЗАДАЧА</span><strong>{sim.phase}</strong></div>
              <p>{sim.phase === 'ASCENT' ? 'Проложить путь к вершине.' : sim.phase === 'DESCENT' ? 'Вернуть всю группу к старту.' : 'Экспедиция закончена.'}</p>
              <button className="mg-secondary" onClick={() => reset(grid)}>Начать заново</button>
              {!routeReady && <small>Движение недоступно, пока нет следующей клетки.</small>}
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}
