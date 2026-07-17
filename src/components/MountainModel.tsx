import { useId, useMemo, useRef, useState } from 'react';
import type { MountainData } from '../core/types';
import {
  cellAt,
  generateMountainGrid,
  type GridPoint,
  type MountainCell,
  type MountainGrid,
  type MountainTerrain,
} from '../topography/mountainGridEngine';

export type MountainModelMarker = {
  id: string;
  point: GridPoint;
  label?: string;
  kind?: 'STAGE' | 'ENTRY' | 'SUMMIT' | 'CURRENT' | 'CAMP' | 'ROPE' | 'TRACE' | 'HAZARD';
  active?: boolean;
  count?: number;
};

type Props = {
  mountain?: MountainData | null;
  seed?: string;
  variant?: 'hero' | 'card' | 'detail' | 'expedition';
  interactive?: boolean;
  label?: string;
  grid?: MountainGrid;
  route?: GridPoint[];
  routeColor?: string;
  markers?: MountainModelMarker[];
  initialYaw?: number;
  initialPitch?: number;
  showControls?: boolean;
  readout?: Array<{ label: string; value: string }>;
};

type ProjectedPoint = { x: number; y: number; depth: number };

type RenderPolygon = {
  key: string;
  points: string;
  fill: string;
  depth: number;
  terrain: MountainTerrain | 'BASE';
  stroke: string;
};

const MATERIALS: Record<MountainTerrain, { shadow: [number, number, number]; mid: [number, number, number]; light: [number, number, number] }> = {
  VALLEY: { shadow: [38, 54, 47], mid: [69, 91, 76], light: [102, 124, 104] },
  SCREE: { shadow: [63, 58, 50], mid: [119, 107, 88], light: [160, 145, 117] },
  GLACIER: { shadow: [78, 126, 143], mid: [157, 204, 218], light: [228, 248, 250] },
  SNOW: { shadow: [136, 157, 164], mid: [211, 225, 228], light: [250, 253, 252] },
  ROCK: { shadow: [38, 40, 39], mid: [80, 78, 72], light: [132, 126, 115] },
  RIDGE: { shadow: [105, 125, 126], mid: [193, 208, 207], light: [242, 249, 247] },
  SUMMIT: { shadow: [155, 168, 168], mid: [230, 237, 235], light: [255, 252, 242] },
};

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function rgb(values: [number, number, number]) {
  return `rgb(${values.map(value => Math.round(Math.max(0, Math.min(255, value)))).join(' ')})`;
}

function materialFill(cell: MountainCell, grid: MountainGrid) {
  const palette = MATERIALS[cell.terrain];
  const elevationRatio = (cell.elevation - grid.baseElevation) / Math.max(1, grid.relief);
  const aspectLight = (Math.cos((cell.aspect - 225) * Math.PI / 180) + 1) / 2;
  const slopeShadow = Math.min(.34, cell.slope / 165);
  const altitudeLift = elevationRatio * (cell.terrain === 'SNOW' || cell.terrain === 'GLACIER' || cell.terrain === 'SUMMIT' ? .17 : .08);
  const amount = Math.max(0, Math.min(1, .15 + aspectLight * .72 - slopeShadow + altitudeLift));
  const from = amount < .48 ? palette.shadow : palette.mid;
  const to = amount < .48 ? palette.mid : palette.light;
  const local = amount < .48 ? amount / .48 : (amount - .48) / .52;
  return rgb([
    mix(from[0], to[0], local),
    mix(from[1], to[1], local),
    mix(from[2], to[2], local),
  ]);
}

function project(
  xCell: number,
  yCell: number,
  elevation: number,
  grid: MountainGrid,
  yaw: number,
  pitch: number,
  zoom: number,
): ProjectedPoint {
  const cx = Math.max(1, (grid.width - 1) / 2);
  const cy = Math.max(1, (grid.height - 1) / 2);
  const x = (xCell - cx) / cx;
  const z = (yCell - cy) / cy;
  const normalizedHeight = (elevation - grid.baseElevation) / Math.max(1, grid.relief);
  const footprintScale = Math.max(.76, Math.min(1.24, grid.physicalDiameterKm / 9));
  const verticalScale = Math.max(.72, Math.min(1.48, grid.relief / 3000));
  const fit = Math.max(.74, Math.min(1, 1 / Math.max(.96, footprintScale * .9, verticalScale * .7)));
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const vertical = normalizedHeight * 1.46 * verticalScale;
  // The height never collapses to zero in top view. The model stays readable while rotating above it.
  const heightVisibility = .46 + Math.cos(pitchRad) * .54;
  const py = vertical * heightVisibility - rz * Math.sin(pitchRad);
  const depth = rz * Math.cos(pitchRad) + vertical * Math.sin(pitchRad) * .72;
  return {
    x: 500 + rx * 315 * footprintScale * fit * zoom,
    y: 438 - py * 252 * fit * zoom,
    depth,
  };
}

