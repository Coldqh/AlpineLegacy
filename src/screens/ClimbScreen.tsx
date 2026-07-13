import { useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { SKILL_LABELS } from '../core/career';
import type { CareerState, ClimbPace, ClimbStepResult } from '../core/types';

type Props = {
  career: CareerState;
  onStep: (pace: ClimbPace) => ClimbStepResult;
  onCamp: () => ClimbStepResult;
  onMeltSnow: () => ClimbStepResult;
  onWait: () => ClimbStepResult;
  onBeginDescent: () => void;
  onRetreat: () => void;
  onClose: () => void;
};

function durationLabel(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return `${days ? `${days}д ` : ''}${hours}ч ${String(rest).padStart(2, '0')}м`;
}

export function ClimbScreen({ career, onStep, onCamp, onMeltSnow, onWait, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const activeSegment = climb.route[Math.max(0, Math.min(climb.route.length - 1, climb.segmentIndex))]!;
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);

  function resolve(action: () => ClimbStepResult) {
    const result = action();
    setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
  }

  if (terminal) {
    const success = climb.phase === 'COMPLETE';
    return (
      <section className={`workspace-page climb-result climb-result--embedded ${success ? 'is-success' : ''}`}>
        <div className="climb-result__index">{success ? '01' : '00'}</div>
        <p className="eyebrow">EXPEDITION CLOSED / {climb.routeName}</p>
        <h1>{success ? 'Ты вернулся.' : climb.phase === 'RETREATED' ? 'Группа вернулась.' : 'Экспедиция сорвана.'}</h1>
        <p className="lead">{success ? 'Вершина записана только после полного спуска. Теперь маршрут существует в карьере как факт.' : climb.phase === 'RETREATED' ? 'Вершины нет. Решение об отходе сохранено, люди живы.' : 'Последствия переходят в здоровье, усталость и журнал.'}</p>
        <div className="result-metrics">
          <div><span>Высшая точка</span><strong>{climb.summitReached ? climb.summitElevation : climb.currentElevation} м</strong></div>
          <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
          <div><span>Остаток сил</span><strong>{Math.round(climb.energy)}%</strong></div>
          <div><span>Команда</span><strong>{Math.round(climb.teamCondition)}%</strong></div>
          <div><span>Репутация</span><strong>+{climb.earnedReputation}</strong></div>
          <div><span>Выплата</span><strong>+{climb.earnedMoney} кр.</strong></div>
        </div>
        <div className="result-ledger">{climb.log.map((line, index) => <div key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{line}</p></div>)}</div>
        <button className="primary-action result-close" onClick={onClose}><span>Закрыть экспедицию</span><b>→</b></button>
      </section>
    );
  }

  if (climb.phase === 'SUMMIT') {
    return (
      <section className="workspace-page summit-screen summit-screen--embedded">
        <div className="summit-screen__altitude">{climb.summitElevation}</div>
        <p className="eyebrow">SUMMIT / NOT THE END</p>
        <h1>Вершина.</h1>
        <p className="lead">Сил осталось {Math.round(climb.energy)}%. Ветер {climb.windKmh} км/ч. Внизу весь маршрут, а группа уже работает {Math.round(climb.hoursAwake)} часов.</p>
        <div className="summit-line"><span>{climb.mountainName}</span><i /><span>{durationLabel(climb.elapsedMinutes)}</span></div>
        <button className="primary-action summit-descent" onClick={onBeginDescent}><span>Начать спуск</span><b>↓</b></button>
      </section>
    );
  }

  return (
    <section className="workspace-page climb-page climb-page--embedded">
      <header className="workspace-title climb-workspace-title">
        <div><p className="eyebrow">LIVE ROUTE / {climb.phase}</p><h1>{climb.mountainName}</h1><p>{climb.routeName} · {climb.routeStyle}</p></div>
        <div className="climb-phase-mark"><span>{climb.phase === 'ASCENT' ? '↑' : '↓'}</span><small>{climb.retreating ? 'ОТХОД' : climb.phase === 'ASCENT' ? 'ПОДЪЁМ' : 'СПУСК'}</small></div>
      </header>

      <div className="climb-instruments climb-instruments--workspace">
        <div><span>Высота</span><strong>{climb.currentElevation} м</strong></div>
        <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
        <div><span>Энергия</span><strong>{Math.round(climb.energy)}%</strong><i style={{ '--value': `${climb.energy}%` } as React.CSSProperties} /></div>
        <div><span>Группа</span><strong>{Math.round(climb.teamCondition)}%</strong><i style={{ '--value': `${climb.teamCondition}%` } as React.CSSProperties} /></div>
        <div><span>Погода</span><strong>{climb.temperatureC}° · {climb.windKmh} км/ч</strong></div>
        <div><span>Видимость</span><strong>{climb.visibility}%</strong></div>
      </div>

      <div className="climb-workspace-grid">
        <section className="climb-map-panel climb-map-panel--workspace">
          <RouteBlueprint climb={climb} />
          <div className="route-progress-register">
            {climb.route.map((segment, index) => {
              const current = index === climb.segmentIndex;
              const passed = climb.phase === 'ASCENT' ? index < climb.segmentIndex : index > climb.segmentIndex;
              return <div key={segment.id} className={`${current ? 'is-current' : ''} ${passed ? 'is-passed' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><i /><p><strong>{segment.name}</strong><small>{segment.terrain} · {segment.hazard}</small></p></div>;
            })}
          </div>
        </section>

        <section className="climb-control-panel">
          <div className="current-segment-card">
            <p className="eyebrow">CURRENT SEGMENT / {String(climb.segmentIndex + 1).padStart(2, '0')}</p>
            <h2>{activeSegment.name}</h2><p>{activeSegment.note}</p>
            <div><span>Навык <b>{SKILL_LABELS[activeSegment.skill]} {career.hero.skills[activeSegment.skill]}</b></span><span>Сложность <b>{activeSegment.difficulty}</b></span><span>Опасность <b>{activeSegment.hazard}</b></span></div>
          </div>

          {feedback && <div className={`climb-feedback is-${feedback.severity.toLowerCase()}`}><span>LAST ACTION</span><h3>{feedback.headline}</h3><p>{feedback.detail}</p></div>}

          <div className="pace-options pace-options--workspace">
            <button onClick={() => resolve(() => onStep('CAUTIOUS'))}><span>01</span><strong>Осторожно</strong><small>Меньше риск и расход сил.</small><b>+28% времени</b></button>
            <button className="is-primary" onClick={() => resolve(() => onStep('STEADY'))}><span>02</span><strong>Ровный темп</strong><small>Рабочий режим.</small><b>Базовый расчёт</b></button>
            <button onClick={() => resolve(() => onStep('FAST'))}><span>03</span><strong>Быстро</strong><small>Меньше времени в зоне риска.</small><b>Цена ошибки выше</b></button>
          </div>

          <div className="field-actions">
            <button disabled={!activeSegment.campPossible} onClick={() => resolve(onCamp)}><span>Лагерь</span><small>7 часов · еда · топливо</small></button>
            <button disabled={climb.supplies.fuelUnits <= 0} onClick={() => resolve(onMeltSnow)}><span>Топить снег</span><small>50 минут · +5 воды</small></button>
            <button onClick={() => resolve(onWait)}><span>Ждать окно</span><small>3 часа · погода меняется</small></button>
          </div>

          {climb.phase === 'ASCENT' && <button className="retreat-button" onClick={onRetreat}>Развернуть группу и начать спуск</button>}
        </section>

        <aside className="climb-resource-panel">
          <p className="eyebrow">FIELD RESOURCES</p><h2>Запасы</h2>
          <div><span>Еда</span><strong>{climb.supplies.foodUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.foodUnits * 8)}%` } as React.CSSProperties} /></div>
          <div><span>Вода</span><strong>{climb.supplies.waterUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.waterUnits * 14)}%` } as React.CSSProperties} /></div>
          <div><span>Топливо</span><strong>{climb.supplies.fuelUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.fuelUnits * 25)}%` } as React.CSSProperties} /></div>
          <div><span>Вес</span><strong>{climb.packWeightKg} кг</strong></div>
          <div><span>Без сна</span><strong>{Math.round(climb.hoursAwake)} ч</strong></div>
          <p className="resource-warning">Пустой запас не заканчивает игру мгновенно. Он резко ухудшает каждое следующее действие.</p>
        </aside>
      </div>
    </section>
  );
}
