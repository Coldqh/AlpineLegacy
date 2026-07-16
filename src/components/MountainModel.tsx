import { useMemo, useRef, useState } from 'react';
import type { MountainData } from '../core/types';
import { cellAt, generateMountainGrid, type MountainCell, type MountainTerrain } from '../topography/mountainGridEngine';

type Props = {
  mountain?: MountainData | null;
  seed?: string;
  variant?: 'hero' | 'card' | 'detail';
  interactive?: boolean;
  label?: string;
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
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rx = x * Math.cos(yawRad) - z * Math.sin(yawRad);
  const rz = x * Math.sin(yawRad) + z * Math.cos(yawRad);
  const vertical = normalizedHeight * 1.48;
  const py = vertical * Math.cos(pitchRad) - rz * Math.sin(pitchRad);
  const depth = rz * Math.cos(pitchRad) + vertical * Math.sin(pitchRad);
  return { x: 500 + rx * 315 * zoom, y: 425 - py * 250 * zoom, depth };
}

export function MountainModel({ mountain, seed = 'ALPINE-MENU', variant = 'hero', interactive = true, label }: Props) {
  const [yaw, setYaw] = useState(-34);
  const [pitch, setPitch] = useState(40);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const summit = mountain?.elevation ?? 4200;
  const relief = Math.max(1200, mountain?.prominence ?? Math.round(summit * 0.58));
  const base = Math.max(180, summit - relief);
  const size = variant === 'card' ? 15 : variant === 'detail' ? 25 : 21;
  const generationSeed = mountain ? `${seed}:${mountain.id}:model` : `${seed}:model`;
  const profile = mountain ? { formId: mountain.identity.formId, characterId: mountain.characterId } : undefined;
  const grid = useMemo(() => generateMountainGrid(generationSeed, base, summit, size, profile), [generationSeed, base, summit, size, profile?.formId, profile?.characterId]);
  const zoom = variant === 'card' ? 0.82 : variant === 'detail' ? 0.96 : 0.9;

  const polygons = useMemo(() => {
    const result: Array<{ key: string; points: string; fill: string; depth: number; stroke: string }> = [];
    const add = (key: string, points: Array<{ x: number; y: number; depth: number }>, fill: string, stroke = 'rgba(16,22,21,.22)') => {
      result.push({ key, points: points.map(point => `${point.x},${point.y}`).join(' '), fill, stroke, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length });
    };
    for (let y = 0; y < grid.height - 1; y += 1) {
      for (let x = 0; x < grid.width - 1; x += 1) {
        const cells = [cellAt(grid, { x, y }), cellAt(grid, { x: x + 1, y }), cellAt(grid, { x: x + 1, y: y + 1 }), cellAt(grid, { x, y: y + 1 })];
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
    ], fill, 'rgba(8,13,12,.34)');
    for (let x = 0; x < grid.width - 1; x += 1) {
      skirt(`north:${x}`, cellAt(grid, { x, y: 0 })!, cellAt(grid, { x: x + 1, y: 0 })!, '#39443f');
      skirt(`south:${x}`, cellAt(grid, { x: x + 1, y: grid.height - 1 })!, cellAt(grid, { x, y: grid.height - 1 })!, '#202925');
    }
    for (let y = 0; y < grid.height - 1; y += 1) {
      skirt(`west:${y}`, cellAt(grid, { x: 0, y: y + 1 })!, cellAt(grid, { x: 0, y })!, '#303a36');
      skirt(`east:${y}`, cellAt(grid, { x: grid.width - 1, y })!, cellAt(grid, { x: grid.width - 1, y: y + 1 })!, '#1e2723');
    }
    add('bottom', [
      project(0, 0, baseElevation, grid, yaw, pitch, zoom),
      project(grid.width - 1, 0, baseElevation, grid, yaw, pitch, zoom),
      project(grid.width - 1, grid.height - 1, baseElevation, grid, yaw, pitch, zoom),
      project(0, grid.height - 1, baseElevation, grid, yaw, pitch, zoom),
    ], '#17201c', 'rgba(8,12,11,.5)');
    return result.sort((a, b) => a.depth - b.depth);
  }, [grid, yaw, pitch, zoom]);

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
          setPitch(Math.max(12, Math.min(70, drag.current.pitch - (event.clientY - drag.current.y) * .25)));
        } : undefined}
        onPointerUp={interactive ? () => { drag.current = null; } : undefined}
        onPointerCancel={interactive ? () => { drag.current = null; } : undefined}
      >
        <rect x="0" y="0" width="1000" height="700" className="mountain-model__backdrop" />
        <g>{polygons.map(poly => <polygon key={poly.key} points={poly.points} fill={poly.fill} stroke={poly.stroke} strokeWidth={variant === 'card' ? 1.1 : .65} />)}</g>
      </svg>
      {variant !== 'card' && <div className="mountain-model__readout"><span>{mountain?.identity.formTitle ?? 'Процедурный массив'}</span><b>{summit} м</b></div>}
      {interactive && variant !== 'card' && <div className="mountain-model__hint">тяни, чтобы вращать</div>}
    </div>
  );
}
