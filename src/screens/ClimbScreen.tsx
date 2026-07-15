import { useMemo, useState } from 'react';
import { RouteBlueprint } from '../components/RouteBlueprint';
import { ExpeditionHeightScale } from '../components/ExpeditionHeightScale';
import { ExpeditionTurnPanel } from '../components/ExpeditionTurnPanel';
import { StrategicExpeditionScreen } from '../components/StrategicExpeditionScreen';
import { currentExpeditionStage, getCurrentRouteDecision, previewClimbAction, previewExpeditionActions, SKILL_LABELS } from '../core/career';
import { getCurrentParticipantScene, nodeProgress, participantLeader } from '../core/expeditionEngine';
import type { CareerState, ClimbActionPreview, ClimbOrderId, ClimbPace, ClimbStepResult, DifficultyId, ExpeditionFieldActionId, StrategicRestId, StrategicSectorPlan } from '../core/types';

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

const preparationLabel = {
  ROUTE_SCOUTED: 'разведать линию',
  SURFACE_CHECKED: 'проверить поверхность',
  ANCHOR_PLACED: 'поставить точку',
  ROPE_FIXED: 'закрепить верёвку',
  TEAM_STABILIZED: 'стабилизировать группу',
} as const;

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
  if (climb.routeChoices.length) strengths.push(`На маршруте приняты осознанные решения: ${climb.routeChoices.length}.`);
  if (climb.fixedRopeSegmentIds.length) strengths.push(`Подготовлено защищённых участков для спуска: ${climb.fixedRopeSegmentIds.length}.`);
  if (climb.caches.some(item => item.recovered)) strengths.push('Закладка сработала на обратном пути.');
  if (climb.hoursAwake > 16) mistakes.push(`Группа работала без сна ${Math.round(climb.hoursAwake)} часов.`);
  if (climb.energy < 20) mistakes.push('Спуск завершён почти без физического резерва.');
  if (climb.injuries.length) mistakes.push(`Получено травм: ${climb.injuries.length}.`);
  if (climb.casualties.length) mistakes.push(`Потери: ${climb.casualties.length}.`);
  if (climb.caches.some(item => !item.recovered)) mistakes.push('Часть оставленных запасов не удалось вернуть.');
  if (!strengths.length) strengths.push('Экспедиция дала данные о маршруте и состоянии команды.');
  if (!mistakes.length) mistakes.push('Критических ошибок в итоговом отчёте не выявлено.');
  return { strengths, mistakes };
}

function riskText(preview: ClimbActionPreview, difficulty: DifficultyId) {
  if (difficulty === 'EXPLORER') return `${preview.incidentRisk}%`;
  if (difficulty === 'CLIMBER') {
    const low = Math.max(1, preview.incidentRisk - 4);
    const high = Math.min(90, preview.incidentRisk + 5);
    return `${low}–${high}%`;
  }
  return preview.riskLabel === 'НИЗКИЙ' ? 'контролируемый' : preview.riskLabel === 'СРЕДНИЙ' ? 'заметный' : preview.riskLabel === 'ВЫСОКИЙ' ? 'тяжёлый' : 'крайний';
}

function conditionText(value: number, difficulty: DifficultyId) {
  if (difficulty === 'EXPLORER') return `${Math.round(value)}%`;
  if (difficulty === 'CLIMBER') return `${Math.round(value / 5) * 5}%`;
  return value >= 76 ? 'рабочая' : value >= 52 ? 'уставшая' : value >= 30 ? 'плохая' : 'критическая';
}

function visibilityText(value: number, difficulty: DifficultyId) {
  if (difficulty === 'EXPLORER') return `${value}%`;
  if (difficulty === 'CLIMBER') return `≈${Math.round(value / 10) * 10}%`;
  return value >= 70 ? 'чисто' : value >= 40 ? 'ограничена' : value >= 20 ? 'плохая' : 'почти нулевая';
}

