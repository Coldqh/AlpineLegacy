import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute, getSelectedWeather, preparationInsights, selectedTeam } from '../core/career';
import type { CareerState, CareerTabId, DifficultyId } from '../core/types';

type Props = {
  career: CareerState;
  difficulty: DifficultyId;
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

function scoreText(value: number, difficulty: DifficultyId) {
  if (difficulty === 'EXPLORER') return String(value);
  if (difficulty === 'CLIMBER') return String(Math.round(value / 5) * 5);
  return status(value);
}

function altitudeMeaning(days: number, routeHeight: number) {
  if (days <= 1) return `Группа почти не готова к ${routeHeight} м. Расход сил на высоте будет резким.`;
  if (days <= 3) return 'Базовая адаптация. Работает на умеренной высоте, но оставляет мало запаса.';
  if (days <= 5) return 'Рабочая адаптация. Высота всё ещё влияет, но не должна ломать темп сама по себе.';
  return 'Сильная адаптация. Цена — потерянные дни и шанс, что соперники выйдут раньше.';
}

export function ExpeditionScreen({ career, difficulty, onLaunch, onOpenTab, onSelectWeather, onSetAcclimatization }: Props) {
  const route = getSelectedRoute(career);
  const weather = getSelectedWeather(career);
  const team = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const insights = preparationInsights(career);
  const cost = expeditionCost(career);
  const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;
  const packed = GEAR_CATALOG.filter(item => (career.expeditionPlan.gear[item.id] ?? 0) > 0);

  const metrics = [
    { label: 'Герой', value: readiness.hero, note: 'форма, здоровье, усталость', tab: 'OVERVIEW' as CareerTabId },
    { label: 'Маршрут', value: readiness.routeFit, note: 'совпадение навыков и линии', tab: 'ROUTE' as CareerTabId },
    { label: 'Команда', value: readiness.team, note: 'навыки, состояние, доверие', tab: 'TEAM' as CareerTabId },
    { label: 'Груз', value: readiness.equipment, note: 'обязательные вещи и вес', tab: 'EQUIPMENT' as CareerTabId },
    { label: 'Погода', value: readiness.weather, note: 'ветер, снег, длина окна', tab: 'EXPEDITION' as CareerTabId },
    { label: 'Высота', value: readiness.acclimatization, note: 'дни адаптации и выносливость', tab: 'EXPEDITION' as CareerTabId },
  ];

  return (
    <section className="workspace-page expedition-page expedition-page--clear">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 4 ИЗ 4 · GO / NO-GO · {difficulty}</p><h1>Прими решение.</h1><p>Здесь нет скрытого «идеального процента». Смотри на конкретные последствия: что случится с группой, если план оставить таким.</p></div>
        <div className={`readiness-seal ${canLaunch ? 'is-ready' : ''}`}><span>{difficulty === 'EXPEDITION' ? status(readiness.total) : readiness.total}</span><small>{difficulty === 'EXPEDITION' ? 'ОЦЕНКА ПЛАНА' : 'ОБЩАЯ ГОТОВНОСТЬ'}</small></div>
      </header>

      <section className={`decision-guide ${canLaunch ? 'is-good' : 'is-warning'}`}>
        <strong>{canLaunch ? 'Экспедицию можно начинать' : `Выход заблокирован: ${readiness.blockers.length}`}</strong>
        <p>{canLaunch ? `Старт через ${weather.startsInDays + career.expeditionPlan.acclimatizationDays} дней. Сразу спишется ${cost} кр. После этого решения будут приниматься уже на маршруте.` : 'Каждый красный пункт ниже ведёт прямо в раздел, где его можно исправить.'}</p>
      </section>

      <section className="consequence-board">
        {insights.map((item, index) => <article key={`${item.title}-${index}`} className={`is-${item.tone.toLowerCase()}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}
      </section>

      <section className="conditions-board">
        <div className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">WEATHER WINDOW</p><h2>Когда выходить</h2></div><span>ВЫБЕРИ ОДНО</span></div>
          <div className="weather-window-list weather-window-list--clear">
            {career.weatherWindows.map(item => {
              const selected = item.id === weather.id;
              const consequence = item.stability >= 75 ? 'Меньше шанс резкого ухудшения.' : item.stability >= 58 ? 'Рабочее окно без большого запаса.' : 'Высокий шанс потерять время или развернуться.';
              return (
                <button key={item.id} className={selected ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}>
                  <span>через {item.startsInDays} дн.</span>
                  <strong>{item.label}</strong>
                  <small>{item.temperatureC}°C · ветер {item.windKmh} км/ч · окно {item.durationHours} ч</small>
                  <p>{item.description}</p>
                  <footer><b>{difficulty === 'EXPLORER' ? `Стабильность ${item.stability}/100` : difficulty === 'CLIMBER' ? `Стабильность ≈${Math.round(item.stability / 10) * 10}/100` : item.stability >= 75 ? 'Устойчивое окно' : item.stability >= 58 ? 'Неустойчивое окно' : 'Слабое окно'}</b><em>{consequence}</em></footer>
                </button>
              );
            })}
          </div>
        </div>

        <div className="workspace-panel acclimatization-card">
          <div className="panel-heading"><div><p className="eyebrow">ACCLIMATIZATION</p><h2>Привыкание к высоте</h2></div><span>{scoreText(readiness.acclimatization, difficulty)}{difficulty === 'EXPEDITION' ? '' : '/100'}</span></div>
          <strong>{career.expeditionPlan.acclimatizationDays} дней</strong>
          <p>{altitudeMeaning(career.expeditionPlan.acclimatizationDays, route.summitElevation)}</p>
          <input type="range" min="0" max="9" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetAcclimatization(Number(event.target.value))} />
          <div className="range-labels"><span>0 · сразу</span><span>9 · максимум</span></div>
          <div className="acclimatization-tradeoff"><span>Цена решения</span><strong>+{career.expeditionPlan.acclimatizationDays} дней до старта</strong><small>За это время мир продолжит симуляцию.</small></div>
        </div>
      </section>

      <section className="readiness-breakdown">
        <div className="panel-heading"><div><p className="eyebrow">READINESS EXPLAINED</p><h2>Где слабое место</h2></div><span>НАЖМИ, ЧТОБЫ ИСПРАВИТЬ</span></div>
        <div className="readiness-explained-grid">
          {metrics.map(metric => (
            <button key={metric.label} onClick={() => onOpenTab(metric.tab)}>
              <span>{metric.label}</span><strong>{scoreText(metric.value, difficulty)}</strong><em>{difficulty === 'EXPEDITION' ? 'оценка' : status(metric.value)}</em><p>{metric.note}</p><i style={{ '--value': `${metric.value}%` } as React.CSSProperties} />
            </button>
          ))}
        </div>
      </section>

      <section className={`difficulty-disclosure is-${difficulty.toLowerCase()}`}><strong>{difficulty === 'EXPLORER' ? 'Explorer показывает точные оценки и рекомендации.' : difficulty === 'CLIMBER' ? 'Climber округляет прогнозы и оставляет решение тебе.' : 'Expedition скрывает точные вероятности. Физика та же, информации меньше.'}</strong><p>Сложность не меняет лавины, холод или прочность снаряжения. Меняется только объём доступной информации.</p></section>

      <div className="expedition-board expedition-board--clear">
        <section className="expedition-board__main">
          <article className="final-plan-card">
            <header><div><p className="eyebrow">ЦЕЛЬ</p><h2>{route.mountainName}</h2><h3>{route.name}</h3></div><button onClick={() => onOpenTab('ROUTE')}>Изменить</button></header>
            <p>{route.summary}</p>
            <dl><div><dt>Высота</dt><dd>{route.summitElevation} м</dd></div><div><dt>Время</dt><dd>≈ {route.estimatedHours} ч</dd></div><div><dt>Риск</dt><dd>{difficulty === 'EXPLORER' ? `${route.objectiveRisk}/100` : difficulty === 'CLIMBER' ? `≈${Math.round(route.objectiveRisk / 10) * 10}/100` : route.objectiveRisk >= 72 ? 'крайний' : route.objectiveRisk >= 54 ? 'высокий' : 'умеренный'}</dd></div></dl>
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
          ) : <p>Критических ошибок нет. Риск остаётся реальным, но теперь ты понимаешь, откуда он берётся.</p>}
          <div className="launch-cost"><span>Расходы сейчас</span><strong>{cost} кр.</strong><small>Останется {career.hero.money - cost} кр.</small></div>
          <button className="primary-action" disabled={!canLaunch} onClick={onLaunch}><span>{career.activeClimb ? 'Экспедиция уже идёт' : canLaunch ? 'Начать экспедицию' : 'Сначала исправь план'}</span><b>→</b></button>
        </aside>
      </div>
    </section>
  );
}
