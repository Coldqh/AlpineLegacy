import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CareerState, QualificationClimb } from '../core/types';
import { ensureIntegratedExpedition, persistIntegratedExpedition } from '../core/career';
import { buildMountainMemory, type MountainMemorySnapshot } from '../core/mountainMemory';
import { applyMountainDynamicsToMap, applyMountainDynamicsToWeather, buildMountainDynamics, type MountainDynamics } from '../core/mountainDynamics';
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
} from '../core/expedition';
import {
  buildMountainRouteOptions,
  buildMountainStages,
  cellAt,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
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

function inheritedInfrastructure(memory: MountainMemorySnapshot, map: LocalStageMap, route: GridPoint[], dynamics: MountainDynamics) {
  if (memory.attempts <= 0 || route.length === 0) return { revealed: [] as string[], camps: [] as string[], legacyRopes: [] as string[] };
  const knownSteps = Math.min(route.length, 2 + Math.min(5, memory.attempts) + Math.floor(memory.attention / 24) + Math.floor(dynamics.knownRouteBonus / 14));
  const knownRoute = route.slice(0, knownSteps);
  const revealRadius = memory.attention >= 70 || dynamics.knownRouteBonus >= 30 ? 2 : 1;
  const revealed = map.cells
    .filter(cell => knownRoute.some(point => Math.max(Math.abs(cell.x - point.x), Math.abs(cell.y - point.y)) <= revealRadius))
    .map(pointKey);
  const campCandidates = knownRoute
    .map(point => localCellAt(map, point))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell?.campPossible));
  const camps = [...new Set(campCandidates.filter((_, index) => index % 3 === 0).slice(0, Math.min(2, memory.summits)).map(pointKey))];
  const ropeCandidates = knownRoute
    .map(point => localCellAt(map, point))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell && (cell.ropeRequired || cell.ropeRecommended)));
  const legacyRopes = [...new Set(ropeCandidates.filter((_, index) => index % 2 === 0).slice(0, Math.min(4, Math.floor(dynamics.traceDensity / 18))).map(pointKey))];
  return { revealed, camps, legacyRopes };
}

function projectMountainPoint(
  xCell: number,
  yCell: number,
  elevation: number,
  grid: ReturnType<typeof generateMountainGrid>,
  yaw: number,
  pitch: number,
  zoom: number,
) {
  const cx = Math.max(1, (grid.width - 1) / 2);
  const cy = Math.max(1, (grid.height - 1) / 2);
  const x = (xCell - cx) / cx;
  const z = (yCell - cy) / cy;
  const normalizedHeight = (elevation - grid.baseElevation) / Math.max(1, grid.relief);
  const footprintScale = Math.max(0.72, Math.min(1.34, grid.physicalDiameterKm / 9));
  const verticalScale = Math.max(0.62, Math.min(1.58, grid.relief / 2950));
  const fit = Math.max(0.72, Math.min(1, 1 / Math.max(0.96, footprintScale * 0.92, verticalScale * 0.74)));
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const ry = normalizedHeight * 1.42 * verticalScale;
  const heightVisibility = Math.max(.32, Math.cos(pitchRad));
  const py = ry * heightVisibility - rz * Math.sin(pitchRad);
  const depth = rz * Math.cos(pitchRad) + ry * Math.sin(pitchRad);
  return {
    x: 500 + rx * 316 * footprintScale * fit * zoom,
    y: 410 - py * 252 * fit * zoom,
    depth,
  };
}

