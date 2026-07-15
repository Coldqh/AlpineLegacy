import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMountainStages,
  cellAt,
  findGuidedRoute,
  findLocalGuidedRoute,
  generateLocalStageMap,
  generateMountainGrid,
  isAdjacent,
  isSamePoint,
  localCellAt,
  weatherAtGrid,
  type EntrySide,
  type GridPoint,
  type LocalStageMap,
  type MountainCell,
  type MountainTerrain,
  type StageDefinition,
} from './mountainGridEngine';

type Participant = { id: string; name: string; role: string; energy: number };
type Tool = 'ROUTE' | 'ROPE' | 'CAMP' | 'SCOUT';

type Authority = 'COMMAND' | 'PARTICIPANT' | 'SPECIALIST';

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

const TERRAIN_CLASS: Record<MountainTerrain, string> = {
  VALLEY: 'terrain-valley', SCREE: 'terrain-scree', GLACIER: 'terrain-glacier', SNOW: 'terrain-snow', ROCK: 'terrain-rock', RIDGE: 'terrain-ridge', SUMMIT: 'terrain-summit',
};

const initialParticipants: Participant[] = [
  { id: 'p1', name: 'Илья Морен', role: 'Ведущий', energy: 100 },
  { id: 'p2', name: 'Нора Вальд', role: 'Навигатор', energy: 100 },
  { id: 'p3', name: 'Томас Рейн', role: 'Замыкающий', energy: 100 },
];

function pointKey(point: GridPoint) { return `${point.x}:${point.y}`; }

function projectCell(cell: MountainCell, width: number, height: number, yaw: number, pitch: number, zoom: number) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const x = (cell.x - cx) / cx;
  const z = (cell.y - cy) / cy;
  const y = (cell.elevation - 620) / 2860;
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const ry = y * 1.38;
  const py = ry * Math.cos(pitchRad) - rz * Math.sin(pitchRad);
  const depth = ry * Math.sin(pitchRad) + rz * Math.cos(pitchRad);
  return {
    x: 500 + rx * 330 * zoom,
    y: 390 - py * 260 * zoom,
    depth,
  };
}

function terrainFill(terrain: MountainTerrain) {
  if (terrain === 'VALLEY') return '#4e594d';
  if (terrain === 'SCREE') return '#756e61';
  if (terrain === 'GLACIER') return '#b9d2d5';
  if (terrain === 'SNOW') return '#e4e7e2';
  if (terrain === 'ROCK') return '#4c4a45';
  if (terrain === 'RIDGE') return '#cbd0cb';
  return '#f4f1e8';
}

