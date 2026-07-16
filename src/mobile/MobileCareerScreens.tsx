import { useMemo, useState } from 'react';
import { MountainArt } from '../components/MountainArt';
import {
  EXPEDITION_RANK_LABELS,
  GEAR_CATALOG,
  SKILL_LABELS,
  TRAINING_ACTIONS,
  expeditionCost,
  expeditionReadiness,
  expeditionWeight,
  getSelectedRoute,
  getSelectedWeather,
  routesForMountain,
  selectedTeam,
  schoolExpeditionBoard,
} from '../core/career';
import { buildMountainDynamics } from '../core/mountainDynamics';
import { careerRegion, regionAccessList, regionMountains } from '../core/regionalCareer';
import { SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase, schoolOfferCanAccept } from '../core/schoolExpeditions';
import { CAREER_TIER_LABELS, SEASON_PHASE_LABELS, careerSeasonPhase, careerWorldRank, currentSeasonExpeditionCount, expeditionLimitForTier, nextCareerMilestone, normalizeCareerProgression } from '../core/progression';
import { buildMountainMemory } from '../core/mountainMemory';
import { normalizeSeasonCampaignPlan, seasonPlanRoutes } from '../core/seasonPlanning';
import type {
  CareerState,
  CareerTabId,
  DifficultyId,
  ExpeditionOffer,
  ExpeditionPlan,
  GearCategory,
  MountainData,
  PermanentTeamStyle,
  SeasonBudgetPolicy,
  SeasonRiskPolicy,
  TrainingId,
  WorldEventType,
  WorldState,
} from '../core/types';

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];
const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;
const categoryLabel: Record<GearCategory, string> = { PROTECTION: 'Страховка', SHELTER: 'Укрытие', SURVIVAL: 'Запасы', COMMUNICATION: 'Связь' };

const expeditionRankOrder = ['NOVICE', 'MEMBER', 'SPECIALIST', 'ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'] as const;
function rankAllows(actual: CareerState['membership']['rank'], required: ExpeditionOffer['requiredRank']) { return expeditionRankOrder.indexOf(actual) >= expeditionRankOrder.indexOf(required); }

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function level(value: number) { return value < 38 ? 'низкий' : value < 58 ? 'средний' : value < 76 ? 'высокий' : 'предельный'; }
function mountainScore(mountain: MountainData) { return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32; }
function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); }

function StepLine({ step, title, value }: { step: string; title: string; value?: string | number }) {
  return <div className="m-step-line"><span>{step}</span><strong>{title}</strong>{value !== undefined && <b>{value}</b>}</div>;
}

