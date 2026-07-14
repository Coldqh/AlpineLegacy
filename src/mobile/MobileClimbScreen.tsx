import { useMemo, useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { getCurrentRouteDecision, previewClimbAction, SKILL_LABELS } from '../core/career';
import { getCurrentParticipantScene, nodeProgress, participantLeader } from '../core/expeditionEngine';
import type { CareerState, ClimbOrderId, ClimbPace, ClimbStepResult, DifficultyId } from '../core/types';

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

function conditionLabel(value: number) {
  if (value >= 75) return 'рабочая';
  if (value >= 50) return 'уставшая';
  if (value >= 28) return 'плохая';
  return 'критическая';
}

export function MobileClimbScreen({ career, difficulty, onStep, onCamp, onMeltSnow, onWait, onOrder, onChooseDecision, onFixRope, onLeaveCache, onParticipantAction, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);
  const segment = climb.route[Math.max(0, Math.min(climb.route.length - 1, climb.segmentIndex))]!;
  const decision = getCurrentRouteDecision(career);
  const participantScene = getCurrentParticipantScene(career);
  const participantProgress = nodeProgress(career);
  const leader = participantLeader(career);
  const previews = useMemo(() => (['CAUTIOUS', 'STEADY', 'FAST'] as ClimbPace[])
    .map(pace => previewClimbAction(career, pace))
    .filter(Boolean), [career]);

  function resolve(action: () => ClimbStepResult) {
    const result = action();
    setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
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