function MountainViewer({ grid, route, stages, side, currentStage }: { grid: ReturnType<typeof generateMountainGrid>; route: GridPoint[]; stages: StageDefinition[]; side: EntrySide; currentStage: number }) {
  const [yaw, setYaw] = useState(-35);
  const [pitch, setPitch] = useState(38);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const stride = 2;
  const mesh = useMemo(() => {
    const polygons: Array<{ key: string; points: string; fill: string; depth: number }> = [];
    for (let y = 0; y < grid.height - stride; y += stride) {
      for (let x = 0; x < grid.width - stride; x += stride) {
        const cells = [cellAt(grid, { x, y }), cellAt(grid, { x: x + stride, y }), cellAt(grid, { x: x + stride, y: y + stride }), cellAt(grid, { x, y: y + stride })];
        if (cells.some(cell => !cell)) continue;
        const projected = cells.map(cell => projectCell(cell!, grid.width, grid.height, yaw, pitch, zoom));
        polygons.push({
          key: `${x}:${y}`,
          points: projected.map(point => `${point.x},${point.y}`).join(' '),
          fill: terrainFill(cells[0]!.terrain),
          depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
        });
      }
    }
    return polygons.sort((a, b) => a.depth - b.depth);
  }, [grid, yaw, pitch, zoom]);

  const summitCell = cellAt(grid, grid.summit)!;
  const summitPoint = projectCell(summitCell, grid.width, grid.height, yaw, pitch, zoom);
  const entryCell = cellAt(grid, grid.entries[side])!;
  const entryPoint = projectCell(entryCell, grid.width, grid.height, yaw, pitch, zoom);
  const stagePoints = stages.map(stage => {
    const cell = cellAt(grid, stage.globalPoint)!;
    return { stage, projected: projectCell(cell, grid.width, grid.height, yaw, pitch, zoom) };
  });
  const routePath = route.map(point => {
    const cell = cellAt(grid, point)!;
    const projected = projectCell(cell, grid.width, grid.height, yaw, pitch, zoom);
    return `${projected.x},${projected.y}`;
  }).join(' ');

  return (
    <section className="mg-viewer-card">
      <div className="mg-panel-head"><div><span>3D МАССИВ</span><strong>полная гора · заход с любой стороны</strong></div><small>тяни в любую сторону</small></div>
      <div
        className="mg-3d-canvas"
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, yaw, pitch }; }}
        onPointerMove={event => {
          if (!dragRef.current) return;
          const dx = event.clientX - dragRef.current.x;
          const dy = event.clientY - dragRef.current.y;
          setYaw(dragRef.current.yaw + dx * 0.35);
          setPitch(Math.max(-12, Math.min(78, dragRef.current.pitch - dy * 0.28)));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={event => { event.preventDefault(); setZoom(value => Math.max(0.7, Math.min(1.45, value - event.deltaY * 0.001))); }}
      >
        <svg viewBox="0 0 1000 700" role="img" aria-label="Интерактивная трёхмерная модель полной горы">
          <defs><filter id="mg-shadow"><feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".25" /></filter></defs>
          <g filter="url(#mg-shadow)">{mesh.map(poly => <polygon key={poly.key} points={poly.points} fill={poly.fill} stroke="rgba(20,25,25,.22)" strokeWidth=".7" />)}</g>
          {route.length > 1 && <polyline points={routePath} fill="none" stroke="#df5f3d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
          {stagePoints.map(({ stage, projected }) => (
            <g key={stage.id} transform={`translate(${projected.x} ${projected.y})`} className={stage.index === currentStage ? 'mg-3d-stage is-active' : 'mg-3d-stage'}>
              <circle r={stage.index === currentStage ? 9 : 6} /><text x="12" y="4">{stage.index + 1}</text>
            </g>
          ))}
          <g transform={`translate(${entryPoint.x} ${entryPoint.y})`} className="mg-entry-marker"><circle r="8"/><text x="12" y="4">СТАРТ · {SIDE_COPY[side]}</text></g>
          <g transform={`translate(${summitPoint.x} ${summitPoint.y})`} className="mg-summit-marker"><path d="M0 -18 L14 10 L-14 10 Z"/><text x="18" y="4">ПИК · {grid.summitElevation} м</text></g>
        </svg>
        <div className="mg-camera-readout"><span>Поворот {Math.round(yaw)}°</span><span>Наклон {Math.round(pitch)}°</span><span>Масштаб {Math.round(zoom * 100)}%</span></div>
      </div>
      <div className="mg-camera-buttons">
        <button onClick={() => setYaw(value => value - 20)}>←</button>
        <button onClick={() => setYaw(value => value + 20)}>→</button>
        <button onClick={() => setPitch(value => Math.min(78, value + 10))}>Вид сверху</button>
        <button onClick={() => setPitch(value => Math.max(-12, value - 10))}>Вид снизу</button>
        <button onClick={() => { setYaw(-35); setPitch(38); setZoom(1); }}>Сброс</button>
      </div>
    </section>
  );
}

function LocalMap({ map, path, positionIndex, tool, camps, ropes, revealed, onCell }: {
  map: LocalStageMap;
  path: GridPoint[];
  positionIndex: number;
  tool: Tool;
  camps: string[];
  ropes: string[];
  revealed: string[];
  onCell: (point: GridPoint) => void;
}) {
  const current = path[Math.min(positionIndex, Math.max(0, path.length - 1))] ?? map.start;
  return (
    <div className="mg-local-map" style={{ '--cols': map.width } as React.CSSProperties}>
      {map.cells.map(cell => {
        const id = pointKey(cell);
        const inPath = path.some(point => isSamePoint(point, cell));
        const isCurrent = isSamePoint(current, cell);
        const hiddenHazard = cell.hazard !== 'NONE' && !revealed.includes(id) && !isCurrent;
        const classes = [
          'mg-local-cell', TERRAIN_CLASS[cell.terrain], !cell.passable ? 'is-blocked' : '', inPath ? 'is-route' : '', isCurrent ? 'is-current' : '',
          isSamePoint(map.start, cell) ? 'is-start' : '', isSamePoint(map.goal, cell) ? 'is-goal' : '', camps.includes(id) ? 'has-camp' : '', ropes.includes(id) ? 'has-rope' : '',
        ].filter(Boolean).join(' ');
        return (
          <button key={id} className={classes} onClick={() => onCell(cell)} disabled={!cell.passable} title={`${cell.elevation} м · ${TERRAIN_COPY[cell.terrain]}`}>
            <span className="mg-cell-height">{cell.elevation}</span>
            {!hiddenHazard && cell.hazard !== 'NONE' && <i className={`hazard-${cell.hazard.toLowerCase()}`}>!</i>}
            {cell.campPossible && <b className="mg-camp-dot" />}
            {camps.includes(id) && <em>▲</em>}
            {ropes.includes(id) && <u>⌁</u>}
          </button>
        );
      })}
      <div className="mg-map-north">N</div>
      <div className="mg-tool-hint">{tool === 'ROUTE' ? 'Кликай соседние клетки и прокладывай локальную линию' : tool === 'CAMP' ? 'Выбери подходящую площадку' : tool === 'ROPE' ? 'Закрепи верёвку на сложной клетке' : 'Разведай клетку и соседние участки'}</div>
    </div>
  );
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
  const globalRoute = useMemo(() => findGuidedRoute(grid, entrySide), [grid, entrySide]);
  const stages = useMemo(() => buildMountainStages(grid, entrySide), [grid, entrySide]);
  const [phase, setPhase] = useState<'ASCENT' | 'DESCENT' | 'COMPLETE'>('ASCENT');
  const [stageIndex, setStageIndex] = useState(0);
  const stage = stages[stageIndex]!;
  const localMap = useMemo(() => {
    const base = generateLocalStageMap(stage, seed);
    return phase === 'DESCENT' ? { ...base, id: `${base.id}:descent`, start: base.goal, goal: base.start } : base;
  }, [stage, seed, phase]);
  const guidedLocalRoute = useMemo(() => findLocalGuidedRoute(localMap), [localMap]);
  const [path, setPath] = useState<GridPoint[]>([localMap.start]);
  const [positionIndex, setPositionIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [tool, setTool] = useState<Tool>('ROUTE');
  const [camps, setCamps] = useState<string[]>([]);
  const [ropes, setRopes] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [participants, setParticipants] = useState(initialParticipants);
  const [message, setMessage] = useState('Выбери сторону захода, осмотри полную гору и пройди первый локальный этап.');
  const completed = phase === 'COMPLETE';

  useEffect(() => {
    const initialPath = participantMode ? guidedLocalRoute : [localMap.start];
    setPath(initialPath);
    setPositionIndex(0);
    setPaused(true);
    setCamps([]);
    setRopes([]);
    setRevealed([]);
    setTool('ROUTE');
    setMessage(participantMode ? 'Руководитель уже проложил локальную линию. Запусти движение и следи за участком.' : 'Проведи локальный маршрут от нижней клетки к верхней.');
  }, [localMap, guidedLocalRoute, participantMode]);

  useEffect(() => {
    if (paused || completed || path.length < 2 || positionIndex >= path.length - 1) return;
    const delay = Math.max(160, 850 / speed);
    const timer = window.setTimeout(() => {
      const nextIndex = positionIndex + 1;
      const next = path[nextIndex]!;
      const cell = localCellAt(localMap, next)!;
      const hazardKnown = revealed.includes(pointKey(next));
      if (cell.hazard !== 'NONE' && !hazardKnown && !ropes.includes(pointKey(next))) {
        setPaused(true);
        setRevealed(values => [...values, pointKey(next)]);
        setMessage(`Группа остановлена: обнаружена опасность «${cell.hazard}». Скорректируй путь, разведай клетку или закрепи верёвку.`);
        return;
      }
      setPositionIndex(nextIndex);
      setElapsedMinutes(value => value + Math.round((18 + Math.abs(cell.elevation - localCellAt(localMap, path[nextIndex - 1]!)!.elevation) / 6) / speed));
      setParticipants(current => current.map((member, index) => ({ ...member, energy: Math.max(0, member.energy - (index === 0 ? 2 : 1)) })));
      if (nextIndex >= path.length - 1) {
        setPaused(true);
        if (isSamePoint(next, localMap.goal)) {
          if (phase === 'ASCENT' && stageIndex >= stages.length - 1) {
            setPhase('DESCENT');
            setMessage('Вершина достигнута. Начинается спуск по отдельным локальным картам.');
          } else if (phase === 'ASCENT') {
            setMessage(`Этап «${stage.title}» пройден. Открыт следующий участок.`);
            window.setTimeout(() => setStageIndex(value => value + 1), 250);
          } else if (stageIndex <= 0) {
            setPhase('COMPLETE');
            setMessage('Группа вернулась к старту. Полный подъём и спуск завершены.');
          } else {
            setMessage(`Спуск через «${stage.title}» завершён. Ниже открыт следующий этап.`);
            window.setTimeout(() => setStageIndex(value => value - 1), 250);
          }
        } else {
          setMessage('План закончился до выхода из этапа. Продолжи маршрут с текущей клетки.');
        }
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [paused, completed, path, positionIndex, speed, localMap, revealed, ropes, stageIndex, stages.length, stage.title, phase]);

  const weather = weatherAtGrid(elapsedMinutes);
  const currentPoint = path[Math.min(positionIndex, Math.max(0, path.length - 1))] ?? localMap.start;
  const currentCell = localCellAt(localMap, currentPoint)!;
  const routeReady = path.length > 1 && isSamePoint(path[path.length - 1]!, localMap.goal);

  function changeEntry(side: EntrySide) {
    if (stageIndex !== 0 || positionIndex !== 0) return;
    setEntrySide(side);
  }

  function handleCell(point: GridPoint) {
    if (!paused || completed) return;
    const cell = localCellAt(localMap, point);
    if (!cell?.passable) return;
    const id = pointKey(point);
    if (tool === 'SCOUT') {
      const around = localMap.cells.filter(item => Math.max(Math.abs(item.x - point.x), Math.abs(item.y - point.y)) <= 1).map(pointKey);
      setRevealed(values => [...new Set([...values, ...around])]);
      setElapsedMinutes(value => value + 20);
      setMessage('Разведан локальный квадрат и соседние клетки.');
      return;
    }
    if (tool === 'CAMP') {
      if (!cell.campPossible) { setMessage('Здесь нет площадки для лагеря. Ищи ровную безопасную клетку.'); return; }
      setCamps(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
      setMessage('Лагерь отмечен на локальной карте.');
      return;
    }
    if (tool === 'ROPE') {
      if (!cell.ropeRecommended && cell.hazard === 'NONE') { setMessage('На этой клетке верёвка почти ничего не даёт.'); return; }
      setRopes(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
      setMessage('Верёвка закреплена на конкретной клетке этапа.');
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
    setMessage(isSamePoint(point, localMap.goal) ? 'Локальная линия готова. Запускай движение.' : 'Маршрут продолжен.');
  }

  function toggleMove() {
    if (completed) return;
    if (!paused) { setPaused(true); return; }
    if (path.length < 2 || positionIndex >= path.length - 1) { setMessage('Сначала продолжи маршрут от текущей клетки.'); return; }
    setPaused(false);
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
        <div><span>ALPINE LEGACY / 0.7.2</span><h1>{mountainName} · полная гора и локальные карты</h1></div>
        <div className="mg-header-actions">{allowRegenerate && <button onClick={() => setVariant(value => value + 1)}>Новая генерация</button>}<button onClick={onExit}>Закрыть</button></div>
      </header>

      <section className="mg-layout">
        <div className="mg-main-column">
          <MountainViewer grid={grid} route={globalRoute} stages={stages} side={entrySide} currentStage={stageIndex} />

          <section className="mg-stage-card">
            <div className="mg-stage-topline">
              <div><span>{phase === 'DESCENT' ? 'СПУСК' : phase === 'COMPLETE' ? 'ЗАВЕРШЕНО' : 'ПОДЪЁМ'} · ЭТАП {stageIndex + 1} / {stages.length}</span><h2>{stage.title}</h2><p>{stage.subtitle} · {stage.type}</p></div>
              <div className="mg-stage-weather"><span>{weather.temperatureC}°C</span><span>ветер {weather.windKmh}</span><span>видимость {weather.visibility}%</span></div>
            </div>

            <div className="mg-local-layout">
              <LocalMap map={localMap} path={path} positionIndex={positionIndex} tool={tool} camps={camps} ropes={ropes} revealed={revealed} onCell={handleCell} />
              <aside className="mg-local-aside">
                <div className="mg-current-cell"><span>ТЕКУЩАЯ КЛЕТКА</span><strong>{currentCell.elevation} м</strong><p>{TERRAIN_COPY[currentCell.terrain]} · {currentCell.hazard === 'NONE' ? 'опасность не замечена' : currentCell.hazard}</p></div>
                <div className="mg-tools">
                  {(['ROUTE', 'SCOUT', 'ROPE', 'CAMP'] as Tool[]).map(id => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} disabled={!paused}>{id === 'ROUTE' ? 'Маршрут' : id === 'SCOUT' ? 'Разведка' : id === 'ROPE' ? 'Верёвка' : 'Лагерь'}</button>)}
                </div>
                <div className="mg-message"><span>{paused ? 'ПАУЗА' : `ДВИЖЕНИЕ ×${speed}`}</span><p>{message}</p></div>
                <div className="mg-time-controls"><button onClick={toggleMove}>{paused ? '▶ Запустить' : 'Ⅱ Пауза'}</button>{([1, 2, 4] as const).map(value => <button key={value} className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>×{value}</button>)}</div>
                <small className="mg-route-state">Линия: {path.length - 1} клеток · {routeReady ? 'до выхода этапа' : 'не завершена'} · время {Math.floor(elapsedMinutes / 60)}:{String(elapsedMinutes % 60).padStart(2, '0')}</small>
              </aside>
            </div>
          </section>
        </div>

        <aside className="mg-side-column">
          <section className="mg-side-card">
            <div className="mg-panel-head"><div><span>СТОРОНА ЗАХОДА</span><strong>{SIDE_COPY[entrySide]}</strong></div></div>
            <div className="mg-entry-grid">{(Object.keys(SIDE_COPY) as EntrySide[]).map(side => <button key={side} className={entrySide === side ? 'is-active' : ''} onClick={() => changeEntry(side)} disabled={stageIndex !== 0 || positionIndex !== 0}>{SIDE_COPY[side]}</button>)}</div>
            <p>Гора генерируется целиком. Старт можно выбрать на любой стороне до начала первого этапа.</p>
          </section>

          <section className="mg-side-card">
            <div className="mg-panel-head"><div><span>ЭКСПЕДИЦИЯ</span><strong>{participantMode ? 'готовый план лидера' : 'твоё управление'}</strong></div></div>
            <div className="mg-team-list">{participants.map((member, index) => <article key={member.id}><div><strong>{member.name}</strong><span>{member.role}</span><small>{member.energy >= 70 ? 'Свежий' : member.energy >= 40 ? 'Устал' : 'На пределе'}</small></div><div><button onClick={() => reorder(index, -1)} disabled={!paused || index === 0}>↑</button><button onClick={() => reorder(index, 1)} disabled={!paused || index === participants.length - 1}>↓</button></div></article>)}</div>
          </section>

          <section className="mg-side-card mg-stage-list-card">
            <div className="mg-panel-head"><div><span>РАЗВЁРТКА ГОРЫ</span><strong>каждый этап — отдельная карта</strong></div></div>
            <ol>{stages.map(item => <li key={item.id} className={item.index === stageIndex ? 'is-active' : (phase === 'ASCENT' ? item.index < stageIndex : item.index > stageIndex) ? 'is-done' : ''}><span>{String(item.index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></li>)}</ol>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default TopoExpeditionPrototype;
