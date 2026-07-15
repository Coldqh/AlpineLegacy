import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  buildMountainRouteOptions,
  buildMountainStages,
  cellAt,
  evaluateLocalRoute,
  evaluateLocalStepRisk,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
  localCellAt,
  localMoveCost,
  weatherAtGrid,
  type EntrySide,
  type GridPoint,
  type LocalRouteProfile,
  type LocalStageMap,
  type MountainCell,
  type MountainRouteOption,
  type MountainTerrain,
  type StageDefinition,
} from './mountainGridEngine';

type Participant = { id: string; name: string; role: string; energy: number; specialty: string };
type Tool = 'ROUTE' | 'ROPE' | 'CAMP' | 'SCOUT';
type RestMode = 'BREAK' | 'BIVOUAC' | 'SLEEP';
type Authority = 'COMMAND' | 'PARTICIPANT' | 'SPECIALIST';
type StageInfrastructure = { camps: string[]; ropes: string[]; revealed: string[] };

type Props = {
  onExit: () => void;
  authority?: Authority;
  seed?: string;
  mountainName?: string;
  startElevation?: number;
  summitElevation?: number;
  allowRegenerate?: boolean;
};

const SIDE_COPY: Record<EntrySide, string> = {
  NORTH: 'Север', EAST: 'Восток', SOUTH: 'Юг', WEST: 'Запад',
};

const TERRAIN_COPY: Record<MountainTerrain, string> = {
  VALLEY: 'Долина', SCREE: 'Осыпь', GLACIER: 'Ледник', SNOW: 'Снег', ROCK: 'Скалы', RIDGE: 'Гребень', SUMMIT: 'Вершина',
};

const HAZARD_COPY = {
  NONE: 'опасность не замечена',
  CREVASSE: 'трещина',
  AVALANCHE: 'лавинный склон',
  ROCKFALL: 'камнепадный жёлоб',
  CORNICE: 'карниз',
} as const;

const TOOL_HELP: Record<Tool, { title: string; text: string }> = {
  ROUTE: { title: 'Маршрут', text: 'Добавляет соседние клетки в линию. Крутые красные клетки без верёвки могут отбросить группу назад.' },
  SCOUT: { title: 'Разведка', text: 'Тратит 12–20 минут и раскрывает скрытые угрозы, устойчивость снега и качество креплений рядом с группой.' },
  ROPE: { title: 'Верёвка', text: 'Расходует 20 м. Убирает откат на обязательной технической клетке, снижает усталость и остаётся на спуск.' },
  CAMP: { title: 'Лагерь', text: 'Ставится только на зелёной площадке под группой. Открывает бивак и полноценный сон, остаётся на обратном пути.' },
};

const RISK_COPY = { LOW: 'низкий', MEDIUM: 'средний', HIGH: 'высокий', EXTREME: 'предельный' } as const;

function slopeBand(slope: number) {
  if (slope >= 55) return 'стена';
  if (slope >= 45) return 'очень круто';
  if (slope >= 32) return 'круто';
  if (slope >= 20) return 'рабочий склон';
  return 'пологий участок';
}

const TERRAIN_CLASS: Record<MountainTerrain, string> = {
  VALLEY: 'terrain-valley', SCREE: 'terrain-scree', GLACIER: 'terrain-glacier', SNOW: 'terrain-snow', ROCK: 'terrain-rock', RIDGE: 'terrain-ridge', SUMMIT: 'terrain-summit',
};

const initialParticipants: Participant[] = [
  { id: 'p1', name: 'Илья Морен', role: 'Ведущий', energy: 100, specialty: 'Техника' },
  { id: 'p2', name: 'Нора Вальд', role: 'Навигатор', energy: 100, specialty: 'Навигация' },
  { id: 'p3', name: 'Томас Рейн', role: 'Замыкающий', energy: 100, specialty: 'Выносливость' },
];

const EMPTY_INFRA: StageInfrastructure = { camps: [], ropes: [], revealed: [] };

