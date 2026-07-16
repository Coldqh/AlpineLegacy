import { useMemo, useRef, useState } from 'react';
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
  kind?: 'STAGE' | 'ENTRY' | 'SUMMIT';
  active?: boolean;
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

function terrainBase(terrain: MountainTerrain) {
  if (terrain === 'VALLEY') return [67, 82, 72];
  if (terrain === 'SCREE') return [116, 105, 87];
  if (terrain === 'GLACIER') return [173, 207, 216];
  if (terrain === 'SNOW') return [225, 232, 229];
  if (terrain === 'ROCK') return [77, 74, 69];
  if (terrain === 'RIDGE') return [193, 203, 199];
  return [240, 239, 232];
}

function terrainFill(cell: MountainCell) {
  const [r, g, b] = terrainBase(cell.terrain);
  const light = Math.cos((cell.aspect - 220) * Math.PI / 180) * 0.13 - cell.slope / 560;
  const factor = Math.max(0.66, Math.min(1.16, 1 + light));
  return `rgb(${Math.round(r * factor)} ${Math.round(g * factor)} ${Math.round(b * factor)})`;
}

function project(
  xCell: number,
  yCell: number,
  elevation: number,
  grid: MountainGrid,
  yaw: number,
  pitch: number,
  zoom: number,
) {
  const cx = Math.max(1, (grid.width - 1) / 2);
  const cy = Math.max(1, (grid.height - 1) / 2);
  const x = (xCell - cx) / cx;
  const z = (yCell - cy) / cy;
  const normalizedHeight = (elevation - grid.baseElevation) / Math.max(1, grid.relief);
  const footprintScale = Math.max(0.76, Math.min(1.24, grid.physicalDiameterKm / 9));
  const verticalScale = Math.max(0.7, Math.min(1.5, grid.relief / 3000));
  const fit = Math.max(0.74, Math.min(1, 1 / Math.max(0.96, footprintScale * .9, verticalScale * .7)));
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const vertical = normalizedHeight * 1.46 * verticalScale;
  const py = vertical * Math.cos(pitchRad) - rz * Math.sin(pitchRad);
  const depth = rz * Math.cos(pitchRad) + vertical * Math.sin(pitchRad);
  return {
    x: 500 + rx * 315 * footprintScale * fit * zoom,
    y: 430 - py * 250 * fit * zoom,
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
  const [yaw, setYaw] = useState(initialYaw);
  const [pitch, setPitch] = useState(initialPitch);
  const [cameraZoom, setCameraZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const summit = suppliedGrid?.summitElevation ?? mountain?.elevation ?? 4200;
  const relief = suppliedGrid?.relief ?? Math.max(1200, mountain?.prominence ?? Math.round(summit * 0.58));
  const base = suppliedGrid?.baseElevation ?? Math.max(180, summit - relief);
  const size = variant === 'card' ? 15 : variant === 'detail' ? 25 : variant === 'expedition' ? 31 : 21;
  const generationSeed = mountain ? `${seed}:${mountain.id}:model` : `${seed}:model`;
  const profile = mountain ? { formId: mountain.identity.formId, characterId: mountain.characterId } : undefined;
  const generatedGrid = useMemo(
    () => generateMountainGrid(generationSeed, base, summit, size, profile),
    [generationSeed, base, summit, size, profile?.formId, profile?.characterId],
  );
  const grid = suppliedGrid ?? generatedGrid;
  const baseZoom = variant === 'card' ? 0.82 : variant === 'detail' ? 0.96 : variant === 'expedition' ? 0.9 : 0.9;
  const zoom = baseZoom * cameraZoom;
  const stride = variant === 'card' ? 1 : grid.width > 35 ? 2 : 1;

  const polygons = useMemo(() => {
    const result: Array<{ key: string; points: string; fill: string; depth: number; stroke: string }> = [];
    const add = (key: string, points: Array<{ x: number; y: number; depth: number }>, fill: string, stroke = 'rgba(16,22,21,.22)') => {
      result.push({ key, points: points.map(point => `${point.x},${point.y}`).join(' '), fill, stroke, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length });
    };
    for (let y = 0; y < grid.height - 1; y += stride) {
      const y2 = Math.min(grid.height - 1, y + stride);
      for (let x = 0; x < grid.width - 1; x += stride) {
        const x2 = Math.min(grid.width - 1, x + stride);
        const cells = [cellAt(grid, { x, y }), cellAt(grid, { x: x2, y }), cellAt(grid, { x: x2, y: y2 }), cellAt(grid, { x, y: y2 })];
        if (cells.some(cell => !cell)) continue;
        add(`surface:${x}:${y}`, cells.map(cell => project(cell!.x, cell!.y, cell!.elevation, grid, yaw, pitch, zoom)), terrainFill(cells[0]!));
      }
    }

    const baseElevation = grid.baseElevation - Math.max(100, grid.relief * .08);
    const skirt = (key: string, a: MountainCell, b: MountainCell, fill: string) => add(key, [
      project(a.x, a.y, a.elevation, grid, yaw, pitch, zoom),
      project(b.x, b.y, b.elevation, grid, yaw, pitch, zoom),
      project(b.x, b.y, baseElevation, grid, yaw, pitch, zoom),
      project(a.x, a.y, baseElevation, grid, yaw, pitch, zoom),
    ], fill, 'rgba(8,13,12,.28)');

    for (let x = 0; x < grid.width - 1; x += stride) {
      const x2 = Math.min(grid.width - 1, x + stride);
      skirt(`north:${x}`, cellAt(grid, { x, y: 0 })!, cellAt(grid, { x: x2, y: 0 })!, '#39443f');
      skirt(`south:${x}`, cellAt(grid, { x: x2, y: grid.height - 1 })!, cellAt(grid, { x, y: grid.height - 1 })!, '#202925');
    }
    for (let y = 0; y < grid.height - 1; y += stride) {
      const y2 = Math.min(grid.height - 1, y + stride);
      skirt(`west:${y}`, cellAt(grid, { x: 0, y: y2 })!, cellAt(grid, { x: 0, y })!, '#303a36');
      skirt(`east:${y}`, cellAt(grid, { x: grid.width - 1, y })!, cellAt(grid, { x: grid.width - 1, y: y2 })!, '#1e2723');
    }
    return result.sort((a, b) => a.depth - b.depth);
  }, [grid, yaw, pitch, zoom, stride]);

  const routePath = useMemo(() => route.map(point => {
    const cell = cellAt(grid, point);
    if (!cell) return null;
    const projected = project(cell.x, cell.y, cell.elevation, grid, yaw, pitch, zoom);
    return `${projected.x},${projected.y}`;
  }).filter(Boolean).join(' '), [route, grid, yaw, pitch, zoom]);

  const projectedMarkers = useMemo(() => markers.map(marker => {
    const cell = cellAt(grid, marker.point);
    return cell ? { marker, projected: project(cell.x, cell.y, cell.elevation, grid, yaw, pitch, zoom) } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)), [markers, grid, yaw, pitch, zoom]);

  const resetCamera = () => {
    setYaw(initialYaw);
    setPitch(initialPitch);
    setCameraZoom(1);
  };

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
          setPitch(Math.max(8, Math.min(76, drag.current.pitch - (event.clientY - drag.current.y) * .25)));
        } : undefined}
        onPointerUp={interactive ? () => { drag.current = null; } : undefined}
        onPointerCancel={interactive ? () => { drag.current = null; } : undefined}
        onWheel={interactive ? event => {
          event.preventDefault();
          setCameraZoom(value => Math.max(.68, Math.min(1.42, value - event.deltaY * .001)));
        } : undefined}
      >
        <rect x="0" y="0" width="1000" height="700" className="mountain-model__backdrop" />
        <g>{polygons.map(poly => <polygon key={poly.key} points={poly.points} fill={poly.fill} stroke={poly.stroke} strokeWidth={variant === 'card' ? 1.1 : .65} />)}</g>
        {routePath && <polyline points={routePath} fill="none" stroke="rgba(8,12,11,.65)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />}
        {routePath && <polyline points={routePath} fill="none" stroke={routeColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        {projectedMarkers.map(({ marker, projected }) => (
          <g key={marker.id} transform={`translate(${projected.x} ${projected.y})`} className={markerClass(marker)}>
            {marker.kind === 'SUMMIT' ? <path d="M0 -16 L13 9 L-13 9 Z" /> : <circle r={marker.active ? 8 : 5} />}
            {marker.label && <text x="12" y="4">{marker.label}</text>}
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
        <button onClick={() => setPitch(74)}>Сверху</button>
        <button onClick={() => setPitch(18)}>Сбоку</button>
        <button onClick={resetCamera}>Сброс</button>
      </div>}
    </div>
  );
}
