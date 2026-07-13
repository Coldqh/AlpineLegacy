import { useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { ScreenShell } from '../components/ScreenShell';
import { SKILL_LABELS } from '../core/career';
import type { CareerState, ClimbPace, ClimbStepResult } from '../core/types';

type Props = {
  career: CareerState;
  onStep: (pace: ClimbPace) => ClimbStepResult;
  onBeginDescent: () => void;
  onRetreat: () => void;
  onClose: () => void;
};

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}ч ${String(rest).padStart(2, '0')}м`;
}

export function ClimbScreen({ career, onStep, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const activeSegment = climb.route[Math.max(0, climb.segmentIndex)]!;
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);

  function move(pace: ClimbPace) {
    const result = onStep(pace);
    setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
  }

  if (terminal) {
    const success = climb.phase === 'COMPLETE';
    return (
      <ScreenShell rightLabel={`EXPEDITION RESULT / ${climb.mountainName}`} onPrint={() => window.print()}>
        <section className={`climb-result page-enter ${success ? 'is-success' : ''}`}>
          <div className="climb-result__index">{success ? '01' : '00'}</div>
          <p className="eyebrow">QUALIFICATION CLIMB / CLOSED</p>
          <h1>{success ? 'Ты вернулся.' : climb.phase === 'RETREATED' ? 'Ты развернулся.' : 'Попытка сорвана.'}</h1>
          <p className="lead">
            {success
              ? 'Вершина записана только сейчас. Не в момент подъёма, а после возвращения всей связки.'
              : climb.phase === 'RETREATED'
                ? 'Вершины нет. Карьера продолжается. Решение об отходе останется в журнале.'
                : 'Клубная группа доставила тебя вниз. Травмы и усталость перейдут в карьеру.'}
          </p>

          <div className="result-metrics">
            <div><span>Высшая точка</span><strong>{success ? climb.summitElevation : climb.currentElevation} м</strong></div>
            <div><span>Время на маршруте</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
            <div><span>Остаток сил</span><strong>{Math.round(climb.energy)}%</strong></div>
            <div><span>Травмы</span><strong>{climb.injuries.length || 'Нет'}</strong></div>
            <div><span>Репутация</span><strong>{success ? `+${climb.earnedReputation}` : '0'}</strong></div>
            <div><span>Клубная выплата</span><strong>{success ? `+${climb.earnedMoney} кр.` : '0'}</strong></div>
          </div>

          <div className="result-ledger">
            <p className="eyebrow">ROUTE LOG</p>
            {climb.log.map((line, index) => <div key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{line}</p></div>)}
          </div>

          <button className="primary-action result-close" onClick={onClose}><span>Вернуться в клуб</span><b>→</b></button>
        </section>
      </ScreenShell>
    );
  }

  if (climb.phase === 'SUMMIT') {
    return (
      <ScreenShell rightLabel={`${climb.mountainName} / ${climb.summitElevation} M`}>
        <section className="summit-screen page-enter">
          <div className="summit-screen__altitude">{climb.summitElevation}</div>
          <p className="eyebrow">SUMMIT / NOT THE END</p>
          <h1>Вершина.</h1>
          <p className="lead">Ты поднялся. Сил осталось {Math.round(climb.energy)}%. До исходной точки пять участков, а спуск проходит на усталости.</p>
          <div className="summit-line"><span>{climb.mountainName}</span><i /><span>{durationLabel(climb.elapsedMinutes)}</span></div>
          <button className="primary-action summit-descent" onClick={onBeginDescent}><span>Начать спуск</span><b>↓</b></button>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell rightLabel={`${climb.phase} / ${climb.currentElevation} M`}>
      <section className="climb-page page-enter">
        <header className="climb-header">
          <div>
            <p className="eyebrow">LIVE ROUTE / {climb.phase}</p>
            <h1>{climb.mountainName}</h1>
            <p>{climb.routeName}</p>
          </div>
          <div className="climb-header__phase">
            <span>{climb.phase === 'ASCENT' ? '↑' : '↓'}</span>
            <strong>{climb.phase === 'ASCENT' ? 'ПОДЪЁМ' : 'СПУСК'}</strong>
          </div>
        </header>

        <div className="climb-instruments">
          <div><span>Высота</span><strong>{climb.currentElevation} м</strong></div>
          <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
          <div><span>Энергия</span><strong>{Math.round(climb.energy)}%</strong><i style={{ '--value': `${climb.energy}%` } as React.CSSProperties} /></div>
          <div><span>Состояние</span><strong>{Math.round(climb.condition)}%</strong><i style={{ '--value': `${climb.condition}%` } as React.CSSProperties} /></div>
          <div><span>Погода</span><strong>{climb.weather}</strong></div>
        </div>

        <div className="climb-layout">
          <div className="climb-map-panel">
            <RouteBlueprint climb={climb} />
            <div className="segment-register">
              {climb.route.map((segment, index) => {
                const current = index === climb.segmentIndex;
                const passed = climb.phase === 'ASCENT' ? index < climb.segmentIndex : index > climb.segmentIndex;
                return (
                  <div key={segment.id} className={`${current ? 'is-current' : ''} ${passed ? 'is-passed' : ''}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <i />
                    <p><strong>{segment.name}</strong><small>{segment.terrain} · +{segment.elevationGain} м</small></p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="climb-decision-panel">
            <p className="eyebrow">CURRENT SEGMENT / {String(climb.segmentIndex + 1).padStart(2, '0')}</p>
            <h2>{activeSegment.name}</h2>
            <p className="segment-note">{activeSegment.note}</p>

            <div className="segment-data">
              <div><span>Рельеф</span><strong>{activeSegment.terrain}</strong></div>
              <div><span>Основной навык</span><strong>{SKILL_LABELS[activeSegment.skill]} {career.hero.skills[activeSegment.skill]}</strong></div>
              <div><span>Базовое время</span><strong>{activeSegment.baseDurationMinutes} мин.</strong></div>
              <div><span>Сложность</span><strong>{activeSegment.difficulty}/100</strong></div>
              <div><span>Открытость</span><strong>{activeSegment.exposure}/100</strong></div>
            </div>

            {feedback && (
              <div className={`climb-feedback is-${feedback.severity.toLowerCase()}`}>
                <span>LAST ACTION</span>
                <h3>{feedback.headline}</h3>
                <p>{feedback.detail}</p>
              </div>
            )}

            <div className="pace-options">
              <button onClick={() => move('CAUTIOUS')}>
                <span>01</span><strong>Осторожно</strong><small>Медленнее. Меньше расход сил и риск.</small><b>+28% времени</b>
              </button>
              <button className="is-primary" onClick={() => move('STEADY')}>
                <span>02</span><strong>Ровный темп</strong><small>Рабочий режим без специальной поправки.</small><b>Базовый расчёт</b>
              </button>
              <button onClick={() => move('FAST')}>
                <span>03</span><strong>Быстро</strong><small>Меньше времени в опасной зоне. Выше цена ошибки.</small><b>−22% времени</b>
              </button>
            </div>

            {climb.phase === 'ASCENT' && <button className="retreat-button" onClick={onRetreat}>Развернуть связку и вернуться вниз</button>}
          </div>
        </div>

        <div className="live-log">
          <p className="eyebrow">LIVE FIELD LOG</p>
          {[...climb.log].reverse().slice(0, 5).map((line, index) => <div key={`${line}-${index}`}><span>{String(climb.log.length - index).padStart(2, '0')}</span><p>{line}</p></div>)}
        </div>
      </section>
    </ScreenShell>
  );
}
