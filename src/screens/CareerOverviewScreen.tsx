import { MountainArt } from '../components/MountainArt';
import { SkillBars } from '../components/SkillBars';
import { TRAINING_ACTIONS, SKILL_LABELS, careerReadiness, expeditionReadiness, getSelectedRoute } from '../core/career';
import { normalizeCareerProgression } from '../core/progression';
import { normalizeSeasonCampaignPlan, seasonPlanRoutes } from '../core/seasonPlanning';
import type { CareerState, SeasonBudgetPolicy, SeasonRiskPolicy, TrainingId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onTrain: (trainingId: TrainingId) => void;
  onOpenExpedition: () => void;
  onOpenWorld: () => void;
  onSeasonRisk: (policy: SeasonRiskPolicy) => void;
  onSeasonBudget: (policy: SeasonBudgetPolicy) => void;
  onSeasonGoal: (routeId: string) => void;
  onSeasonTeam: () => void;
};

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function CareerOverviewScreen({ world, career, onTrain, onOpenExpedition, onOpenWorld, onSeasonRisk, onSeasonBudget, onSeasonGoal, onSeasonTeam }: Props) {
  const target = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === target.mountainId) ?? world.region.mountains[0]!;
  const readiness = careerReadiness(career);
  const expedition = expeditionReadiness(career);
  const progression = normalizeCareerProgression(career);
  const clubState = career.livingWorld.clubs.find(item => item.id === career.club.id);
  const incompleteGoals = progression.milestones.filter(item => !item.completed).slice(0, 4);
  const clubMentorIds = new Set(career.club.mentors.map(item => item.id));
  const mentorActivity = [...career.livingWorld.expeditions].reverse().filter(item => clubMentorIds.has(item.leaderAthleteId)).slice(0, 3);
  const seasonPlan = normalizeSeasonCampaignPlan(career);
  const seasonGoals = seasonPlanRoutes(career);
  const seasonCandidates = [...career.routes].sort((a, b) => a.objectiveRisk - b.objectiveRisk || a.summitElevation - b.summitElevation).filter((route, index, list) => list.findIndex(item => item.mountainId === route.mountainId) === index).slice(0, 8);
  const seasonCore = career.teamRoster.filter(member => seasonPlan.coreMemberIds.includes(member.id));
  const nextMessage = career.recoveryDays > 0
    ? `После экспедиции нужен отдых: ещё ${career.recoveryDays} дн. Тяжёлые тренировки временно закрыты.`
    : career.activeClimb
    ? 'Экспедиция уже идёт. Открой раздел восхождения.'
    : expedition.blockers.length
      ? `Подготовка не закончена: ${expedition.blockers[0]}`
      : 'План готов. Проверь цель и переходи к финальному выходу.';

  return (
    <section className="workspace-page overview-page overview-page--clear">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">КАРЬЕРА · {career.hero.originTitle}</p>
          <h1>{career.hero.name}</h1>
          <p>{career.hero.age} лет · {career.club.name} · {career.club.town}</p>
        </div>
        <div className="workspace-title__mark"><span>{career.completedClimbs}</span><small>ВОСХОЖДЕНИЙ</small></div>
      </header>

      <section className="career-next-step">
        <div><small>ГЛАВНОЕ СЕЙЧАС</small><strong>{career.recoveryDays > 0 ? 'Восстановиться после экспедиции' : career.activeClimb ? 'Вернуться на маршрут' : 'Подготовить следующую экспедицию'}</strong><p>{nextMessage}</p></div>
        <button onClick={career.recoveryDays > 0 ? () => onTrain('RECOVERY') : onOpenExpedition}><span>{career.recoveryDays > 0 ? 'Провести восстановление' : career.activeClimb ? 'Открыть план' : 'Выбрать гору и маршрут'}</span><b>→</b></button>
      </section>

      <div className="overview-poster overview-poster--clear">
        <MountainArt points={mountain.profilePoints} variant="hero" label={target.mountainName} elevation={target.summitElevation} />
        <div className="overview-poster__plate">
          <small>ТЕКУЩАЯ ЦЕЛЬ</small>
          <strong>{target.mountainName}</strong>
          <span>{target.name} · {target.summitElevation} м</span>
        </div>
      </div>

      <div className="workspace-metrics workspace-metrics--clear">
        <div><span>Личная готовность</span><strong>{readiness}/100</strong><small>Форма, здоровье, усталость, навыки</small><i style={{ '--value': `${readiness}%` } as React.CSSProperties} /></div>
        <div><span>План экспедиции</span><strong>{expedition.total}/100</strong><small>{expedition.blockers.length ? `${expedition.blockers.length} блокировки` : 'Можно выходить'}</small><i style={{ '--value': `${expedition.total}%` } as React.CSSProperties} /></div>
        <div><span>Здоровье</span><strong>{Math.round(career.hero.health)}/100</strong><small>{career.hero.injuries.length ? career.hero.injuries.join(', ') : 'Травм нет'}</small><i style={{ '--value': `${career.hero.health}%` } as React.CSSProperties} /></div>
        <div><span>{career.recoveryDays > 0 ? 'Восстановление' : 'Высшая точка'}</span><strong>{career.recoveryDays > 0 ? `${career.recoveryDays} дн.` : `${career.highestElevation} м`}</strong><small>{career.recoveryDays > 0 ? 'До возвращения к тяжёлой подготовке' : 'Личный подтверждённый результат'}</small></div>
      </div>

      <div className="overview-columns overview-columns--clear">
        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">ЛИЧНЫЕ ВОЗМОЖНОСТИ</p><h2>Навыки</h2></div><span>МАКС. 10</span></div>
          <SkillBars skills={career.hero.skills} xp={career.hero.skillXp} />
        </section>
        <section className="workspace-panel club-brief">
          <div className="panel-heading"><div><p className="eyebrow">КЛУБ</p><h2>{career.club.name}</h2></div><span>{career.club.standing}/100</span></div>
          <p>{career.club.specialty}. {career.club.doctrine}</p>
          {clubState && <div className="club-profile-facts"><span><small>Профиль</small><strong>{SKILL_LABELS[clubState.focusSkill]}</strong></span><span><small>Риск</small><strong>{clubState.riskProfile === 'CAUTIOUS' ? 'Осторожный' : clubState.riskProfile === 'AGGRESSIVE' ? 'Агрессивный' : 'Сбалансированный'}</strong></span><span><small>Подготовка</small><strong>{clubState.trainingQuality}/100</strong></span></div>}
          <div className="club-mentor-list">{career.club.mentors.map(mentor => { const athlete = career.livingWorld.athletes.find(item => item.id === mentor.id); return <article key={mentor.id}><strong>{mentor.name}</strong><small>{mentor.title} · {mentor.routePreference === 'EASY' ? 'учебные маршруты' : mentor.routePreference === 'HARD' ? 'сложные маршруты' : 'смешанные маршруты'}{athlete?.recoveryDays ? ` · отдых ${athlete.recoveryDays} дн.` : ''}</small>{athlete?.lastEvent && <em>{athlete.lastEvent}</em>}</article>; })}</div>
          {mentorActivity.length > 0 && <div className="mentor-route-strip">{mentorActivity.map(item => <span key={item.id}><b>{item.mountainName}</b><small>{item.routeName} · {item.outcome === 'SUMMIT' ? 'вершина' : item.outcome === 'RETREAT' ? 'отход' : item.outcome === 'TRAGEDY' ? 'трагедия' : 'авария'}</small></span>)}</div>}
        </section>
      </div>

      <section className="workspace-panel season-command-panel">
        <div className="panel-heading"><div><p className="eyebrow">ПЛАН СЕЗОНА · {career.year}</p><h2>Цели, состав, деньги, риск</h2></div><span>{seasonPlan.spentCredits}/{seasonPlan.reserveCredits} КР.</span></div>
        <p className="section-explainer">Ты задаёшь только четыре рамки. Подготовка копится через тренировки, а школа сама двигает наборы, переносы и выходы.</p>
        <div className="season-command-grid">
          <article className="season-command-card season-command-card--goals">
            <header><small>01 · ЦЕЛИ</small><strong>{seasonPlan.completedGoalRouteIds.length}/{seasonPlan.goalRouteIds.length} выполнено</strong></header>
            <div className="season-goal-list">{seasonGoals.map(route => <button key={route.id} className="is-active" onClick={() => onSeasonGoal(route.id)}><span>{route.mountainName}</span><small>{route.name} · {route.summitElevation} м</small><b>{seasonPlan.completedGoalRouteIds.includes(route.id) ? '✓' : '×'}</b></button>)}</div>
            <details><summary>Изменить цели</summary><div className="season-goal-picker">{seasonCandidates.map(route => <button key={route.id} className={seasonPlan.goalRouteIds.includes(route.id) ? 'is-active' : ''} onClick={() => onSeasonGoal(route.id)}><strong>{route.mountainName}</strong><small>{route.name}</small></button>)}</div></details>
          </article>
          <article className="season-command-card">
            <header><small>02 · ОСНОВНОЙ СОСТАВ</small><strong>{seasonCore.length} человек</strong></header>
            <p>{seasonCore.length ? seasonCore.map(member => member.name).join(' · ') : 'Основной состав не закреплён.'}</p>
            <button className="season-command-action" onClick={onSeasonTeam} disabled={!career.permanentTeam.memberIds.length}>Взять постоянную связку</button>
          </article>
          <article className="season-command-card">
            <header><small>03 · БЮДЖЕТ</small><strong>{Math.max(0, seasonPlan.reserveCredits - seasonPlan.spentCredits)} кр. осталось</strong></header>
            <div className="season-segmented">{([['LEAN', 'Экономный'], ['STANDARD', 'Рабочий'], ['FULL', 'Полный']] as Array<[SeasonBudgetPolicy, string]>).map(([policy, label]) => <button key={policy} className={seasonPlan.budgetPolicy === policy ? 'is-active' : ''} onClick={() => onSeasonBudget(policy)}>{label}</button>)}</div>
            <p>{seasonPlan.budgetPolicy === 'FULL' ? 'Больше резерв и лучше подготовка целей.' : seasonPlan.budgetPolicy === 'LEAN' ? 'Меньше резерв, без скидки на целевые экспедиции.' : 'Средний резерв и поддержка основных целей.'}</p>
          </article>
          <article className="season-command-card">
            <header><small>04 · ДОПУСТИМЫЙ РИСК</small><strong>{seasonPlan.preparationDays} дн. подготовки</strong></header>
            <div className="season-segmented">{([['CAUTIOUS', 'Осторожно'], ['BALANCED', 'Рабоче'], ['AGGRESSIVE', 'Жёстко']] as Array<[SeasonRiskPolicy, string]>).map(([policy, label]) => <button key={policy} className={seasonPlan.riskPolicy === policy ? 'is-active' : ''} onClick={() => onSeasonRisk(policy)}>{label}</button>)}</div>
            <p>Переносов школы: {seasonPlan.delayedPlans}. Отмен: {seasonPlan.cancelledPlans}. Риск влияет на готовность и допустимую сложность цели.</p>
          </article>
        </div>
      </section>

      <section className="workspace-panel career-goals-panel">
        <div className="panel-heading"><div><p className="eyebrow">ДОЛГОСРОЧНАЯ КАРЬЕРА</p><h2>Следующие цели</h2></div><span>{progression.milestones.filter(item => item.completed).length}/{progression.milestones.length}</span></div>
        <div className="career-goal-list">{incompleteGoals.map((goal, index) => <article key={goal.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{goal.title}</strong><p>{goal.description}</p></div><b>+{goal.rewardReputation} REP</b></article>)}</div>
      </section>

      <section className="workspace-panel training-section training-section--workspace training-section--clear">
        <div className="panel-heading"><div><p className="eyebrow">ДЕЙСТВИЯ МЕЖДУ ЭКСПЕДИЦИЯМИ</p><h2>Подготовка героя</h2></div><span>КАЖДОЕ ДЕЙСТВИЕ ДВИГАЕТ ВРЕМЯ</span></div>
        <p className="section-explainer">Здесь нет скрытых эффектов: на каждой карточке показано, что изменится сразу после нажатия. За это время соперники тоже совершают восхождения.</p>
        <div className="training-grid training-grid--workspace training-grid--clear">
          {trainingOrder.map((id, index) => {
            const action = TRAINING_ACTIONS[id];
            const unavailable = (action.cost > 0 && career.hero.money < action.cost) || (career.recoveryDays > 0 && id !== 'RECOVERY');
            return (
              <button key={id} disabled={unavailable} className="training-card training-card--clear" onClick={() => onTrain(id)}>
                <header><span>{String(index + 1).padStart(2, '0')}</span><small>{action.days} ДНЕЙ</small></header>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <div className="training-impact">
                  {action.skill && action.xp && <span><small>{SKILL_LABELS[action.skill]}</small><strong>прогресс +{action.xp}</strong></span>}
                  {action.form !== 0 && <span><small>Форма</small><strong>{signed(action.form)}</strong></span>}
                  {action.fatigue !== 0 && <span><small>Усталость</small><strong>{signed(action.fatigue)}</strong></span>}
                  {id === 'RECOVERY' && <span><small>Здоровье</small><strong>+10</strong></span>}
                  <span><small>Средства</small><strong>{action.cost < 0 ? `+${Math.abs(action.cost)}` : `−${action.cost}`} кр.</strong></span>
                </div>
                <footer>{career.recoveryDays > 0 && id !== 'RECOVERY' ? 'СНАЧАЛА ВОССТАНОВЛЕНИЕ' : unavailable ? 'НЕ ХВАТАЕТ СРЕДСТВ' : 'ВЫПОЛНИТЬ'}</footer>
              </button>
            );
          })}
        </div>
      </section>

      {career.livingWorld.news[0] && (
        <section className="world-signal-compact">
          <div><small>ПОСЛЕДНЯЯ НОВОСТЬ МИРА</small><strong>{career.livingWorld.news[0].headline}</strong><p>{career.livingWorld.news[0].summary}</p></div>
          <button onClick={onOpenWorld}>Открыть мир →</button>
        </section>
      )}
    </section>
  );
}
