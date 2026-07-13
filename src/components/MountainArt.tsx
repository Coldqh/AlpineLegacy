import { useId } from 'react';
import type { ProfilePoint } from '../core/types';

type Props = {
  points?: ProfilePoint[];
  variant?: 'hero' | 'card' | 'detail';
  label?: string;
  elevation?: number;
};

const defaultPoints: ProfilePoint[] = [
  { x: 0, y: 96 }, { x: 9, y: 82 }, { x: 18, y: 73 }, { x: 28, y: 78 },
  { x: 38, y: 53 }, { x: 47, y: 39 }, { x: 56, y: 15 }, { x: 64, y: 34 },
  { x: 73, y: 48 }, { x: 84, y: 67 }, { x: 100, y: 96 },
];

const WIDTH = 160;
const HEIGHT = 72;
const TOP = 8;
const BOTTOM = 64;

function projectPoint(point: ProfilePoint): ProfilePoint {
  return {
    x: (point.x / 100) * WIDTH,
    y: TOP + (point.y / 110) * (BOTTOM - TOP),
  };
}

function pathFrom(points: ProfilePoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

export function MountainArt({ points = defaultPoints, variant = 'hero', label, elevation }: Props) {
  const uid = useId().replace(/:/g, '');
  const projected = points.map(projectPoint);
  const path = pathFrom(projected);
  const fillPath = `${path} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
  const summit = projected.reduce((best, point) => point.y < best.y ? point : best, projected[0]!);
  const fillId = `mountain-fill-${variant}-${uid}`;
  const gridId = `mountain-grid-${variant}-${uid}`;

  return (
    <div className={`mountain-art mountain-art--${variant}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label || 'Профиль горы'}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
          <pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${gridId})`} />
        {[18, 32, 46, 60].map(y => <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} className="mountain-grid-line" />)}
        <path d={fillPath} fill={`url(#${fillId})`} />
        <path d={path} className="mountain-line mountain-line--ghost" transform="translate(0 2.5)" />
        <path d={path} className="mountain-line" />
        <line x1={summit.x} y1={Math.max(2, summit.y - 1.5)} x2={summit.x} y2="67" className="summit-axis" />
        <circle cx={summit.x} cy={summit.y} r="1.2" className="summit-dot" />
        {elevation && <text x={Math.min(146, summit.x + 3)} y={Math.max(7, summit.y - 3)} className="svg-label">{elevation} M</text>}
      </svg>
      {label && <div className="mountain-art__caption"><span>{label}</span><span>ALPINE PROFILE</span></div>}
    </div>
  );
}