export function MobileOverview({ world, career, onTrain, onOpenExpedition, onSeasonRisk, onSeasonBudget, onSeasonGoal, onSeasonTeam }: { world: WorldState; career: CareerState; onTrain: (id: TrainingId) => void; onOpenExpedition: () => void; onOpenWorld: () => void; onSeasonRisk: (policy: SeasonRiskPolicy) => void; onSeasonBudget: (policy: SeasonBudgetPolicy) => void; onSeasonGoal: (routeId: string) => void; onSeasonTeam: () => void }) {
  const route = getSelectedRoute(career);
  const expedition = expeditionReadiness(career);
  const progression = normalizeCareerProgression(career);
  const phase = careerSeasonPhase(career.seasonDay);
  const expeditionCount = currentSeasonExpeditionCount(career);
  const expeditionLimit = expeditionLimitForTier(progression.tier);
  const milestone = nextCareerMilestone(career);
  const worldRank = careerWorldRank(career);
  const primaryTraining = trainingOrder.slice(0, 4);
  const extraTraining = trainingOrder.slice(4);
  const seasonPlan = normalizeSeasonCampaignPlan(career);
  const seasonGoals = seasonPlanRoutes(career);
  const seasonCandidates = [...career.routes].sort((a, b) => a.objectiveRisk - b.objectiveRisk).filter((item, index, list) => list.findIndex(route => route.mountainId === item.mountainId) === index).slice(0, 6);
  const seasonCore = career.teamRoster.filter(member => seasonPlan.coreMemberIds.includes(member.id));

  const renderTraining = (id: TrainingId) => {
    const action = TRAINING_ACTIONS[id];
    const disabled = (action.cost > 0 && career.hero.money < action.cost) || (career.recoveryDays > 0 && id !== 'RECOVERY');
    const impacts = [
      action.skill && action.xp ? `${SKILL_LABELS[action.skill]} +${action.xp}` : '',
      action.form ? `форма ${signed(action.form)}` : '',
      action.fatigue ? `усталость ${signed(action.fatigue)}` : '',
      `${action.cost < 0 ? '+' : '−'}${Math.abs(action.cost)} кр.`,
    ].filter(Boolean).slice(0, 2);
    return <button key={id} disabled={disabled} onClick={() => onTrain(id)}><span className="m-action-index">{action.days}д</span><div><strong>{action.title}</strong><small>{impacts.join(' · ')}</small></div><b>›</b></button>;
  };

  return <section className="m-screen" aria-label={`Штаб ${world.region.name}`}>
    <button className="m-focus-card m-focus-card--compact" onClick={career.recoveryDays > 0 ? () => onTrain('RECOVERY') : onOpenExpedition}><div><small>СЕЙЧАС</small><strong>{career.recoveryDays > 0 ? 'Восстановление' : career.activeClimb ? 'Вернуться на маршрут' : expedition.blockers.length ? 'Закончить подготовку' : 'Начать экспедицию'}</strong><span>{career.recoveryDays > 0 ? `Ещё ${career.recoveryDays} дн. до тяжёлой работы` : career.activeClimb ? 'Экспедиция продолжается' : expedition.blockers[0] ?? route.mountainName}</span></div><b>→</b></button>
    <section className="m-season-card"><header><div><small>{SEASON_PHASE_LABELS[phase]}</small><strong>Сезон {progression.seasonNumber}</strong></div><span>{expeditionCount}/{expeditionLimit} выходов</span></header><div className="m-season-facts"><span>{CAREER_TIER_LABELS[progression.tier]}<b>уровень</b></span><span>№ {worldRank}<b>в мире</b></span><span>{progression.sponsor ? progression.sponsor.name : 'Без поддержки'}<b>партнёр</b></span></div>{milestone && <footer><small>СЛЕДУЮЩАЯ ЦЕЛЬ</small><strong>{milestone.title}</strong></footer>}</section>
    <div className="m-state-strip"><span>Здоровье <b>{Math.round(career.hero.health)}</b></span><span>{career.recoveryDays > 0 ? 'Отдых' : 'Форма'} <b>{career.recoveryDays > 0 ? `${career.recoveryDays}д` : Math.round(career.hero.form)}</b></span><span>Усталость <b>{Math.round(career.hero.fatigue)}</b></span></div>
    <details className="m-details m-season-plan-mobile" open={seasonPlan.preparationDays === 0 || undefined}>
      <summary>План сезона · {seasonPlan.spentCredits}/{seasonPlan.reserveCredits} кр.</summary>
      <div className="m-season-plan-body">
        <div className="m-season-plan-goals">{seasonGoals.map(route => <button key={route.id} className="is-active" onClick={() => onSeasonGoal(route.id)}><strong>{route.mountainName}</strong><small>{route.name}</small><b>{seasonPlan.completedGoalRouteIds.includes(route.id) ? '✓' : '×'}</b></button>)}</div>
        <details className="m-details m-details--flat"><summary>Сменить цели</summary><div className="m-season-goal-picker">{seasonCandidates.map(route => <button key={route.id} className={seasonPlan.goalRouteIds.includes(route.id) ? 'is-active' : ''} onClick={() => onSeasonGoal(route.id)}><strong>{route.mountainName}</strong><small>{route.summitElevation} м</small></button>)}</div></details>
        <div className="m-season-plan-label"><span>Основной состав</span><b>{seasonCore.length ? seasonCore.map(member => member.name.split(' ')[0]).join(' · ') : 'не задан'}</b></div>
        <button className="m-season-team-button" onClick={onSeasonTeam} disabled={!career.permanentTeam.memberIds.length}>Взять постоянную связку</button>
        <div className="m-season-plan-label"><span>Бюджет</span><b>{Math.max(0, seasonPlan.reserveCredits - seasonPlan.spentCredits)} кр. осталось</b></div>
        <div className="m-segmented">{([['LEAN', 'Эконом'], ['STANDARD', 'Рабочий'], ['FULL', 'Полный']] as Array<[SeasonBudgetPolicy, string]>).map(([policy, label]) => <button key={policy} className={seasonPlan.budgetPolicy === policy ? 'is-active' : ''} onClick={() => onSeasonBudget(policy)}>{label}</button>)}</div>
        <div className="m-season-plan-label"><span>Риск</span><b>{seasonPlan.preparationDays} дн. подготовки</b></div>
        <div className="m-segmented">{([['CAUTIOUS', 'Осторожно'], ['BALANCED', 'Рабоче'], ['AGGRESSIVE', 'Жёстко']] as Array<[SeasonRiskPolicy, string]>).map(([policy, label]) => <button key={policy} className={seasonPlan.riskPolicy === policy ? 'is-active' : ''} onClick={() => onSeasonRisk(policy)}>{label}</button>)}</div>
      </div>
    </details>
    <div className="m-section-head"><h2>Тренировки</h2></div>
    <div className="m-action-list">{primaryTraining.map(renderTraining)}</div>
    <details className="m-details m-details--flat"><summary>Все действия</summary><div className="m-action-list">{extraTraining.map(renderTraining)}</div></details>
  </section>;
}

