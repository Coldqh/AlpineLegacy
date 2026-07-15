import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TOPO_CAMP_SITES,
  TOPO_CREVASSES,
  TOPO_MAP_HEIGHT,
  TOPO_MAP_WIDTH,
  TOPO_START,
  TOPO_START_ELEVATION,
  TOPO_SUMMIT,
  TOPO_SUMMIT_ELEVATION,
  TOPO_TERRAIN_ZONES,
  canPlaceCamp,
  clamp,
  decimateRoute,
  distance,
  elevationAt,
  estimateRoute,
  formatClock,
  movementFactor,
  pointAtDistance,
  polylinePrefix,
  polylineLength,
  routeToPath,
  terrainAt,
  weatherAt,
  type TopoPoint,
} from './topoEngine';

type ToolId = 'ROUTE' | 'ROPE' | 'CAMP' | 'SCOUT' | 'MARKER';
type Phase = 'ASCENT' | 'DESCENT' | 'COMPLETE';
type ParticipantId = 'lead' | 'middle' | 'rear';

type Participant = {
  id: ParticipantId;
  name: string;
  specialty: string;
  energy: number;
  condition: number;
  note: string;
};

type FixedRope = { id: string; a: TopoPoint; b: TopoPoint; metres: number; damaged: boolean };
type Camp = { id: string; point: TopoPoint; label: string };
type Marker = { id: string; point: TopoPoint; label: string };

type SimState = {
  phase: Phase;
  paused: boolean;
  timeScale: 1 | 2 | 4;
  elapsedMinutes: number;
  position: TopoPoint;
  route: TopoPoint[];
  routeTravelled: number;
  participants: Participant[];
  roped: boolean;
  ropeSpacing: number;
  fixedRopes: FixedRope[];
  ropeMetres: number;
  camps: Camp[];
  markers: Marker[];
  revealedCrevasseIds: string[];
  blockedCrevasseIds: string[];
  lastMessage: string;
  summitReached: boolean;
};

const initialParticipants: Participant[] = [
  { id: 'lead', name: 'Илья Морен', specialty: 'Ледовик', energy: 100, condition: 100, note: 'Ведёт след' },
  { id: 'middle', name: 'Нора Вальд', specialty: 'Навигатор', energy: 100, condition: 100, note: 'Контроль линии' },
  { id: 'rear', name: 'Томас Рейн', specialty: 'Поддержка', energy: 100, condition: 100, note: 'Груз и замыкающий' },
];

const terrainCopy: Record<ReturnType<typeof terrainAt>, string> = {
  VALLEY: 'Долина',
  SCREE: 'Осыпь',
  GLACIER: 'Ледник',
  SNOW: 'Снежный склон',
  RIDGE: 'Гребень',
  ROCK: 'Скалы',
};

const toolCopy: Array<{ id: ToolId; label: string; note: string }> = [
  { id: 'ROUTE', label: 'Маршрут', note: 'Проведи линию' },
  { id: 'ROPE', label: 'Верёвка', note: 'Две точки' },
  { id: 'CAMP', label: 'Лагерь', note: 'Ровная площадка' },
  { id: 'SCOUT', label: 'Разведка', note: 'Открыть район' },
  { id: 'MARKER', label: 'Маркер', note: 'Пометить место' },
];

function statusFor(value: number) {
  if (value >= 72) return 'Свежий';
  if (value >= 46) return 'Рабочий';
  if (value >= 24) return 'Устал';
  return 'На пределе';
}

function contourLoops() {
  return Array.from({ length: 15 }, (_, index) => {
    const t = index / 14;
    const rx = 450 - index * 24;
    const ry = 315 - index * 17;
    const centerX = 560 + index * 14;
    const centerY = 410 - index * 20;
    const points = Array.from({ length: 44 }, (_, step) => {
      const angle = step / 43 * Math.PI * 2;
      const noise = Math.sin(angle * 3 + index * 0.7) * (10 - t * 5) + Math.cos(angle * 5 - index) * 5;
      return {
        x: centerX + Math.cos(angle) * (rx + noise),
        y: centerY + Math.sin(angle) * (ry + noise * 0.55),
      };
    });
    return { id: `contour-${index}`, path: `${routeToPath(points)} Z`, major: index % 3 === 0 };
  });
}

