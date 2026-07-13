import { MountainArt } from '../components/MountainArt';
import { expeditionReadiness, getSelectedRoute, getSelectedWeather } from '../core/career';
import type { CareerState, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onSelectRoute: (routeId: string) => void;
  onSelectWeather: (windowId: string) => void;
  onSetAcclimatization: (days: number) => void;
};

export function RoutePlanningScreen({ world, career, onSelectRoute, onSelectWeather, onSetAcclimatization }: Props) {
  const route = getSelectedRoute(career);
  const window = getSelectedWeather(career);
  const mountain = world.region.mountains.find(item => item.id === route.mountainId) ?? world.region.mountains[0]!;
  const readiness = expeditionReadiness(career);

  return (
    <section className="workspace-page route-planning-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ROUTE OFFICE / OBJECTIVE 001</p><h1>Маршрут</h1><p>Выбор линии определяет время, состав группы, снаряжение и характер риска.</p></div>
        <div className="workspace-title__mark"><span>{readiness.routeFit}</span><small>СООТВЕТСТВИЕ</small></div>
      </header>

      <div className="route-hero-panel">
        <MountainArt points={mountain.profilePoints} variant="hero" label={route.mountainName} elevation={route.summitElevation} />
        <div className="route-hero-panel__legend"><small>SELECTED LINE</small><strong>{route.name}</strong><span>{route.style}</span></div>
      </div>

      <section className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">AVAILABLE LINES</p><h2>Три способа подняться</h2></div><span>SELECT ONE</span></div>
        <div className="route-choice-grid">
          {career.routes.map((item, index) => (
            <button key={item.id} className={item.id === route.id ? 'is-active' : ''} onClick={() => onSelectRoute(item.id)}>
              <div><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
              <small>{item.style}</small>
              <h3>{item.name}</h3>
              <p>{item.summary}</p>
              <dl>
                <div><dt>Время</dt><dd>{item.estimatedHours} ч</dd></div>
                <div><dt>Техника</dt><dd>{item.technicality}</dd></div>
                <div><dt>Риск</dt><dd>{item.objectiveRisk}</dd></div>
              </dl>
            </button>
          ))}
        </div>
      </section>

      <div className="route-detail-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">SEGMENT REGISTER</p><h2>{route.name}</h2></div><span>{route.segments.length} УЧАСТКОВ</span></div>
          <div className="route-segment-list">
            {route.segments.map((segment, index) => (
              <article key={segment.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><small>{segment.terrain} · +{segment.elevationGain} м</small><h3>{segment.name}</h3><p>{segment.note}</p></div>
                <div><strong>{segment.difficulty}</strong><small>{segment.hazard}</small></div>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">WEATHER WINDOWS</p><h2>Окно выхода</h2></div><span>{window.durationHours} H</span></div>
          <div className="weather-window-list">
            {career.weatherWindows.map(item => (
              <button key={item.id} className={item.id === window.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}>
                <span>+{item.startsInDays} ДНЕЙ</span><strong>{item.label}</strong><small>{item.temperatureC}°C · {item.windKmh} км/ч · стабильность {item.stability}</small><p>{item.description}</p>
              </button>
            ))}
          </div>
          <div className="acclimatization-control">
            <div><p className="eyebrow">ACCLIMATIZATION</p><h3>{career.expeditionPlan.acclimatizationDays} дней</h3></div>
            <input type="range" min="0" max="9" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetAcclimatization(Number(event.target.value))} />
            <div><span>Быстро</span><span>Надёжно</span></div>
          </div>
        </section>
      </div>
    </section>
  );
}