function pointKey(point: GridPoint) { return `${point.x}:${point.y}`; }
function formatMinutes(minutes: number) { return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`; }

function projectCell(cell: MountainCell, grid: ReturnType<typeof generateMountainGrid>, yaw: number, pitch: number, zoom: number) {
  const cx = (grid.width - 1) / 2;
  const cy = (grid.height - 1) / 2;
  const x = (cell.x - cx) / cx;
  const z = (cell.y - cy) / cy;
  const normalizedHeight = (cell.elevation - grid.baseElevation) / Math.max(1, grid.relief);
  const footprintScale = Math.max(0.72, Math.min(1.34, grid.physicalDiameterKm / 9));
  const verticalScale = Math.max(0.62, Math.min(1.58, grid.relief / 2950));
  const fit = Math.max(0.72, Math.min(1, 1 / Math.max(0.96, footprintScale * 0.92, verticalScale * 0.74)));
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const ry = normalizedHeight * 1.42 * verticalScale;
  const py = ry * Math.cos(pitchRad) - rz * Math.sin(pitchRad);
  const depth = ry * Math.sin(pitchRad) + rz * Math.cos(pitchRad);
  return {
    x: 500 + rx * 316 * footprintScale * fit * zoom,
    y: 418 - py * 252 * fit * zoom,
    depth,
  };
}

function terrainBase(terrain: MountainTerrain) {
  if (terrain === 'VALLEY') return [76, 91, 76];
  if (terrain === 'SCREE') return [119, 109, 91];
  if (terrain === 'GLACIER') return [178, 210, 218];
  if (terrain === 'SNOW') return [225, 232, 229];
  if (terrain === 'ROCK') return [76, 73, 68];
  if (terrain === 'RIDGE') return [196, 205, 202];
  return [242, 240, 232];
}

function terrainFill(cell: MountainCell) {
  const [r, g, b] = terrainBase(cell.terrain);
  const light = Math.cos((cell.aspect - 220) * Math.PI / 180) * 0.14 - cell.slope / 520;
  const factor = Math.max(0.62, Math.min(1.18, 1 + light));
  return `rgb(${Math.round(r * factor)} ${Math.round(g * factor)} ${Math.round(b * factor)})`;
}

function routeStroke(route?: MountainRouteOption) {
  if (!route) return '#e26a48';
  if (route.profile === 'CLASSIC') return '#66aa8e';
  if (route.profile === 'GLACIER') return '#70aabe';
  if (route.profile === 'RIDGE') return '#d4a65b';
  return '#e35d43';
}

function MountainViewer({
  grid,
  route,
  routeName,
  selectedRoute,
  stages,
  side,
  currentStage,
}: {
  grid: ReturnType<typeof generateMountainGrid>;
  route: GridPoint[];
  routeName: string;
  selectedRoute?: MountainRouteOption;
  stages: StageDefinition[];
  side: EntrySide;
  currentStage: number;
}) {
  const [yaw, setYaw] = useState(-35);
  const [pitch, setPitch] = useState(38);
  const [zoom, setZoom] = useState(grid.relief >= 6000 ? 0.82 : grid.relief >= 4300 ? 0.9 : 1);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const stride = grid.width <= 35 ? 1 : 2;
  const mesh = useMemo(() => {
    const polygons: Array<{ key: string; points: string; fill: string; depth: number }> = [];
    for (let y = 0; y < grid.height - stride; y += stride) {
      for (let x = 0; x < grid.width - stride; x += stride) {
        const cells = [
          cellAt(grid, { x, y }),
          cellAt(grid, { x: x + stride, y }),
          cellAt(grid, { x: x + stride, y: y + stride }),
          cellAt(grid, { x, y: y + stride }),
        ];
        if (cells.some(cell => !cell)) continue;
        const projected = cells.map(cell => projectCell(cell!, grid, yaw, pitch, zoom));
        polygons.push({
          key: `${x}:${y}`,
          points: projected.map(point => `${point.x},${point.y}`).join(' '),
          fill: terrainFill(cells[0]!),
          depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
        });
      }
    }
    return polygons.sort((a, b) => a.depth - b.depth);
  }, [grid, yaw, pitch, zoom, stride]);

  const summitCell = cellAt(grid, grid.summit)!;
  const summitPoint = projectCell(summitCell, grid, yaw, pitch, zoom);
  const entryCell = cellAt(grid, grid.entries[side])!;
  const entryPoint = projectCell(entryCell, grid, yaw, pitch, zoom);
  const stagePoints = stages.map(stage => ({ stage, projected: projectCell(cellAt(grid, stage.globalPoint)!, grid, yaw, pitch, zoom) }));
  const routePath = route.map(point => {
    const projected = projectCell(cellAt(grid, point)!, grid, yaw, pitch, zoom);
    return `${projected.x},${projected.y}`;
  }).join(' ');

  return (
    <section className="mg-viewer-card">
      <div className="mg-panel-head">
        <div><span>3D МАССИВ</span><strong>{routeName}</strong></div>
        <small>вращение · наклон · масштаб</small>
      </div>
      <div
        className="mg-3d-canvas"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, yaw, pitch };
        }}
        onPointerMove={event => {
          if (!dragRef.current) return;
          const dx = event.clientX - dragRef.current.x;
          const dy = event.clientY - dragRef.current.y;
          setYaw(dragRef.current.yaw + dx * 0.35);
          setPitch(Math.max(-14, Math.min(80, dragRef.current.pitch - dy * 0.28)));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={event => {
          event.preventDefault();
          setZoom(value => Math.max(0.6, Math.min(1.48, value - event.deltaY * 0.001)));
        }}
      >
        <svg viewBox="0 0 1000 700" role="img" aria-label="Интерактивная трёхмерная модель полной горы">
          <defs>
            <filter id="mg-shadow"><feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity=".28" /></filter>
            <linearGradient id="mg-route-glow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".8"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
          </defs>
          <g filter="url(#mg-shadow)">{mesh.map(poly => <polygon key={poly.key} points={poly.points} fill={poly.fill} stroke="rgba(16,22,21,.2)" strokeWidth=".58" />)}</g>
          {route.length > 1 && <polyline points={routePath} fill="none" stroke="rgba(8,12,11,.62)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />}
          {route.length > 1 && <polyline points={routePath} fill="none" stroke={routeStroke(selectedRoute)} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}
          {stagePoints.map(({ stage, projected }) => (
            <g key={stage.id} transform={`translate(${projected.x} ${projected.y})`} className={stage.index === currentStage ? 'mg-3d-stage is-active' : 'mg-3d-stage'}>
              <circle r={stage.index === currentStage ? 8 : 4.5} />
              {stage.index === currentStage && <text x="12" y="4">{stage.index + 1} · {stage.title}</text>}
            </g>
          ))}
          <g transform={`translate(${entryPoint.x} ${entryPoint.y})`} className="mg-entry-marker"><circle r="8"/><text x="12" y="4">СТАРТ · {SIDE_COPY[side]}</text></g>
          <g transform={`translate(${summitPoint.x} ${summitPoint.y})`} className="mg-summit-marker"><path d="M0 -18 L14 10 L-14 10 Z"/><text x="18" y="4">ПИК · {grid.summitElevation} м</text></g>
        </svg>
        <div className="mg-mountain-scale">
          <div><span>ПЕРЕПАД</span><strong>{grid.relief} м</strong></div>
          <div><span>МАССИВ</span><strong>{grid.physicalDiameterKm} км</strong></div>
          <div><span>ДЕТАЛИЗАЦИЯ</span><strong>{grid.width} × {grid.height}</strong></div>
          <div><span>ЭТАПЫ</span><strong>{stages.length}</strong></div>
        </div>
        <div className="mg-camera-readout"><span>{Math.round(yaw)}°</span><span>{Math.round(pitch)}°</span><span>{Math.round(zoom * 100)}%</span></div>
      </div>
      <div className="mg-camera-buttons">
        <button onClick={() => setYaw(value => value - 20)}>←</button>
        <button onClick={() => setYaw(value => value + 20)}>→</button>
        <button onClick={() => setPitch(value => Math.min(80, value + 10))}>Сверху</button>
        <button onClick={() => setPitch(value => Math.max(-14, value - 10))}>Снизу</button>
        <button onClick={() => { setYaw(-35); setPitch(38); setZoom(grid.relief >= 6000 ? 0.82 : grid.relief >= 4300 ? 0.9 : 1); }}>Сброс</button>
      </div>
    </section>
  );
}

function LocalMap({ map, path, positionIndex, tool, camps, ropes, revealed, selectedPoint, started, onCell }: {
  map: LocalStageMap;
  path: GridPoint[];
  positionIndex: number;
  tool: Tool;
  camps: string[];
  ropes: string[];
  revealed: string[];
  selectedPoint: GridPoint;
  started: boolean;
  onCell: (point: GridPoint) => void;
}) {
  const current = path[Math.min(positionIndex, Math.max(0, path.length - 1))] ?? map.start;
  const pathPoints = path.map(point => `${point.x + 0.5},${point.y + 0.5}`).join(' ');
  return (
    <div className="mg-local-map" style={{ '--cols': map.width } as CSSProperties}>
      {map.cells.map(cell => {
        const id = pointKey(cell);
        const inPath = path.some(point => isSamePoint(point, cell));
        const isCurrent = isSamePoint(current, cell);
        const isRevealed = revealed.includes(id) || isCurrent || isSamePoint(map.start, cell);
        const knownHazard = cell.hazard !== 'NONE' && isRevealed;
        const isSelected = isSamePoint(selectedPoint, cell);
        const heightRatio = (cell.elevation - map.minElevation) / Math.max(1, map.maxElevation - map.minElevation);
        const classes = [
          'mg-local-cell',
          TERRAIN_CLASS[cell.terrain],
          `surface-${cell.surface.toLowerCase()}`,
          `zone-${cell.zone.toLowerCase()}`,
          !cell.passable ? 'is-blocked' : '',
          inPath ? 'is-route' : '',
          isCurrent ? 'is-current' : '',
          isSelected ? 'is-selected' : '',
          isRevealed ? 'is-revealed' : 'is-unknown',
          cell.ropeRequired ? 'rope-required' : cell.ropeRecommended ? 'rope-recommended' : '',
          cell.campPossible ? 'camp-candidate' : '',
          isSamePoint(map.start, cell) ? 'is-start' : '',
          isSamePoint(map.goal, cell) ? 'is-goal' : '',
          camps.includes(id) ? 'has-camp' : '',
          ropes.includes(id) ? 'has-rope' : '',
          knownHazard ? `has-hazard hazard-${cell.hazard.toLowerCase()}` : '',
        ].filter(Boolean).join(' ');
        const style = {
          '--height-level': heightRatio.toFixed(3),
          '--slope-angle': `${cell.aspect}deg`,
          '--stability': `${cell.stability}%`,
          '--exposure': `${cell.exposure}%`,
        } as CSSProperties;
        return (
          <button
            key={id}
            className={classes}
            style={style}
            onClick={() => onCell(cell)}
            disabled={!cell.passable || !started}
            title={`${cell.elevation} м · ${TERRAIN_COPY[cell.terrain]} · ${slopeBand(cell.slope)}`}
          >
            <span className="mg-slope-arrow" />
            <span className="mg-cell-height">{cell.elevation}</span>
            {knownHazard && <i>!</i>}
            {!isRevealed && <span className="mg-unknown-mark">?</span>}
            {cell.ropeRequired && <span className="mg-rope-required-mark">R</span>}
            {!cell.ropeRequired && cell.ropeRecommended && <span className="mg-rope-recommended-mark">r</span>}
            {cell.campPossible && <b className="mg-camp-dot" />}
            {camps.includes(id) && <em>▲</em>}
            {ropes.includes(id) && <u>⌁</u>}
          </button>
        );
      })}
      {path.length > 1 && (
        <svg className="mg-local-route-overlay" viewBox={`0 0 ${map.width} ${map.height}`} preserveAspectRatio="none">
          <polyline points={pathPoints} fill="none" stroke="rgba(12,17,16,.72)" strokeWidth=".18" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pathPoints} fill="none" stroke="#e36343" strokeWidth=".09" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className="mg-map-north">N</div>
      <div className="mg-tool-hint">{started ? TOOL_HELP[tool].text : 'Сначала зафиксируй сторону захода и маршрут, затем начни экспедицию.'}</div>
      <div className="mg-map-legend"><span><b className="legend-rope-required">R</b> верёвка обязательна</span><span><b className="legend-rope-recommended">r</b> полезна</span><span><b className="legend-camp" /> лагерь</span><span><b className="legend-unknown">?</b> не разведано</span></div>
    </div>
  );
}

function RouteCard({ option, active, disabled, onClick }: { option: MountainRouteOption; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button className={`mg-route-card ${active ? 'is-active' : ''}`} onClick={onClick} disabled={disabled}>
      <div><span>{option.difficultyLabel}</span><strong>{option.name}</strong></div>
      <p>{option.description}</p>
      <small>{option.distanceKm} км · {option.stageCount} этапов · уклон до {option.maxSlope}°</small>
      <div className="mg-difficulty-dots">{[1, 2, 3, 4, 5].map(value => <i key={value} className={value <= option.difficulty ? 'is-on' : ''} />)}</div>
    </button>
  );
}

function localProfileFor(option?: MountainRouteOption): LocalRouteProfile {
  return option?.localProfile ?? 'SAFE';
}

export function TopoExpeditionPrototype({
  onExit,
  authority = 'COMMAND',
  seed = 'ALPINE-LOCAL-STAGES',
  mountainName = 'Кайрн-Валь',
  startElevation = 620,
  summitElevation = 3480,
  allowRegenerate = true,
}: Props) {
  const [variant, setVariant] = useState(0);
  const participantMode = authority !== 'COMMAND';
  const [entrySide, setEntrySide] = useState<EntrySide>('SOUTH');
  const grid = useMemo(() => generateMountainGrid(`${seed}:v${variant}`, startElevation, summitElevation), [seed, variant, startElevation, summitElevation]);
  const routeOptions = useMemo(() => buildMountainRouteOptions(grid, entrySide), [grid, entrySide]);
  const [routeChoice, setRouteChoice] = useState('MANUAL');
  const selectedRoute = routeOptions.find(option => option.id === routeChoice);
  const globalRoute = selectedRoute?.route ?? routeOptions[0]!.route;
  const routeName = selectedRoute?.name ?? 'Авторская линия по локальным картам';
  const stages = useMemo(
    () => buildMountainStages(grid, entrySide, globalRoute, selectedRoute?.profile ?? 'CUSTOM'),
    [grid, entrySide, globalRoute, selectedRoute?.profile],
  );
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'ASCENT' | 'DESCENT' | 'COMPLETE'>('ASCENT');
  const [stageIndex, setStageIndex] = useState(0);
  const stage = stages[Math.min(stageIndex, stages.length - 1)]!;
  const localMap = useMemo(() => {
    const base = generateLocalStageMap(stage, grid.seed);
    return phase === 'DESCENT' ? { ...base, start: base.goal, goal: base.start } : base;
  }, [stage, grid.seed, phase]);
  const guidedLocalRoute = useMemo(() => findLocalGuidedRoute(localMap, localProfileFor(selectedRoute)), [localMap, selectedRoute]);
  const [path, setPath] = useState<GridPoint[]>([localMap.start]);
  const [completedStagePaths, setCompletedStagePaths] = useState<Record<string, GridPoint[]>>({});
  const [positionIndex, setPositionIndex] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<GridPoint>(localMap.start);
  const [stepAttempts, setStepAttempts] = useState<Record<string, number>>({});
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [tool, setTool] = useState<Tool>('ROUTE');
  const [infrastructure, setInfrastructure] = useState<Record<string, StageInfrastructure>>({});
  const [ropeMetres, setRopeMetres] = useState(140);
  const [campKits, setCampKits] = useState(2);
  const [participants, setParticipants] = useState(initialParticipants);
  const [message, setMessage] = useState('Выбери сторону захода и маршрут, затем открой первый локальный этап.');
  const completed = phase === 'COMPLETE';
  const infra = infrastructure[stage.id] ?? EMPTY_INFRA;
  const canChangePlan = !started;

  useEffect(() => {
    if (participantMode && routeChoice === 'MANUAL') setRouteChoice(routeOptions[0]!.id);
  }, [participantMode, routeChoice, routeOptions]);

  useEffect(() => {
    setStarted(false);
    setPhase('ASCENT');
    setStageIndex(0);
    setElapsedMinutes(0);
    setCompletedStagePaths({});
    setInfrastructure({});
    setRopeMetres(140);
    setCampKits(2);
    setParticipants(initialParticipants);
    setPaused(true);
    setStepAttempts({});
  }, [grid.seed, entrySide, routeChoice]);

  useEffect(() => {
    const previousAscentPath = completedStagePaths[stage.id];
    const initialPath = phase === 'DESCENT' && previousAscentPath
      ? [...previousAscentPath].reverse()
      : participantMode || selectedRoute
        ? guidedLocalRoute
        : [localMap.start];
    setPath(initialPath);
    setPositionIndex(0);
    setSelectedPoint(localMap.start);
    setPaused(true);
    setTool('ROUTE');
    setInfrastructure(current => {
      const previous = current[stage.id] ?? EMPTY_INFRA;
      const startKnown = localMap.cells.filter(cell => Math.max(Math.abs(cell.x - localMap.start.x), Math.abs(cell.y - localMap.start.y)) <= 1).map(pointKey);
      return { ...current, [stage.id]: { ...previous, revealed: [...new Set([...previous.revealed, ...startKnown])] } };
    });
    setMessage(
      phase === 'DESCENT' && previousAscentPath
        ? 'На спуске используется подготовленная линия подъёма. Проверь, что верёвки и проходы сохранились.'
        : participantMode
          ? 'Руководитель выбрал готовую линию. Запусти движение и реагируй на участок.'
          : selectedRoute
            ? 'Готовая линия нанесена. Её можно скорректировать до запуска.'
            : 'Построй собственную линию от старта к выходу этапа.',
    );
  }, [localMap, guidedLocalRoute, participantMode, selectedRoute, phase, stage.id, completedStagePaths]);

  function updateInfra(updater: (value: StageInfrastructure) => StageInfrastructure) {
    setInfrastructure(current => ({ ...current, [stage.id]: updater(current[stage.id] ?? EMPTY_INFRA) }));
  }

  const weather = weatherAtGrid(elapsedMinutes);
  const currentPoint = path[Math.min(positionIndex, Math.max(0, path.length - 1))] ?? localMap.start;
  const currentCell = localCellAt(localMap, currentPoint)!;
  const selectedCell = localCellAt(localMap, selectedPoint) ?? currentCell;
  const selectedId = pointKey(selectedCell);
  const selectedKnown = infra.revealed.includes(selectedId) || isSamePoint(selectedCell, currentCell) || isSamePoint(selectedCell, localMap.start);
  const selectedProtected = infra.ropes.includes(selectedId);
  const selectedRisk = evaluateLocalStepRisk(localMap, currentPoint, selectedCell, weatherAtGrid(elapsedMinutes), { fixedRope: selectedProtected, leaderEnergy: participants[0]?.energy ?? 100 });
  const routeReady = path.length > 1 && isSamePoint(path[path.length - 1]!, localMap.goal);
  const routeMetrics = useMemo(
    () => evaluateLocalRoute(localMap, path, weather, new Set(infra.ropes)),
    [localMap, path, weather, infra.ropes],
  );

  function hazardBlockReason(cell: NonNullable<ReturnType<typeof localCellAt>>, protectedByRope: boolean) {
    if (cell.hazard === 'CREVASSE' && !protectedByRope) return 'Трещина открыта. Нужна закреплённая верёвка или обход.';
    if (cell.hazard === 'AVALANCHE' && weather.snowSoftness >= 54) return 'Снег размягчён. Лавинный склон сейчас закрыт для движения.';
    if (cell.hazard === 'ROCKFALL' && weather.temperatureC >= 0) return 'Прогрев усилил камнепад. Нужен обход или ожидание холода.';
    if (cell.hazard === 'CORNICE') return 'Карниз нельзя пересекать. Перестрой линию ниже гребня.';
    return null;
  }

  useEffect(() => {
    if (!started || paused || completed || path.length < 2 || positionIndex >= path.length - 1) return;
    const delay = Math.max(140, 820 / speed);
    const timer = window.setTimeout(() => {
      const nextIndex = positionIndex + 1;
      const previous = path[nextIndex - 1]!;
      const next = path[nextIndex]!;
      const cell = localCellAt(localMap, next)!;
      const id = pointKey(next);
      const hazardKnown = infra.revealed.includes(id);
      const protectedByRope = infra.ropes.includes(id);

      if (cell.hazard !== 'NONE' && !hazardKnown) {
        setPaused(true);
        updateInfra(value => ({ ...value, revealed: [...new Set([...value.revealed, id])] }));
        setMessage(`Ведущий обнаружил: ${HAZARD_COPY[cell.hazard]}. Оцени клетку и перестрой путь.`);
        return;
      }
      const blocked = hazardBlockReason(cell, protectedByRope);
      if (blocked) {
        setPaused(true);
        setMessage(blocked);
        return;
      }

      const leaderEnergy = participants[0]?.energy ?? 0;
      const attemptKey = `${stage.id}:${id}`;
      const attempt = stepAttempts[attemptKey] ?? 0;
      const stepRisk = evaluateLocalStepRisk(localMap, previous, next, weather, { fixedRope: protectedByRope, leaderEnergy, attempt });
      const cost = localMoveCost(localMap, previous, next, weather, { fixedRope: protectedByRope, leaderEnergy, unprotectedTechnical: cell.ropeRequired && !protectedByRope });
      if (leaderEnergy < cost.energy) {
        setPaused(true);
        setMessage('Ведущий больше не держит темп. Смени ведущего, отдохни в лагере или начни отход.');
        return;
      }

      if (stepRisk.willRollback) {
        const rollbackTo = Math.max(0, positionIndex - stepRisk.rollbackCells);
        setPositionIndex(rollbackTo);
        setSelectedPoint(path[rollbackTo] ?? localMap.start);
        setStepAttempts(current => ({ ...current, [attemptKey]: attempt + 1 }));
        setElapsedMinutes(value => value + cost.minutes + 25);
        setParticipants(current => current.map((member, index) => ({
          ...member,
          energy: Math.max(0, member.energy - Math.max(2, Math.round(cost.energy * (index === 0 ? 1.35 : 0.85)))),
        })));
        setPaused(true);
        setMessage(`Срыв на участке ${cell.slope}°. Группа откатилась на ${positionIndex - rollbackTo + 1} клеток. Закрепи верёвку на красной точке или выбери обход.`);
        return;
      }

      setPositionIndex(nextIndex);
      setSelectedPoint(next);
      updateInfra(value => ({ ...value, revealed: [...new Set([...value.revealed, id])] }));
      setElapsedMinutes(value => value + cost.minutes);
      setParticipants(current => current.map((member, index) => ({
        ...member,
        energy: Math.max(0, member.energy - Math.max(1, Math.round(cost.energy * (index === 0 ? 1 : index === current.length - 1 ? 0.72 : 0.62)))),
      })));

      if (nextIndex >= path.length - 1) {
        setPaused(true);
        if (isSamePoint(next, localMap.goal)) {
          if (phase === 'ASCENT') setCompletedStagePaths(current => ({ ...current, [stage.id]: path }));
          if (phase === 'ASCENT' && stageIndex >= stages.length - 1) {
            setPhase('DESCENT');
            setMessage('Вершина достигнута. Начинается спуск по созданной инфраструктуре.');
          } else if (phase === 'ASCENT') {
            setMessage(`Этап «${stage.title}» пройден. Открыт следующий участок.`);
            window.setTimeout(() => setStageIndex(value => value + 1), 220);
          } else if (stageIndex <= 0) {
            setPhase('COMPLETE');
            setMessage('Группа вернулась к старту. Полный подъём и спуск завершены.');
          } else {
            setMessage(`Спуск через «${stage.title}» завершён.`);
            window.setTimeout(() => setStageIndex(value => value - 1), 220);
          }
        } else {
          setMessage('План закончился до выхода. Продолжи линию с текущей клетки.');
        }
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [started, paused, completed, path, positionIndex, speed, localMap, infra.revealed, infra.ropes, stageIndex, stages.length, stage.title, stage.id, phase, weather, participants, stepAttempts]);

  function changeEntry(side: EntrySide) {
    if (!canChangePlan) return;
    setEntrySide(side);
    const nextOptions = buildMountainRouteOptions(grid, side);
    setRouteChoice(participantMode ? nextOptions[0]!.id : 'MANUAL');
  }

  function chooseRoute(choice: string) {
    if (!canChangePlan) return;
    setRouteChoice(choice);
  }

  function regenerate() {
    if (started) return;
    setVariant(value => value + 1);
    setRouteChoice('MANUAL');
  }

  function handleCell(point: GridPoint) {
    setSelectedPoint(point);
    if (!started || !paused || completed) return;
    const cell = localCellAt(localMap, point);
    if (!cell?.passable) return;
    const id = pointKey(point);
    const distanceFromGroup = Math.max(Math.abs(point.x - currentPoint.x), Math.abs(point.y - currentPoint.y));

    if (tool === 'SCOUT') {
      if (distanceFromGroup > (authority === 'SPECIALIST' ? 3 : 2)) {
        setMessage('Эта клетка слишком далеко. Сначала подведи группу ближе.');
        return;
      }
      const radius = authority === 'SPECIALIST' ? 2 : 1;
      const around = localMap.cells
        .filter(item => Math.max(Math.abs(item.x - point.x), Math.abs(item.y - point.y)) <= radius)
        .map(pointKey);
      updateInfra(value => ({ ...value, revealed: [...new Set([...value.revealed, ...around])] }));
      setElapsedMinutes(value => value + (authority === 'SPECIALIST' ? 12 : 20));
      setMessage('Разведаны клетка и ближайший рельеф.');
      return;
    }

    if (tool === 'CAMP') {
      if (!isSamePoint(point, currentPoint)) { setMessage('Лагерь можно поставить только там, где находится группа.'); return; }
      if (!cell.campPossible) { setMessage('Площадка слишком крутая, открытая или опасная.'); return; }
      if (infra.camps.includes(id)) { setMessage('Лагерь уже стоит в этой клетке.'); return; }
      if (campKits <= 0) { setMessage('Свободных комплектов лагеря больше нет.'); return; }
      updateInfra(value => ({ ...value, camps: [...value.camps, id] }));
      setCampKits(value => value - 1);
      setElapsedMinutes(value => value + 95);
      setMessage('Лагерь установлен и останется на спуск.');
      return;
    }

    if (tool === 'ROPE') {
      if (distanceFromGroup > 1) { setMessage('Крепление слишком далеко от группы.'); return; }
      if (!cell.ropeRequired && !cell.ropeRecommended && cell.hazard === 'NONE') { setMessage('Эта клетка пологая: стационарная верёвка здесь не нужна.'); return; }
      if (cell.anchorQuality < 35) { setMessage('Нет надёжного крепления. Разведай соседнюю клетку или ищи скалу/лёд с лучшим анкером.'); return; }
      if (infra.ropes.includes(id)) {
        updateInfra(value => ({ ...value, ropes: value.ropes.filter(valueId => valueId !== id) }));
        setRopeMetres(value => value + 20);
        setMessage('Верёвка снята и возвращена в запас.');
        return;
      }
      if (ropeMetres < 20) { setMessage('Не хватает двадцати метров верёвки.'); return; }
      updateInfra(value => ({ ...value, ropes: [...value.ropes, id], revealed: [...new Set([...value.revealed, id])] }));
      setRopeMetres(value => value - 20);
      setElapsedMinutes(value => value + 35);
      setMessage(`Закреплено 20 м верёвки. Риск отката на клетке ${cell.slope}° снят; линия останется на спуск.`);
      return;
    }

    if (participantMode) return;
    const existingIndex = path.findIndex(item => isSamePoint(item, point));
    if (existingIndex >= positionIndex) {
      setPath(values => values.slice(0, existingIndex + 1));
      return;
    }
    const last = path[path.length - 1]!;
    if (!isAdjacent(last, point)) { setMessage('Маршрут строится только по соседним квадратам.'); return; }
    setPath(values => [...values, point]);
    setMessage(isSamePoint(point, localMap.goal) ? 'Линия доведена до выхода. Проверь стоимость и запускай движение.' : 'Маршрут продолжен.');
  }

  function beginExpedition() {
    if (started) return;
    setStarted(true);
    setPaused(true);
    setMessage(selectedRoute
      ? `Заход ${SIDE_COPY[entrySide]} и маршрут «${selectedRoute.name}» зафиксированы. Проверь первый участок и запускай движение.`
      : `Заход ${SIDE_COPY[entrySide]} зафиксирован. Построй авторскую линию на первом участке.`);
  }

  function toggleMove() {
    if (completed) return;
    if (!paused) { setPaused(true); return; }
    if (path.length < 2 || positionIndex >= path.length - 1) { setMessage('Сначала продолжи маршрут от текущей клетки.'); return; }
    setPaused(false);
  }

  function rest(mode: RestMode) {
    const atCamp = infra.camps.includes(pointKey(currentPoint));
    if (mode !== 'BREAK' && !atCamp) { setMessage('Бивак и сон доступны только в установленном лагере.'); return; }
    if (mode === 'BREAK' && (currentCell.hazard !== 'NONE' || currentCell.slope > 36)) { setMessage('Здесь нельзя безопасно остановиться. Нужна более ровная клетка или лагерь.'); return; }
    const minutes = mode === 'BREAK' ? 30 : mode === 'BIVOUAC' ? 180 : 480;
    const recovery = mode === 'BREAK' ? 9 : mode === 'BIVOUAC' ? 34 : 74;
    setElapsedMinutes(value => value + minutes);
    setParticipants(current => current.map(member => ({ ...member, energy: Math.min(100, member.energy + recovery) })));
    setMessage(mode === 'BREAK'
      ? 'Короткий привал: 30 минут, небольшое восстановление. Погода продолжила меняться.'
      : mode === 'BIVOUAC'
        ? 'Бивак в лагере: 3 часа, заметное восстановление без полного сна.'
        : 'Полноценный сон в лагере: 8 часов, сильное восстановление. Условия на карте могли измениться.');
  }

  function reorder(index: number, delta: number) {
    setParticipants(values => {
      const next = [...values];
      const target = index + delta;
      if (target < 0 || target >= next.length) return values;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((member, memberIndex) => ({ ...member, role: memberIndex === 0 ? 'Ведущий' : memberIndex === next.length - 1 ? 'Замыкающий' : 'Участник' }));
    });
  }

  return (
    <main className="mg-app">
      <header className="mg-header">
        <div><span>ALPINE LEGACY / 0.7.4</span><h1>{mountainName} · маршрутная экспедиция</h1></div>
        <div className="mg-header-actions">{allowRegenerate && <button onClick={regenerate} disabled={started}>Новая генерация</button>}<button onClick={onExit}>Закрыть</button></div>
      </header>

      <section className="mg-layout">
        <div className="mg-main-column">
          <MountainViewer grid={grid} route={globalRoute} routeName={routeName} selectedRoute={selectedRoute} stages={stages} side={entrySide} currentStage={stageIndex} />

          <section className="mg-stage-card">
            <div className="mg-stage-topline">
              <div><span>{phase === 'DESCENT' ? 'СПУСК' : phase === 'COMPLETE' ? 'ЗАВЕРШЕНО' : 'ПОДЪЁМ'} · ЭТАП {stageIndex + 1} / {stages.length}</span><h2>{stage.title}</h2><p>{stage.subtitle} · сложность {stage.difficulty}/5 · карта {localMap.width} × {localMap.height}</p></div>
              <div className="mg-stage-weather"><span>{weather.temperatureC}°C</span><span>ветер {weather.windKmh}</span><span>видимость {weather.visibility}%</span><span>снег {weather.snowSoftness}</span></div>
            </div>

            {!started ? (
              <section className="mg-preflight">
                <div><span>ПЛАНИРОВАНИЕ ДО ВЫХОДА</span><h3>Зафиксируй сторону и маршрут</h3><p>После старта изменить сторону захода и глобальный маршрут нельзя. На горе останется только управление локальными линиями, людьми и инфраструктурой.</p></div>
                <dl><div><dt>Заход</dt><dd>{SIDE_COPY[entrySide]}</dd></div><div><dt>Маршрут</dt><dd>{routeName}</dd></div><div><dt>Этапы</dt><dd>{stages.length}</dd></div><div><dt>Верёвка / лагеря</dt><dd>140 м / 2</dd></div></dl>
                <button onClick={beginExpedition}>Начать экспедицию →</button>
              </section>
            ) : (
            <div className="mg-local-layout">
              <LocalMap map={localMap} path={path} positionIndex={positionIndex} tool={tool} camps={infra.camps} ropes={infra.ropes} revealed={infra.revealed} selectedPoint={selectedPoint} started={started} onCell={handleCell} />
              <aside className="mg-local-aside">
                <div className="mg-current-cell"><span>ГРУППА СЕЙЧАС</span><strong>{currentCell.elevation} м</strong><p>{TERRAIN_COPY[currentCell.terrain]} · уклон {currentCell.slope}° · {HAZARD_COPY[currentCell.hazard]}</p></div>
                <div className={`mg-cell-inspector ${selectedCell.ropeRequired ? 'is-critical' : ''}`}><span>ВЫБРАННАЯ ТОЧКА</span><div><strong>{selectedCell.elevation} м</strong><b>{slopeBand(selectedCell.slope)} · {selectedCell.slope}°</b></div><p>{selectedKnown ? `${TERRAIN_COPY[selectedCell.terrain]}; устойчивость ${selectedCell.stability}/100; крепление ${selectedCell.anchorQuality}/100.` : 'Рельеф виден, но устойчивость, скрытая угроза и качество крепления не разведаны.'}</p><small>{selectedProtected ? 'Верёвка установлена: откат исключён.' : selectedRisk.reason} Риск: {RISK_COPY[selectedRisk.band]}.</small></div>
                <div className="mg-route-metrics">
                  <div><span>ВРЕМЯ</span><strong>{formatMinutes(routeMetrics.minutes)}</strong></div>
                  <div><span>СИЛЫ</span><strong>{routeMetrics.energy}</strong></div>
                  <div><span>НАБОР / СБРОС</span><strong>+{routeMetrics.ascentMetres} / −{routeMetrics.descentMetres}</strong></div>
                  <div><span>ОПАСНОСТИ</span><strong>{routeMetrics.hazardCells}</strong></div>
                  <div><span>МАКС. УКЛОН</span><strong>{routeMetrics.maxSlope}°</strong></div>
                  <div><span>ВЕРЁВКА</span><strong>{routeMetrics.ropeMetresRecommended} м</strong></div>
                  <div className={routeMetrics.unprotectedRopeCells ? 'is-warning' : ''}><span>БЕЗ СТРАХОВКИ</span><strong>{routeMetrics.unprotectedRopeCells}</strong></div>
                  <div><span>ОТКАТ</span><strong>до {routeMetrics.maxRollbackCells} кл.</strong></div>
                </div>
                <div className="mg-tools">{(['ROUTE', 'SCOUT', 'ROPE', 'CAMP'] as Tool[]).map(id => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} disabled={!paused}><strong>{id === 'ROUTE' ? 'Маршрут' : id === 'SCOUT' ? 'Разведка' : id === 'ROPE' ? 'Верёвка' : 'Лагерь'}</strong><small>{id === 'SCOUT' ? '12–20 мин' : id === 'ROPE' ? '20 м' : id === 'CAMP' ? '1 комплект' : 'бесплатно'}</small></button>)}</div>
                <div className="mg-tool-explain"><strong>{TOOL_HELP[tool].title}</strong><p>{TOOL_HELP[tool].text}</p></div>
                <div className="mg-message"><span>{paused ? 'ПАУЗА' : `ДВИЖЕНИЕ ×${speed}`}</span><p>{message}</p></div>
                <div className="mg-time-controls"><button onClick={toggleMove}>{paused ? '▶ Запустить' : 'Ⅱ Пауза'}</button>{([1, 2, 4] as const).map(value => <button key={value} className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>×{value}</button>)}</div>
                <div className="mg-rest-controls"><span>ОТДЫХ</span><button onClick={() => rest('BREAK')} disabled={!paused}>Привал · 30 мин <small>+9 сил</small></button><button onClick={() => rest('BIVOUAC')} disabled={!paused || !infra.camps.includes(pointKey(currentPoint))}>Бивак · 3 ч <small>+34</small></button><button onClick={() => rest('SLEEP')} disabled={!paused || !infra.camps.includes(pointKey(currentPoint))}>Сон · 8 ч <small>+74</small></button><p>Установка лагеря сама по себе не восстанавливает силы. Она открывает длительный отдых и безопасную точку на спуске.</p></div>
                <small className="mg-route-state">Линия {path.length - 1} клеток · {routeReady ? 'до выхода' : 'не завершена'} · экспедиция {formatMinutes(elapsedMinutes)}</small>
              </aside>
            </div>
            )}
          </section>
        </div>

        <aside className="mg-side-column">
          <section className="mg-side-card">
            <div className="mg-panel-head"><div><span>СТОРОНА ЗАХОДА</span><strong>{started ? `${SIDE_COPY[entrySide]} · зафиксирован` : SIDE_COPY[entrySide]}</strong></div></div>
            <div className="mg-entry-grid">{(Object.keys(SIDE_COPY) as EntrySide[]).map(side => <button key={side} className={entrySide === side ? 'is-active' : ''} onClick={() => changeEntry(side)} disabled={!canChangePlan}>{SIDE_COPY[side]}</button>)}</div>
          </section>

          <section className="mg-side-card mg-routes-card">
            <div className="mg-panel-head"><div><span>МАРШРУТ НА ВЕРШИНУ</span><strong>{started ? 'план зафиксирован' : participantMode ? 'выбран руководителем' : 'выбери до выхода'}</strong></div></div>
            {!participantMode && (
              <button className={`mg-route-card mg-route-card--manual ${routeChoice === 'MANUAL' ? 'is-active' : ''}`} onClick={() => chooseRoute('MANUAL')} disabled={!canChangePlan}>
                <div><span>СВОБОДНАЯ ЛИНИЯ</span><strong>Авторский маршрут</strong></div>
                <p>Общий коридор виден на 3D-модели, но каждый локальный этап строится вручную.</p>
                <small>{stages.length} этапов · сложность зависит от твоей линии</small>
              </button>
            )}
            <div className="mg-route-options">{routeOptions.map(option => <RouteCard key={option.id} option={option} active={routeChoice === option.id} disabled={!canChangePlan || participantMode} onClick={() => chooseRoute(option.id)} />)}</div>
          </section>

          <section className="mg-side-card">
            <div className="mg-panel-head"><div><span>ЭКСПЕДИЦИЯ</span><strong>{participantMode ? 'готовый план лидера' : 'твоё управление'}</strong></div><small>{ropeMetres} м · {campKits} лагеря</small></div>
            <div className="mg-team-list">{participants.map((member, index) => <article key={member.id}><div><strong>{member.name}</strong><span>{member.role} · {member.specialty}</span><small>{member.energy >= 70 ? 'Свежий' : member.energy >= 40 ? 'Устал' : 'На пределе'} · {member.energy}</small></div><div><button onClick={() => reorder(index, -1)} disabled={!paused || index === 0}>↑</button><button onClick={() => reorder(index, 1)} disabled={!paused || index === participants.length - 1}>↓</button></div></article>)}</div>
          </section>

          <section className="mg-side-card mg-stage-list-card">
            <div className="mg-panel-head"><div><span>РАЗВЁРТКА ГОРЫ</span><strong>{stages.length} локальных карт</strong></div></div>
            <ol>{stages.map(item => <li key={item.id} className={item.index === stageIndex ? 'is-active' : (phase === 'ASCENT' ? item.index < stageIndex : item.index > stageIndex) ? 'is-done' : ''}><span>{String(item.index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.subtitle} · {item.difficulty}/5</small></div></li>)}</ol>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default TopoExpeditionPrototype;