function projectCell(cell: MountainCell, grid: ReturnType<typeof generateMountainGrid>, yaw: number, pitch: number, zoom: number) {
  return projectMountainPoint(cell.x, cell.y, cell.elevation, grid, yaw, pitch, zoom);
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
    const polygons: Array<{ key: string; points: string; fill: string; depth: number; stroke?: string }> = [];
    const addPolygon = (key: string, projected: Array<{ x: number; y: number; depth: number }>, fill: string, stroke?: string) => {
      polygons.push({
        key,
        points: projected.map(point => `${point.x},${point.y}`).join(' '),
        fill,
        stroke,
        depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
      });
    };
    for (let y = 0; y < grid.height - 1; y += stride) {
      const y2 = Math.min(grid.height - 1, y + stride);
      for (let x = 0; x < grid.width - 1; x += stride) {
        const x2 = Math.min(grid.width - 1, x + stride);
        const cells = [cellAt(grid, { x, y }), cellAt(grid, { x: x2, y }), cellAt(grid, { x: x2, y: y2 }), cellAt(grid, { x, y: y2 })];
        if (cells.some(cell => !cell)) continue;
        addPolygon(`surface:${x}:${y}`, cells.map(cell => projectCell(cell!, grid, yaw, pitch, zoom)), terrainFill(cells[0]!), 'rgba(16,22,21,.2)');
      }
    }

    const baseElevation = grid.baseElevation - Math.max(120, grid.relief * .11);
    const skirt = (key: string, a: MountainCell, b: MountainCell, fill: string) => addPolygon(key, [
      projectCell(a, grid, yaw, pitch, zoom),
      projectCell(b, grid, yaw, pitch, zoom),
      projectMountainPoint(b.x, b.y, baseElevation, grid, yaw, pitch, zoom),
      projectMountainPoint(a.x, a.y, baseElevation, grid, yaw, pitch, zoom),
    ], fill, 'rgba(9,14,13,.34)');

    for (let x = 0; x < grid.width - 1; x += stride) {
      const x2 = Math.min(grid.width - 1, x + stride);
      skirt(`skirt:n:${x}`, cellAt(grid, { x, y: 0 })!, cellAt(grid, { x: x2, y: 0 })!, '#38433e');
      skirt(`skirt:s:${x}`, cellAt(grid, { x: x2, y: grid.height - 1 })!, cellAt(grid, { x, y: grid.height - 1 })!, '#222b28');
    }
    for (let y = 0; y < grid.height - 1; y += stride) {
      const y2 = Math.min(grid.height - 1, y + stride);
      skirt(`skirt:w:${y}`, cellAt(grid, { x: 0, y: y2 })!, cellAt(grid, { x: 0, y })!, '#303a36');
      skirt(`skirt:e:${y}`, cellAt(grid, { x: grid.width - 1, y })!, cellAt(grid, { x: grid.width - 1, y: y2 })!, '#1f2825');
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
          setPitch(Math.max(8, Math.min(72, dragRef.current.pitch - dy * 0.28)));
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
            <linearGradient id="mg-route-glow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".8"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
          </defs>
          <g>{mesh.map(poly => <polygon key={poly.key} points={poly.points} fill={poly.fill} stroke={poly.stroke ?? "rgba(16,22,21,.2)"} strokeWidth=".58" />)}</g>
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
        <button onClick={() => setPitch(72)}>Сверху</button>
        <button onClick={() => setPitch(18)}>Сбоку</button>
        <button onClick={() => { setYaw(-35); setPitch(38); setZoom(grid.relief >= 6000 ? 0.82 : grid.relief >= 4300 ? 0.9 : 1); }}>Сброс</button>
      </div>
    </section>
  );
}

function LocalMap({ map, path, positionIndex, camps, ropes, legacyRopes, revealed, selectedPoint, started, onCell }: {
  map: LocalStageMap;
  path: GridPoint[];
  positionIndex: number;
  camps: string[];
  ropes: string[];
  legacyRopes: string[];
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
          legacyRopes.includes(id) ? 'has-legacy-rope' : '',
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
            {!ropes.includes(id) && legacyRopes.includes(id) && <span className="mg-legacy-rope-mark">⌁</span>}
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
      <div className="mg-tool-hint">{started ? 'Нажми на клетку, чтобы проверить её. Разведка раскрывает квадрат 9×9 вокруг группы.' : 'Начни экспедицию после проверки людей и снаряжения.'}</div>
      <div className="mg-map-legend"><span><b className="legend-rope-required">R</b> верёвка обязательна</span><span><b className="legend-rope-recommended">r</b> полезна</span><span><b className="legend-camp" /> лагерь</span><span><b className="legend-legacy-rope">⌁</b> старая верёвка</span><span><b className="legend-unknown">?</b> не разведано</span></div>
    </div>
  );
}

