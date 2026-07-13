import { useMemo, useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { previewClimbAction, SKILL_LABELS } from '../core/career';
import type { CareerState, ClimbActionPreview, ClimbOrderId, ClimbPace, ClimbStepResult } from '../core/types';

type Props = {
  career: CareerState;
  onStep: (pace: ClimbPace) => ClimbStepResult;
  onCamp: () => ClimbStepResult;
  onMeltSnow: () => ClimbStepResult;
  onWait: () => ClimbStepResult;
  onOrder: (order: ClimbOrderId) => ClimbStepResult;
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

function paceTitle(pace: ClimbPace) {
  return pace === 'CAUTIOUS' ? 'Осторожно' : pace === 'FAST' ? 'Быстро' : 'Ровный темп';
}

function resultReview(career: CareerState) {
  const climb = career.activeClimb!;
  const strengths: string[] = [];
  const mistakes: string[] = [];
  if (climb.phase === 'COMPLETE' && climb.summitReached) strengths.push('Вершина засчитана только после полного спуска.');
  if (climb.phase === 'RETREATED') strengths.push('Отход начат до полной потери рабочего состояния.');
  if (climb.rescuedMemberIds.length) strengths.push(`Помощь получили ${climb.rescuedMemberIds.length} участника.`);
  if (climb.energy >= 30) strengths.push(`На возвращении осталось ${Math.round(climb.energy)}% энергии.`);
  if (climb.hoursAwake > 16) mistakes.push(`Группа работала без сна ${Math.round(climb.hoursAwake)} часов.`);
  if (climb.energy < 20) mistakes.push('Спуск завершён почти без физического резерва.');
  if (climb.injuries.length) mistakes.push(`Получено травм: ${climb.injuries.length}.`);
  if (climb.casualties.length) mistakes.push(`Потери: ${climb.casualties.length}.`);
  if (!strengths.length) strengths.push('Экспедиция дала данные о маршруте и состоянии команды.');
  if (!mistakes.length) mistakes.push('Критических ошибок в итоговом отчёте не выявлено.');
  return { strengths, mistakes };
}

function PaceCard({ preview, primary, onClick }: { preview: ClimbActionPreview; primary?: boolean; onClick: () => void }) {
  return (
    <button className={primary ? 'is-primary' : ''} onClick={onClick}>
      <header><span>{preview.pace === 'CAUTIOUS' ? '01' : preview.pace === 'STEADY' ? '02' : '03'}</span><strong>{paceTitle(preview.pace)}</strong><em className={`risk-${preview.riskLabel.toLowerCase()}`}>{preview.riskLabel}</em></header>
      <p>{preview.summary}</p>
      <dl><div><dt>Время</dt><dd>{durationLabel(preview.durationMinutes)}</dd></div><div><dt>Силы</dt><dd>−{preview.energyCost}%</dd></div><div><dt>Инцидент</dt><dd>{preview.incidentRisk}%</dd></div></dl>
      <footer>Еда −{preview.foodCost} · вода −{preview.waterCost}</footer>
    </button>
  );
}

export function ClimbScreen({ career, onStep, onCamp, onMeltSnow, onWait, onOrder, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const activeSegment = climb.route[Math.max(0, Math.min(climb.route.length - 1, climb.segmentIndex))]!;
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);
  const liveTeam = climb.teamStates.map(state => ({ state, member: career.teamRoster.find(member => member.id === state.memberId) })).filter(item => item.member);
  const previews = useMemo(() => (['CAUTIOUS', 'STEADY', 'FAST'] as ClimbPace[]).map(pace => previewClimbAction(career, pace)).filter(Boolean) as ClimbActionPreview[], [career]);
  const noReturn = climb.phase === 'ASCENT' && (activeSegment.exposure >= 65 || climb.segmentIndex >= Math.ceil(climb.route.length * .6));
  const fieldSignal = climb.supplies.waterUnits <= 3
    ? { tone: 'danger', title: 'Вода почти закончилась', detail: 'Топи снег, если есть топливо. Следующий длинный участок резко ударит по группе.' }
    : climb.hoursAwake >= 12
      ? { tone: 'warning', title: 'Группа давно без сна', detail: activeSegment.campPossible ? 'На этом участке можно поставить лагерь.' : 'Ищи ближайший участок, где разрешена ночёвка.' }
      : climb.windKmh >= 48 || climb.visibility <= 35
        ? { tone: 'warning', title: 'Условия ухудшились', detail: 'Ожидание тратит время и запасы, но может изменить погоду до следующего движения.' }
        : { tone: 'calm', title: 'Условия рабочие', detail: 'Сравни три варианта темпа. Перед нажатием видны время, силы, расход и риск.' };

  function resolve(action: () => ClimbStepResult) {
    const result = action();
    setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
  }

  if (terminal) {
    const success = climb.phase === 'COMPLETE';
    const review = resultReview(career);
    return (
      <section className={`workspace-page climb-result climb-result--embedded ${success ? 'is-success' : ''}`}>
        <div className="climb-result__index">{success ? '01' : '00'}</div>
        <p className="eyebrow">EXPEDITION CLOSED / {climb.routeName}</p>
        <h1>{success ? 'Ты вернулся.' : climb.phase === 'RETREATED' ? 'Группа вернулась.' : 'Экспедиция сорвана.'}</h1>
        <p className="lead">{success ? 'Вершина записана после полного спуска. Ниже — не только награда, но и разбор того, что сработало.' : climb.phase === 'RETREATED' ? 'Вершины нет, но решение об отходе стало частью карьеры и отношений.' : 'Последствия переходят в здоровье, людей и историю мира.'}</p>
        <div className="result-metrics">
          <div><span>Высшая точка</span><strong>{climb.summitReached ? climb.summitElevation : climb.currentElevation} м</strong></div>
          <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
          <div><span>Остаток сил</span><strong>{Math.round(climb.energy)}%</strong></div>
          <div><span>Команда</span><strong>{Math.round(climb.teamCondition)}%</strong></div>
          <div><span>Репутация</span><strong>+{climb.earnedReputation}</strong></div>
          <div><span>Выплата</span><strong>+{climb.earnedMoney} кр.</strong></div>
        </div>
        <section className="expedition-debrief">
          <article className="is-good"><small>СИЛЬНЫЕ РЕШЕНИЯ</small>{review.strengths.map(item => <p key={item}>✓ {item}</p>)}</article>
          <article className="is-warning"><small>ЧТО ИЗМЕНИТЬ</small>{review.mistakes.map(item => <p key={item}>— {item}</p>)}</article>
        </section>
        <details className="result-log-disclosure"><summary>Открыть полный журнал экспедиции ({climb.log.length})</summary><div className="result-ledger">{climb.log.map((line, index) => <div key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{line}</p></div>)}</div></details>
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
        <div className="summit-warning"><strong>Победа ещё не засчитана</strong><p>Награда, рекорд и репутация появятся только после возвращения к стартовой точке.</p></div>
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

      <section className={`field-signal is-${fieldSignal.tone}`}><strong>{fieldSignal.title}</strong><p>{fieldSignal.detail}</p></section>
      {noReturn && <section className="no-return-warning"><span>ТОЧКА ТЯЖЁЛОГО ОТХОДА</span><strong>После этого участка спуск станет дороже.</strong><p>Оцени силы, погоду и состояние людей до движения. Кнопка отхода остаётся доступной, но время и риск вырастут.</p></section>}

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
            <p className="eyebrow">СЛЕДУЮЩЕЕ ДЕЙСТВИЕ / {String(climb.segmentIndex + 1).padStart(2, '0')}</p>
            <h2>{activeSegment.name}</h2><p>{activeSegment.note}</p>
            <div><span>Набор <b>{climb.phase === 'ASCENT' ? '+' : '−'}{activeSegment.elevationGain} м</b></span><span>Навык <b>{SKILL_LABELS[activeSegment.skill]} {career.hero.skills[activeSegment.skill]}</b></span><span>Сложность <b>{activeSegment.difficulty}</b></span><span>Опасность <b>{activeSegment.hazard}</b></span></div>
          </div>

          {feedback && <div className={`climb-feedback is-${feedback.severity.toLowerCase()}`}><span>ПОСЛЕДНЕЕ ДЕЙСТВИЕ</span><h3>{feedback.headline}</h3><p>{feedback.detail}</p></div>}

          <div className="pace-options pace-options--preview">
            {previews.map(preview => <PaceCard key={preview.pace} preview={preview} primary={preview.pace === 'STEADY'} onClick={() => resolve(() => onStep(preview.pace))} />)}
          </div>

          <div className="field-actions field-actions--explained">
            <button disabled={!activeSegment.campPossible} onClick={() => resolve(onCamp)}><span>Лагерь</span><small>+34% сил · 7 часов · еда и топливо</small></button>
            <button disabled={climb.supplies.fuelUnits <= 0} onClick={() => resolve(onMeltSnow)}><span>Топить снег</span><small>50 минут · топливо −1 · вода +5</small></button>
            <button onClick={() => resolve(onWait)}><span>Ждать окно</span><small>3 часа · запасы расходуются · погода меняется</small></button>
          </div>

          <details className="team-orders team-orders--disclosure">
            <summary><span>Приказы группе</span><small>Люди могут отказаться, если не доверяют решению</small></summary>
            <div>
              <button onClick={() => resolve(() => onOrder('SLOW_DOWN'))}><strong>Снизить темп</strong><small>+2 состояния группе · −45 минут.</small></button>
              <button onClick={() => resolve(() => onOrder('PRESS_ON'))}><strong>Давить вверх</strong><small>Сохраняет темп, повышает усталость и риск конфликта.</small></button>
              <button onClick={() => resolve(() => onOrder('TURN_BACK_WEAKEST'))}><strong>Развернуть слабого</strong><small>Снимает худшего участника, но может вызвать отказ и обиду.</small></button>
              <button onClick={() => resolve(() => onOrder('ASSIGN_HELPER'))}><strong>Назначить помощь</strong><small>Стабилизирует пострадавшего ценой сил помощника.</small></button>
            </div>
          </details>

          {climb.phase === 'ASCENT' && <button className="retreat-button" onClick={onRetreat}>Развернуть всю группу и начать спуск</button>}
        </section>

        <aside className="climb-resource-panel">
          <p className="eyebrow">FIELD RESOURCES</p><h2>Запасы</h2>
          <div><span>Еда</span><strong>{climb.supplies.foodUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.foodUnits * 8)}%` } as React.CSSProperties} /></div>
          <div><span>Вода</span><strong>{climb.supplies.waterUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.waterUnits * 14)}%` } as React.CSSProperties} /></div>
          <div><span>Топливо</span><strong>{climb.supplies.fuelUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.fuelUnits * 25)}%` } as React.CSSProperties} /></div>
          <div><span>Вес</span><strong>{climb.packWeightKg} кг</strong></div>
          <div><span>Без сна</span><strong>{Math.round(climb.hoursAwake)} ч</strong></div>
          <p className="resource-warning">Смотри расходы прямо на карточках темпа. Пустой запас не убивает мгновенно, но делает каждый следующий ход хуже.</p>
          <div className="field-team-register">
            <p className="eyebrow">PEOPLE ON ROUTE</p>
            {liveTeam.map(({ state, member }) => (
              <article key={state.memberId} className={`is-${state.status.toLowerCase()}`}>
                <span>{member!.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</span>
                <div><strong>{member!.name}</strong><small>{state.status} · {state.visibleInjury ?? 'без выявленной травмы'}</small></div>
                <b>{Math.round(state.condition)}</b>
                <i style={{ '--value': `${state.condition}%` } as React.CSSProperties} />
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