export function MobileRoute({ world, career, offers, onAcceptOffer, onSelectMountain, onSelectRoute, onContinue }: { world: WorldState; career: CareerState; offers: ExpeditionOffer[]; onAcceptOffer: (id: string) => void; onSelectMountain: (id: string) => void; onSelectRoute: (id: string) => void; onContinue: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const route = getSelectedRoute(career);
  const currentRegion = careerRegion(world, career);
  const currentMountains = regionMountains(world, currentRegion.id);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId] ?? currentMountains[0]!;
  const canPlan = career.membership.permissions.canChooseRoute;
  const mountains = [...currentMountains].sort((a, b) => mountainScore(a) - mountainScore(b));
  const routes = routesForMountain(career, mountain.id);
  const mountainMemory = useMemo(() => buildMountainMemory(career, mountain.id), [career, mountain.id]);
  const applicationFor = (offerId: string) => [...career.applications].reverse().find(application => application.offerId === offerId) ?? null;
  const routeDynamics = buildMountainDynamics(career, mountain.id, route.id);

  const chooseMountain = (id: string) => {
    onSelectMountain(id);
    setPickerOpen(false);
  };

  const renderOffer = (offer: ExpeditionOffer) => {
    const offerRoute = world.ecosystem.content.routes.byId[offer.routeId] ?? career.routes.find(item => item.id === offer.routeId);
    const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null;
    const leader = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
    const application = applicationFor(offer.id);
    const active = career.selectedOfferId === offer.id;
    const phase = schoolExpeditionPhase(offer, career.seasonDay);
    const rankOk = rankAllows(career.membership.rank, offer.requiredRank);
    const canApply = rankOk && schoolOfferCanAccept(offer, career.seasonDay);
    const status = active || application?.status === 'ACCEPTED' ? 'МЕСТО' : !rankOk ? 'РАНГ' : SCHOOL_EXPEDITION_PHASE_LABELS[phase].toUpperCase();
    return <button key={offer.id} disabled={!canApply && !active} className={`${active ? 'is-active' : ''} is-${phase.toLowerCase()} ${application?.status === 'REJECTED' ? 'is-rejected' : ''}`} onClick={() => onAcceptOffer(offer.id)}><div><small>{status} · {leader?.name ?? 'Инструктор'}</small><strong>{offerMountain?.name ?? offerRoute?.mountainName ?? 'Неизвестная гора'}</strong><span>{offerRoute?.name ?? 'Маршрут'} · выход день {offer.departureDay ?? '—'} · готовность {offer.preparationProgress ?? 0}%{offer.delayDays ? ` · задержка ${offer.delayDays} дн.` : ''}</span><em>{offer.briefing}</em>{application && <i>{application.reason}</i>}</div><b>{active ? '✓' : canApply ? '›' : '—'}</b></button>;
  };

  if (!canPlan) {
    return <section className="m-screen m-screen--with-action">
      <StepLine step="1/4" title="Планы инструкторов" value={EXPEDITION_RANK_LABELS[career.membership.rank]} />
      <div className="m-status-line"><strong>{career.selectedOfferId ? `Выход: день ${career.acceptedOffer?.departureDay ?? career.seasonDay}` : 'Выбери план и дождись выхода'}</strong><span>{offers.length} планов</span></div>
      <div className="m-offer-list">{offers.map(renderOffer)}</div>
      {!offers.length && <div className="m-note">Сейчас нет доступных заявок. Продвигай время тренировками.</div>}
      {career.selectedOfferId && <section className="m-target-card m-target-card--route"><MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} /><footer><div><small>НАЗНАЧЕННАЯ ЦЕЛЬ</small><strong>{mountain.name}</strong><span>{route.name} · роль: {roleLabel[career.expeditionPlan.playerRole]}</span></div><b>{route.estimatedDecisionCount ?? 20} реш.</b></footer></section>}
      <button className="m-sticky-action" disabled={!career.selectedOfferId} onClick={onContinue}><span>{career.selectedOfferId ? 'Состав экспедиции' : 'Нужна принятая заявка'}</span><b>→</b></button>
    </section>;
  }

  const foreignOffers = offers.filter(offer => !offer.solo);

  return <section className="m-screen m-screen--with-action">
    <StepLine step="1/4" title={career.selectedOfferId ? 'Чужая экспедиция' : career.membership.mode === 'INDEPENDENT' ? 'Одиночный выход' : 'Цель'} />
    {career.membership.mode === 'INDEPENDENT' && foreignOffers.length > 0 && <details className="m-details m-details--flat m-foreign-offers"><summary>Чужие походы · {foreignOffers.length}</summary><div className="m-offer-list">{foreignOffers.map(renderOffer)}</div></details>}
    <section className="m-target-card m-target-card--route"><MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} /><footer><div><small>{career.selectedOfferId ? 'НАЗНАЧЕННАЯ ЦЕЛЬ' : mountain.characterTitle}</small><strong>{mountain.name}</strong><span>{career.selectedOfferId ? `${route.name} · роль: ${roleLabel[career.expeditionPlan.playerRole]}` : mountain.dangerProfile}</span></div><b>{mountain.elevation} м</b></footer></section>
    <section className={`m-dynamic-condition is-${routeDynamics.status.toLowerCase()}`}><div><small>СОСТОЯНИЕ МАССИВА</small><strong>{routeDynamics.seasonTitle}</strong><span>{routeDynamics.seasonSummary}</span></div><b>{routeDynamics.statusLabel}</b>{routeDynamics.closureReason && <p>{routeDynamics.closureReason}</p>}</section>
    <details className="m-details m-details--flat m-memory-details">
      <summary>Память горы</summary>
      <div className="m-memory-card">
        <div className="m-memory-facts">
          <span><b>{mountainMemory.attempts}</b><i>выходов</i></span>
          <span><b>{mountainMemory.summits}</b><i>вершин</i></span>
          <span><b>{mountainMemory.successRate}%</b><i>успех</i></span>
          <span><b>{mountainMemory.firstAscentLabel}</b><i>первая</i></span>
        </div>
        <p>{mountainMemory.attentionLabel}. {mountainMemory.signs[0]}</p>
        {mountainMemory.stories.length > 0 && <div className="m-memory-stories">{mountainMemory.stories.slice(0, 2).map(story => <article key={story.id}><small>{story.tag}</small><strong>{story.title}</strong><span>{story.detail}</span></article>)}</div>}
      </div>
    </details>
    {!career.selectedOfferId && <><button className="m-picker-button" onClick={() => setPickerOpen(true)}><span>Сменить вершину</span><b>{mountains.length} доступно ›</b></button><div className="m-section-head"><h2>Маршрут</h2></div><div className="m-route-list">{routes.map(item => { const dynamics = buildMountainDynamics(career, mountain.id, item.id); const closed = dynamics.status === 'CLOSED'; return <button key={item.id} disabled={closed} className={`${item.id === route.id ? 'is-active' : ''} is-dynamic-${dynamics.status.toLowerCase()}`} onClick={() => onSelectRoute(item.id)}><div><small>{item.style} · {dynamics.statusLabel}</small><strong>{item.name}</strong><span>{closed ? dynamics.closureReason : `${item.estimatedDecisionCount ?? 20} решений · ≈ ${item.expectedPlayMinutes ?? 20} мин · риск ${level(item.objectiveRisk)}`}</span></div><b>{closed ? '×' : item.id === route.id ? '✓' : '○'}</b></button>; })}</div></>}
    <button className="m-sticky-action" disabled={routeDynamics.status === 'CLOSED'} onClick={onContinue}><span>{routeDynamics.status === 'CLOSED' ? 'Выбери открытую линию' : career.selectedOfferId ? 'Состав экспедиции' : 'Подготовить выход'}</span><b>→</b></button>
    {pickerOpen && <div className="m-modal-layer" onClick={() => setPickerOpen(false)}><section className="m-picker-sheet" onClick={event => event.stopPropagation()}><header><div><small>РЕЕСТР ГОР</small><strong>Выбери вершину</strong></div><button onClick={() => setPickerOpen(false)}>×</button></header><div className="m-list">{mountains.map((item, index) => <button key={item.id} className={item.id === mountain.id ? 'is-active' : ''} onClick={() => chooseMountain(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.characterTitle} · техника {level(item.technicality)}</small></div><b>{item.elevation} м</b></button>)}</div></section></div>}
  </section>;
}