function markerClass(marker: MountainModelMarker) {
  return [
    'mountain-model__marker',
    `is-${(marker.kind ?? 'STAGE').toLowerCase()}`,
    marker.active ? 'is-active' : '',
  ].filter(Boolean).join(' ');
}

function markerGlyph(marker: MountainModelMarker) {
  if (marker.kind === 'SUMMIT') return <path d="M0 -17 L14 10 L-14 10 Z" />;
  if (marker.kind === 'CAMP') return <path d="M-10 8 L0 -8 L10 8 Z M0 -8 L0 8" />;
  if (marker.kind === 'ROPE' || marker.kind === 'TRACE') return <path d="M-9 -5 C-2 -12 3 1 9 -6 M-9 5 C-2 -2 3 11 9 4" />;
  if (marker.kind === 'HAZARD') return <path d="M0 -11 L11 9 L-11 9 Z M0 -5 L0 3 M0 6 L0 7" />;
  return <circle r={marker.active || marker.kind === 'CURRENT' ? 8 : 5} />;
}

export function MountainModel({
  mountain,
  seed = 'ALPINE-MENU',
  variant = 'hero',
  interactive = true,
  label,
  grid: suppliedGrid,
  route = [],
  routeColor = '#e36343',
  markers = [],
  initialYaw = -34,
  initialPitch = 40,
  showControls = false,
  readout,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const [yaw, setYaw] = useState(initialYaw);
  const [pitch, setPitch] = useState(initialPitch);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [compact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const summit = suppliedGrid?.summitElevation ?? mountain?.elevation ?? 4200;
  const relief = suppliedGrid?.relief ?? Math.max(1200, mountain?.prominence ?? Math.round(summit * .58));
  const base = suppliedGrid?.baseElevation ?? Math.max(180, summit - relief);
  const size = variant === 'card' ? 15 : variant === 'detail' ? 25 : variant === 'expedition' ? 31 : 21;
  const generationSeed = mountain ? `${seed}:${mountain.id}:model` : `${seed}:model`;
  const profile = mountain ? { formId: mountain.identity.formId, characterId: mountain.characterId } : undefined;
  const generatedGrid = useMemo(
    () => generateMountainGrid(generationSeed, base, summit, size, profile),
    [generationSeed, base, summit, size, profile?.formId, profile?.characterId],
  );
  const grid = suppliedGrid ?? generatedGrid;
  const baseZoom = variant === 'card' ? .84 : variant === 'detail' ? .98 : variant === 'expedition' ? .92 : .92;
  const zoom = baseZoom * cameraZoom;
  const stride = variant === 'card' ? 1 : compact || grid.width > 33 ? 2 : 1;

  const renderData = useMemo(() => {
    const polygons: RenderPolygon[] = [];
    for (let y = 0; y < grid.height - 1; y += stride) {
      const y2 = Math.min(grid.height - 1, y + stride);
      for (let x = 0; x < grid.width - 1; x += stride) {
        const x2 = Math.min(grid.width - 1, x + stride);
        const cells = [cellAt(grid, { x, y }), cellAt(grid, { x: x2, y }), cellAt(grid, { x: x2, y: y2 }), cellAt(grid, { x, y: y2 })];
        if (cells.some(cell => !cell)) continue;
        const cell = cells[0]!;
        const projected = cells.map(item => project(item!.x, item!.y, item!.elevation, grid, yaw, pitch, zoom));
        const fill = materialFill(cell, grid);
        polygons.push({
          key: `surface:${x}:${y}`,
          points: projected.map(point => `${point.x},${point.y}`).join(' '),
          fill,
          stroke: fill,
          terrain: cell.terrain,
          depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
        });
      }
    }
    // Only the terrain surface is rendered. The old vertical skirts and black bottom
    // could sort in front of the mountain during rotation and appear as black blocks.
    polygons.sort((a, b) => a.depth - b.depth);
    return polygons;
  }, [grid, yaw, pitch, zoom, stride]);

  const routePath = useMemo(() => route.map(point => {
    const cell = cellAt(grid, point);
    if (!cell) return null;
    const projected = project(cell.x, cell.y, cell.elevation + Math.max(5, grid.relief * .003), grid, yaw, pitch, zoom);
    return `${projected.x},${projected.y}`;
  }).filter(Boolean).join(' '), [route, grid, yaw, pitch, zoom]);

  const projectedMarkers = useMemo(() => markers.map(marker => {
    const cell = cellAt(grid, marker.point);
    return cell ? { marker, projected: project(cell.x, cell.y, cell.elevation + Math.max(8, grid.relief * .004), grid, yaw, pitch, zoom) } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)), [markers, grid, yaw, pitch, zoom]);

  const resetCamera = () => {
    setYaw(initialYaw);
    setPitch(initialPitch);
    setCameraZoom(1);
  };

  const backgroundId = `mountain-sky-${uid}`;
  const fogId = `mountain-fog-${uid}`;
  const glowId = `mountain-glow-${uid}`;

  return (
    <div className={`mountain-model mountain-model--${variant} ${interactive ? 'is-interactive' : ''}`}>
      <svg
        viewBox="0 0 1000 700"
        role="img"
        aria-label={label ?? mountain?.name ?? 'Трёхмерная модель горы'}
        onPointerDown={interactive ? event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, yaw, pitch };
        } : undefined}
        onPointerMove={interactive ? event => {
          if (!drag.current) return;
          setYaw(drag.current.yaw + (event.clientX - drag.current.x) * .34);
          setPitch(Math.max(8, Math.min(74, drag.current.pitch - (event.clientY - drag.current.y) * .25)));
        } : undefined}
        onPointerUp={interactive ? () => { drag.current = null; } : undefined}
        onPointerCancel={interactive ? () => { drag.current = null; } : undefined}
        onWheel={interactive ? event => {
          event.preventDefault();
          setCameraZoom(value => Math.max(.68, Math.min(1.42, value - event.deltaY * .001)));
        } : undefined}
      >
        <defs>
          <linearGradient id={backgroundId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#07110f" />
            <stop offset=".54" stopColor="#172925" />
            <stop offset="1" stopColor="#26352f" />
          </linearGradient>
          <linearGradient id={fogId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#172925" stopOpacity="0" />
            <stop offset=".7" stopColor="#172925" stopOpacity=".18" />
            <stop offset="1" stopColor="#0b1210" stopOpacity=".9" />
          </linearGradient>
          <radialGradient id={glowId} cx="25%" cy="18%" r="65%">
            <stop offset="0" stopColor="#d6eee8" stopOpacity=".2" />
            <stop offset="1" stopColor="#d6eee8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1000" height="700" fill={`url(#${backgroundId})`} className="mountain-model__backdrop" />
        <rect x="0" y="0" width="1000" height="700" fill={`url(#${glowId})`} className="mountain-model__sky-glow" />
        <g className="mountain-model__surface">
          {renderData.map(poly => (
            <polygon
              key={poly.key}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={variant === 'card' ? .7 : .85}
              className={`mountain-model__face is-${poly.terrain.toLowerCase()}`}
            />
          ))}
        </g>

        <rect x="0" y="455" width="1000" height="245" fill={`url(#${fogId})`} className="mountain-model__altitude-fog" />

        {routePath && <polyline points={routePath} fill="none" stroke="rgba(4,8,7,.72)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />}
        {routePath && <polyline points={routePath} fill="none" stroke={routeColor} strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round" className="mountain-model__route" />}
        {projectedMarkers.map(({ marker, projected }) => (
          <g key={marker.id} transform={`translate(${projected.x} ${projected.y})`} className={markerClass(marker)}>
            {markerGlyph(marker)}
            {marker.count && marker.count > 1 ? <text className="mountain-model__marker-count" x="0" y="3">{marker.count}</text> : null}
            {marker.label && <text x="14" y="4">{marker.label}</text>}
          </g>
        ))}
      </svg>

      {readout?.length ? (
        <div className="mountain-model__metrics">{readout.map(item => <span key={item.label}><small>{item.label}</small><b>{item.value}</b></span>)}</div>
      ) : variant !== 'card' && (
        <div className="mountain-model__readout"><span>{mountain?.identity.formTitle ?? 'Процедурный массив'}</span><b>{summit} м</b></div>
      )}
      {interactive && variant !== 'card' && <div className="mountain-model__hint">тяни, чтобы вращать</div>}
      {showControls && <div className="mountain-model__controls">
        <button onClick={() => setYaw(value => value - 20)} aria-label="Повернуть влево">←</button>
        <button onClick={() => setYaw(value => value + 20)} aria-label="Повернуть вправо">→</button>
        <button onClick={() => setPitch(72)}>Сверху</button>
        <button onClick={() => setPitch(18)}>Сбоку</button>
        <button onClick={resetCamera}>Сброс</button>
      </div>}
    </div>
  );
}
