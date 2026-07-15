import { useMemo, useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { ExpeditionHeightScale } from '../components/ExpeditionHeightScale';
import { ExpeditionTurnPanel } from '../components/ExpeditionTurnPanel';
import { StrategicExpeditionScreen } from '../components/StrategicExpeditionScreen';
import { currentExpeditionStage, getCurrentRouteDecision, previewClimbAction, previewExpeditionActions, SKILL_LABELS } from '../core/career';
import { getCurrentParticipantScene, nodeProgress, participantLeader } from '../core/expeditionEngine';
import type { CareerState, ClimbOrderId, ClimbPace, ClimbStepResult, DifficultyId, ExpeditionFieldActionId, StrategicRestId, StrategicSectorPlan } from '../core/types';

type Props = {
  career: CareerState;
  difficulty: DifficultyId;
  onStep: (pace: ClimbPace) => ClimbStepResult;
  onCamp: () => ClimbStepResult;
  onMeltSnow: () => ClimbStepResult;
  onWait: () => ClimbStepResult;
  onOrder: (order: ClimbOrderId) => ClimbStepResult;
  onChooseDecision: (optionId: string) => ClimbStepResult;
  onFixRope: () => ClimbStepResult;
  onLeaveCache: () => ClimbStepResult;
  onParticipantAction: (optionId: string) => ClimbStepResult;
  onFieldAction: (actionId: ExpeditionFieldActionId) => ClimbStepResult;
  onStrategicResolve: (plan: StrategicSectorPlan) => ClimbStepResult;
  onStrategicRest: (choice: StrategicRestId) => ClimbStepResult;
  onBeginDescent: () => void;
  onRetreat: () => void;
  onClose: () => void;
};

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}ч ${String(rest).padStart(2, '0')}м`;
}

function paceTitle(pace: ClimbPace) {
  if (pace === 'CAUTIOUS') return 'Осторожно';
  if (pace === 'FAST') return 'Быстро';
  return 'Ровно';
}


const preparationLabel = {
  ROUTE_SCOUTED: 'разведать линию',
  SURFACE_CHECKED: 'проверить поверхность',
  ANCHOR_PLACED: 'поставить точку',
  ROPE_FIXED: 'закрепить верёвку',
  TEAM_STABILIZED: 'стабилизировать группу',
} as const;

function conditionLabel(value: number) {
  if (value >= 75) return 'рабочая';
  if (value >= 50) return 'уставшая';
  if (value >= 28) return 'плохая';
  return 'критическая';
}

export function MobileClimbScreen({ career, difficulty, onStep, onCamp, onMeltSnow, onWait, onOrder, onChooseDecision, onFixRope, onLeaveCache, onParticipantAction, onFieldAction, onStrategicResolve, onStrategicRest, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState<'ROUTE' | 'GROUP' | 'PACK' | 'STATE' | 'LOG'>('ROUTE');
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);
  const segment = climb.route[Math.max(0, Math.min(climb.route.length - 1, climb.segmentIndex))]!;
  const decision = getCurrentRouteDecision(career);
  const participantScene = getCurrentParticipantScene(career);
  const participantProgress = nodeProgress(career);
  const leader = participantLeader(career);
  const simulationStage = currentExpeditionStage(career);
  const fieldActions = useMemo(() => previewExpeditionActions(career), [career]);
  const previews = useMemo(() => (['CAUTIOUS', 'STEADY', 'FAST'] as ClimbPace[])
    .map(pace => previewClimbAction(career, pace))
    .filter(Boolean), [career]);

  async function resolve(action: () => ClimbStepResult) {
    if (busy) return;
    setBusy(true);
    await new Promise<void>(done => requestAnimationFrame(() => done()));
    try {
      const result = action();
      setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
    } finally {
      requestAnimationFrame(() => setBusy(false));
    }
  }

  if (terminal) {
    const success = climb.phase === 'COMPLETE';
    return (
      <section className="m-screen m-climb-result">
        <p className="m-kicker">ЭКСПЕДИЦИЯ ЗАВЕРШЕНА</p>
        <h1>{success ? 'Ты вернулся.' : climb.phase === 'RETREATED' ? 'Группа вернулась.' : 'Экспедиция сорвана.'}</h1>
        <p className="m-copy">{success ? 'Вершина засчитана после полного спуска.' : 'Результат и последствия сохранены в карьере.'}</p>
        <div className="m-stat-grid m-stat-grid--result">
          <div><span>Высшая точка</span><strong>{climb.summitReached ? climb.summitElevation : climb.currentElevation} м</strong></div>
          <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
          <div><span>Силы</span><strong>{Math.round(climb.energy)}%</strong></div>
          <div><span>Группа</span><strong>{Math.round(climb.teamCondition)}%</strong></div>
        </div>
        {climb.participant?.evaluation && <section className="m-participant-evaluation"><header><span>ОЦЕНКА РУКОВОДИТЕЛЯ</span><b>{climb.participant.evaluation.grade}</b></header><h2>{climb.participant.evaluation.title}</h2><p>{climb.participant.evaluation.summary}</p><div>{climb.participant.evaluation.tags.map(tag => <span key={tag}>{tag}</span>)}</div><footer>+{climb.participant.evaluation.rankPoints} очков ранга</footer></section>}
        {(climb.injuries.length > 0 || climb.casualties.length > 0) && <div className="m-alert-card is-danger"><strong>Последствия</strong><span>{climb.injuries.length} травм · {climb.casualties.length} потерь</span></div>}
        <details className="m-details"><summary>Журнал экспедиции · {climb.log.length}</summary>{climb.log.map((line, index) => <p key={`${line}-${index}`}>{String(index + 1).padStart(2, '0')} · {line}</p>)}</details>
        <button className="m-primary-button" onClick={onClose}>Закрыть экспедицию <b>→</b></button>
      </section>
    );
  }

  if (climb.strategic) return <StrategicExpeditionScreen career={career} difficulty={difficulty} mobile onResolve={onStrategicResolve} onRest={onStrategicRest} onBeginDescent={onBeginDescent} onRetreat={onRetreat} />;

  if (climb.simulation && simulationStage) {
    const simulation = climb.simulation;
    const routeStages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
    const remainingAltitude = simulation.direction === 'ASCENT'
      ? Math.max(0, climb.summitElevation - climb.currentElevation)
      : Math.max(0, climb.currentElevation - climb.startElevation);
    const lastFailure = simulation.failureTrace.at(-1);

    if (simulation.status === 'SUMMIT') {
      return <section className="m-screen m-summit-card m-simulation-summit"><p className="m-kicker">ВЕРШИНА · {climb.summitElevation} М</p><h1>{climb.mountainName}</h1><ExpeditionHeightScale climb={climb} /><p>Экспедиция не закончена. До стартовой точки остаётся полный спуск.</p><button className="m-primary-button" disabled={busy} onClick={onBeginDescent}>Начать спуск <b>↓</b></button></section>;
    }

    const expeditionHeader = <>
      <header className="m-sim-head exp-ux__head"><div><small>{simulation.direction === 'ASCENT' ? 'ПОДЪЁМ' : climb.retreating ? 'ОТХОД' : 'СПУСК'} · {simulation.stageIndex + 1}/{routeStages.length}</small><h1>{simulationStage.label}</h1><span>{simulationStage.terrain}</span></div><div><strong>{climb.currentElevation} м</strong><small>осталось {remainingAltitude} м</small></div></header>
      <ExpeditionHeightScale climb={climb} />
      <nav className="m-expedition-tabs" aria-label="Разделы экспедиции">
        {([['ROUTE', 'Маршрут'], ['GROUP', 'Группа'], ['PACK', 'Рюкзак'], ['STATE', 'Состояние'], ['LOG', 'Журнал']] as const).map(([id, label]) => <button key={id} className={activePanel === id ? 'is-active' : ''} onClick={() => setActivePanel(id)}>{label}</button>)}
      </nav>
    </>;

    if (activePanel === 'GROUP') {
      return <section className="m-screen m-expedition-simulation exp-ux">{expeditionHeader}<section className="m-expedition-panel"><p className="m-kicker">ГРУППА</p>{simulation.leaderOrder && !simulation.leaderOrder.resolved && <div className="m-live-order"><small>{leader?.name ?? 'Руководитель'}</small><strong>«{simulation.leaderOrder.text}»</strong></div>}<div className="m-team-route-list">{climb.teamStates.map(state => { const member = career.teamRoster.find(item => item.id === state.memberId); return <div key={state.memberId}><span>{member?.name ?? state.memberId}{climb.leaderNpcId === state.memberId ? ' · руководитель' : ''}</span><strong>{conditionLabel(state.condition)}</strong></div>; })}</div></section></section>;
    }
    if (activePanel === 'PACK') {
      return <section className="m-screen m-expedition-simulation exp-ux">{expeditionHeader}<section className="m-expedition-panel"><p className="m-kicker">РЮКЗАК</p><div className="m-mini-grid"><span>Еда <b>{climb.supplies.foodUnits}</b></span><span>Вода <b>{climb.supplies.waterUnits}</b></span><span>Топливо <b>{climb.supplies.fuelUnits}</b></span><span>Верёвка <b>{climb.ropeMetersRemaining} м</b></span><span>Вес <b>{climb.packWeightKg.toFixed(1)} кг</b></span><span>Брошено <b>{simulation.loadDroppedKg.toFixed(1)} кг</b></span></div></section></section>;
    }
    if (activePanel === 'STATE') {
      return <section className="m-screen m-expedition-simulation exp-ux">{expeditionHeader}<section className="m-expedition-panel"><p className="m-kicker">СОСТОЯНИЕ</p><div className="m-mini-grid"><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Здоровье <b>{Math.round(climb.condition)}%</b></span><span>Группа <b>{Math.round(climb.teamCondition)}%</b></span><span>Без сна <b>{Math.round(climb.hoursAwake)} ч</b></span><span>Температура <b>{climb.temperatureC}°</b></span><span>Ветер <b>{climb.windKmh} км/ч</b></span></div>{lastFailure && <section className="m-failure-trace"><small>ПОСЛЕДНЯЯ ПРОБЛЕМА</small><strong>{lastFailure.cause}</strong></section>}</section></section>;
    }
    if (activePanel === 'LOG') {
      return <section className="m-screen m-expedition-simulation exp-ux">{expeditionHeader}<section className="m-expedition-panel"><p className="m-kicker">ЖУРНАЛ · {climb.log.length}</p><div className="m-expedition-log">{climb.log.slice(-80).map((line, index) => <p key={`${line}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b>{line}</p>)}</div></section></section>;
    }

    return <section className="m-screen m-expedition-simulation exp-ux">
      {expeditionHeader}
      <div className="exp-ux__status"><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Состояние <b>{Math.round(climb.condition)}%</b></span><span>Запасы <b>{climb.supplies.foodUnits}/{climb.supplies.waterUnits}</b></span></div>
      {simulation.status === 'STRANDED' && <section className="m-survival-alert"><strong>Движение невозможно</strong><p>Восстанови рабочий резерв, добейся отхода или вызови помощь.</p>{simulation.rescueEtaMinutes !== null && <span>Помощь: примерно {Math.ceil(simulation.rescueEtaMinutes / 60)} ч</span>}</section>}
      {simulation.leaderOrder && !simulation.leaderOrder.resolved && <section className="exp-ux__order"><small>ПРИКАЗ · {leader?.name ?? 'руководитель'}</small><strong>«{simulation.leaderOrder.text}»</strong></section>}
      {participantScene ? <section className="m-sim-event exp-ux__event"><header><small>{participantScene.kind === 'ORDER' ? 'ПРИКАЗ' : 'СОБЫТИЕ'}</small><strong>{participantScene.title}</strong></header><p>{participantScene.situation}</p><div>{participantScene.options.map(option => <button key={option.id} disabled={busy} onClick={() => void resolve(() => onParticipantAction(option.id))}><strong>{option.title}</strong><span>{option.detail}</span></button>)}</div></section> : <ExpeditionTurnPanel career={career} stage={simulationStage} actions={fieldActions} difficulty={difficulty} feedback={feedback} busy={busy} onAction={actionId => void resolve(() => onFieldAction(actionId))} />}
      {!participantScene && simulation.direction === 'ASCENT' && <button className="m-retreat-button" disabled={busy} onClick={() => void resolve(() => onFieldAction('TURN_BACK'))}>{climb.authorityMode === 'COMMAND' ? 'Начать отход' : 'Потребовать отход'}</button>}
    </section>;
  }

  if (climb.participant && participantScene) {
    const node = participantProgress;
    const toneLabel = { OBEY: 'ВЫПОЛНИТЬ', QUESTION: 'ВОЗРАЗИТЬ', REFUSE: 'ОТКАЗАТЬСЯ', INITIATIVE: 'ИНИЦИАТИВА', CARE: 'ПОМОЧЬ' } as const;
    return (
      <section className="m-screen m-screen--with-action m-participant-screen">
        <header className="m-climb-head"><div><small>{participantScene.phase} · {climb.playerRole}</small><h1>{participantScene.nodeLabel}</h1><span>{climb.mountainName} · {climb.routeName}</span></div><strong>{climb.currentElevation} м</strong></header>
        <div className="m-progress-line"><i style={{ width: `${node.overall}%` }} /></div>
        <div className="m-participant-vitals"><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Руководитель <b>{climb.participant.leaderTrust}</b></span><span>Группа <b>{climb.participant.groupTrust}</b></span><span>Решения <b>{climb.participant.totalActions}/{climb.participant.targetActions}</b></span></div>
        <section className="m-leader-order"><header><span>{leader?.name ?? participantScene.leaderName}</span><b>{participantScene.kind === 'ORDER' ? 'ПРИКАЗ' : participantScene.roleLabel}</b></header>{participantScene.orderText && <blockquote>«{participantScene.orderText}»</blockquote>}<h2>{participantScene.title}</h2><p>{participantScene.situation}</p><small>Действие {node.current + 1} из {node.required} на этом этапе</small></section>
        {feedback && <div className={`m-alert-card is-${feedback.severity.toLowerCase()}`}><strong>{feedback.headline}</strong><span>{feedback.detail}</span></div>}
        <div className="m-personal-choice-list">{participantScene.options.map(option => <button key={option.id} className={`is-${option.tone.toLowerCase()}`} onClick={() => resolve(() => onParticipantAction(option.id))}><header><small>{toneLabel[option.tone]}</small><strong>{option.title}</strong></header><p>{option.detail}</p><footer><span>{option.advanceMinutes} мин</span>{option.skill && <b>{SKILL_LABELS[option.skill]}</b>}<em>→</em></footer></button>)}</div>
        <details className="m-details m-participant-status"><summary>Твоя работа в экспедиции</summary><div className="m-mini-grid"><span>Дисциплина <b>{Math.round(climb.participant.discipline)}</b></span><span>Инициатива <b>{Math.round(climb.participant.initiative)}</b></span><span>Помощь <b>{Math.round(climb.participant.care)}</b></span><span>Компетентность <b>{Math.round(climb.participant.competence)}</b></span></div><p>Приказы: {climb.participant.ordersObeyed}/{climb.participant.ordersReceived} выполнено · отказов {climb.participant.ordersRefused}</p></details>
      </section>
    );
  }

  if (climb.phase === 'SUMMIT' && !climb.participant) {
    return (
      <section className="m-screen m-summit-card">
        <p className="m-kicker">ВЕРШИНА · {climb.summitElevation} М</p>
        <h1>{climb.mountainName}</h1>
        <p>Подъём закончен. Победа будет записана только после возвращения.</p>
        <div className="m-stat-grid"><div><span>Силы</span><strong>{Math.round(climb.energy)}%</strong></div><div><span>Группа</span><strong>{Math.round(climb.teamCondition)}%</strong></div><div><span>Вода</span><strong>{climb.supplies.waterUnits}</strong></div><div><span>Без сна</span><strong>{Math.round(climb.hoursAwake)} ч</strong></div></div>
        <button className="m-primary-button" onClick={onBeginDescent}>Начать спуск <b>↓</b></button>
      </section>
    );
  }

  const routeProgress = Math.min(100, Math.round(((climb.segmentIndex + 1) / Math.max(1, climb.route.length)) * 100));
  const warning = climb.supplies.waterUnits <= 3
    ? 'Воды осталось мало.'
    : climb.hoursAwake >= 12
      ? 'Группа давно без сна.'
      : climb.windKmh >= 48 || climb.visibility <= 35
        ? 'Погода ухудшилась.'
        : null;

  return (
    <section className="m-screen m-screen--with-action m-climb-screen">
      <header className="m-climb-head">
        <div><small>{climb.phase === 'ASCENT' ? 'ПОДЪЁМ' : 'СПУСК'} · УЧАСТОК {climb.segmentIndex + 1}/{climb.route.length}</small><h1>{climb.mountainName}</h1><span>{climb.routeName}</span></div>
        <strong>{climb.currentElevation} м</strong>
      </header>

      <div className="m-progress-line"><i style={{ width: `${routeProgress}%` }} /></div>
      <div className="m-climb-vitals">
        <div><span>Силы</span><strong>{Math.round(climb.energy)}%</strong></div>
        <div><span>Группа</span><strong>{conditionLabel(climb.teamCondition)}</strong></div>
        <div><span>Погода</span><strong>{climb.temperatureC}° · {climb.windKmh}</strong></div>
        <div><span>Запасы</span><strong>{climb.supplies.foodUnits}/{climb.supplies.waterUnits}</strong></div>
      </div>

      {warning && <div className="m-alert-card is-warning"><strong>{warning}</strong><span>{climb.supplies.waterUnits <= 3 ? 'Топи снег или сокращай маршрут.' : climb.hoursAwake >= 12 ? 'Лагерь снизит риск следующего хода.' : 'Ожидание может улучшить условия.'}</span></div>}
      {feedback && <div className={`m-alert-card is-${feedback.severity.toLowerCase()}`}><strong>{feedback.headline}</strong><span>{feedback.detail}</span></div>}

      <section className="m-segment-card">
        <div><small>СЛЕДУЮЩИЙ УЧАСТОК</small><h2>{segment.name}</h2><p>{segment.hazard}</p></div>
        <dl><div><dt>Набор</dt><dd>{climb.phase === 'ASCENT' ? '+' : '−'}{segment.elevationGain} м</dd></div><div><dt>Навык</dt><dd>{SKILL_LABELS[segment.skill]} {career.hero.skills[segment.skill]}</dd></div><div><dt>Сложность</dt><dd>{segment.difficulty}</dd></div></dl>
      </section>

      <RouteBlueprint climb={climb} />

      {decision ? (
        <section className="m-decision-card">
          <p className="m-kicker">РЕШЕНИЕ</p><h2>{decision.title}</h2><p>{decision.situation}</p>
          <div>{decision.options.map(option => {
            const unavailable = Boolean(option.requiresRopeMeters && climb.ropeMetersRemaining < option.requiresRopeMeters);
            return <button key={option.id} disabled={unavailable} onClick={() => resolve(() => onChooseDecision(option.id))}><span><strong>{option.title}</strong><small>{option.description}</small></span><b>›</b></button>;
          })}</div>
        </section>
      ) : (
        <div className="m-pace-list">{previews.map(preview => <button key={preview!.pace} className={preview!.pace === 'STEADY' ? 'is-primary' : ''} onClick={() => resolve(() => onStep(preview!.pace))}><div><strong>{paceTitle(preview!.pace)}</strong><small>{durationLabel(preview!.durationMinutes)} · силы −{preview!.energyCost}% · риск {difficulty === 'EXPEDITION' ? preview!.riskLabel.toLowerCase() : `${preview!.incidentRisk}%`}</small></div><b>→</b></button>)}</div>
      )}

      <button className="m-tools-toggle" onClick={() => setToolsOpen(value => !value)}>{toolsOpen ? 'Скрыть полевые действия' : 'Полевые действия'} <b>{toolsOpen ? '−' : '+'}</b></button>
      {toolsOpen && <div className="m-field-tool-list">
        <button disabled={!segment.campPossible} onClick={() => resolve(onCamp)}><span><strong>Поставить лагерь</strong><small>7 часов · восстановление сил</small></span><b>›</b></button>
        <button disabled={climb.supplies.fuelUnits <= 0} onClick={() => resolve(onMeltSnow)}><span><strong>Топить снег</strong><small>50 минут · вода +5</small></span><b>›</b></button>
        <button onClick={() => resolve(onWait)}><span><strong>Ждать погоду</strong><small>3 часа · расход запасов</small></span><b>›</b></button>
        <button disabled={climb.phase !== 'ASCENT' || climb.ropeMetersRemaining < 20} onClick={() => resolve(onFixRope)}><span><strong>Закрепить верёвку</strong><small>Безопаснее на спуске</small></span><b>›</b></button>
        <button disabled={climb.phase !== 'ASCENT' || !segment.campPossible} onClick={() => resolve(onLeaveCache)}><span><strong>Оставить закладку</strong><small>Снизить вес, оставить запас</small></span><b>›</b></button>
      </div>}

      <details className="m-details"><summary>{climb.authorityMode === 'COMMAND' ? 'Команда и приказы' : 'Состав экспедиции'}</summary>
        <div className="m-team-route-list">{climb.teamStates.map(state => { const member = career.teamRoster.find(item => item.id === state.memberId); return member ? <div key={state.memberId}><span>{member.name}{climb.leaderNpcId === member.id ? ' · руководитель' : ''}</span><strong>{conditionLabel(state.condition)}</strong></div> : null; })}</div>
        {climb.authorityMode === 'COMMAND' ? <div className="m-order-grid"><button onClick={() => resolve(() => onOrder('SLOW_DOWN'))}>Снизить темп</button><button onClick={() => resolve(() => onOrder('PRESS_ON'))}>Давить вверх</button><button onClick={() => resolve(() => onOrder('TURN_BACK_WEAKEST'))}>Развернуть слабого</button><button onClick={() => resolve(() => onOrder('ASSIGN_HELPER'))}>Назначить помощь</button></div> : <p>Ты не управляешь всей группой. Основной геймплей — личный темп, решения на участке, помощь, отказ и выполнение приказов руководителя.</p>}
      </details>

      {climb.phase === 'ASCENT' && <button className="m-retreat-button" onClick={onRetreat}>Развернуть группу и начать спуск</button>}
    </section>
  );
}
