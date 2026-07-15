import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CareerState, QualificationClimb } from '../core/types';
import { ensureIntegratedExpedition, persistIntegratedExpedition } from '../core/career';
import {
  EMPTY_INTEGRATED_INFRASTRUCTURE,
  integratedSpecialist,
  integratedStepPreview,
  integratedTeamMorale,
  integratedTeamTrust,
  integratedWeatherAt,
  reduceIntegratedExpedition,
  type IntegratedExpeditionCommand,
  type IntegratedExpeditionContext,
  type IntegratedExpeditionState,
  type IntegratedPace,
  type IntegratedRestMode,
  type IntegratedTool,
} from '../core/expedition';
import {
  buildMountainRouteOptions,
  buildMountainStages,
  cellAt,
  evaluateLocalRoute,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
  localCellAt,
  type EntrySide,
  type GridPoint,
  type LocalRouteProfile,
  type LocalStageMap,
  type MountainCell,
  type MountainRouteOption,
  type MountainTerrain,
  type StageDefinition,
} from './mountainGridEngine';

type Tool = 'ROUTE' | 'ROPE' | 'CAMP' | 'SCOUT';
type ExpeditionTab = 'CLIMB' | 'MOUNTAIN' | 'EXPEDITION' | 'JOURNAL';

type Props = {
  career: CareerState;
  onPersist: (career: CareerState) => void;
  onExit: (terminal: boolean) => void;
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

const PACE_COPY: Record<IntegratedPace, { title: string; detail: string }> = {
  CAUTIOUS: { title: 'Осторожно', detail: 'медленнее · меньше риск' },
  STEADY: { title: 'Рабочий', detail: 'ровный расход сил' },
  FAST: { title: 'Быстро', detail: 'быстрее · выше риск' },
};

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

function localProfileFor(option?: MountainRouteOption): LocalRouteProfile {
  return option?.localProfile ?? 'SAFE';
}

export function TopoExpeditionPrototype({ career, onPersist, onExit, allowRegenerate = false }: Props) {
  const integratedCareer = useMemo(() => ensureIntegratedExpedition(career), [career]);
  const climb = integratedCareer.activeClimb;
  const topo = climb?.topo;

  useEffect(() => {
    if (integratedCareer !== career) onPersist(integratedCareer);
  }, [career, integratedCareer, onPersist]);

  if (!climb || !topo) {
    return (
      <main className="mg-app">
        <header className="mg-header"><div><span>ALPINE LEGACY / 0.9.6</span><h1>Экспедиция недоступна</h1></div><div className="mg-header-actions"><button onClick={() => onExit(true)}>Вернуться</button></div></header>
      </main>
    );
  }

  return <ActiveTopoExpedition integratedCareer={integratedCareer} climb={climb} topo={topo} onPersist={onPersist} onExit={onExit} allowRegenerate={allowRegenerate} />;
}

type ActiveTopoProps = Omit<Props, 'career'> & {
  integratedCareer: CareerState;
  climb: QualificationClimb;
  topo: IntegratedExpeditionState;
};

function ActiveTopoExpedition({ integratedCareer, climb, topo, onPersist, onExit, allowRegenerate = false }: ActiveTopoProps) {
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [tool, setTool] = useState<IntegratedTool>('ROUTE');
  const [selectedPoint, setSelectedPoint] = useState<GridPoint>({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<ExpeditionTab>(() => topo.started ? 'CLIMB' : 'EXPEDITION');

  const participantMode = topo.authority !== 'COMMAND';
  const grid = useMemo(
    () => generateMountainGrid(`${topo.seed}:v${topo.variant}`, topo.startElevation, topo.summitElevation),
    [topo.seed, topo.variant, topo.startElevation, topo.summitElevation],
  );
  const routeOptions = useMemo(() => buildMountainRouteOptions(grid, topo.entrySide), [grid, topo.entrySide]);
  const selectedRoute = routeOptions.find(option => option.id === topo.routeChoice)
    ?? (participantMode || topo.routeChoice === 'AUTO' ? routeOptions[0] : undefined);
  const globalRoute = selectedRoute?.route ?? routeOptions[0]!.route;
  const routeName = selectedRoute?.name ?? climb.routeName ?? 'Авторская линия по локальным картам';
  const stages = useMemo(
    () => buildMountainStages(grid, topo.entrySide, globalRoute, selectedRoute?.profile ?? 'CUSTOM'),
    [grid, topo.entrySide, globalRoute, selectedRoute?.profile],
  );
  const stageIndex = Math.min(topo.stageIndex, Math.max(0, stages.length - 1));
  const stage = stages[stageIndex]!;
  const descending = topo.phase === 'DESCENT' || topo.phase === 'COMPLETE' || topo.phase === 'RETREATED';
  const localMap = useMemo(() => {
    const base = generateLocalStageMap(stage, grid.seed);
    return descending ? { ...base, start: base.goal, goal: base.start } : base;
  }, [stage, grid.seed, descending]);
  const guidedLocalRoute = useMemo(() => findLocalGuidedRoute(localMap, localProfileFor(selectedRoute)), [localMap, selectedRoute]);
  const previousAscentPath = topo.completedStagePaths[stage.id];
  const defaultPath = descending && previousAscentPath
    ? [...previousAscentPath].reverse()
    : participantMode || selectedRoute
      ? guidedLocalRoute
      : [localMap.start];
  const storedPath = topo.paths[stage.id];
  const needsDescentPath = Boolean(
    descending
    && previousAscentPath?.length
    && storedPath?.length
    && isSamePoint(storedPath[0]!, previousAscentPath[0]!)
  );
  const path = needsDescentPath ? defaultPath : storedPath ?? defaultPath;
  const infra = topo.infrastructure[stage.id] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
  const weather = integratedWeatherAt(topo);
  const completed = ['COMPLETE', 'RETREATED', 'FAILED'].includes(topo.phase);
  const currentPoint = path[Math.min(topo.positionIndex, Math.max(0, path.length - 1))] ?? localMap.start;
  const currentCell = localCellAt(localMap, currentPoint)!;
  const selectedCell = localCellAt(localMap, selectedPoint) ?? currentCell;
  const selectedId = pointKey(selectedCell);
  const selectedKnown = infra.revealed.includes(selectedId) || isSamePoint(selectedCell, currentCell) || isSamePoint(selectedCell, localMap.start);
  const selectedProtected = infra.ropes.includes(selectedId);
  const selectedRisk = integratedStepPreview(topo, localMap, currentPoint, selectedCell, weather, selectedProtected);
  const routeReady = path.length > 1 && isSamePoint(path[path.length - 1]!, localMap.goal);
  const routeMetrics = useMemo(
    () => evaluateLocalRoute(localMap, path, weather, new Set(infra.ropes)),
    [localMap, path, weather, infra.ropes],
  );
  const context: IntegratedExpeditionContext = { stageId: stage.id, stageTitle: stage.title, stageCount: stages.length, localMap, weather };

  useEffect(() => {
    if (!topo.paths[stage.id]?.length || needsDescentPath) {
      const nextTopo = reduceIntegratedExpedition(topo, { type: 'ENSURE_STAGE_PATH', stageId: stage.id, path: defaultPath, currentElevation: localCellAt(localMap, defaultPath[0] ?? localMap.start)?.elevation ?? topo.currentElevation, replace: needsDescentPath }, context);
      onPersist(persistIntegratedExpedition(integratedCareer, nextTopo));
    }
    setSelectedPoint(path[Math.min(topo.positionIndex, Math.max(0, path.length - 1))] ?? localMap.start);
    setPaused(true);
    setTool('ROUTE');
  }, [stage.id, descending]);


  useEffect(() => {
    if (!topo.started || completed) setActiveTab('EXPEDITION');
  }, [topo.started, completed]);

  function commit(command: IntegratedExpeditionCommand) {
    const nextTopo = reduceIntegratedExpedition(topo!, command, context);
    if (nextTopo !== topo) onPersist(persistIntegratedExpedition(integratedCareer, nextTopo));
    if (nextTopo.lastEvent.kind !== 'INFO') setPaused(true);
    return nextTopo;
  }

  useEffect(() => {
    if (!topo.started || paused || completed || path.length < 2 || topo.positionIndex >= path.length - 1) return;
    const delay = Math.max(140, 820 / speed);
    const timer = window.setTimeout(() => {
      const next = commit({ type: 'STEP' });
      if (next.lastEvent.kind !== 'INFO') setPaused(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [topo, paused, completed, path, speed, context.stageId, weather.temperatureC, weather.windKmh, weather.visibility, weather.snowSoftness]);

  function regenerate() {
    if (topo!.started) return;
    commit({ type: 'REGENERATE' });
  }

  function handleCell(point: GridPoint) {
    setSelectedPoint(point);
    if (!topo!.started || !paused || completed) return;
    const cell = localCellAt(localMap, point);
    if (!cell?.passable) return;
    const distanceFromGroup = Math.max(Math.abs(point.x - currentPoint.x), Math.abs(point.y - currentPoint.y));

    if (tool === 'SCOUT') {
      commit({ type: 'SCOUT', point, radius: topo!.authority === 'SPECIALIST' ? 2 : 1, minutes: topo!.authority === 'SPECIALIST' ? 12 : 20 });
      return;
    }
    if (tool === 'CAMP') {
      if (!isSamePoint(point, currentPoint)) return;
      commit({ type: 'MAKE_CAMP', point });
      return;
    }
    if (tool === 'ROPE') {
      if (distanceFromGroup > 1) return;
      if (!cell.ropeRequired && !cell.ropeRecommended && cell.hazard === 'NONE') return;
      commit({ type: 'TOGGLE_ROPE', point });
      return;
    }
    if (participantMode) return;
    const existingIndex = path.findIndex(item => isSamePoint(item, point));
    if (existingIndex >= topo!.positionIndex) {
      commit({ type: 'SET_STAGE_PATH', stageId: stage.id, path: path.slice(0, existingIndex + 1) });
      return;
    }
    const last = path[path.length - 1]!;
    if (!isAdjacent(last, point)) return;
    commit({ type: 'SET_STAGE_PATH', stageId: stage.id, path: [...path, point] });
  }

  function toggleMove() {
    if (completed) return;
    if (!paused) { setPaused(true); return; }
    if (path.length < 2 || topo!.positionIndex >= path.length - 1) return;
    setPaused(false);
  }

  const phaseLabel = topo.phase === 'DESCENT' ? 'СПУСК' : topo.phase === 'COMPLETE' ? 'ЗАВЕРШЕНО' : topo.phase === 'RETREATED' ? 'ОТХОД ЗАВЕРШЁН' : topo.phase === 'FAILED' ? 'ПРОВАЛ' : 'ПОДЪЁМ';
  const teamAverageEnergy = Math.round(topo.participants.reduce((sum, participant) => sum + participant.energy, 0) / Math.max(1, topo.participants.length));
  const teamAverageCondition = Math.round(topo.participants.reduce((sum, participant) => sum + participant.condition, 0) / Math.max(1, topo.participants.length));
  const teamAverageMorale = integratedTeamMorale(topo);
  const teamAverageTrust = integratedTeamTrust(topo);
  const navigator = integratedSpecialist(topo, 'NAVIGATION');
  const technician = integratedSpecialist(topo, selectedCell.terrain === 'GLACIER' ? 'ICE' : 'ROCK');
  const medic = integratedSpecialist(topo, 'MEDICINE');
  const outcomeLabel = topo.phase === 'COMPLETE' ? 'Вершина и возвращение' : topo.phase === 'RETREATED' ? 'Экспедиция завершена отходом' : 'Экспедиция провалена';

  return (
    <main className="mg-app mg-expedition-shell">
      <header className="mg-header mg-expedition-header">
        <div className="mg-header-copy">
          <span>ALPINE LEGACY / 0.9.6</span>
          <h1>{climb.mountainName}</h1>
          <small>{routeName} · {phaseLabel.toLowerCase()}</small>
        </div>
        <div className="mg-header-actions">
          {allowRegenerate && <button onClick={regenerate} disabled={topo.started}>Новая гора</button>}
          <button onClick={() => onExit(completed)}>{completed ? 'Закрыть' : 'Сохранить и выйти'}</button>
        </div>
      </header>

      <nav className="mg-expedition-tabs" role="tablist" aria-label="Разделы экспедиции">
        {([
          ['CLIMB', 'Подъём', `${stageIndex + 1}/${stages.length}`],
          ['MOUNTAIN', 'Гора 3D', `${Math.round(topo.currentElevation)} м`],
          ['EXPEDITION', 'Экспедиция', `${teamAverageEnergy}%`],
          ['JOURNAL', 'Журнал', String(topo.eventLog.length)],
        ] as Array<[ExpeditionTab, string, string]>).map(([id, label, meta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'is-active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <strong>{label}</strong>
            <small>{meta}</small>
          </button>
        ))}
      </nav>

      <section className="mg-tab-panel">
        {activeTab === 'CLIMB' && (
          <section className="mg-stage-card mg-climb-tab" role="tabpanel">
            <div className="mg-stage-topline">
              <div>
                <span>{phaseLabel} · ЭТАП {stageIndex + 1} / {stages.length}</span>
                <h2>{stage.title}</h2>
                <p>{stage.subtitle} · сложность {stage.difficulty}/5</p>
              </div>
              <div className="mg-stage-weather">
                <span>{weather.temperatureC}°C</span>
                <span>ветер {weather.windKmh}</span>
                <span>видимость {weather.visibility}%</span>
                <span>снег {weather.snowSoftness}</span>
              </div>
            </div>

            {!topo.started ? (
              <div className="mg-empty-tab">
                <strong>Экспедиция ещё не началась</strong>
                <p>Проверь людей и снаряжение, затем выходи на маршрут.</p>
                <button onClick={() => setActiveTab('EXPEDITION')}>Открыть экспедицию</button>
              </div>
            ) : completed ? (
              <div className="mg-empty-tab">
                <strong>Вылазка завершена</strong>
                <p>{topo.message}</p>
                <button onClick={() => setActiveTab('EXPEDITION')}>Посмотреть итог</button>
              </div>
            ) : (
              <div className="mg-local-layout">
                <LocalMap
                  map={localMap}
                  path={path}
                  positionIndex={topo.positionIndex}
                  tool={tool as Tool}
                  camps={infra.camps}
                  ropes={infra.ropes}
                  revealed={infra.revealed}
                  selectedPoint={selectedPoint}
                  started={topo.started}
                  onCell={handleCell}
                />
                <aside className="mg-local-aside">
                  <div className="mg-climb-status">
                    <article>
                      <span>ГРУППА</span>
                      <strong>{currentCell.elevation} м</strong>
                      <small>{TERRAIN_COPY[currentCell.terrain]} · {currentCell.slope}° · {HAZARD_COPY[currentCell.hazard]}</small>
                    </article>
                    <article className={selectedCell.ropeRequired ? 'is-critical' : ''}>
                      <span>ВЫБРАННАЯ ТОЧКА</span>
                      <strong>{RISK_COPY[selectedRisk.band]}</strong>
                      <small>{selectedKnown ? `${selectedCell.elevation} м · ${slopeBand(selectedCell.slope)} · навык ${selectedRisk.skill}/10` : 'Угроза не разведана'}</small>
                    </article>
                  </div>

                  <div className="mg-climb-metrics">
                    <div><span>ВРЕМЯ</span><strong>{formatMinutes(routeMetrics.minutes)}</strong></div>
                    <div><span>СИЛЫ</span><strong>{routeMetrics.energy}</strong></div>
                    <div className={routeMetrics.unprotectedRopeCells ? 'is-warning' : ''}><span>БЕЗ СТРАХОВКИ</span><strong>{routeMetrics.unprotectedRopeCells}</strong></div>
                    <div><span>ВЕРЁВКА</span><strong>{topo.ropeMeters} м</strong></div>
                  </div>

                  <div className="mg-tools" role="group" aria-label="Инструмент на карте">
                    {(['ROUTE', 'SCOUT', 'ROPE', 'CAMP'] as IntegratedTool[]).map(id => (
                      <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} disabled={!paused || completed}>
                        <strong>{id === 'ROUTE' ? 'Маршрут' : id === 'SCOUT' ? 'Разведка' : id === 'ROPE' ? 'Верёвка' : 'Лагерь'}</strong>
                        <small>{id === 'SCOUT' ? '12–20 мин' : id === 'ROPE' ? '20 м' : id === 'CAMP' ? '1 комплект' : 'линия'}</small>
                      </button>
                    ))}
                  </div>

                  <div className={`mg-message ${topo.lastEvent.severity === 'DANGER' ? 'is-danger' : ''}`}>
                    <span>{paused ? 'ПАУЗА' : `ДВИЖЕНИЕ ×${speed}`}</span>
                    <p>{topo.message}</p>
                  </div>

                  <div className="mg-time-controls">
                    <button onClick={toggleMove} disabled={topo.forcedRetreat && path.length < 2}>{paused ? '▶ Двигаться' : 'Ⅱ Пауза'}</button>
                    {([1, 2, 4] as const).map(value => <button key={value} className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>×{value}</button>)}
                  </div>

                  <details className="mg-secondary-actions" open={topo.forcedRetreat || undefined}>
                    <summary>Отдых и аварийные действия</summary>
                    <div className="mg-rest-controls">
                      <button onClick={() => commit({ type: 'REST', mode: 'BREAK' as IntegratedRestMode })} disabled={!paused}>Привал <small>30 мин · +9 сил</small></button>
                      <button onClick={() => commit({ type: 'REST', mode: 'BIVOUAC' as IntegratedRestMode })} disabled={!paused}>Бивак <small>3 ч · топливо 1</small></button>
                      <button onClick={() => commit({ type: 'REST', mode: 'SLEEP' as IntegratedRestMode })} disabled={!paused}>Сон <small>8 ч · топливо 2</small></button>
                      {topo.phase === 'ASCENT' && <button className="is-warning" onClick={() => commit({ type: 'BEGIN_RETREAT' })} disabled={!paused}>Начать отход</button>}
                      {topo.forcedRetreat && <button className="is-warning" onClick={() => commit({ type: 'REQUEST_RESCUE' })} disabled={!paused}>Вызвать спасателей</button>}
                    </div>
                  </details>
                </aside>
              </div>
            )}
          </section>
        )}

        {activeTab === 'MOUNTAIN' && (
          <div role="tabpanel" className="mg-mountain-tab">
            <MountainViewer grid={grid} route={globalRoute} routeName={routeName} selectedRoute={selectedRoute} stages={stages} side={topo.entrySide} currentStage={stageIndex} />
          </div>
        )}

        {activeTab === 'EXPEDITION' && (
          <div role="tabpanel" className="mg-expedition-tab">
            {completed ? (
              <section className="mg-expedition-summary">
                <div className="mg-summary-lead"><span>ИТОГ ЭКСПЕДИЦИИ</span><h3>{outcomeLabel}</h3><p>{topo.message}</p></div>
                <dl>
                  <div><dt>Вершина</dt><dd>{topo.summitReached ? 'достигнута' : 'нет'}</dd></div>
                  <div><dt>Максимальная высота</dt><dd>{Math.round(topo.highestElevation)} м</dd></div>
                  <div><dt>Общее время</dt><dd>{formatMinutes(topo.elapsedMinutes)}</dd></div>
                  <div><dt>Травмы / потери</dt><dd>{topo.injuries.length} / {topo.casualties.length}</dd></div>
                  <div><dt>Спасение</dt><dd>{topo.rescueCost > 0 ? `${topo.rescueCost} кр. · ${formatMinutes(topo.rescueDurationMinutes)}` : 'не потребовалось'}</dd></div>
                  <div><dt>Снаряжение</dt><dd>верёвка {Math.round(topo.gear.ropeCondition)}% · железо {Math.round(topo.gear.hardwareCondition)}%</dd></div>
                </dl>
                <button onClick={() => onExit(true)}>Закрыть экспедицию →</button>
              </section>
            ) : !topo.started ? (
              <section className="mg-preflight">
                <div><span>ГОТОВНОСТЬ</span><h3>Команда собрана</h3><p>Навигатор ведёт разведку, техник отвечает за страховку, медик работает с травмами. Ты управляешь линией, темпом, отдыхом и отходом.</p></div>
                <dl>
                  <div><dt>Команда</dt><dd>{topo.participants.length}</dd></div>
                  <div><dt>Специалисты</dt><dd>{navigator.name} · {technician.name} · {medic.name}</dd></div>
                  <div><dt>Верёвка / лагеря</dt><dd>{topo.ropeMeters} м / {topo.campKits}</dd></div>
                  <div><dt>Груз</dt><dd>{topo.packWeightKg.toFixed(1)} кг/чел.</dd></div>
                  <div><dt>Акклиматизация</dt><dd>{topo.acclimatizationDays} дн.</dd></div>
                  <div><dt>Аптечка</dt><dd>{topo.gear.medkitCharges} применений</dd></div>
                </dl>
                <button onClick={() => { commit({ type: 'START' }); setActiveTab('CLIMB'); }}>Начать экспедицию →</button>
              </section>
            ) : (
              <>
                <section className="mg-expedition-overview">
                  <div>
                    <span>{phaseLabel}</span>
                    <strong>{teamAverageEnergy} сил · {teamAverageCondition} состояние</strong>
                    <small>мораль {teamAverageMorale} · доверие {teamAverageTrust} · в пути {formatMinutes(topo.elapsedMinutes)}</small>
                  </div>
                  <div className="mg-pace-controls">
                    <span>ОБЩИЙ ТЕМП</span>
                    <div>{(Object.keys(PACE_COPY) as IntegratedPace[]).map(pace => <button key={pace} className={topo.pace === pace ? 'is-active' : ''} onClick={() => commit({ type: 'SET_PACE', pace })} disabled={!paused}><strong>{PACE_COPY[pace].title}</strong><small>{PACE_COPY[pace].detail}</small></button>)}</div>
                  </div>
                </section>

                <div className="mg-expedition-grid">
                  <section className="mg-side-card mg-gear-card">
                    <div className="mg-panel-head"><div><span>СНАРЯЖЕНИЕ И ЗАПАСЫ</span><strong>Фактический остаток</strong></div></div>
                    <div className="mg-route-metrics">
                      <div><span>ЕДА</span><strong>{topo.supplies.foodUnits.toFixed(1)}</strong></div>
                      <div><span>ВОДА</span><strong>{topo.supplies.waterUnits.toFixed(1)}</strong></div>
                      <div><span>ТОПЛИВО</span><strong>{topo.supplies.fuelUnits.toFixed(1)}</strong></div>
                      <div><span>АПТЕЧКА</span><strong>{topo.gear.medkitCharges}</strong></div>
                      <div><span>ВЕРЁВКА</span><strong>{topo.ropeMeters} м · {Math.round(topo.gear.ropeCondition)}%</strong></div>
                      <div><span>ЖЕЛЕЗО</span><strong>{Math.round(topo.gear.hardwareCondition)}%</strong></div>
                      <div><span>УКРЫТИЕ</span><strong>{Math.round(topo.gear.shelterCondition)}%</strong></div>
                      <div><span>РАДИО</span><strong>{Math.round(topo.gear.radioCondition)}%</strong></div>
                    </div>
                  </section>

                  <section className="mg-side-card mg-team-card">
                    <div className="mg-panel-head"><div><span>ЛЮДИ</span><strong>{topo.participants.length} участников</strong></div><small>порядок группы</small></div>
                    <div className="mg-team-list">{topo.participants.map((member, index) => <article key={member.id} className={member.status === 'INCAPACITATED' || member.status === 'DEAD' ? 'is-critical' : ''}><div><strong>{member.name}</strong><span>{member.role} · {member.specialty}</span><small>Силы {Math.round(member.energy)} · состояние {Math.round(member.condition)} · груз {member.loadKg.toFixed(1)}/{member.carryCapacityKg.toFixed(1)} кг</small><small>Мораль {Math.round(member.morale)} · доверие {Math.round(member.trust)}{member.injury ? ` · ${member.injury}` : ''}</small></div><div><button onClick={() => commit({ type: 'REORDER', index, delta: -1 })} disabled={!paused || index === 0}>↑</button><button onClick={() => commit({ type: 'REORDER', index, delta: 1 })} disabled={!paused || index === topo.participants.length - 1}>↓</button></div></article>)}</div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'JOURNAL' && (
          <div role="tabpanel" className="mg-journal-tab">
            <section className="mg-side-card">
              <div className="mg-panel-head"><div><span>ПОСЛЕДСТВИЯ</span><strong>{topo.incidents.length || 'нет'} событий</strong></div></div>
              {topo.incidents.length > 0 ? <ol className="mg-incident-list">{topo.incidents.slice().reverse().map(incident => <li key={incident.id}><strong>{incident.title}</strong><small>{incident.detail}</small></li>)}</ol> : <p className="mg-journal-empty">Серьёзных происшествий пока нет.</p>}
            </section>
            <section className="mg-side-card mg-log-card">
              <div className="mg-panel-head"><div><span>ХОД ЭКСПЕДИЦИИ</span><strong>{topo.eventLog.length} записей</strong></div></div>
              <ol className="mg-event-log">{topo.eventLog.slice().reverse().map(entry => <li key={`${entry.serial}-${entry.text}`} className={`is-${entry.severity.toLowerCase()}`}><span>{String(entry.serial).padStart(2, '0')}</span><p>{entry.text}</p></li>)}</ol>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default TopoExpeditionPrototype;
