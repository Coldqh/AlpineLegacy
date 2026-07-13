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

function pathFrom(points: ProfilePoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function MountainArt({ points = defaultPoints, variant = 'hero', label, elevation }: Props) {
  const path = pathFrom(points);
  const fillPath = `${path} L 100 110 L 0 110 Z`;
  const summit = points.reduce((best, point) => point.y < best.y ? point : best, points[0]!);

  return (
    <div className={`mountain-art mountain-art--${variant}`}>
      <svg viewBox="0 0 100 110" preserveAspectRatio="none" role="img" aria-label={label || 'Профиль горы'}>
        <defs>
          <linearGradient id={`mountain-fill-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
          <pattern id={`grid-${variant}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width="100" height="110" fill={`url(#grid-${variant})`} />
        {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} className="mountain-grid-line" />)}
        <path d={fillPath} fill={`url(#mountain-fill-${variant})`} />
        <path d={path} className="mountain-line mountain-line--ghost" transform="translate(0 4)" />
        <path d={path} className="mountain-line" />
        <line x1={summit.x} y1={summit.y - 2} x2={summit.x} y2="103" className="summit-axis" />
        <circle cx={summit.x} cy={summit.y} r="1.2" className="summit-dot" />
        {elevation && <text x={Math.min(88, summit.x + 2)} y={Math.max(8, summit.y - 4)} className="svg-label">{elevation} M</text>}
      </svg>
      {label && <div className="mountain-art__caption"><span>{label}</span><span>ALPINE PROFILE</span></div>}
    </div>
  );
}