function PaceCard({ preview, primary, recommended, difficulty, onClick }: { preview: ClimbActionPreview; primary?: boolean; recommended?: boolean; difficulty: DifficultyId; onClick: () => void }) {
  return (
    <button className={`${primary ? 'is-primary' : ''} ${recommended ? 'is-recommended' : ''}`} onClick={onClick}>
      <header><span>{preview.pace === 'CAUTIOUS' ? '01' : preview.pace === 'STEADY' ? '02' : '03'}</span><strong>{paceTitle(preview.pace)}</strong><em className={`risk-${preview.riskLabel.toLowerCase()}`}>{recommended ? 'СОВЕТ' : preview.riskLabel}</em></header>
      <p>{preview.summary}</p>
      <dl><div><dt>Время</dt><dd>{durationLabel(preview.durationMinutes)}</dd></div><div><dt>Силы</dt><dd>−{preview.energyCost}%</dd></div><div><dt>Риск</dt><dd>{riskText(preview, difficulty)}</dd></div></dl>
      <footer>Еда −{preview.foodCost} · вода −{preview.waterCost}{difficulty === 'EXPEDITION' ? ' · точность оценки ограничена' : ''}</footer>
    </button>
  );
}

export function ClimbScreen({ career, difficulty, onStep, onCamp, onMeltSnow, onWait, onOrder, onChooseDecision, onFixRope, onLeaveCache, onParticipantAction, onFieldAction, onStrategicResolve, onStrategicRest, onBeginDescent, onRetreat, onClose }: Props) {
  const climb = career.activeClimb!;
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const [busy, setBusy] = useState(false);
  const activeSegment = climb.route[Math.max(0, Math.min(climb.route.length - 1, climb.segmentIndex))]!;
  const terminal = ['COMPLETE', 'FAILED', 'RETREATED'].includes(climb.phase);
  const liveTeam = climb.teamStates.map(state => ({ state, member: career.teamRoster.find(member => member.id === state.memberId) })).filter(item => item.member);
  const currentDecision = getCurrentRouteDecision(career);
  const participantScene = getCurrentParticipantScene(career);
  const participantProgress = nodeProgress(career);
  const participantLeaderData = participantLeader(career);
  const simulationStage = currentExpeditionStage(career);
  const fieldActions = useMemo(() => previewExpeditionActions(career), [career]);
  const previews = useMemo(() => (['CAUTIOUS', 'STEADY', 'FAST'] as ClimbPace[]).map(pace => previewClimbAction(career, pace)).filter(Boolean) as ClimbActionPreview[], [career]);
  const recommendedPace = difficulty === 'EXPLORER' ? [...previews].sort((a, b) => (a.incidentRisk + a.energyCost * .45 + a.durationMinutes / 180) - (b.incidentRisk + b.energyCost * .45 + b.durationMinutes / 180))[0]?.pace : null;
  const noReturn = climb.phase === 'ASCENT' && Boolean(activeSegment.noReturn || activeSegment.exposure >= 65);
  const clockMinutes = (5 * 60 + 10 + climb.elapsedMinutes) % 1440;
  const daylightMinutes = Math.max(0, 20 * 60 - clockMinutes);
  const nextCampIndex = climb.route.findIndex((segment, index) => index >= climb.segmentIndex && segment.campPossible);
  const nextCampDistance = nextCampIndex < 0 ? null : nextCampIndex - climb.segmentIndex;
  const fieldSignal = climb.supplies.waterUnits <= 3
    ? { tone: 'danger', title: 'Вода почти закончилась', detail: 'Топи снег, если есть топливо. Следующий длинный участок резко ударит по группе.' }
    : climb.hoursAwake >= 12
      ? { tone: 'warning', title: 'Группа давно без сна', detail: activeSegment.campPossible ? 'На этом участке можно поставить лагерь.' : 'Ищи ближайший участок, где разрешена ночёвка.' }
      : climb.windKmh >= 48 || climb.visibility <= 35
        ? { tone: 'warning', title: 'Условия ухудшились', detail: 'Ожидание тратит время и запасы, но может изменить погоду до следующего движения.' }
        : { tone: 'calm', title: 'Условия рабочие', detail: 'Сравни три варианта темпа. Перед нажатием видны время, силы, расход и риск.' };

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
        {climb.participant?.evaluation && <section className="participant-evaluation-panel"><header><div><p className="eyebrow">LEADER EVALUATION</p><h2>{climb.participant.evaluation.title}</h2></div><b>{climb.participant.evaluation.grade}</b></header><p>{climb.participant.evaluation.summary}</p><div>{climb.participant.evaluation.tags.map(tag => <span key={tag}>{tag}</span>)}</div><footer>Рост ранга: +{climb.participant.evaluation.rankPoints}</footer></section>}
        {climb.routeChoices.length > 0 && <section className="route-choice-debrief"><p className="eyebrow">ROUTE DECISIONS</p>{climb.routeChoices.map(choice => <article key={`${choice.decisionId}-${choice.optionId}`}><strong>{choice.title}</strong><p>{choice.note}</p></article>)}</section>}
        <details className="result-log-disclosure"><summary>Открыть полный журнал экспедиции ({climb.log.length})</summary><div className="result-ledger">{climb.log.map((line, index) => <div key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{line}</p></div>)}</div></details>
        <button className="primary-action result-close" onClick={onClose}><span>Закрыть экспедицию</span><b>→</b></button>
      </section>
    );
  }

  if (climb.strategic) return <StrategicExpeditionScreen career={career} difficulty={difficulty} onResolve={onStrategicResolve} onRest={onStrategicRest} onBeginDescent={onBeginDescent} onRetreat={onRetreat} />;

  if (climb.simulation && simulationStage) {
    const simulation = climb.simulation;
    const stages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
    const remainingAltitude = simulation.direction === 'ASCENT'
      ? Math.max(0, climb.summitElevation - climb.currentElevation)
      : Math.max(0, climb.currentElevation - climb.startElevation);
    if (simulation.status === 'SUMMIT') return <section className="workspace-page summit-screen summit-screen--embedded"><div className="summit-screen__altitude">{climb.summitElevation}</div><p className="eyebrow">SUMMIT / RETURN REQUIRED</p><h1>{climb.mountainName}</h1><ExpeditionHeightScale climb={climb} /><p className="lead">Вершина не завершает экспедицию. Нужно физически вернуться к стартовой точке.</p><button className="primary-action summit-descent" disabled={busy} onClick={onBeginDescent}><span>Начать спуск</span><b>↓</b></button></section>;

    return <section className="workspace-page simulation-expedition-page exp-ux exp-ux--desktop">
      <header className="simulation-expedition-head exp-ux__head"><div><p className="eyebrow">{simulation.direction === 'ASCENT' ? 'ASCENT' : climb.retreating ? 'RETREAT' : 'DESCENT'} · {simulation.stageIndex + 1}/{stages.length}</p><h1>{simulationStage.label}</h1><span>{climb.mountainName} · {simulationStage.terrain}</span></div><div><strong>{climb.currentElevation} м</strong><small>осталось {remainingAltitude} м</small></div></header>
      <ExpeditionHeightScale climb={climb} />
      <div className="exp-ux__status"><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Состояние <b>{Math.round(climb.condition)}%</b></span><span>Группа <b>{Math.round(climb.teamCondition)}%</b></span><span>Запасы <b>{climb.supplies.foodUnits}/{climb.supplies.waterUnits}</b></span></div>
      {simulation.status === 'STRANDED' && <section className="simulation-survival"><h2>Движение остановлено</h2><p>Восстанови рабочий резерв, добейся отхода или вызови помощь.</p></section>}
      {simulation.leaderOrder && !simulation.leaderOrder.resolved && <section className="exp-ux__order"><small>ПРИКАЗ РУКОВОДИТЕЛЯ</small><strong>«{simulation.leaderOrder.text}»</strong></section>}
      {participantScene ? <section className="simulation-event-panel exp-ux__event"><p className="eyebrow">СОБЫТИЕ НА МАРШРУТЕ</p><h2>{participantScene.title}</h2><p>{participantScene.situation}</p><div>{participantScene.options.map(option => <button key={option.id} disabled={busy} onClick={() => void resolve(() => onParticipantAction(option.id))}><strong>{option.title}</strong><p>{option.detail}</p></button>)}</div></section> : <ExpeditionTurnPanel career={career} stage={simulationStage} actions={fieldActions} difficulty={difficulty} feedback={feedback} busy={busy} onAction={actionId => void resolve(() => onFieldAction(actionId))} />}
      <details className="exp-ux__details"><summary>Группа, рюкзак и журнал</summary><div><span>Верёвка <b>{climb.ropeMetersRemaining} м</b></span><span>Вес <b>{climb.packWeightKg.toFixed(1)} кг</b></span><span>Без сна <b>{Math.round(climb.hoursAwake)} ч</b></span><span>Действия <b>{simulation.totalActions}</b></span></div><p>{climb.log.slice(-4).join(' · ')}</p></details>
      {!participantScene && simulation.direction === 'ASCENT' && <button className="m-retreat-button" disabled={busy} onClick={() => void resolve(() => onFieldAction('TURN_BACK'))}>{climb.authorityMode === 'COMMAND' ? 'Начать отход' : 'Потребовать отход'}</button>}
    </section>;
  }

  if (climb.participant && participantScene) {
    const toneLabel = { OBEY: 'ВЫПОЛНИТЬ', QUESTION: 'ВОЗРАЗИТЬ', REFUSE: 'ОТКАЗАТЬСЯ', INITIATIVE: 'ИНИЦИАТИВА', CARE: 'ПОМОЧЬ' } as const;
    return (
      <section className="workspace-page participant-expedition-page">
        <header className="participant-expedition-head"><div><p className="eyebrow">{participantScene.phase} · {participantScene.roleLabel}</p><h1>{participantScene.nodeLabel}</h1><span>{climb.mountainName} · {climb.routeName}</span></div><strong>{climb.currentElevation} м</strong></header>
        <div className="participant-progress"><i style={{ width: `${participantProgress.overall}%` }} /><span>{climb.participant.totalActions}/{climb.participant.targetActions} решений</span></div>
        <div className="participant-layout"><section className="participant-main">
          <article className="leader-order-card"><header><div><small>{participantScene.kind === 'ORDER' ? 'ПРИКАЗ РУКОВОДИТЕЛЯ' : 'ЛИЧНАЯ СИТУАЦИЯ'}</small><strong>{participantLeaderData?.name ?? participantScene.leaderName}</strong></div><b>{participantProgress.current + 1}/{participantProgress.required}</b></header>{participantScene.orderText && <blockquote>«{participantScene.orderText}»</blockquote>}<h2>{participantScene.title}</h2><p>{participantScene.situation}</p></article>
          {feedback && <div className={`climb-feedback is-${feedback.severity.toLowerCase()}`}><span>ПОСЛЕДНЕЕ ДЕЙСТВИЕ</span><h3>{feedback.headline}</h3><p>{feedback.detail}</p></div>}
          <div className="participant-choice-grid">{participantScene.options.map(option => <button key={option.id} className={`is-${option.tone.toLowerCase()}`} onClick={() => resolve(() => onParticipantAction(option.id))}><header><span>{toneLabel[option.tone]}</span><strong>{option.title}</strong></header><p>{option.detail}</p><footer><span>{option.advanceMinutes} мин</span>{option.skill && <b>{SKILL_LABELS[option.skill]}</b>}<em>→</em></footer></button>)}</div>
        </section><aside className="participant-side"><p className="eyebrow">ТВОЯ РАБОТА</p><div><span>Силы</span><strong>{Math.round(climb.energy)}%</strong></div><div><span>Доверие руководителя</span><strong>{climb.participant.leaderTrust}</strong></div><div><span>Доверие группы</span><strong>{climb.participant.groupTrust}</strong></div><div><span>Дисциплина</span><strong>{Math.round(climb.participant.discipline)}</strong></div><div><span>Инициатива</span><strong>{Math.round(climb.participant.initiative)}</strong></div><div><span>Помощь</span><strong>{Math.round(climb.participant.care)}</strong></div><div><span>Компетентность</span><strong>{Math.round(climb.participant.competence)}</strong></div><p>Приказы: {climb.participant.ordersObeyed}/{climb.participant.ordersReceived} выполнено · отказов {climb.participant.ordersRefused}</p></aside></div>
      </section>
    );
  }

  if (climb.phase === 'SUMMIT' && !climb.participant) {
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
        <div><p className="eyebrow">LIVE ROUTE / {climb.phase} · {difficulty}</p><h1>{climb.mountainName}</h1><p>{climb.routeName} · {climb.routeStyle}</p></div>
        <div className="climb-phase-mark"><span>{climb.phase === 'ASCENT' ? '↑' : '↓'}</span><small>{climb.retreating ? 'ОТХОД' : climb.phase === 'ASCENT' ? 'ПОДЪЁМ' : 'СПУСК'}</small></div>
      </header>

      <div className="climb-instruments climb-instruments--workspace">
        <div><span>Высота</span><strong>{climb.currentElevation} м</strong></div>
        <div><span>Время</span><strong>{durationLabel(climb.elapsedMinutes)}</strong></div>
        <div><span>Энергия</span><strong>{Math.round(climb.energy)}%</strong><i style={{ '--value': `${climb.energy}%` } as React.CSSProperties} /></div>
        <div><span>Группа</span><strong>{conditionText(climb.teamCondition, difficulty)}</strong><i style={{ '--value': `${climb.teamCondition}%` } as React.CSSProperties} /></div>
        <div><span>Погода</span><strong>{climb.temperatureC}° · {climb.windKmh} км/ч</strong></div>
        <div><span>Видимость</span><strong>{visibilityText(climb.visibility, difficulty)}</strong></div>
      </div>

      {!career.onboarding.completed && !career.onboarding.dismissed && <section className="climb-briefing"><span>ПЕРВАЯ ЭКСПЕДИЦИЯ</span><strong>Смотри на одну проблему за раз.</strong><p>Сначала оцени сигнал ниже. Затем сравни темп. Разворот не является поражением: вершина засчитывается только после спуска.</p></section>}
      <section className={`field-signal is-${fieldSignal.tone}`}><strong>{fieldSignal.title}</strong><p>{fieldSignal.detail}</p></section>
      {noReturn && <section className="no-return-warning"><span>ТОЧКА ТЯЖЁЛОГО ОТХОДА</span><strong>После этого участка спуск станет дороже.</strong><p>Оцени силы, погоду и состояние людей до движения. Кнопка отхода остаётся доступной, но время и риск вырастут.</p></section>}

      <div className="climb-workspace-grid">
        <section className="climb-map-panel climb-map-panel--workspace">
          <RouteBlueprint climb={climb} />
          <div className="route-progress-register">
            {climb.route.map((segment, index) => {
              const current = index === climb.segmentIndex;
              const passed = index < climb.segmentIndex;
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

          {currentDecision ? (
            <section className="route-decision-panel">
              <p className="eyebrow">РЕШЕНИЕ НА МАРШРУТЕ</p>
              <h2>{currentDecision.title}</h2>
              <p>{currentDecision.situation}</p>
              <div>
                {currentDecision.options.map(option => {
                  const unavailable = Boolean(option.requiresRopeMeters && climb.ropeMetersRemaining < option.requiresRopeMeters);
                  return (
                    <button key={option.id} className={`is-${option.tone.toLowerCase()}`} disabled={unavailable} onClick={() => resolve(() => onChooseDecision(option.id))}>
                      <header><strong>{option.title}</strong><span>{option.tone === 'SAFE' ? 'БЕЗОПАСНЕЕ' : option.tone === 'BOLD' ? 'РИСКОВАННО' : 'БАЛАНС'}</span></header>
                      <p>{option.description}</p>
                      <small>{difficulty === 'EXPLORER' ? `Время ×${option.durationModifier.toFixed(2)} · силы ×${option.energyModifier.toFixed(2)} · риск ${option.riskModifier >= 0 ? '+' : ''}${Math.round(option.riskModifier * 100)}%` : difficulty === 'CLIMBER' ? `${option.durationModifier > 1 ? 'Дольше' : 'Быстрее'} · ${option.energyModifier > 1 ? 'тяжелее' : 'экономнее'} · ${option.riskModifier < 0 ? 'риск ниже' : option.riskModifier > 0 ? 'риск выше' : 'риск без изменения'}` : `${option.tone === 'SAFE' ? 'Больше контроля, меньше темпа' : option.tone === 'BOLD' ? 'Быстро, но с малым запасом' : 'Умеренный компромисс'}`}</small>
                      {option.requiresRopeMeters && <em>{unavailable ? `Нужно ${option.requiresRopeMeters} м верёвки` : `Будет оставлено ${option.requiresRopeMeters} м верёвки`}</em>}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="pace-options pace-options--preview">
              {previews.map(preview => <PaceCard key={preview.pace} preview={preview} primary={preview.pace === 'STEADY'} recommended={preview.pace === recommendedPace} difficulty={difficulty} onClick={() => resolve(() => onStep(preview.pace))} />)}
            </div>
          )}

          <div className="field-actions field-actions--explained">
            <button disabled={!activeSegment.campPossible} onClick={() => resolve(onCamp)}><span>Лагерь</span><small>+34% сил · 7 часов · еда и топливо</small></button>
            <button disabled={climb.supplies.fuelUnits <= 0} onClick={() => resolve(onMeltSnow)}><span>Топить снег</span><small>50 минут · топливо −1 · вода +5</small></button>
            <button onClick={() => resolve(onWait)}><span>Ждать окно</span><small>3 часа · запасы расходуются · погода меняется</small></button>
            <button disabled={climb.phase !== 'ASCENT' || climb.ropeMetersRemaining < 20} onClick={() => resolve(onFixRope)}><span>Закрепить линию</span><small>50 минут · верёвка −20 м · безопаснее на спуске</small></button>
            <button disabled={climb.phase !== 'ASCENT' || !activeSegment.campPossible} onClick={() => resolve(onLeaveCache)}><span>Оставить закладку</span><small>30 минут · рюкзак легче · запас на возвращение</small></button>
          </div>

          {climb.authorityMode === 'COMMAND' ? <details className="team-orders team-orders--disclosure">
            <summary><span>Приказы группе</span><small>Люди могут отказаться, если не доверяют решению</small></summary>
            <div>
              <button onClick={() => resolve(() => onOrder('SLOW_DOWN'))}><strong>Снизить темп</strong><small>+2 состояния группе · −45 минут.</small></button>
              <button onClick={() => resolve(() => onOrder('PRESS_ON'))}><strong>Давить вверх</strong><small>Сохраняет темп, повышает усталость и риск конфликта.</small></button>
              <button onClick={() => resolve(() => onOrder('TURN_BACK_WEAKEST'))}><strong>Развернуть слабого</strong><small>Снимает худшего участника, но может вызвать отказ и обиду.</small></button>
              <button onClick={() => resolve(() => onOrder('ASSIGN_HELPER'))}><strong>Назначить помощь</strong><small>Стабилизирует пострадавшего ценой сил помощника.</small></button>
            </div>
          </details> : <section className="decision-guide"><strong>Ты участник, а не руководитель</strong><p>Общий темп и приказы задаёт {climb.leaderNpcId ? career.teamRoster.find(member => member.id === climb.leaderNpcId)?.name ?? 'руководитель экспедиции' : 'руководитель экспедиции'}. Твои решения касаются собственной роли, помощи группе и поведения на каждом участке.</p></section>}

          {climb.phase === 'ASCENT' && <button className="retreat-button" onClick={onRetreat}>Развернуть всю группу и начать спуск</button>}
        </section>

        <aside className="climb-resource-panel">
          <p className="eyebrow">FIELD RESOURCES</p><h2>Запасы</h2>
          <div><span>Еда</span><strong>{climb.supplies.foodUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.foodUnits * 8)}%` } as React.CSSProperties} /></div>
          <div><span>Вода</span><strong>{climb.supplies.waterUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.waterUnits * 14)}%` } as React.CSSProperties} /></div>
          <div><span>Топливо</span><strong>{climb.supplies.fuelUnits}</strong><i style={{ '--value': `${Math.min(100, climb.supplies.fuelUnits * 25)}%` } as React.CSSProperties} /></div>
          <div><span>Вес</span><strong>{climb.packWeightKg} кг</strong></div>
          <div><span>Верёвка</span><strong>{climb.ropeMetersRemaining} м</strong></div>
          <div><span>Закладки</span><strong>{climb.caches.filter(item => !item.recovered).length}</strong></div>
          <div><span>До темноты</span><strong>{durationLabel(daylightMinutes)}</strong></div>
          <div><span>Ближайший лагерь</span><strong>{nextCampDistance === null ? 'нет' : nextCampDistance === 0 ? 'здесь' : `через ${nextCampDistance} уч.`}</strong></div>
          <div><span>Без сна</span><strong>{Math.round(climb.hoursAwake)} ч</strong></div>
          <p className="resource-warning">Смотри расходы прямо на карточках темпа. Пустой запас не убивает мгновенно, но делает каждый следующий ход хуже.</p>
          <div className="field-team-register">
            <p className="eyebrow">PEOPLE ON ROUTE</p>
            {liveTeam.map(({ state, member }) => (
              <article key={state.memberId} className={`is-${state.status.toLowerCase()}`}>
                <span>{member!.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</span>
                <div><strong>{member!.name}</strong><small>{state.status} · {state.visibleInjury ?? 'без выявленной травмы'}</small></div>
                <b>{conditionText(state.condition, difficulty)}</b>
                <i style={{ '--value': `${state.condition}%` } as React.CSSProperties} />
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