export function MobileTeam({ career, onToggle, onSavePermanent, onTeamStyle, onUsePermanent, onContinue, onPeople }: { career: CareerState; onToggle: (id: string) => void; onSavePermanent: () => void; onTeamStyle: (style: PermanentTeamStyle) => void; onUsePermanent: () => void; onContinue: () => void; onPeople: () => void }) {
  const team = selectedTeam(career);
  const route = getSelectedRoute(career);
  const canChoose = career.membership.permissions.canChooseTeam;
  const enough = career.membership.mode === 'INDEPENDENT' ? true : team.length + 1 >= route.recommendedTeamSize;
  const visibleRoster = canChoose ? career.teamRoster : career.teamRoster.filter(member => career.expeditionPlan.teamMemberIds.includes(member.id));
  const heroRole = roleLabel[career.expeditionPlan.playerRole];
  const permanentMembers = career.teamRoster.filter(member => career.permanentTeam.memberIds.includes(member.id));
  return <section className="m-screen m-screen--with-action">
    <StepLine step="2/4" title={canChoose ? 'Команда' : 'Состав экспедиции'} value={career.membership.mode === 'INDEPENDENT' && team.length === 0 ? 'соло' : `${team.length + 1}`} />
    <div className={`m-status-line ${enough ? 'is-good' : 'is-warning'}`}><strong>{career.membership.mode === 'INDEPENDENT' && team.length === 0 ? 'Одиночный выход' : canChoose ? (enough ? 'Состав готов' : `Нужно минимум ${route.recommendedTeamSize}`) : `Твоя роль: ${heroRole}`}</strong>{career.teamRoster.length > 0 && <button onClick={onPeople}>Досье</button>}</div>
    <section className="m-permanent-team">
      <header><div><small>ПОСТОЯННАЯ СВЯЗКА</small><strong>{career.permanentTeam.name}</strong></div><b>{career.permanentTeam.cohesion}</b></header>
      <p>{permanentMembers.length ? permanentMembers.map(member => member.name.split(' ')[0]).join(' · ') : 'Состав пока не закреплён.'}</p>
      <div className="m-permanent-team__facts"><span>{career.permanentTeam.climbs} выходов</span><span>{career.permanentTeam.summits} вершин</span><span>{career.permanentTeam.losses} потерь</span></div>
      {canChoose && <><div className="m-segmented m-segmented--team">{([['CAUTIOUS', 'Осторожно'], ['BALANCED', 'Рабоче'], ['AGGRESSIVE', 'Риск']] as Array<[PermanentTeamStyle, string]>).map(([style, label]) => <button key={style} className={career.permanentTeam.style === style ? 'is-active' : ''} onClick={() => onTeamStyle(style)}>{label}</button>)}</div><div className="m-permanent-team__actions"><button onClick={onSavePermanent} disabled={team.length === 0}>Сохранить состав</button><button onClick={onUsePermanent} disabled={!permanentMembers.length}>Взять связку</button></div></>}
    </section>
    <div className="m-person-list"><article className="is-active"><span>{initials(career.hero.name)}</span><div><strong>{career.hero.name}</strong><small>{heroRole}{career.expeditionPlan.authorityMode === 'COMMAND' ? ' · право приказов' : ' · подчиняется руководителю'}</small></div><b>✓</b></article>{visibleRoster.map(member => { const active = career.expeditionPlan.teamMemberIds.includes(member.id); const unavailable = member.status !== 'ACTIVE' || member.availability < 45; const leader = career.expeditionPlan.leaderNpcId === member.id; return <button key={member.id} disabled={!canChoose || member.required || unavailable} className={active ? 'is-active' : ''} onClick={() => onToggle(member.id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{leader ? 'Руководитель экспедиции' : roleLabel[member.role]} · {SKILL_LABELS[member.specialty]} {member.skill}/10</small></div><b>{unavailable ? '—' : active ? '✓' : '+'}</b></button>; })}</div>
    {!canChoose && career.membership.mode === 'ORGANIZATION' && !career.selectedOfferId && <div className="m-note">Состав появится после принятия заявки на чужую экспедицию.</div>}
    <button className="m-sticky-action" onClick={onContinue}><span>Снаряжение</span><b>→</b></button>
  </section>;
}

export function MobileEquipment({ career, onSetQuantity, onSetPlan, onPreset, onContinue }: { career: CareerState; onSetQuantity: (id: string, quantity: number) => void; onSetPlan: (patch: Partial<ExpeditionPlan>) => void; onPreset: (preset: 'MINIMUM' | 'RECOMMENDED') => void; onContinue: () => void }) {
  const route = getSelectedRoute(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  return <section className="m-screen m-screen--with-action">
    <StepLine step="3/4" title="Снаряжение" value={`${weight.toFixed(1)} кг · ${cost} кр.`} />
    <div className="m-preset-row"><button onClick={() => onPreset('MINIMUM')}>Минимум</button><button className="is-primary" onClick={() => onPreset('RECOMMENDED')}>Рекомендуемый</button></div>
    <div className="m-gear-list">{GEAR_CATALOG.map(item => { const quantity = career.expeditionPlan.gear[item.id] ?? 0; const required = route.requiredGearIds.includes(item.id); return <article key={item.id} className={`${quantity ? 'is-packed' : ''} ${required && !quantity ? 'is-missing' : ''}`}><div><small>{categoryLabel[item.category]}{required ? ' · обязательно' : ''}</small><strong>{item.name}</strong><span>{item.weightKg} кг · {item.unitCost} кр.</span></div><div><button onClick={() => onSetQuantity(item.id, quantity - 1)}>−</button><b>{quantity}</b><button onClick={() => onSetQuantity(item.id, quantity + 1)}>+</button></div></article>; })}</div>
    <details className="m-details"><summary>Еда, топливо и верёвка</summary><label className="m-range-line"><span>Еда <b>{career.expeditionPlan.foodDays} дн.</b></span><input type="range" min="1" max="7" value={career.expeditionPlan.foodDays} onChange={event => onSetPlan({ foodDays: Number(event.target.value) })} /></label><label className="m-range-line"><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span><input type="range" min="0" max="8" value={career.expeditionPlan.fuelUnits} onChange={event => onSetPlan({ fuelUnits: Number(event.target.value) })} /></label><label className="m-range-line"><span>Верёвка <b>{career.expeditionPlan.ropeMeters} м</b></span><input type="range" min="30" max="100" step="10" value={career.expeditionPlan.ropeMeters} onChange={event => onSetPlan({ ropeMeters: Number(event.target.value) })} /></label></details>
    <button className="m-sticky-action" onClick={onContinue}><span>Проверить выход</span><b>→</b></button>
  </section>;
}

function blockerTab(text: string): CareerTabId {
  if (/снаряж|еды|топлива|средств/i.test(text)) return 'EQUIPMENT';
  if (/группа/i.test(text)) return 'TEAM';
  if (/акклиматизац|погод/i.test(text)) return 'EXPEDITION';
  if (/утомл|форма|здоров/i.test(text)) return 'OVERVIEW';
  return 'ROUTE';
}

export function MobileExpedition({ career, difficulty, onLaunch, onOpenTab, onSelectWeather, onSetAcclimatization }: { career: CareerState; difficulty: DifficultyId; onLaunch: () => void; onOpenTab: (tab: CareerTabId) => void; onSelectWeather: (id: string) => void; onSetAcclimatization: (days: number) => void }) {
  const weather = getSelectedWeather(career);
  const readiness = expeditionReadiness(career);
  const cost = expeditionCost(career);
  const conditions = Math.round((readiness.weather + readiness.acclimatization) / 2);
  const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;
  const score = (value: number) => difficulty === 'EXPEDITION' ? (value >= 70 ? 'сильно' : value >= 50 ? 'рабоче' : 'слабо') : Math.round(value);
  const checks: Array<[string, number, CareerTabId]> = [['Герой', readiness.hero, 'OVERVIEW'], ['Команда', readiness.team, 'TEAM'], ['Груз', readiness.equipment, 'EQUIPMENT'], ['Условия', conditions, 'EXPEDITION']];

  return <section className="m-screen m-screen--with-action">
    <StepLine step="4/4" title="Выход" value={difficulty === 'EXPEDITION' ? (readiness.total >= 60 ? 'рабочий' : 'слабый') : `${readiness.total}/100`} />
    <div className={`m-status-line ${canLaunch ? 'is-good' : 'is-warning'}`}><strong>{canLaunch ? 'План готов' : `${readiness.blockers.length} проблем`}</strong><span>{cost} кр.</span></div>
    <div className="m-section-head"><h2>Погода</h2></div>
    <div className="m-weather-list">{career.weatherWindows.map(item => <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}><div><strong>{item.label}</strong><small>через {item.startsInDays} дн. · {item.temperatureC}° · {item.windKmh} км/ч</small></div><b>{item.id === weather.id ? '✓' : '○'}</b></button>)}</div>
    <label className="m-range-card m-range-card--small"><span>Акклиматизация <b>{career.expeditionPlan.acclimatizationDays} дн.</b></span><input type="range" min="0" max="9" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetAcclimatization(Number(event.target.value))} /></label>
    <div className="m-readiness-list">{checks.map(([label, value, tab]) => <button key={label} onClick={() => onOpenTab(tab)}><span>{label}</span><i><b style={{ width: `${value}%` }} /></i><strong>{score(value)}</strong></button>)}</div>
    {readiness.blockers.length > 0 && <div className="m-blocker-list">{readiness.blockers.map(item => <button key={item} onClick={() => onOpenTab(blockerTab(item))}><span>{item}</span><b>Исправить</b></button>)}</div>}
    <button className="m-sticky-action" disabled={!canLaunch} onClick={onLaunch}><span>{canLaunch ? 'Начать экспедицию' : 'План не готов'}</span><b>→</b></button>
  </section>;
}

export function MobileWorld({ world, career, onTravel }: { world: WorldState; career: CareerState; onTravel: (regionId: string) => void }) {
  const living = career.livingWorld;
  const currentRegion = careerRegion(world, career);
  const access = regionAccessList(world, career);
  const localClubs = living.clubs.filter(club => club.regionId === currentRegion.id);
  const localClubIds = new Set(localClubs.map(club => club.id));
  const localAthletes = living.athletes.filter(item => localClubIds.has(item.clubId));
  const active = localAthletes.filter(item => item.status === 'ACTIVE' && item.recoveryDays === 0).length;
  const recovering = localAthletes.filter(item => item.status === 'INJURED' || item.recoveryDays > 0).length;
  const losses = localAthletes.filter(item => item.status === 'DEAD' || item.status === 'MISSING').length;
  const latest = [...living.expeditions].filter(item => item.regionId === currentRegion.id).reverse().slice(0, 6);
  const plans = schoolExpeditionBoard(world, career, true);
  const localMountains = regionMountains(world, currentRegion.id);
  const localMountainIds = new Set(localMountains.map(item => item.id));
  return <section className="m-screen">
    <section className="m-world-region-head"><small>{currentRegion.country} · {currentRegion.rangeName}</small><strong>{currentRegion.name}</strong><span>{currentRegion.climbingSeason}</span></section>
    <div className="m-region-carousel">{access.map(({ region, current, unlocked, reputationGap, affordable, travelCost, travelDays }) => <article key={region.id} className={`${current ? 'is-current' : ''} ${!unlocked ? 'is-locked' : ''}`}><div><small>{region.country}</small><strong>{region.name}</strong><span>{region.elevationMin}–{region.elevationMax} м</span></div><button disabled={current || !unlocked || !affordable || Boolean(career.activeClimb)} onClick={() => onTravel(region.id)}>{current ? 'Здесь' : !unlocked ? `+${reputationGap} реп.` : !affordable ? 'Нет средств' : `${travelDays}д · ${travelCost} кр.`}</button></article>)}</div>
    <div className="m-state-strip"><span>В строю <b>{active}</b></span><span>Восстановление <b>{recovering}</b></span><span>Потери <b>{losses}</b></span></div>
    <div className="m-section-head"><h2>Планы школ</h2><span>{plans.length}</span></div>
    <div className="m-school-plan-list">{plans.map(plan => { const route = career.routes.find(item => item.id === plan.routeId); const leader = plan.leaderNpcId ? world.ecosystem.content.npcs.byId[plan.leaderNpcId] : null; const club = living.clubs.find(item => item.id === plan.organizationId); const phase = schoolExpeditionPhase(plan, career.seasonDay); return <article key={plan.id} className={`is-${phase.toLowerCase()}`}><small>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]} · день {plan.departureDay ?? '—'}</small><strong>{route?.mountainName ?? 'Гора'} · {route?.name ?? 'Маршрут'}</strong><span>{club?.name ?? 'Школа'} · {leader?.name ?? 'Инструктор'}</span></article>; })}</div>
    <div className="m-section-head"><h2>Школы региона</h2></div>
    <div className="m-club-list">{localClubs.slice().sort((a, b) => b.prestige - a.prestige).map(club => <article key={club.id} className={club.id === career.club.id ? 'is-player' : ''}><div><strong>{club.name}</strong><small>{SKILL_LABELS[club.focusSkill]} · {club.riskProfile === 'CAUTIOUS' ? 'осторожная' : club.riskProfile === 'AGGRESSIVE' ? 'агрессивная' : 'сбалансированная'} школа</small></div><b>{club.prestige}</b></article>)}</div>
    <div className="m-section-head"><h2>Последние выходы</h2><span>{latest.length}</span></div>
    <div className="m-world-expedition-list">{latest.map(item => { const leader = living.athletes.find(person => person.id === item.leaderAthleteId); return <article key={item.id}><div><small>{item.teamSize} чел. · {item.durationDays} дн. · отдых {item.recoveryDays} дн.</small><strong>{item.mountainName}</strong><span>{item.routeName} · {leader?.name ?? 'Группа'}</span></div><b className={`is-${item.outcome.toLowerCase()}`}>{item.outcome === 'SUMMIT' ? 'Вершина' : item.outcome === 'RETREAT' ? 'Отход' : item.outcome === 'TRAGEDY' ? 'Трагедия' : 'Авария'}</b></article>; })}</div>
    <details className="m-details"><summary>Состояние гор · {localMountains.length}</summary><div className="m-world-mountains">{living.mountainHistory.filter(history => localMountainIds.has(history.mountainId)).map((history, index) => { const mountain = world.ecosystem.content.mountains.byId[history.mountainId]; return <article key={history.mountainId}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{history.mountainName}</strong><small>{mountain?.elevation ?? 0} м · {history.firstAscentYear ? `первая ${history.firstAscentYear}` : 'не покорена'}</small></div></article>; })}</div></details>
  </section>;
}

