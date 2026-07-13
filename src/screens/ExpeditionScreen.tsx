import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute, getSelectedWeather, selectedTeam } from '../core/career';
import type { CareerState, CareerTabId } from '../core/types';

type Props = {
  career: CareerState;
  onLaunch: () => void;
  onOpenTab: (tab: CareerTabId) => void;
  onSelectWeather: (windowId: string) => void;
  onSetAcclimatization: (days: number) => void;
};

function blockerTab(text: string): CareerTabId {
  if (text.includes('снаряж') || text.includes('еды') || text.includes('топлива') || text.includes('средств')) return 'EQUIPMENT';
  if (text.includes('Группа')) return 'TEAM';
  if (text.includes('Акклиматизация') || text.includes('утомлён')) return 'OVERVIEW';
  return 'ROUTE';
}

function status(value: number) {
  if (value >= 76) return 'Сильная';
  if (value >= 58) return 'Рабочая';
  if (value >= 40) return 'Слабая';
  return 'Опасная';
}

export function ExpeditionScreen({ career, onLaunch, onOpenTab, onSelectWeather, onSetAcclimatization }: Props) {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const team = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const cost = expeditionCost(career);
  const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;
  const packed = GEAR_CATALOG.filter(item => (career.expeditionPlan.gear[item.id] ?? 0) > 0);

  const metrics = [
    { label: 'Герой', value: readiness.hero, note: 'форма, здоровье, усталость', tab: 'OVERVIEW' as CareerTabId },
    { label: 'Маршрут', value: readiness.routeFit, note: 'совпадение навыков и линии', tab: 'ROUTE' as CareerTabId },
    { label: 'Команда', value: readiness.team, note: 'навыки, состояние, доверие', tab: 'TEAM' as CareerTabId },
    { label: 'Снаряжение', value: readiness.equipment, note: 'обязательные вещи и вес', tab: 'EQUIPMENT' as CareerTabId },
    { label: 'Погода', value: readiness.weather, note: 'ветер, снег, длина окна', tab: 'EXPEDITION' as CareerTabId },
    { label: 'Высота', value: readiness.acclimatization, note: 'дни акклиматизации и выносливость', tab: 'EXPEDITION' as CareerTabId },
  ];

  return (
    <section className="workspace-page expedition-page expedition-page--clear">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 4 ИЗ 4 · GO / NO-GO</p><h1>Проверка выхода.</h1><p>Выбери погодное окно и срок акклиматизации. Затем исправь красные блокировки. Общий процент сам по себе не разрешает выход.</p></div>
        <div className={`readiness-seal ${canLaunch ? 'is-ready' : ''}`}><span>{readiness.total}</span><small>ОБЩАЯ ГОТОВНОСТЬ</small></div>
      </header>

      <section className={`decision-guide ${canLaunch ? 'is-good' : 'is-warning'}`}>
        <strong>{canLaunch ? 'Экспедицию можно начинать' : `Выход заблокирован: ${readiness.blockers.length}`}</strong>
        <p>{canLaunch ? `После старта пройдёт ${weather.startsInDays + career.expeditionPlan.acclimatizationDays} игровых дней, спишется ${cost} кр. и откроется пошаговое восхождение.` : 'Ниже показано, что именно мешает. Каждый пункт ведёт в нужный раздел.'}</p>
      </section>

      <section className="conditions-board">
        <div className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">WEATHER WINDOW</p><h2>Когда выходить</h2></div><span>ВЫБЕРИ ОДНО</span></div>
          <div className="weather-window-list weather-window-list--clear">
            {career.weatherWindows.map(item => (
              <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}>
                <span>через {item.startsInDays} дн.</span>
                <strong>{item.label}</strong>
                <small>{item.temperatureC}°C · ветер {item.windKmh} км/ч · окно {item.durationHours} ч</small>
                <p>{item.description}</p>
                <footer>Стабильность {item.stability}/100</footer>
              </button>
            ))}
          </div>
        </div>

        <div className="workspace-panel acclimatization-card">
          <div className="panel-heading"><div><p className="eyebrow">ACCLIMATIZATION</p><h2>Привыкание к высоте</h2></div><span>{readiness.acclimatization}/100</span></div>
          <strong>{career.expeditionPlan.acclimatizationDays} дней</strong>
          <p>Больше дней повышает высотную готовность, но мир продолжает жить: соперники могут выйти раньше, а погода изменится.</p>
          <input type="range" min="0" max="9" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetAcclimatization(Number(event.target.value))} />
          <div className="range-labels"><span>0 · сразу</span><span>9 · надёжно</span></div>
        </div>
      </section>

      <section className="readiness-breakdown">
        <div className="panel-heading"><div><p className="eyebrow">READINESS EXPLAINED</p><h2>Из чего сложилась готовность</h2></div><span>НАЖМИ, ЧТОБЫ ИСПРАВИТЬ</span></div>
        <div className="readiness-explained-grid">
          {metrics.map(metric => (
            <button key={metric.label} onClick={() => onOpenTab(metric.tab)}>
              <span>{metric.label}</span><strong>{metric.value}</strong><em>{status(metric.value)}</em><p>{metric.note}</p><i style={{ '--value': `${metric.value}%` } as React.CSSProperties} />
            </button>
          ))}
        </div>
      </section>

      <div className="expedition-board expedition-board--clear">
        <section className="expedition-board__main">
          <article className="final-plan-card">
            <header><div><p className="eyebrow">ЦЕЛЬ</p><h2>{route.mountainName}</h2><h3>{route.name}</h3></div><button onClick={() => onOpenTab('ROUTE')}>Изменить</button></header>
            <p>{route.summary}</p>
            <dl><div><dt>Высота</dt><dd>{route.summitElevation} м</dd></div><div><dt>Время</dt><dd>≈ {route.estimatedHours} ч</dd></div><div><dt>Риск</dt><dd>{route.objectiveRisk}/100</dd></div></dl>
          </article>
          <div className="final-plan-row">
            <article><header><p className="eyebrow">КОМАНДА</p><button onClick={() => onOpenTab('TEAM')}>Изменить</button></header><h3>{team.length + 1} человека</h3><p>{team.length ? team.map(member => member.name).join(' · ') : 'Только герой'}</p></article>
            <article><header><p className="eyebrow">ГРУЗ</p><button onClick={() => onOpenTab('EQUIPMENT')}>Изменить</button></header><h3>{expeditionWeight(career).toFixed(1)} кг / чел.</h3><p>{packed.map(item => item.name).join(' · ') || 'Снаряжение не собрано'}</p></article>
          </div>
        </section>

        <aside className="launch-panel launch-panel--clear">
          <p className="eyebrow">ФИНАЛЬНОЕ РЕШЕНИЕ</p>
          <h2>{canLaunch ? 'План закрыт.' : 'План не готов.'}</h2>
          {readiness.blockers.length > 0 ? (
            <div className="launch-blockers launch-blockers--actionable">
              {readiness.blockers.map(item => <button key={item} onClick={() => onOpenTab(blockerTab(item))}><i /><span>{item}</span><b>Исправить →</b></button>)}
            </div>
          ) : <p>Обязательные условия выполнены. Риск остаётся, но это уже осознанный выход, а не ошибка интерфейса.</p>}
          <div className="launch-cost"><span>Расходы сейчас</span><strong>{cost} кр.</strong><small>Останется {career.hero.money - cost} кр.</small></div>
          <button className="primary-action" disabled={!canLaunch} onClick={onLaunch}><span>{career.activeClimb ? 'Экспедиция уже идёт' : canLaunch ? 'Начать экспедицию' : 'Сначала исправь план'}</span><b>→</b></button>
        </aside>
      </div>
    </section>
  );
}
