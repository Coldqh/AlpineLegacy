import { useId } from 'react';
import type { QualificationClimb } from '../core/types';

type Props = {
  climb: QualificationClimb;
};

const WIDTH = 160;
const HEIGHT = 72;

export function RouteBlueprint({ climb }: Props) {
  const uid = useId().replace(/:/g, '');
  const descending = climb.phase === 'DESCENT';
  const totalGain = Math.max(1, climb.summitElevation - climb.startElevation);
  let running = descending ? climb.summitElevation : climb.startElevation;
  const points = [{ x: 8, y: descending ? 15 : 62, elevation: running }];

  climb.route.forEach((segment, index) => {
    running += descending ? -segment.elevationGain : segment.elevationGain;
    running = Math.max(climb.startElevation, Math.min(climb.summitElevation, running));
    points.push({
      x: 8 + ((index + 1) / climb.route.length) * 144,
      y: 62 - ((running - climb.startElevation) / totalGain) * 47,
      elevation: running,
    });
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const currentPointIndex = Math.max(0, Math.min(points.length - 1, climb.segmentIndex));
  const current = points[currentPointIndex]!;
  const washId = `route-wash-${uid}`;

  return (
    <div className={`route-blueprint ${descending ? 'is-descending' : ''}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${descending ? 'Спуск' : 'Подъём'} на ${climb.mountainName}`}>
        <defs>
          <linearGradient id={washId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[18, 32, 46, 60].map(y => <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} className="route-grid-line" />)}
        <path d={`${path} L 152 67 L 8 67 Z`} fill={`url(#${washId})`} />
        <path d={path} className="route-main-line" />
        {points.map((point, index) => {
          const passed = index <= currentPointIndex;
          return (
            <g key={`${point.x}-${point.y}`}>
              <circle cx={point.x} cy={point.y} r="1.3" className={passed ? 'route-node is-passed' : 'route-node'} />
              <text x={point.x + 2} y={point.y - 2.2} className="route-node-label">{Math.round(point.elevation)} M</text>
            </g>
          );
        })}
        <line x1={current.x} y1={current.y} x2={current.x} y2="68" className="route-current-axis" />
        <circle cx={current.x} cy={current.y} r="2.2" className="route-current-dot" />
      </svg>
      <div className="route-blueprint__caption">
        <span>{climb.routeName}</span>
        <span>{descending ? 'ЛИНИЯ СПУСКА' : 'ЛИНИЯ ПОДЪЁМА'}</span>
      </div>
    </div>
  );
}