function localProfileFor(option?: MountainRouteOption): LocalRouteProfile {
  return option?.localProfile ?? 'SAFE';
}

const EXPEDITION_TUTORIAL = [
  { title: 'Карта и группа', text: 'Линия движения строится заранее. Нажимай на клетки, чтобы смотреть высоту, склон и риск. Порядок группы фиксирован на всю вылазку.' },
  { title: 'Разведка', text: 'Одна разведка раскрывает квадрат 9×9 вокруг текущей позиции. Сильный навигатор делает это быстрее и лучше замечает скрытые угрозы.' },
  { title: 'Верёвка', text: 'Выбери соседний техничный участок и закрепи верёвку. Она снижает риск на крутом льду, скалах, трещинах и остаётся для спуска.' },
  { title: 'Силы всей группы', text: 'Каждый переход расходует силы у всех участников. Потери зависят от выносливости, груза, высоты, погоды и темпа.' },
  { title: 'Отдых и сон', text: 'Короткие привалы поддерживают темп. Бивак спасает в плохой ситуации. Полный сон длится около восьми часов и автоматически ставит лагерь на подходящей клетке.' },
  { title: 'Высота и возвращение', text: 'Выше 3000 м старайся не поднимать высоту сна больше чем на 500 м за ночь. После вершины экспедиция не закончена — группу нужно вернуть к старту.' },
] as const;

