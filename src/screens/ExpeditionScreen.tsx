import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute, getSelectedWeather, selectedTeam } from '../core/career';
import type { CareerState } from '../core/types';

type Props = { career: CareerState; onLaunch: () => void; onOpenTab: (tab: 'ROUTE' | 'TEAM' | 'EQUIPMENT') => void };

export function ExpeditionScreen({ career, onLaunch, onOpenTab }: Props) {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const team = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const cost = expeditionCost(career);
  const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;

  const metrics = [
    ['Герой', readiness.hero], ['Маршрут', readiness.routeFit], ['Команда', readiness.team], ['Снаряжение', readiness.equipment], ['Погода', readiness.weather], ['Акклиматизация', readiness.acclimatization],
  ] as const;

  return (
    <section className="workspace-page expedition-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">EXPEDITION BOARD / FINAL REVIEW</p><h1>Экспедиция</h1><p>Здесь план закрывается. После выхода изменения состава, маршрута и груза недоступны.</p></div>
        <div className={`readiness-seal ${canLaunch ? 'is-ready' : ''}`}><span>{readiness.total}</span><small>ГОТОВНОСТЬ</small></div>
      </header>

      <div className="expedition-score-grid">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><i style={{ '--value': `${value}%` } as React.CSSProperties} /></div>)}
      </div>

      <div className="expedition-board">
        <section className="expedition-board__main">
          <div className="expedition-route-card">
            <div><p className="eyebrow">OBJECTIVE / ROUTE</p><h2>{route.mountainName}</h2><h3>{route.name}</h3></div>
            <button onClick={() => onOpenTab('ROUTE')}>Изменить →</button>
            <p>{route.summary}</p>
            <dl><div><dt>Высота</dt><dd>{route.summitElevation} м</dd></div><div><dt>Время</dt><dd>≈ {route.estimatedHours} ч</dd></div><div><dt>Риск</dt><dd>{route.objectiveRisk}/100</dd></div></dl>
          </div>

          <div className="expedition-review-row">
            <article><div><p className="eyebrow">TEAM</p><h3>{team.length + 1} человека</h3></div><button onClick={() => onOpenTab('TEAM')}>Изменить</button><p>{team.map(member => member.name).join(' · ')}</p></article>
            <article><div><p className="eyebrow">LOAD</p><h3>{expeditionWeight(career).toFixed(1)} кг / чел.</h3></div><button onClick={() => onOpenTab('EQUIPMENT')}>Изменить</button><p>{GEAR_CATALOG.filter(item => (career.expeditionPlan.gear[item.id] ?? 0) > 0).map(item => item.name).join(' · ')}</p></article>
          </div>

          <div className="weather-ticket">
            <span>+{weather.startsInDays} ДНЕЙ</span><div><small>WEATHER WINDOW</small><h3>{weather.label}</h3><p>{weather.description}</p></div><strong>{weather.temperatureC}°<small>{weather.windKmh} км/ч</small></strong>
          </div>
        </section>

        <aside className="launch-panel">
          <p className="eyebrow">GO / NO-GO</p>
          <h2>{canLaunch ? 'План принят.' : 'План не закрыт.'}</h2>
          <p>{canLaunch ? 'После нажатия проходит ожидание окна и акклиматизация. Группа выходит на маршрут.' : 'Исправь блокирующие проблемы. Высокая цифра готовности не отменяет обязательные условия.'}</p>
          {readiness.blockers.length > 0 && <div className="launch-blockers">{readiness.blockers.map(item => <div key={item}><i />{item}</div>)}</div>}
          <div className="launch-cost"><span>Общие расходы</span><strong>{cost} кр.</strong><small>Останется {career.hero.money - cost} кр.</small></div>
          <button className="primary-action" disabled={!canLaunch} onClick={onLaunch}><span>{career.activeClimb ? 'Экспедиция уже идёт' : canLaunch ? 'Начать экспедицию' : 'Выход заблокирован'}</span><b>→</b></button>
        </aside>
      </div>
    </section>
  );
}