const newsFilters: Array<{ id: 'ALL' | WorldEventType; label: string }> = [{ id: 'ALL', label: 'Все' }, { id: 'SUMMIT', label: 'Вершины' }, { id: 'RECORD', label: 'Рекорды' }, { id: 'INJURY', label: 'Аварии' }, { id: 'DEATH', label: 'Потери' }];

export function MobileNews({ career }: { career: CareerState }) {
  const [filter, setFilter] = useState<'ALL' | WorldEventType>('ALL');
  const items = useMemo(() => career.livingWorld.news.filter(item => filter === 'ALL' || item.type === filter), [career.livingWorld.news, filter]);
  return <section className="m-screen"><div className="m-chip-row">{newsFilters.map(item => <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div><div className="m-news-list">{items.map(item => <article key={item.id}><small>{item.year} · день {item.seasonDay}</small><strong>{item.headline}</strong></article>)}</div></section>;
}

export function MobileRivals({ career }: { career: CareerState }) {
  const candidates = [...career.livingWorld.athletes].filter(item => item.status === 'ACTIVE').sort((a, b) => b.fame - a.fame).slice(0, 15);
  return <section className="m-screen"><div className="m-person-list">{candidates.map(person => <article key={person.id}><span>{initials(person.name)}</span><div><strong>{person.name}</strong><small>{person.recoveryDays > 0 ? `восстановление ${person.recoveryDays} дн.` : `${person.country} · ${person.currentGoal}`}</small></div><b>{person.fame}</b></article>)}</div></section>;
}

export function MobileRecords({ career }: { career: CareerState }) {
  return <section className="m-screen"><div className="m-record-list">{career.livingWorld.records.map(record => <article key={record.id}><small>{record.year} · {record.category}</small><strong>{record.title}</strong><b>{record.value.toLocaleString('ru-RU')} {record.unit}</b><span>{record.holderName}</span></article>)}</div></section>;
}

export function MobilePeople({ career }: { career: CareerState }) {
  const [selectedId, setSelectedId] = useState(career.teamRoster[0]?.id ?? '');
  const selected = career.teamRoster.find(item => item.id === selectedId) ?? career.teamRoster[0];
  if (!selected) return null;
  const athlete = career.livingWorld.athletes.find(item => item.id === selected.id);
  return <section className="m-screen"><div className="m-chip-row m-chip-row--people">{career.teamRoster.map(person => <button key={person.id} className={person.id === selected.id ? 'is-active' : ''} onClick={() => setSelectedId(person.id)}>{person.isMentor ? '★ ' : ''}{person.name.split(' ')[0]}</button>)}</div><section className="m-person-profile"><header><span>{initials(selected.name)}</span><div><strong>{selected.name}</strong><small>{selected.isMentor ? 'Наставник · ' : ''}{roleLabel[selected.role]} · {selected.age} лет</small></div></header>{selected.isMentor && <p className="m-person-mentor">{selected.routePreference === 'EASY' ? 'Ведёт учебные маршруты.' : selected.routePreference === 'HARD' ? 'Берёт сложные технические цели.' : 'Чередует маршруты разной сложности.'}{athlete?.lastEvent ? ` ${athlete.lastEvent}` : ''}</p>}{athlete && <div className="m-person-state"><span>Состояние <b>{Math.round(athlete.condition)}</b></span><span>Усталость <b>{Math.round(athlete.fatigue)}</b></span><span>Отдых <b>{athlete.recoveryDays} дн.</b></span></div>}<div className="m-mini-grid"><span>Выносливость <b>{selected.skills.ENDURANCE}</b></span><span>Скалы <b>{selected.skills.ROCK}</b></span><span>Лёд <b>{selected.skills.ICE}</b></span><span>Навигация <b>{selected.skills.NAVIGATION}</b></span><span>Медицина <b>{selected.skills.MEDICINE}</b></span><span>Лидерство <b>{selected.skills.LEADERSHIP}</b></span></div><details className="m-details"><summary>Отношения и память</summary><p>Доверие {selected.relationship.trust} · уважение {selected.relationship.respect} · выходы {selected.sharedClimbs}</p>{[...selected.memories].reverse().map(memory => <p key={memory.id}><b>{memory.year}</b> · {memory.title}</p>)}</details></section></section>;
}

export function MobileJournal({ career }: { career: CareerState }) {
  const history = [...career.log].filter(entry => !['TRAINING', 'CLIMB', 'EXPEDITION'].includes(entry.type)).reverse();
  const progression = normalizeCareerProgression(career);
  const completedMilestones = progression.milestones.filter(item => item.completed);
  return <section className="m-screen">
    {progression.seasonHistory.length > 0 && <><div className="m-section-head"><h2>Сезоны</h2><span>{progression.seasonHistory.length}</span></div><div className="m-season-history">{[...progression.seasonHistory].reverse().map(season => <article key={season.year}><strong>{season.year}</strong><span>{season.summits}/{season.expeditions} вершин</span><span>{season.highestElevation} м</span><b>№ {season.worldRank}</b></article>)}</div></>}
    <details className="m-details m-career-milestones"><summary>Достижения · {completedMilestones.length}/{progression.milestones.length}</summary>{progression.milestones.map(item => <p key={item.id} className={item.completed ? 'is-complete' : ''}><b>{item.completed ? '✓' : '○'}</b> {item.title}</p>)}</details>
    {career.reports.length > 0 && <><div className="m-section-head"><h2>Экспедиции</h2><span>{career.reports.length}</span></div><div className="m-report-list">{[...career.reports].reverse().map(report => <article key={report.id}><div><small>{report.year} · день {report.seasonDay}</small><strong>{report.mountainName}</strong><span>{report.routeName}</span></div><b>{report.highestElevation} м</b></article>)}</div></>}
    {history.length > 0 && <><div className="m-section-head"><h2>Карьера</h2><span>{history.length}</span></div><div className="m-ledger-list">{history.map(entry => <article key={entry.id}><span>{entry.year}</span><div><small>{entry.type} · день {entry.seasonDay}</small><strong>{entry.title}</strong></div></article>)}</div></>}
  </section>;
}