function polygonPoints(points: TopoPoint[]) {
  return points.map(point => `${point.x},${point.y}`).join(' ');
}

function pointToLineDistance(point: TopoPoint, a: TopoPoint, b: TopoPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.001) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function hasFixedRopeNear(point: TopoPoint, ropes: FixedRope[]) {
  return ropes.some(rope => !rope.damaged && pointToLineDistance(point, rope.a, rope.b) <= 28);
}

function mapPoint(event: React.PointerEvent<SVGSVGElement>): TopoPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width * TOPO_MAP_WIDTH, 0, TOPO_MAP_WIDTH),
    y: clamp((event.clientY - rect.top) / rect.height * TOPO_MAP_HEIGHT, 0, TOPO_MAP_HEIGHT),
  };
}

function shortTime(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} мин`;
  return `${Math.floor(minutes / 60)} ч ${Math.round(minutes % 60)} мин`;
}

function routeEnd(route: TopoPoint[]) {
  return route[route.length - 1] ?? null;
}

export function TopoExpeditionPrototype({ onExit }: { onExit: () => void }) {
  const contours = useMemo(contourLoops, []);
  const [tool, setTool] = useState<ToolId>('ROUTE');
  const [drawing, setDrawing] = useState(false);
  const [draftRoute, setDraftRoute] = useState<TopoPoint[]>([]);
  const [ropeStart, setRopeStart] = useState<TopoPoint | null>(null);
  const [sim, setSim] = useState<SimState>({
    phase: 'ASCENT',
    paused: true,
    timeScale: 1,
    elapsedMinutes: 0,
    position: TOPO_START,
    route: [],
    routeTravelled: 0,
    participants: initialParticipants,
    roped: false,
    ropeSpacing: 18,
    fixedRopes: [],
    ropeMetres: 120,
    camps: [],
    markers: [],
    revealedCrevasseIds: TOPO_CREVASSES.filter(item => !item.hidden).map(item => item.id),
    blockedCrevasseIds: [],
    lastMessage: 'Пауза. Изучи рельеф и проведи первую линию от группы.',
    summitReached: false,
  });
  const simRef = useRef(sim);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    simRef.current = sim;
  }, [sim]);

  const weather = weatherAt(sim.elapsedMinutes);
  const routeEstimate = useMemo(() => estimateRoute(sim.route, sim.elapsedMinutes), [sim.route, sim.elapsedMinutes]);
  const currentTerrain = terrainAt(sim.position);
  const currentElevation = elevationAt(sim.position);
  const target = sim.phase === 'ASCENT' ? TOPO_SUMMIT : TOPO_START;
  const targetLabel = sim.phase === 'ASCENT' ? 'вершины' : 'старта';
  const nearCamp = sim.camps.find(camp => distance(camp.point, sim.position) <= 42) ?? null;
  const totalRouteLength = polylineLength(sim.route);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const previous = lastTickRef.current ?? now;
      const realSeconds = Math.min(0.12, (now - previous) / 1000);
      const current = simRef.current;
      if (realSeconds >= 0.045) lastTickRef.current = now;
      if (realSeconds >= 0.045 && !current.paused && current.phase !== 'COMPLETE' && current.route.length >= 2) {
        const gameMinutes = realSeconds * 2.4 * current.timeScale;
        setSim(state => {
          if (state.paused || state.route.length < 2) return state;
          const routeLength = polylineLength(state.route);
          const here = pointAtDistance(state.route, state.routeTravelled);
          const ahead = pointAtDistance(state.route, Math.min(routeLength, state.routeTravelled + 12));
          const fixedRope = hasFixedRopeNear(here, state.fixedRopes);
          const liveWeather = weatherAt(state.elapsedMinutes);
          const leader = state.participants[0]!;
          const exhaustion = clamp(0.42 + leader.energy / 115, 0.38, 1.08);
          const ropePenalty = state.roped ? 0.91 : 1;
          const factor = movementFactor(here, ahead, liveWeather, fixedRope) * exhaustion * ropePenalty;
          const movement = gameMinutes * 1.16 * factor;
          const nextTravelled = Math.min(routeLength, state.routeTravelled + movement);
          const nextPosition = pointAtDistance(state.route, nextTravelled);
          const terrain = terrainAt(nextPosition);

          const newlyVisible = TOPO_CREVASSES
            .filter(crevasse => !state.revealedCrevasseIds.includes(crevasse.id))
            .filter(crevasse => liveWeather.visibility >= 42 && pointToLineDistance(nextPosition, crevasse.a, crevasse.b) <= 34)
            .map(crevasse => crevasse.id);

          const crossed = TOPO_CREVASSES.find(crevasse => {
            if (state.blockedCrevasseIds.includes(crevasse.id)) return false;
            const was = pointToLineDistance(here, crevasse.a, crevasse.b);
            const nowDistance = pointToLineDistance(nextPosition, crevasse.a, crevasse.b);
            return Math.min(was, nowDistance) <= 7;
          });

          const terrainLoad = terrain === 'SNOW' ? 1.35 + liveWeather.snowSoftness / 140
            : terrain === 'SCREE' ? 1.3
              : terrain === 'ROCK' ? 1.45
                : terrain === 'GLACIER' ? 1.18
                  : terrain === 'RIDGE' ? 1.15 + liveWeather.windKmh / 120
                    : 0.82;
          const participants = state.participants.map((participant, index) => ({
            ...participant,
            energy: clamp(participant.energy - gameMinutes * terrainLoad * (index === 0 ? 0.052 : 0.034), 0, 100),
          }));

          let paused: boolean = state.paused;
          let lastMessage = state.lastMessage;
          let blockedCrevasseIds = state.blockedCrevasseIds;
          let revealedCrevasseIds = [...state.revealedCrevasseIds, ...newlyVisible];
          let position = nextPosition;
          let travelled = nextTravelled;
          let route = state.route;

          if (crossed) {
            paused = true;
            revealedCrevasseIds = [...revealedCrevasseIds, crossed.id];
            blockedCrevasseIds = [...blockedCrevasseIds, crossed.id];
            position = here;
            travelled = 0;
            route = [here];
            if (state.roped) {
              lastMessage = 'Связка остановилась у разлома. Линию нужно изменить или провести разведку.';
            } else {
              participants[0] = { ...participants[0]!, condition: clamp(participants[0]!.condition - 14), energy: clamp(participants[0]!.energy - 9) };
              lastMessage = 'Ведущий провалился по колено в скрытый разлом. Без связки ошибка ударила по состоянию.';
            }
          }

          const reachedRouteEnd = nextTravelled >= routeLength - 0.5;
          if (!crossed && reachedRouteEnd) {
            const reachedTarget = distance(nextPosition, target) <= 42;
            paused = true;
            if (reachedTarget && state.phase === 'ASCENT') {
              lastMessage = 'Вершина достигнута. Проведи обратную линию к старту. Подъём ещё не закончен.';
              return {
                ...state,
                phase: 'DESCENT',
                paused: true,
                elapsedMinutes: state.elapsedMinutes + gameMinutes,
                position: TOPO_SUMMIT,
                route: [],
                routeTravelled: 0,
                participants,
                summitReached: true,
                revealedCrevasseIds,
                blockedCrevasseIds,
                lastMessage,
              };
            }
            if (reachedTarget && state.phase === 'DESCENT') {
              lastMessage = 'Группа вернулась к старту. Экспедиция завершена физическим возвращением.';
              return {
                ...state,
                phase: 'COMPLETE',
                paused: true,
                elapsedMinutes: state.elapsedMinutes + gameMinutes,
                position: TOPO_START,
                route: [],
                routeTravelled: 0,
                participants,
                revealedCrevasseIds,
                blockedCrevasseIds,
                lastMessage,
              };
            }
            lastMessage = `Линия закончилась до ${targetLabel}. Пауза: продолжи маршрут от текущей точки.`;
          }

          if (participants[0]!.energy <= 8 && !paused) {
            paused = true;
            lastMessage = 'Ведущий больше не держит темп. Поменяй порядок или поставь лагерь.';
          }

          return {
            ...state,
            paused,
            elapsedMinutes: state.elapsedMinutes + gameMinutes,
            position,
            route,
            routeTravelled: travelled,
            participants,
            revealedCrevasseIds,
            blockedCrevasseIds,
            lastMessage,
          };
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, targetLabel]);

  function beginRoute(event: React.PointerEvent<SVGSVGElement>) {
    if (!sim.paused || tool !== 'ROUTE' || sim.phase === 'COMPLETE') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = mapPoint(event);
    setDrawing(true);
    setDraftRoute([sim.position, point]);
  }

  function extendRoute(event: React.PointerEvent<SVGSVGElement>) {
    if (!drawing || tool !== 'ROUTE') return;
    const point = mapPoint(event);
    setDraftRoute(current => distance(current[current.length - 1]!, point) >= 5 ? [...current, point] : current);
  }

  function finishRoute(event: React.PointerEvent<SVGSVGElement>) {
    if (!drawing || tool !== 'ROUTE') return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const route = decimateRoute(draftRoute, 9);
    setDrawing(false);
    setDraftRoute([]);
    if (route.length < 2 || polylineLength(route) < 18) return;
    setSim(state => ({
      ...state,
      route,
      routeTravelled: 0,
      paused: true,
      lastMessage: `Новая линия построена: ${estimateRoute(route, state.elapsedMinutes).distance} м. Запусти движение, когда готов.`,
    }));
  }

  function handleMapClick(event: React.PointerEvent<SVGSVGElement>) {
    if (!sim.paused || drawing || tool === 'ROUTE' || sim.phase === 'COMPLETE') return;
    const point = mapPoint(event);
    if (tool === 'ROPE') {
      if (!ropeStart) {
        setRopeStart(point);
        setSim(state => ({ ...state, lastMessage: 'Выбрана первая точка верёвки. Укажи вторую.' }));
        return;
      }
      const metres = Math.max(8, Math.round(distance(ropeStart, point) * 0.42));
      if (metres > sim.ropeMetres) {
        setRopeStart(null);
        setSim(state => ({ ...state, lastMessage: `Нужно ${metres} м верёвки, осталось ${state.ropeMetres} м.` }));
        return;
      }
      setSim(state => ({
        ...state,
        fixedRopes: [...state.fixedRopes, { id: `rope-${Date.now()}`, a: ropeStart, b: point, metres, damaged: false }],
        ropeMetres: state.ropeMetres - metres,
        elapsedMinutes: state.elapsedMinutes + 24,
        lastMessage: `Закреплён участок ${metres} м. Он останется для повторного прохода и спуска.`,
      }));
      setRopeStart(null);
      return;
    }
    if (tool === 'CAMP') {
      if (!canPlaceCamp(point)) {
        setSim(state => ({ ...state, lastMessage: 'Здесь нет ровной защищённой площадки. Ищи террасу по форме рельефа.' }));
        return;
      }
      if (sim.camps.some(camp => distance(camp.point, point) < 75)) {
        setSim(state => ({ ...state, lastMessage: 'На этой площадке лагерь уже существует.' }));
        return;
      }
      const site = TOPO_CAMP_SITES.find(item => distance(point, item) <= item.radius)!;
      setSim(state => ({
        ...state,
        camps: [...state.camps, { id: `camp-${Date.now()}`, point, label: site.label }],
        elapsedMinutes: state.elapsedMinutes + 95,
        lastMessage: `Лагерь установлен: ${site.label}. Сюда можно вернуться и восстановиться.`,
      }));
      return;
    }
    if (tool === 'SCOUT') {
      const discovered = TOPO_CREVASSES
        .filter(crevasse => pointToLineDistance(point, crevasse.a, crevasse.b) <= 125)
        .map(crevasse => crevasse.id);
      setSim(state => ({
        ...state,
        elapsedMinutes: state.elapsedMinutes + 22,
        revealedCrevasseIds: [...new Set([...state.revealedCrevasseIds, ...discovered])],
        lastMessage: discovered.length ? `Разведка открыла ${discovered.length} разлома в выбранном районе.` : 'Разведка не нашла явной угрозы. Время потрачено.',
      }));
      return;
    }
    if (tool === 'MARKER') {
      setSim(state => ({
        ...state,
        markers: [...state.markers, { id: `marker-${Date.now()}`, point, label: `М${state.markers.length + 1}` }],
        lastMessage: 'Точка отмечена на карте.',
      }));
    }
  }

  function toggleMovement() {
    setSim(state => {
      if (state.phase === 'COMPLETE') return state;
      if (state.route.length < 2) return { ...state, paused: true, lastMessage: 'Сначала проведи маршрут от текущей позиции.' };
      return { ...state, paused: !state.paused, lastMessage: state.paused ? 'Группа начала движение по проведённой линии.' : 'Активная пауза. Маршрут и команды можно менять.' };
    });
  }

  function reorder(index: number, direction: -1 | 1) {
    setSim(state => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= state.participants.length) return state;
      const participants = [...state.participants];
      [participants[index], participants[nextIndex]] = [participants[nextIndex]!, participants[index]!];
      return { ...state, participants, paused: true, lastMessage: `${participants[0]!.name} теперь ведёт группу.` };
    });
  }

  function restAtCamp() {
    if (!nearCamp) {
      setSim(state => ({ ...state, lastMessage: 'Для полноценного отдыха нужно физически дойти до установленного лагеря.' }));
      return;
    }
    setSim(state => ({
      ...state,
      paused: true,
      elapsedMinutes: state.elapsedMinutes + 360,
      participants: state.participants.map(participant => ({ ...participant, energy: clamp(participant.energy + 58), condition: clamp(participant.condition + 5) })),
      lastMessage: `Шесть часов в лагере «${nearCamp.label}». Люди восстановились, но погода продолжила меняться.`,
    }));
  }

  function resetPrototype() {
    setTool('ROUTE');
    setDraftRoute([]);
    setRopeStart(null);
    setSim({
      phase: 'ASCENT', paused: true, timeScale: 1, elapsedMinutes: 0, position: TOPO_START, route: [], routeTravelled: 0,
      participants: initialParticipants, roped: false, ropeSpacing: 18, fixedRopes: [], ropeMetres: 120, camps: [], markers: [],
      revealedCrevasseIds: TOPO_CREVASSES.filter(item => !item.hidden).map(item => item.id), blockedCrevasseIds: [],
      lastMessage: 'Пауза. Изучи рельеф и проведи первую линию от группы.', summitReached: false,
    });
  }

  const lineOpacity = weather.visibility < 45 ? 0.42 : weather.visibility < 65 ? 0.68 : 0.92;
  const groupRoute = sim.route.length ? sim.route : [sim.position];
  const groupDots = sim.participants.map((participant, index) => ({
    participant,
    point: pointAtDistance(groupRoute, Math.max(0, sim.routeTravelled - index * (sim.roped ? sim.ropeSpacing : 11))),
  }));

  return (
    <main className="topo-expedition">
      <header className="topo-header">
        <button className="topo-exit" onClick={onExit}>← Карьера</button>
        <div>
          <span>0.7.0 / TOPOGRAPHIC PROTOTYPE</span>
          <strong>Караульный пик · {TOPO_SUMMIT_ELEVATION} м</strong>
        </div>
        <div className="topo-header__weather">
          <span>{formatClock(sim.elapsedMinutes)}</span>
          <b>{weather.temperatureC}° · ветер {weather.windKmh} км/ч · видимость {weather.visibility}%</b>
        </div>
      </header>

      <section className="topo-workspace">
        <div className="topo-map-column">
          <div className="topo-map-head">
            <div>
              <span>{sim.phase === 'ASCENT' ? 'ПОДЪЁМ' : sim.phase === 'DESCENT' ? 'СПУСК' : 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА'}</span>
              <strong>{currentElevation} м</strong>
              <small>{terrainCopy[currentTerrain]} · до {targetLabel} {Math.round(distance(sim.position, target) * 3.2)} м по карте</small>
            </div>
            <div className="topo-map-head__route">
              <span>Текущая линия</span>
              <strong>{routeEstimate.distance || 0} м · {routeEstimate.gain || 0} м набора</strong>
              <small>{routeEstimate.minutes ? `около ${shortTime(routeEstimate.minutes)}` : 'линия не построена'}</small>
            </div>
          </div>

          <div className={`topo-map-frame tool-${tool.toLowerCase()} ${sim.paused ? 'is-paused' : 'is-running'}`}>
            <svg
              className="topo-map"
              viewBox={`0 0 ${TOPO_MAP_WIDTH} ${TOPO_MAP_HEIGHT}`}
              role="application"
              aria-label="Интерактивная топографическая карта"
              onPointerDown={beginRoute}
              onPointerMove={extendRoute}
              onPointerUp={finishRoute}
              onPointerCancel={() => { setDrawing(false); setDraftRoute([]); }}
              onClick={handleMapClick}
            >
              <defs>
                <linearGradient id="topo-ground" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#52624f" />
                  <stop offset="0.42" stopColor="#82907d" />
                  <stop offset="1" stopColor="#d7d9cf" />
                </linearGradient>
                <pattern id="scree-pattern" width="18" height="18" patternUnits="userSpaceOnUse">
                  <circle cx="4" cy="5" r="1.8" fill="#302f2a" opacity=".34" />
                  <circle cx="13" cy="12" r="2.3" fill="#302f2a" opacity=".22" />
                </pattern>
                <pattern id="ice-pattern" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
                  <path d="M0 16 H32" stroke="#dff5f7" strokeWidth="8" opacity=".25" />
                </pattern>
                <filter id="group-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".45" />
                </filter>
              </defs>

              <rect width={TOPO_MAP_WIDTH} height={TOPO_MAP_HEIGHT} fill="url(#topo-ground)" />

              {TOPO_TERRAIN_ZONES.map(zone => (
                <g key={zone.id} className={`terrain terrain-${zone.type.toLowerCase()}`}>
                  <polygon points={polygonPoints(zone.points)} />
                  {zone.type === 'SCREE' && <polygon points={polygonPoints(zone.points)} fill="url(#scree-pattern)" />}
                  {zone.type === 'GLACIER' && <polygon points={polygonPoints(zone.points)} fill="url(#ice-pattern)" />}
                </g>
              ))}

              <g className="topo-contours">
                {contours.map(loop => <path key={loop.id} d={loop.path} className={loop.major ? 'major' : ''} />)}
              </g>

              <g className="topo-camp-terrain">
                {TOPO_CAMP_SITES.map(site => <ellipse key={site.id} cx={site.x} cy={site.y} rx={site.radius} ry={site.radius * 0.44} />)}
              </g>

              <g className="topo-crevasses">
                {TOPO_CREVASSES.filter(crevasse => sim.revealedCrevasseIds.includes(crevasse.id)).map(crevasse => (
                  <g key={crevasse.id} className={crevasse.hidden ? 'is-discovered' : 'is-known'}>
                    <line x1={crevasse.a.x} y1={crevasse.a.y} x2={crevasse.b.x} y2={crevasse.b.y} />
                    <line x1={crevasse.a.x + 6} y1={crevasse.a.y + 5} x2={crevasse.b.x + 6} y2={crevasse.b.y + 5} />
                  </g>
                ))}
              </g>

              <g className="topo-fixed-ropes">
                {sim.fixedRopes.map(rope => (
                  <g key={rope.id} className={rope.damaged ? 'is-damaged' : ''}>
                    <line x1={rope.a.x} y1={rope.a.y} x2={rope.b.x} y2={rope.b.y} />
                    <circle cx={rope.a.x} cy={rope.a.y} r="6" />
                    <circle cx={rope.b.x} cy={rope.b.y} r="6" />
                  </g>
                ))}
                {ropeStart && <circle className="rope-pending" cx={ropeStart.x} cy={ropeStart.y} r="9" />}
              </g>

              <g className="topo-camps">
                {sim.camps.map(camp => (
                  <g key={camp.id} transform={`translate(${camp.point.x} ${camp.point.y})`}>
                    <path d="M-17 10 L0 -15 L17 10 Z" />
                    <text y="27">{camp.label}</text>
                  </g>
                ))}
              </g>

              <g className="topo-markers">
                {sim.markers.map(marker => (
                  <g key={marker.id} transform={`translate(${marker.point.x} ${marker.point.y})`}>
                    <path d="M0 0 V-25 H18 L12-17 H0" />
                    <text x="8" y="14">{marker.label}</text>
                  </g>
                ))}
              </g>

              <g className="topo-route" opacity={lineOpacity}>
                {sim.route.length >= 2 && <path d={routeToPath(sim.route)} />}
                {draftRoute.length >= 2 && <path className="draft" d={routeToPath(draftRoute)} />}
                {sim.route.length >= 2 && <path className="travelled" d={routeToPath(polylinePrefix(sim.route, sim.routeTravelled))} />}
              </g>

              <g className="topo-objectives">
                <g transform={`translate(${TOPO_START.x} ${TOPO_START.y})`} className="start-marker">
                  <circle r="13" /><text x="20" y="5">СТАРТ {TOPO_START_ELEVATION} м</text>
                </g>
                <g transform={`translate(${TOPO_SUMMIT.x} ${TOPO_SUMMIT.y})`} className="summit-marker">
                  <path d="M0 -18 L16 12 L-16 12 Z" /><text x="22" y="5">ВЕРШИНА {TOPO_SUMMIT_ELEVATION} м</text>
                </g>
              </g>

              <g className="topo-group" filter="url(#group-shadow)">
                {groupDots.slice().reverse().map(({ participant, point }, index) => (
                  <g key={participant.id} transform={`translate(${point.x} ${point.y})`} className={index === groupDots.length - 1 ? 'is-leader' : ''}>
                    <circle r={index === groupDots.length - 1 ? 12 : 9} />
                    <text x="14" y="4">{participant.name.split(' ')[0]}</text>
                  </g>
                ))}
                {sim.roped && groupDots.length >= 2 && groupDots.slice(1).map((item, index) => (
                  <line key={item.participant.id} x1={groupDots[index]!.point.x} y1={groupDots[index]!.point.y} x2={item.point.x} y2={item.point.y} />
                ))}
              </g>

              <rect className="topo-weather-mask" width={TOPO_MAP_WIDTH} height={TOPO_MAP_HEIGHT} opacity={clamp((65 - weather.visibility) / 80, 0, 0.52)} />
              {weather.windKmh >= 38 && (
                <g className="topo-wind" opacity={clamp((weather.windKmh - 30) / 40, 0.18, 0.7)}>
                  {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M ${40 + index * 78} ${90 + (index % 4) * 150} l 72 -24`} />)}
                </g>
              )}
            </svg>

            <div className="topo-map-message">
              <span>{sim.paused ? 'ПАУЗА' : `ДВИЖЕНИЕ ×${sim.timeScale}`}</span>
              <p>{sim.lastMessage}</p>
            </div>
          </div>

          <div className="topo-toolbar">
            <div className="topo-tools" aria-label="Инструменты карты">
              {toolCopy.map(item => (
                <button key={item.id} className={tool === item.id ? 'is-active' : ''} onClick={() => { setTool(item.id); setRopeStart(null); }} disabled={!sim.paused || sim.phase === 'COMPLETE'}>
                  <strong>{item.label}</strong><small>{item.note}</small>
                </button>
              ))}
            </div>
            <div className="topo-time-controls">
              <button className="topo-play" onClick={toggleMovement} disabled={sim.phase === 'COMPLETE'}>{sim.paused ? '▶' : 'Ⅱ'}</button>
              {[1, 2, 4].map(value => <button key={value} className={sim.timeScale === value ? 'is-active' : ''} onClick={() => setSim(state => ({ ...state, timeScale: value as 1 | 2 | 4 }))}>×{value}</button>)}
            </div>
          </div>
        </div>

        <aside className="topo-side">
          <section className="topo-panel topo-team-panel">
            <div className="topo-panel__head"><span>ЭКСПЕДИЦИЯ</span><strong>{sim.roped ? `Связка · ${sim.ropeSpacing} м` : 'Группа без связки'}</strong></div>
            <div className="topo-team-list">
              {sim.participants.map((participant, index) => (
                <article key={participant.id}>
                  <div className="topo-order-index">{String(index + 1).padStart(2, '0')}</div>
                  <div>
                    <strong>{participant.name}</strong>
                    <span>{index === 0 ? 'Ведущий' : index === sim.participants.length - 1 ? 'Замыкающий' : participant.specialty}</span>
                    <small>{statusFor(participant.energy)} · состояние {statusFor(participant.condition).toLowerCase()}</small>
                  </div>
                  <div className="topo-order-buttons">
                    <button onClick={() => reorder(index, -1)} disabled={!sim.paused || index === 0}>↑</button>
                    <button onClick={() => reorder(index, 1)} disabled={!sim.paused || index === sim.participants.length - 1}>↓</button>
                  </div>
                </article>
              ))}
            </div>
            <button className={`topo-wide-button ${sim.roped ? 'is-active' : ''}`} onClick={() => setSim(state => ({ ...state, paused: true, roped: !state.roped, lastMessage: state.roped ? 'Связка распущена.' : 'Участники объединены основной верёвкой.' }))} disabled={!sim.paused || sim.phase === 'COMPLETE'}>
              {sim.roped ? 'Распустить связку' : 'Создать связку'}
            </button>
          </section>

          <section className="topo-panel topo-resources-panel">
            <div className="topo-panel__head"><span>ИНФРАСТРУКТУРА</span><strong>на карте</strong></div>
            <div className="topo-resource-grid">
              <div><span>Верёвка</span><strong>{sim.ropeMetres} м</strong></div>
              <div><span>Закреплено</span><strong>{sim.fixedRopes.length}</strong></div>
              <div><span>Лагеря</span><strong>{sim.camps.length}</strong></div>
              <div><span>Разведано</span><strong>{sim.revealedCrevasseIds.length}/{TOPO_CREVASSES.length}</strong></div>
            </div>
            <button className="topo-wide-button" onClick={restAtCamp} disabled={!sim.paused || !nearCamp || sim.phase === 'COMPLETE'}>Отдых 6 часов</button>
          </section>

          <section className="topo-panel topo-observation-panel">
            <div className="topo-panel__head"><span>НАБЛЮДЕНИЕ</span><strong>{terrainCopy[currentTerrain]}</strong></div>
            <ul>
              <li>Контуры расположены {currentElevation > 2400 ? 'плотно: склон крутой' : 'умеренно: есть место для траверса'}.</li>
              <li>{weather.snowSoftness > 66 ? 'Солнце заметно размягчило снег.' : 'Снег пока держит утренний холод.'}</li>
              <li>{weather.visibility < 48 ? 'Облака закрывают ориентиры и часть проведённой линии.' : 'Форма рельефа читается уверенно.'}</li>
              <li>{weather.windKmh > 42 ? 'На гребне ветер будет сильнее текущего.' : 'Ветер пока не определяет маршрут.'}</li>
            </ul>
          </section>

          <section className="topo-panel topo-goal-panel">
            <div className="topo-panel__head"><span>ЗАДАЧА ПРОТОТИПА</span><strong>{sim.phase === 'COMPLETE' ? 'выполнена' : sim.phase === 'DESCENT' ? 'вернуться' : 'взойти'}</strong></div>
            <p>Проведи группу до вершины и физически верни её к старту. Игра не строит путь и не выбирает действия вместо тебя.</p>
            {sim.phase === 'COMPLETE' ? <button className="topo-wide-button is-active" onClick={resetPrototype}>Пройти другой линией</button> : <button className="topo-wide-button" onClick={resetPrototype}>Сбросить прототип</button>}
          </section>
        </aside>
      </section>
    </main>
  );
}