function ExpeditionTutorial({ step, onStep }: { step: number; onStep: (step: number) => void }) {
  if (step >= EXPEDITION_TUTORIAL.length) return null;
  const item = EXPEDITION_TUTORIAL[Math.max(0, step)]!;
  return (
    <div className="mg-tutorial-backdrop" role="dialog" aria-modal="true" aria-label="Обучение вылазке">
      <section className="mg-tutorial-card">
        <span>ОБУЧЕНИЕ ВЫЛАЗКЕ · {step + 1}/{EXPEDITION_TUTORIAL.length}</span>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        <div className="mg-tutorial-progress">{EXPEDITION_TUTORIAL.map((_, index) => <i key={index} className={index <= step ? 'is-active' : ''} />)}</div>
        <div className="mg-tutorial-actions">
          <button onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>Назад</button>
          <button onClick={() => onStep(EXPEDITION_TUTORIAL.length)}>Пропустить</button>
          <button onClick={() => onStep(step + 1)}>{step === EXPEDITION_TUTORIAL.length - 1 ? 'Понятно' : 'Далее'}</button>
        </div>
      </section>
    </div>
  );
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
        <header className="mg-header"><div><span>ALPINE LEGACY / 0.15.0</span><h1>Экспедиция недоступна</h1></div><div className="mg-header-actions"><button onClick={() => onExit(true)}>Вернуться</button></div></header>
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
  const [selectedPoint, setSelectedPoint] = useState<GridPoint>({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<ExpeditionTab>(() => topo.started ? 'CLIMB' : 'EXPEDITION');

  const participantMode = topo.authority !== 'COMMAND';
  const mountainMemory = useMemo(() => buildMountainMemory(integratedCareer, climb.mountainId), [integratedCareer.livingWorld, climb.mountainId]);
  const mountainDynamics = useMemo(() => buildMountainDynamics(integratedCareer, climb.mountainId, climb.routeId), [integratedCareer.year, integratedCareer.seasonDay, integratedCareer.livingWorld, climb.mountainId, climb.routeId]);
  const authoredRoute = integratedCareer.routes.find(route => route.id === climb.routeId);
  const gridProfile = useMemo(() => ({
    formId: authoredRoute?.mountainFormId,
    characterId: authoredRoute?.mountainCharacterId,
  }), [authoredRoute?.mountainFormId, authoredRoute?.mountainCharacterId]);
  const grid = useMemo(
    () => generateMountainGrid(`${topo.seed}:v${topo.variant}`, topo.startElevation, topo.summitElevation, undefined, gridProfile),
    [topo.seed, topo.variant, topo.startElevation, topo.summitElevation, gridProfile],
  );
  const routeOptions = useMemo(() => buildMountainRouteOptions(grid, topo.entrySide), [grid, topo.entrySide]);
  const authoredProfile = authoredRoute?.id.endsWith('east-glacier')
    ? 'GLACIER'
    : authoredRoute?.id.endsWith('north-line')
      ? (authoredRoute.routeArchetype?.includes('TRAVERSE') ? 'RIDGE' : 'DIRECT')
      : 'CLASSIC';
  const selectedRoute = routeOptions.find(option => option.id === topo.routeChoice)
    ?? (participantMode || topo.routeChoice === 'AUTO' ? routeOptions.find(option => option.profile === authoredProfile) ?? routeOptions[0] : undefined);
  const globalRoute = selectedRoute?.route ?? routeOptions[0]!.route;
  const routeName = authoredRoute?.name ?? climb.routeName ?? selectedRoute?.name ?? 'Авторская линия по локальным картам';
  const stages = useMemo(
    () => buildMountainStages(grid, topo.entrySide, globalRoute, selectedRoute?.profile ?? 'CUSTOM'),
    [grid, topo.entrySide, globalRoute, selectedRoute?.profile],
  );
  const stageIndex = Math.min(topo.stageIndex, Math.max(0, stages.length - 1));
  const stage = stages[stageIndex]!;
  const descending = topo.phase === 'DESCENT' || topo.phase === 'COMPLETE' || topo.phase === 'RETREATED';
  const localMap = useMemo(() => {
    const base = generateLocalStageMap(stage, grid.seed);
    const oriented = descending ? { ...base, start: base.goal, goal: base.start } : base;
    return applyMountainDynamicsToMap(oriented, mountainDynamics);
  }, [stage, grid.seed, descending, mountainDynamics]);
  const guidedLocalRoute = useMemo(() => findLocalGuidedRoute(localMap, localProfileFor(selectedRoute)), [localMap, selectedRoute]);
  const previousAscentPath = topo.completedStagePaths[stage.id];
  const defaultPath = descending && previousAscentPath
    ? [...previousAscentPath].reverse()
    : participantMode || selectedRoute
      ? guidedLocalRoute
      : [localMap.start];
  const rememberedInfrastructure = useMemo(() => inheritedInfrastructure(mountainMemory, localMap, defaultPath, mountainDynamics), [mountainMemory.attempts, mountainMemory.summits, mountainMemory.attention, localMap, defaultPath, mountainDynamics]);
  const storedPath = topo.paths[stage.id];
  const needsDescentPath = Boolean(
    descending
    && previousAscentPath?.length
    && storedPath?.length
    && isSamePoint(storedPath[0]!, previousAscentPath[0]!)
  );
  const path = needsDescentPath ? defaultPath : storedPath ?? defaultPath;
  const infra = topo.infrastructure[stage.id] ?? EMPTY_INTEGRATED_INFRASTRUCTURE;
  const weather = applyMountainDynamicsToWeather(integratedWeatherAt(topo), mountainDynamics);
  const completed = ['COMPLETE', 'RETREATED', 'FAILED'].includes(topo.phase);
  const currentPoint = path[Math.min(topo.positionIndex, Math.max(0, path.length - 1))] ?? localMap.start;
  const currentCell = localCellAt(localMap, currentPoint)!;
  const selectedCell = localCellAt(localMap, selectedPoint) ?? currentCell;
  const selectedId = pointKey(selectedCell);
  const selectedProtected = infra.ropes.includes(selectedId);
  const selectedRisk = integratedStepPreview(topo, localMap, currentPoint, selectedCell, weather, selectedProtected);
  const selectedDistance = Math.max(Math.abs(selectedCell.x - currentPoint.x), Math.abs(selectedCell.y - currentPoint.y));
  const canSecureSelected = selectedDistance <= 1 && (selectedCell.ropeRequired || selectedCell.ropeRecommended || selectedCell.hazard !== 'NONE');
  const context: IntegratedExpeditionContext = { stageId: stage.id, stageTitle: stage.title, stageCount: stages.length, localMap, weather };

  useEffect(() => {
    let nextTopo = topo;
    if (!topo.paths[stage.id]?.length || needsDescentPath) {
      nextTopo = reduceIntegratedExpedition(nextTopo, { type: 'ENSURE_STAGE_PATH', stageId: stage.id, path: defaultPath, currentElevation: localCellAt(localMap, defaultPath[0] ?? localMap.start)?.elevation ?? topo.currentElevation, replace: needsDescentPath }, context);
    }
    if (!descending && (rememberedInfrastructure.revealed.length > 0 || rememberedInfrastructure.camps.length > 0)) {
      nextTopo = reduceIntegratedExpedition(nextTopo, { type: 'APPLY_MOUNTAIN_MEMORY', stageId: stage.id, revealed: rememberedInfrastructure.revealed, camps: rememberedInfrastructure.camps }, context);
    }
    if (nextTopo !== topo) onPersist(persistIntegratedExpedition(integratedCareer, nextTopo));
    setSelectedPoint(path[Math.min(topo.positionIndex, Math.max(0, path.length - 1))] ?? localMap.start);
    setPaused(true);
  }, [stage.id, descending, rememberedInfrastructure.revealed.join('|'), rememberedInfrastructure.camps.join('|')]);


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
    const cell = localCellAt(localMap, point);
    if (!cell?.passable) return;
    setSelectedPoint(point);
  }

  function scoutArea() {
    if (!topo.started || !paused || completed) return;
    const minutes = Math.max(8, 20 - navigator.skills.NAVIGATION);
    commit({ type: 'SCOUT', point: currentPoint, radius: 4, minutes });
  }

  function secureSelectedPoint() {
    if (!topo.started || !paused || completed) return;
    const distance = Math.max(Math.abs(selectedCell.x - currentPoint.x), Math.abs(selectedCell.y - currentPoint.y));
    if (distance > 1) return;
    if (!selectedCell.ropeRequired && !selectedCell.ropeRecommended && selectedCell.hazard === 'NONE') return;
    commit({ type: 'TOGGLE_ROPE', point: selectedCell });
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
  const specialistNames = [...new Set([navigator.name, technician.name, medic.name])];
  const specialistSummary = specialistNames.length === 1 ? `${specialistNames[0]} · все роли` : specialistNames.join(' · ');
  const outcomeLabel = topo.phase === 'COMPLETE' ? 'Вершина и возвращение' : topo.phase === 'RETREATED' ? 'Экспедиция завершена отходом' : 'Экспедиция провалена';

  return (
    <main className="mg-app mg-expedition-shell">
      <header className="mg-header mg-expedition-header">
        <div className="mg-header-copy">
          <span>ALPINE LEGACY / 0.15.0</span>
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

      {topo.started && !completed && <ExpeditionTutorial step={topo.tutorialStep} onStep={step => commit({ type: 'SET_TUTORIAL_STEP', step })} />}

      <section className="mg-tab-panel">
        {activeTab === 'CLIMB' && (
          <section className="mg-stage-card mg-climb-tab" role="tabpanel">
            <div className="mg-stage-topline">
              <div className="mg-stage-heading">
                <span>{phaseLabel} · ЭТАП {stageIndex + 1} / {stages.length}</span>
                <h2>{stage.title}</h2>
                <p>{stage.subtitle} · сложность {stage.difficulty}/5 · {mountainDynamics.seasonTitle.toLowerCase()}</p>
              </div>
              <div className="mg-stage-weather mg-status-strip" aria-label="Состояние вылазки">
                <span><small>ТЕМП.</small><b>{weather.temperatureC}°</b></span>
                <span><small>ВЕТЕР</small><b>{weather.windKmh}</b></span>
                <span><small>ВИДИМ.</small><b>{weather.visibility}%</b></span>
                <span><small>ВЫСОТА</small><b>{Math.round(currentCell.elevation)} м</b></span>
                <span><small>ГРУППА</small><b>{teamAverageCondition}%</b></span>
                <span><small>СИЛЫ</small><b>{teamAverageEnergy}%</b></span>
                <span><small>В ПУТИ</small><b>{formatMinutes(topo.elapsedMinutes)}</b></span>
                <span className={`is-risk-${selectedRisk.band.toLowerCase()}`}><small>ТОЧКА</small><b>{Math.round(selectedCell.elevation)} м · {RISK_COPY[selectedRisk.band]}</b></span>
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
                  camps={infra.camps}
                  ropes={infra.ropes}
                  legacyRopes={rememberedInfrastructure.legacyRopes}
                  revealed={infra.revealed}
                  selectedPoint={selectedPoint}
                  started={topo.started}
                  onCell={handleCell}
                />
                <aside className="mg-local-aside">
                  <div className="mg-compact-actions" role="group" aria-label="Полевые действия">
                    <button onClick={scoutArea} disabled={!paused || completed}>
                      <strong>Разведка 9×9</strong><small>{Math.max(8, 20 - navigator.skills.NAVIGATION)} мин · {navigator.name}</small>
                    </button>
                    <button onClick={secureSelectedPoint} disabled={!paused || completed || !canSecureSelected} className={selectedProtected ? 'is-active' : ''}>
                      <strong>{selectedProtected ? 'Снять верёвку' : 'Закрепить верёвку'}</strong><small>{canSecureSelected ? `${selectedCell.elevation} м · ${technician.name}` : 'выбери соседний техничный участок'}</small>
                    </button>
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
                      <button onClick={() => commit({ type: 'REST', mode: 'BREAK' as IntegratedRestMode })} disabled={!paused}>Короткий привал <small>20 мин</small></button>
                      <button onClick={() => commit({ type: 'REST', mode: 'BIVOUAC' as IntegratedRestMode })} disabled={!paused}>Бивак <small>5 ч · слабое восстановление</small></button>
                      <button onClick={() => commit({ type: 'REST', mode: 'SLEEP' as IntegratedRestMode })} disabled={!paused}>Сон <small>8 ч · лагерь автоматически</small></button>
                      <p>С последнего сна: {formatMinutes(topo.minutesSinceSleep)}. Выше 3000 м безопасный набор высоты сна — около 500 м за ночь.</p>
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
                <div><span>ГОТОВНОСТЬ · {mountainDynamics.seasonTitle}</span><h3>Команда собрана</h3><p>{mountainDynamics.seasonSummary} Навигатор ведёт разведку, техник отвечает за страховку, медик работает с травмами.</p></div>
                <dl>
                  <div><dt>Команда</dt><dd>{topo.participants.length}</dd></div>
                  <div><dt>Специалисты</dt><dd>{specialistSummary}</dd></div>
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
                    <div className="mg-panel-head"><div><span>ЛЮДИ</span><strong>{topo.participants.length} участников</strong></div><small>порядок зафиксирован перед выходом</small></div>
                    <div className="mg-team-list">{topo.participants.map(member => (
                      <article key={member.id} className={member.status === 'INCAPACITATED' || member.status === 'DEAD' ? 'is-critical' : ''}>
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.role} · {member.specialty}</span>
                          <small>Силы {Math.round(member.energy)} · состояние {Math.round(member.condition)} · груз {member.loadKg.toFixed(1)}/{member.carryCapacityKg.toFixed(1)} кг</small>
                          <small>Выносливость {member.skills.ENDURANCE} · скалы {member.skills.ROCK} · лёд {member.skills.ICE} · навигация {member.skills.NAVIGATION} · медицина {member.skills.MEDICINE}</small>
                          <small>Мораль {Math.round(member.morale)} · доверие {Math.round(member.trust)}{member.injury ? ` · ${member.injury}` : ''}</small>
                        </div>
                      </article>
                    ))}</div>
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
