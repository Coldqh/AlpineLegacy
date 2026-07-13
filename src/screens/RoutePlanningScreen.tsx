import { MountainArt } from '../components/MountainArt';
import { expeditionReadiness, getSelectedRoute, routesForMountain } from '../core/career';
import type { CareerState, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onSelectMountain: (mountainId: string) => void;
  onSelectRoute: (routeId: string) => void;
  onContinue: () => void;
};

function level(value: number) {
  if (value < 38) return 'Низкая';
  if (value < 58) return 'Средняя';
  if (value < 76) return 'Высокая';
  return 'Предельная';
}

function mountainScore(mountain: WorldState['region']['mountains'][number]) {
  return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32;
}

export function RoutePlanningScreen({ world, career, onSelectMountain, onSelectRoute, onContinue }: Props) {
  const route = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === route.mountainId) ?? world.region.mountains[0]!;
  const routes = routesForMountain(career, mountain.id);
  const readiness = expeditionReadiness(career);
  const mountains = [...world.region.mountains].sort((a, b) => mountainScore(a) - mountainScore(b));

  return (
    <section className="workspace-page route-planning-page">
      <header className="workspace-title workspace-title--compact">
        <div>
          <p className="eyebrow">ШАГ 1 ИЗ 4 · ЦЕЛЬ ЭКСПЕДИЦИИ</p>
          <h1>Выбери гору.</h1>
          <p>Сначала вершина, потом линия. Все показатели ниже влияют на время, состав, груз и шанс вернуться.</p>
        </div>
        <div className="workspace-title__mark"><span>{readiness.routeFit}</span><small>ТВОЁ СООТВЕТСТВИЕ</small></div>
      </header>

      <section className="decision-guide">
        <strong>Что делать сейчас</strong>
        <p>Выбери вершину, сравни три маршрута и нажми «Команда». Число соответствия показывает, насколько твои текущие навыки подходят выбранной линии.</p>
      </section>

      <section className="workspace-panel objective-selector">
        <div className="panel-heading"><div><p className="eyebrow">MOUNTAIN REGISTER</p><h2>Доступные вершины</h2></div><span>{mountains.length} ЦЕЛЕЙ</span></div>
        <div className="mountain-choice-grid">
          {mountains.map((item, index) => {
            const active = item.id === mountain.id;
            const history = career.livingWorld.mountainHistory.find(entry => entry.mountainId === item.id);
            return (
              <button key={item.id} className={active ? 'is-active' : ''} onClick={() => onSelectMountain(item.id)}>
                <span className="mountain-choice-grid__index">{String(index + 1).padStart(2, '0')}</span>
                <div><small>{item.characterTitle}</small><h3>{item.name}</h3><p>{item.epithet}</p></div>
                <strong>{item.elevation}<small>м</small></strong>
                <footer><span>Техника {level(item.technicality)}</span><span>{history?.summits ? `${history.summits} восх.` : 'не покорена'}</span></footer>
              </button>
            );
          })}
        </div>
      </section>

      <div className="route-hero-panel route-hero-panel--clear">
        <MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} />
        <div className="selected-objective-card">
          <small>ВЫБРАННАЯ ВЕРШИНА</small>
          <strong>{mountain.name}</strong>
          <span>{mountain.elevation} м · {mountain.dangerProfile}</span>
          <div className="mountain-character-callout"><small>{mountain.characterTitle}</small><p>{mountain.characterDescription}</p></div>
          <p>{mountain.summary}</p>
        </div>
      </div>

      <section className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">ROUTE OPTIONS</p><h2>Как подниматься</h2></div><span>ВЫБЕРИ ОДНУ ЛИНИЮ</span></div>
        <div className="route-choice-grid route-choice-grid--clear">
          {routes.map((item, index) => {
            const active = item.id === route.id;
            return (
              <button key={item.id} className={active ? 'is-active' : ''} onClick={() => onSelectRoute(item.id)}>
                <div><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
                <small>{mountain.characterTitle} · {item.style}</small>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <dl>
                  <div><dt>Время</dt><dd>≈ {item.estimatedHours} ч</dd></div>
                  <div><dt>Техника</dt><dd>{level(item.technicality)}</dd></div>
                  <div><dt>Риск</dt><dd>{level(item.objectiveRisk)}</dd></div>
                </dl>
                <footer>{active ? 'ВЫБРАНО' : 'ВЫБРАТЬ МАРШРУТ'}</footer>
              </button>
            );
          })}
        </div>
      </section>

      <section className="route-summary-panel">
        <div>
          <p className="eyebrow">SELECTED ROUTE</p>
          <h2>{route.name}</h2>
          <p>{route.summary}</p>
        </div>
        <div className="route-summary-panel__metrics">
          <span><small>СТАРТ</small><strong>{route.startElevation} м</strong></span>
          <span><small>ВЕРШИНА</small><strong>{route.summitElevation} м</strong></span>
          <span><small>ГРУППА</small><strong>{route.recommendedTeamSize}+</strong></span>
          <span><small>СООТВЕТСТВИЕ</small><strong>{readiness.routeFit}/100</strong></span>
        </div>
        <details className="route-segments-disclosure">
          <summary>Показать участки маршрута ({route.segments.length})</summary>
          <div className="route-segment-list">
            {route.segments.map((segment, index) => (
              <article key={segment.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><small>{segment.terrain} · +{segment.elevationGain} м</small><h3>{segment.name}</h3><p>{segment.note}</p></div>
                <div><strong>{segment.difficulty}</strong><small>{segment.hazard}</small></div>
              </article>
            ))}
          </div>
        </details>
      </section>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Подобрать команду</strong></span><b>→</b></button>
    </section>
  );
}
