import type { QualificationClimb } from '../core/types';

type Props = {
  climb: QualificationClimb;
};

export function RouteBlueprint({ climb }: Props) {
  const descending = climb.phase === 'DESCENT';
  const totalGain = Math.max(1, climb.summitElevation - climb.startElevation);
  let running = descending ? climb.summitElevation : climb.startElevation;
  const points = [{ x: 7, y: descending ? 20 : 92, elevation: running }];

  climb.route.forEach((segment, index) => {
    running += descending ? -segment.elevationGain : segment.elevationGain;
    running = Math.max(climb.startElevation, Math.min(climb.summitElevation, running));
    points.push({
      x: 7 + ((index + 1) / climb.route.length) * 86,
      y: 92 - ((running - climb.startElevation) / totalGain) * 72,
      elevation: running,
    });
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const currentPointIndex = Math.max(0, Math.min(points.length - 1, climb.segmentIndex));
  const current = points[currentPointIndex]!;

  return (
    <div className={`route-blueprint ${descending ? 'is-descending' : ''}`}>
      <svg viewBox="0 0 100 108" preserveAspectRatio="none" role="img" aria-label={`${descending ? 'Спуск' : 'Подъём'} на ${climb.mountainName}`}>
        <defs>
          <linearGradient id="route-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} className="route-grid-line" />)}
        <path d={`${path} L 93 100 L 7 100 Z`} fill="url(#route-wash)" />
        <path d={path} className="route-main-line" />
        {points.map((point, index) => {
          const passed = index <= currentPointIndex;
          return (
            <g key={`${point.x}-${point.y}`}>
              <circle cx={point.x} cy={point.y} r="1.5" className={passed ? 'route-node is-passed' : 'route-node'} />
              <text x={point.x + 1.8} y={point.y - 2.3} className="route-node-label">{Math.round(point.elevation)} M</text>
            </g>
          );
        })}
        <line x1={current.x} y1={current.y} x2={current.x} y2="101" className="route-current-axis" />
        <circle cx={current.x} cy={current.y} r="2.5" className="route-current-dot" />
      </svg>
      <div className="route-blueprint__caption">
        <span>{climb.routeName}</span>
        <span>{descending ? 'ОТДЕЛЬНАЯ ЛИНИЯ СПУСКА' : 'ЛИНИЯ ПОДЪЁМА'}</span>
      </div>
    </div>
  );
}
