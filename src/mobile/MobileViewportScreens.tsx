import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MountainModel } from '../components/MountainModel';
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
import { activeCareerStory, careerStoryNpc } from '../core/careerStories';
import { analyzeRouteEquipment } from '../core/gearPlanning';
import { runBalanceSample } from '../core/playtest';
import { careerRegion, regionAccessList, regionMountains } from '../core/regionalCareer';
import { CAREER_TIER_LABELS, careerWorldRank, nextCareerMilestone, normalizeCareerProgression } from '../core/progression';
import { SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase, schoolOfferCanAccept } from '../core/schoolExpeditions';
import type {
  CareerState,
  CareerStoryKind,
  CareerTabId,
  ExpeditionOffer,
  ExpeditionPlan,
  PermanentTeamStyle,
  TrainingId,
  WorldEventType,
  WorldState,
} from '../core/types';

const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;
const prepTabs: Array<{ id: CareerTabId; label: string }> = [
  { id: 'ROUTE', label: 'Цель' },
  { id: 'TEAM', label: 'Команда' },
  { id: 'EQUIPMENT', label: 'Груз' },
  { id: 'EXPEDITION', label: 'Выход' },
];
const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];
const worldTabMap: Record<CareerTabId, 'OVERVIEW' | 'NEWS' | 'PEOPLE' | 'RECORDS'> = {
  WORLD: 'OVERVIEW', NEWS: 'NEWS', RIVALS: 'PEOPLE', RECORDS: 'RECORDS',
  OVERVIEW: 'OVERVIEW', ROUTE: 'OVERVIEW', TEAM: 'OVERVIEW', PEOPLE: 'PEOPLE', EQUIPMENT: 'OVERVIEW', EXPEDITION: 'OVERVIEW', CLIMB: 'OVERVIEW', JOURNAL: 'OVERVIEW', STORIES: 'OVERVIEW',
};
const expeditionRankOrder = ['NOVICE', 'MEMBER', 'SPECIALIST', 'ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'] as const;

function rankAllows(actual: CareerState['membership']['rank'], required: ExpeditionOffer['requiredRank']) {
  return expeditionRankOrder.indexOf(actual) >= expeditionRankOrder.indexOf(required);
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function compactDate(year: number, day: number) {
  return `${year} · день ${day}`;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MobileSegmentTabs<T extends string>({ items, value, onChange, ariaLabel }: {
  items: Array<{ id: T; label: string; badge?: string | number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return <nav className="mvp-tabs" aria-label={ariaLabel}>{items.map(item => <button key={item.id} className={item.id === value ? 'is-active' : ''} onClick={() => onChange(item.id)}><span>{item.label}</span>{item.badge !== undefined && <b>{item.badge}</b>}</button>)}</nav>;
}

function MobileBottomSheet({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="mvp-sheet-layer" onClick={onClose}><section className={`mvp-sheet ${wide ? 'is-wide' : ''}`} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}><header><strong>{title}</strong><button onClick={onClose} aria-label="Закрыть">×</button></header><div className="mvp-sheet__body">{children}</div></section></div>;
}

function MobileViewportFrame({ tabs, active, onTab, children, action, className = '' }: {
  tabs?: Array<{ id: string; label: string; badge?: string | number }>;
  active?: string;
  onTab?: (id: string) => void;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <section className={`mvp-screen ${className}`}>
    {tabs && active && onTab && <MobileSegmentTabs items={tabs} value={active} onChange={onTab} ariaLabel="Подразделы" />}
    <div className="mvp-screen__body">{children}</div>
    {action && <div className="mvp-actionbar">{action}</div>}
  </section>;
}

function MountainPreview({ world, career, compact = false }: { world: WorldState; career: CareerState; compact?: boolean }) {
  const route = getSelectedRoute(career);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId] ?? regionMountains(world, careerRegion(world, career).id)[0];
  if (!mountain) return <div className="mvp-mountain-empty">Гора не выбрана</div>;
  return <div className={`mvp-mountain ${compact ? 'is-compact' : ''}`}><MountainModel mountain={mountain} seed={world.config.seed} variant={compact ? 'card' : 'hero'} interactive={!compact} label={mountain.name} /><footer><div><strong>{mountain.name}</strong><span>{route.name}</span></div><b>{mountain.elevation} м</b></footer></div>;
}

export function MobileViewportOverview({ world, career, onTrain, onOpenExpedition, onWaitForDeparture, onOpenStories }: {
  world: WorldState;
  career: CareerState;
  onTrain: (id: TrainingId) => void;
  onOpenExpedition: () => void;
  onWaitForDeparture: () => void;
  onOpenStories: () => void;
}) {
  const [view, setView] = useState<'OVERVIEW' | 'TRAINING' | 'CAREER'>('OVERVIEW');
  const progression = normalizeCareerProgression(career);
  const milestone = nextCareerMilestone(career);
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const openStory = activeCareerStory(career);
  const accepted = career.acceptedOffer?.scheduleStatus !== 'CANCELLED' ? career.acceptedOffer : null;
  const waitDays = accepted?.departureDay ? Math.max(0, accepted.departureDay - career.seasonDay) : 0;
  const mainAction = career.recoveryDays > 0
    ? { title: 'Восстановление', detail: `Ещё ${career.recoveryDays} дн.`, action: () => onTrain('RECOVERY') }
    : accepted
      ? { title: waitDays > 0 ? `Выход через ${waitDays} дн.` : 'Группа готова к выходу', detail: `${route.mountainName} · ${route.name}`, action: onWaitForDeparture }
      : { title: readiness.blockers.length ? 'Закончить подготовку' : 'Экспедиция готова', detail: readiness.blockers[0] ?? route.mountainName, action: onOpenExpedition };

  return <MobileViewportFrame
    tabs={[{ id: 'OVERVIEW', label: 'Обзор' }, { id: 'TRAINING', label: 'Тренировки' }, { id: 'CAREER', label: 'Карьера' }]}
    active={view}
    onTab={id => setView(id as typeof view)}
    className="mvp-hq"
  >
    {view === 'OVERVIEW' && <>
      <button className="mvp-primary-card" onClick={mainAction.action}><div><small>ГЛАВНОЕ СЕЙЧАС</small><strong>{mainAction.title}</strong><span>{mainAction.detail}</span></div><b>→</b></button>
      <div className="mvp-stat-strip"><span>Здоровье <b>{Math.round(career.hero.health)}</b></span><span>Форма <b>{Math.round(career.hero.form)}</b></span><span>Усталость <b>{Math.round(career.hero.fatigue)}</b></span><span>Готовность <b>{readiness.total}</b></span></div>
      <MountainPreview world={world} career={career} />
      <button className={`mvp-story-line ${openStory ? 'has-story' : ''}`} onClick={onOpenStories}><div><small>{openStory ? 'ТРЕБУЕТ РЕШЕНИЯ' : 'ИСТОРИИ КАРЬЕРЫ'}</small><strong>{openStory?.title ?? 'Сейчас никто не требует ответа'}</strong></div><b>›</b></button>
    </>}

    {view === 'TRAINING' && <div className="mvp-training-grid">{trainingOrder.map(id => {
      const action = TRAINING_ACTIONS[id];
      const disabled = (action.cost > 0 && career.hero.money < action.cost) || (career.recoveryDays > 0 && id !== 'RECOVERY');
      return <button key={id} disabled={disabled} onClick={() => onTrain(id)}><span>{action.days}д</span><strong>{action.title}</strong><small>{action.skill && action.xp ? `${SKILL_LABELS[action.skill]} +${action.xp}` : `форма ${signed(action.form)}`}</small><b>{action.cost < 0 ? '+' : '−'}{Math.abs(action.cost)} кр.</b></button>;
    })}</div>}

    {view === 'CAREER' && <div className="mvp-career-grid">
      <article><small>УРОВЕНЬ</small><strong>{CAREER_TIER_LABELS[progression.tier]}</strong><span>№ {careerWorldRank(career)} в мире</span></article>
      <article><small>СЕЗОН</small><strong>{progression.seasonNumber}</strong><span>{career.completedClimbs} завершённых выходов</span></article>
      <article className="is-wide"><small>СЛЕДУЮЩАЯ ЦЕЛЬ</small><strong>{milestone?.title ?? 'Карьерная вершина достигнута'}</strong><span>{milestone?.description ?? 'Продолжай строить наследие команды.'}</span></article>
      <article className="is-wide"><small>НАВЫКИ</small><div className="mvp-skill-chips">{Object.entries(career.hero.skills).map(([skill, value]) => <span key={skill}>{SKILL_LABELS[skill as keyof typeof SKILL_LABELS]} <b>{value}</b></span>)}</div></article>
    </div>}
  </MobileViewportFrame>;
}

type PrepCallbacks = {
  onAcceptOffer: (id: string) => void;
  onSelectMountain: (id: string) => void;
  onSelectRoute: (id: string) => void;
  onToggleMember: (id: string) => void;
  onSetGearQuantity: (id: string, quantity: number) => void;
  onSetPlan: (patch: Partial<ExpeditionPlan>) => void;
  onPreset: (preset: 'MINIMUM' | 'RECOMMENDED') => void;
  onSelectWeather: (id: string) => void;
  onLaunch: () => void;
  onWaitForDeparture: () => void;
  onOpenPeople: () => void;
  onSavePermanent: () => void;
  onUsePermanent: () => void;
  onTeamStyle: (style: PermanentTeamStyle) => void;
};

export function MobileViewportPreparation({ world, career, activeTab, launchMessage, onTab, ...actions }: {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  launchMessage: string | null;
  onTab: (tab: CareerTabId) => void;
} & PrepCallbacks) {
  const schoolMode = !career.membership.permissions.canChooseRoute;
  if (schoolMode) return <MobileSchoolExpedition world={world} career={career} launchMessage={launchMessage} {...actions} />;
  return <MobileIndependentPreparation world={world} career={career} activeTab={activeTab} launchMessage={launchMessage} onTab={onTab} {...actions} />;
}

function MobileSchoolExpedition({ world, career, launchMessage, onAcceptOffer, onWaitForDeparture, onOpenPeople }: {
  world: WorldState;
  career: CareerState;
  launchMessage: string | null;
  onAcceptOffer: (id: string) => void;
  onWaitForDeparture: () => void;
  onOpenPeople: () => void;
} & Partial<PrepCallbacks>) {
  const [view, setView] = useState<'PLANS' | 'MY'>((career.selectedOfferId ? 'MY' : 'PLANS'));
  const [planOpen, setPlanOpen] = useState(false);
  const offers = schoolExpeditionBoard(world, career);
  const accepted = career.acceptedOffer;
  const route = getSelectedRoute(career);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId];
  const leader = accepted?.leaderNpcId ? world.ecosystem.content.npcs.byId[accepted.leaderNpcId] : null;
  const waitDays = accepted?.departureDay ? Math.max(0, accepted.departureDay - career.seasonDay) : 0;

  useEffect(() => { if (career.selectedOfferId) setView('MY'); }, [career.selectedOfferId]);

  const renderPlan = (offer: ExpeditionOffer) => {
    const offerRoute = world.ecosystem.content.routes.byId[offer.routeId] ?? career.routes.find(item => item.id === offer.routeId);
    const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null;
    const instructor = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
    const phase = schoolExpeditionPhase(offer, career.seasonDay);
    const rankOk = rankAllows(career.membership.rank, offer.requiredRank);
    const available = rankOk && schoolOfferCanAccept(offer, career.seasonDay);
    return <button key={offer.id} className={career.selectedOfferId === offer.id ? 'is-active' : ''} disabled={!available && career.selectedOfferId !== offer.id} onClick={() => onAcceptOffer?.(offer.id)}><div><small>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]} · {instructor?.name ?? 'Инструктор'}</small><strong>{offerMountain?.name ?? offerRoute?.mountainName}</strong><span>{offerRoute?.name} · выход день {offer.departureDay ?? '—'}</span></div><b>{career.selectedOfferId === offer.id ? '✓' : available ? '›' : '—'}</b></button>;
  };

  return <MobileViewportFrame
    tabs={[{ id: 'PLANS', label: 'Планы', badge: offers.length }, { id: 'MY', label: 'Мой выход', badge: career.selectedOfferId ? '✓' : undefined }]}
    active={view}
    onTab={id => setView(id as typeof view)}
    className="mvp-school"
    action={view === 'MY' && accepted && accepted.scheduleStatus !== 'CANCELLED' ? <button className="mvp-main-action" onClick={onWaitForDeparture}><span>{waitDays > 0 ? `Подождать ${waitDays} дн. и начать` : 'Начать экспедицию'}</span><b>→</b></button> : undefined}
  >
    {view === 'PLANS' && <div className="mvp-plan-list">{offers.length ? offers.map(renderPlan) : <div className="mvp-empty"><strong>Новых планов нет</strong><span>Тренируйся или продвинь время — инструкторы обновляют доску постоянно.</span></div>}</div>}
    {view === 'MY' && accepted && mountain && <>
      <MountainPreview world={world} career={career} compact />
      <section className="mvp-assigned-plan"><header><div><small>РУКОВОДИТЕЛЬ</small><strong>{leader?.name ?? 'Инструктор школы'}</strong></div><button onClick={() => setPlanOpen(true)}>План</button></header><div className="mvp-plan-facts"><span>Роль <b>{roleLabel[career.expeditionPlan.playerRole]}</b></span><span>Состав <b>{accepted.memberNpcIds.length + 1}</b></span><span>Выход <b>{waitDays > 0 ? `через ${waitDays} дн.` : 'сегодня'}</b></span><span>Готовность <b>{accepted.preparationProgress ?? 0}%</b></span></div><button className="mvp-inline-link" onClick={onOpenPeople}>Посмотреть людей →</button></section>
      {launchMessage && <div className="mvp-alert">{launchMessage}</div>}
    </>}
    {view === 'MY' && !accepted && <div className="mvp-empty"><strong>План ещё не выбран</strong><span>Открой «Планы» и подай заявку на подходящий выход.</span><button onClick={() => setView('PLANS')}>Открыть планы</button></div>}
    <MobileBottomSheet open={planOpen} title="План инструктора" onClose={() => setPlanOpen(false)}><div className="mvp-detail-list"><span><b>Маршрут</b>{route.mountainName} · {route.name}</span><span><b>Погода</b>{getSelectedWeather(career).label}</span><span><b>Ночёвки</b>{Math.max(0, Math.ceil(route.estimatedHours / 12) - 1)}</span><span><b>Верёвка</b>{career.expeditionPlan.ropeMeters} м</span><span><b>Брифинг</b>{accepted?.briefing ?? 'Инструктор ещё не выдал подробности.'}</span></div></MobileBottomSheet>
  </MobileViewportFrame>;
}

function MobileIndependentPreparation({ world, career, activeTab, launchMessage, onTab, onSelectMountain, onSelectRoute, onToggleMember, onSetGearQuantity, onSetPlan, onPreset, onSelectWeather, onLaunch, onOpenPeople, onSavePermanent, onUsePermanent, onTeamStyle }: {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  launchMessage: string | null;
  onTab: (tab: CareerTabId) => void;
} & PrepCallbacks) {
  const current = prepTabs.some(item => item.id === activeTab) ? activeTab : 'ROUTE';
  const [picker, setPicker] = useState<'MOUNTAIN' | 'ROUTE' | 'TEAM' | 'GEAR' | 'BLOCKERS' | null>(null);
  const [gearView, setGearView] = useState<'CORE' | 'SUPPLIES' | 'RESERVE'>('CORE');
  const route = getSelectedRoute(career);
  const region = careerRegion(world, career);
  const mountains = regionMountains(world, region.id);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId] ?? mountains[0];
  const routes = routesForMountain(career, route.mountainId);
  const team = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const analysis = analyzeRouteEquipment(route, career.expeditionPlan, team.length + 1);
  const weather = getSelectedWeather(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  const blockers = readiness.blockers;
  const categories: Record<typeof gearView, string[]> = {
    CORE: ['rope', 'rock-kit', 'ice-kit', 'tent'],
    SUPPLIES: ['stove', 'medkit'],
    RESERVE: ['bivy', 'radio'],
  };
  const visibleGear = GEAR_CATALOG.filter(item => categories[gearView].includes(item.id));
  const nextTab = current === 'ROUTE' ? 'TEAM' : current === 'TEAM' ? 'EQUIPMENT' : current === 'EQUIPMENT' ? 'EXPEDITION' : null;

  const action = current === 'EXPEDITION'
    ? <button className="mvp-main-action" disabled={Boolean(blockers.length)} onClick={onLaunch}><span>{blockers.length ? 'План не готов' : 'Начать экспедицию'}</span><b>→</b></button>
    : <button className="mvp-main-action" onClick={() => onTab(nextTab!)}><span>Далее</span><b>→</b></button>;

  return <MobileViewportFrame tabs={prepTabs} active={current} onTab={id => onTab(id as CareerTabId)} action={action} className="mvp-preparation">
    {current === 'ROUTE' && mountain && <>
      <MountainPreview world={world} career={career} />
      <div className="mvp-selector-row"><button onClick={() => setPicker('MOUNTAIN')}><small>ГОРА</small><strong>{mountain.name}</strong><span>{mountain.elevation} м</span></button><button onClick={() => setPicker('ROUTE')}><small>МАРШРУТ</small><strong>{route.name}</strong><span>риск {route.objectiveRisk}</span></button></div>
      <div className="mvp-stat-strip"><span>Время <b>{route.estimatedHours}ч</b></span><span>Техника <b>{route.technicality}</b></span><span>Риск <b>{route.objectiveRisk}</b></span><span>Группа <b>{route.recommendedTeamSize}+</b></span></div>
    </>}

    {current === 'TEAM' && <>
      <section className="mvp-team-summary"><header><div><small>ПОСТОЯННАЯ СВЯЗКА</small><strong>{career.permanentTeam.name}</strong></div><b>{career.permanentTeam.cohesion}</b></header><div className="mvp-avatars"><span className="is-hero">{initials(career.hero.name)}</span>{team.slice(0, 5).map(member => <span key={member.id}>{initials(member.name)}</span>)}</div><div className="mvp-plan-facts"><span>Люди <b>{team.length + 1}</b></span><span>Слаженность <b>{career.permanentTeam.cohesion}</b></span><span>Стиль <b>{career.permanentTeam.style === 'CAUTIOUS' ? 'осторожный' : career.permanentTeam.style === 'AGGRESSIVE' ? 'рисковый' : 'рабочий'}</b></span></div><div className="mvp-inline-actions"><button onClick={() => setPicker('TEAM')}>Изменить состав</button><button onClick={onOpenPeople}>Досье</button></div></section>
      <div className="mvp-style-row">{([['CAUTIOUS', 'Осторожно'], ['BALANCED', 'Рабоче'], ['AGGRESSIVE', 'Риск']] as Array<[PermanentTeamStyle, string]>).map(([style, label]) => <button key={style} className={career.permanentTeam.style === style ? 'is-active' : ''} onClick={() => onTeamStyle(style)}>{label}</button>)}</div>
      <div className="mvp-inline-actions"><button onClick={onSavePermanent}>Сохранить состав</button><button onClick={onUsePermanent}>Взять связку</button></div>
    </>}

    {current === 'EQUIPMENT' && <>
      <div className="mvp-gear-head"><div><small>ГРУЗ НА ЧЕЛОВЕКА</small><strong>{weight.toFixed(1)} кг</strong></div><div><small>ВЕРЁВКА</small><strong>{analysis.plannedRopeMeters} м</strong></div><div><small>НОЧЁВКИ</small><strong>{analysis.expectedNights}</strong></div></div>
      <MobileSegmentTabs items={[{ id: 'CORE', label: 'Основное' }, { id: 'SUPPLIES', label: 'Запасы' }, { id: 'RESERVE', label: 'Резерв' }]} value={gearView} onChange={setGearView} ariaLabel="Категории груза" />
      <div className="mvp-gear-list">{visibleGear.map(item => { const quantity = career.expeditionPlan.gear[item.id] ?? 0; const need = analysis.needs[item.id]; return <article key={item.id} className={need?.tone ? `is-${need.tone.toLowerCase()}` : ''}><button className="mvp-gear-info" onClick={() => setPicker('GEAR')}><small>{need?.opens ?? item.description}</small><strong>{item.name}</strong><span>{item.weightKg} кг · {need ? `нужно ${need.minimum}, рек. ${need.recommended}` : item.description}</span></button><div><button onClick={() => onSetGearQuantity(item.id, quantity - 1)}>−</button><b>{quantity}</b><button onClick={() => onSetGearQuantity(item.id, quantity + 1)}>+</button></div></article>; })}</div>
      <div className="mvp-supply-row"><label><span>Еда <b>{career.expeditionPlan.foodDays}д</b></span><input type="range" min="1" max="10" value={career.expeditionPlan.foodDays} onChange={event => onSetPlan({ foodDays: Number(event.target.value) })} /></label><label><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span><input type="range" min="0" max="10" value={career.expeditionPlan.fuelUnits} onChange={event => onSetPlan({ fuelUnits: Number(event.target.value) })} /></label></div>
      <div className="mvp-inline-actions"><button onClick={() => onPreset('MINIMUM')}>Минимум</button><button className="is-primary" onClick={() => onPreset('RECOMMENDED')}>Рекомендуемый</button></div>
    </>}

    {current === 'EXPEDITION' && <>
      <div className="mvp-weather-row">{career.weatherWindows.map(item => <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}><strong>{item.label}</strong><span>{item.temperatureC}° · {item.windKmh} км/ч</span></button>)}</div>
      <section className="mvp-acclimatization"><span>Акклиматизация</span><div><button onClick={() => onSetPlan({ acclimatizationDays: Math.max(0, career.expeditionPlan.acclimatizationDays - 1) })}>−</button><b>{career.expeditionPlan.acclimatizationDays} дней</b><button onClick={() => onSetPlan({ acclimatizationDays: Math.min(12, career.expeditionPlan.acclimatizationDays + 1) })}>+</button></div></section>
      <section className={`mvp-readiness ${blockers.length ? 'is-warning' : 'is-good'}`}><div><small>ГОТОВНОСТЬ</small><strong>{readiness.total}/100</strong><span>{blockers[0] ?? 'Группа и груз готовы к выходу.'}</span></div><b>{cost} кр.</b></section>
      {blockers.length > 1 && <button className="mvp-blocker-link" onClick={() => setPicker('BLOCKERS')}>Ещё {blockers.length - 1} проблемы →</button>}
      {launchMessage && <div className="mvp-alert">{launchMessage}</div>}
    </>}

    <MobileBottomSheet open={picker === 'MOUNTAIN'} title="Выбери вершину" onClose={() => setPicker(null)} wide><div className="mvp-picker-list">{mountains.map(item => <button key={item.id} className={item.id === mountain?.id ? 'is-active' : ''} onClick={() => { onSelectMountain(item.id); setPicker(null); }}><div><strong>{item.name}</strong><span>{item.characterTitle} · {item.elevation} м</span></div><b>›</b></button>)}</div></MobileBottomSheet>
    <MobileBottomSheet open={picker === 'ROUTE'} title="Выбери маршрут" onClose={() => setPicker(null)}><div className="mvp-picker-list">{routes.map(item => <button key={item.id} className={item.id === route.id ? 'is-active' : ''} onClick={() => { onSelectRoute(item.id); setPicker(null); }}><div><strong>{item.name}</strong><span>{item.style} · риск {item.objectiveRisk} · {item.estimatedHours}ч</span></div><b>›</b></button>)}</div></MobileBottomSheet>
    <MobileBottomSheet open={picker === 'TEAM'} title="Состав экспедиции" onClose={() => setPicker(null)} wide><div className="mvp-picker-list mvp-picker-list--people">{career.teamRoster.map(member => { const active = career.expeditionPlan.teamMemberIds.includes(member.id); const unavailable = member.status !== 'ACTIVE' || member.availability < 45; return <button key={member.id} disabled={unavailable} className={active ? 'is-active' : ''} onClick={() => onToggleMember(member.id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{roleLabel[member.role]} · {SKILL_LABELS[member.specialty]} {member.skill}/10</small></div><b>{active ? '✓' : unavailable ? '—' : '+'}</b></button>; })}</div></MobileBottomSheet>
    <MobileBottomSheet open={picker === 'GEAR'} title="Как работает снаряжение" onClose={() => setPicker(null)}><div className="mvp-detail-list">{Object.values(analysis.needs).map(need => <span key={need.gearId}><b>{GEAR_CATALOG.find(item => item.id === need.gearId)?.name ?? need.gearId}</b>{need.effect}<small>Без предмета: {need.without}</small></span>)}</div></MobileBottomSheet>
    <MobileBottomSheet open={picker === 'BLOCKERS'} title="Что мешает выходу" onClose={() => setPicker(null)}><div className="mvp-detail-list">{blockers.map(item => <span key={item}><b>Проблема</b>{item}</span>)}</div></MobileBottomSheet>
  </MobileViewportFrame>;
}

export function MobileViewportWorld({ world, career, activeTab, onTab, onTravel }: { world: WorldState; career: CareerState; activeTab: CareerTabId; onTab: (tab: CareerTabId) => void; onTravel: (regionId: string) => void }) {
  const view = worldTabMap[activeTab] ?? 'OVERVIEW';
  const [regionSheet, setRegionSheet] = useState(false);
  const [newsFilter, setNewsFilter] = useState<'ALL' | WorldEventType>('ALL');
  const currentRegion = careerRegion(world, career);
  const access = regionAccessList(world, career);
  const plans = schoolExpeditionBoard(world, career, true).slice(0, 3);
  const latestExpedition = [...career.livingWorld.expeditions].filter(item => item.regionId === currentRegion.id).reverse()[0];
  const news = career.livingWorld.news.filter(item => newsFilter === 'ALL' || item.type === newsFilter).slice(0, 8);
  const people = [...career.livingWorld.athletes].filter(item => item.status === 'ACTIVE').sort((a, b) => b.fame - a.fame).slice(0, 10);
  const records = career.livingWorld.records.slice(0, 10);
  const localClubIds = new Set(career.livingWorld.clubs.filter(item => item.regionId === currentRegion.id).map(item => item.id));
  const localAthleteCount = career.livingWorld.athletes.filter(item => localClubIds.has(item.clubId) && item.status === 'ACTIVE').length;
  const tabToCareer: Record<typeof view, CareerTabId> = { OVERVIEW: 'WORLD', NEWS: 'NEWS', PEOPLE: 'RIVALS', RECORDS: 'RECORDS' };

  return <MobileViewportFrame tabs={[{ id: 'OVERVIEW', label: 'Обзор' }, { id: 'NEWS', label: 'Новости' }, { id: 'PEOPLE', label: 'Люди' }, { id: 'RECORDS', label: 'Рекорды' }]} active={view} onTab={id => onTab(tabToCareer[id as typeof view])} className="mvp-world">
    {view === 'OVERVIEW' && <>
      <button className="mvp-region-card" onClick={() => setRegionSheet(true)}><div><small>{currentRegion.country} · {currentRegion.rangeName}</small><strong>{currentRegion.name}</strong><span>{currentRegion.climbingSeason}</span></div><b>Сменить ›</b></button>
      <div className="mvp-world-summary"><span>Школы <b>{career.livingWorld.clubs.filter(item => item.regionId === currentRegion.id).length}</b></span><span>Планы <b>{plans.length}</b></span><span>Альпинисты <b>{localAthleteCount}</b></span></div>
      <div className="mvp-compact-heading"><strong>Планы школ</strong><span>{plans.length}</span></div>
      <div className="mvp-mini-plans">{plans.map(plan => { const route = career.routes.find(item => item.id === plan.routeId); const leader = plan.leaderNpcId ? world.ecosystem.content.npcs.byId[plan.leaderNpcId] : null; return <article key={plan.id}><small>{SCHOOL_EXPEDITION_PHASE_LABELS[schoolExpeditionPhase(plan, career.seasonDay)]}</small><strong>{route?.mountainName}</strong><span>{leader?.name ?? 'Инструктор'} · день {plan.departureDay ?? '—'}</span></article>; })}</div>
      {latestExpedition && <article className="mvp-latest-expedition"><small>ПОСЛЕДНИЙ ВЫХОД</small><strong>{latestExpedition.mountainName}</strong><span>{latestExpedition.routeName} · {latestExpedition.outcome}</span></article>}
    </>}

    {view === 'NEWS' && <><div className="mvp-chip-row">{(['ALL', 'SUMMIT', 'RECORD', 'INJURY', 'DEATH'] as const).map(id => <button key={id} className={newsFilter === id ? 'is-active' : ''} onClick={() => setNewsFilter(id)}>{id === 'ALL' ? 'Все' : id === 'SUMMIT' ? 'Вершины' : id === 'RECORD' ? 'Рекорды' : id === 'INJURY' ? 'Аварии' : 'Потери'}</button>)}</div><div className="mvp-scroll-list">{news.map(item => <article key={item.id}><small>{compactDate(item.year, item.seasonDay)} · {item.type}</small><strong>{item.headline}</strong><span>{item.summary}</span></article>)}</div></>}

    {view === 'PEOPLE' && <div className="mvp-scroll-list mvp-people-ranking">{people.map((person, index) => <article key={person.id}><b>{String(index + 1).padStart(2, '0')}</b><span>{initials(person.name)}</span><div><strong>{person.name}</strong><small>{person.country} · {person.currentGoal}</small></div><em>{person.fame}</em></article>)}</div>}

    {view === 'RECORDS' && <div className="mvp-scroll-list">{records.map(record => <article key={record.id}><small>{record.year} · {record.category}</small><strong>{record.title}</strong><span>{record.holderName}</span><b>{record.value.toLocaleString('ru-RU')} {record.unit}</b></article>)}</div>}

    <MobileBottomSheet open={regionSheet} title="Горные регионы" onClose={() => setRegionSheet(false)} wide><div className="mvp-picker-list">{access.map(item => <button key={item.region.id} disabled={item.current || !item.unlocked || !item.affordable || Boolean(career.activeClimb)} className={item.current ? 'is-active' : ''} onClick={() => { onTravel(item.region.id); setRegionSheet(false); }}><div><strong>{item.region.country} · {item.region.name}</strong><span>{item.region.elevationMin}–{item.region.elevationMax} м · {item.region.climbingSeason}</span></div><b>{item.current ? 'Здесь' : !item.unlocked ? `+${item.reputationGap} реп.` : `${item.travelDays}д · ${item.travelCost} кр.`}</b></button>)}</div></MobileBottomSheet>
  </MobileViewportFrame>;
}

export function MobileViewportPeople({ career }: { career: CareerState }) {
  const [selectedId, setSelectedId] = useState(career.teamRoster[0]?.id ?? '');
  const [view, setView] = useState<'PROFILE' | 'SKILLS' | 'RELATIONS' | 'MEMORY'>('PROFILE');
  const person = career.teamRoster.find(item => item.id === selectedId) ?? career.teamRoster[0];
  if (!person) return <MobileViewportFrame><div className="mvp-empty"><strong>Команда пуста</strong><span>Люди появятся после вступления в школу.</span></div></MobileViewportFrame>;
  const athlete = career.livingWorld.athletes.find(item => item.id === person.id);
  return <MobileViewportFrame tabs={[{ id: 'PROFILE', label: 'Профиль' }, { id: 'SKILLS', label: 'Навыки' }, { id: 'RELATIONS', label: 'Отношения' }, { id: 'MEMORY', label: 'Память' }]} active={view} onTab={id => setView(id as typeof view)} className="mvp-dossier">
    <div className="mvp-person-strip">{career.teamRoster.map(item => <button key={item.id} className={item.id === person.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}><span>{initials(item.name)}</span><small>{item.name.split(' ')[0]}</small></button>)}</div>
    <section className="mvp-person-card"><header><span>{initials(person.name)}</span><div><small>{person.isMentor ? 'НАСТАВНИК' : roleLabel[person.role].toUpperCase()}</small><strong>{person.name}</strong><em>{person.age} лет · {SKILL_LABELS[person.specialty]}</em></div></header>
      {view === 'PROFILE' && <div className="mvp-profile-copy"><p>{person.note}</p><div className="mvp-stat-strip"><span>Состояние <b>{Math.round(athlete?.condition ?? person.condition)}</b></span><span>Усталость <b>{Math.round(athlete?.fatigue ?? 0)}</b></span><span>Доступность <b>{person.availability}</b></span><span>Вершины <b>{person.summits}</b></span></div><p>{athlete?.lastEvent ?? person.personalGoal}</p></div>}
      {view === 'SKILLS' && <div className="mvp-skill-list">{Object.entries(person.skills).map(([skill, value]) => <div key={skill}><span>{SKILL_LABELS[skill as keyof typeof SKILL_LABELS]}</span><i><b style={{ width: `${value * 10}%` }} /></i><strong>{value}/10</strong></div>)}</div>}
      {view === 'RELATIONS' && <div className="mvp-relation-grid">{Object.entries(person.relationship).map(([key, value]) => <span key={key}>{key === 'trust' ? 'Доверие' : key === 'respect' ? 'Уважение' : key === 'bond' ? 'Связь' : key === 'rivalry' ? 'Соперничество' : key === 'resentment' ? 'Обида' : 'Долг'}<b>{value}</b></span>)}</div>}
      {view === 'MEMORY' && <div className="mvp-scroll-list">{[...person.memories].reverse().slice(0, 12).map(memory => <article key={memory.id}><small>{memory.year} · день {memory.seasonDay}</small><strong>{memory.title}</strong><span>{memory.description}</span></article>)}</div>}
    </section>
  </MobileViewportFrame>;
}

const storyKindLabel: Record<CareerStoryKind, string> = { INVITATION: 'Приглашение', RIVALRY: 'Соперничество', MENTOR: 'Наставник', TEAM: 'Связка', CLUB: 'Школа', TRANSFER: 'Переход' };

export function MobileViewportStories({ career, onResolve, onRead }: { career: CareerState; onResolve: (eventId: string, choiceId: string) => void; onRead: () => void }) {
  const [view, setView] = useState<'DECISION' | 'ARCS' | 'TIMELINE'>('DECISION');
  const open = activeCareerStory(career);
  const arcs = career.storyState.arcs.filter(item => item.status === 'ACTIVE');
  const timeline = [...career.storyState.events].reverse();
  useEffect(() => { if (career.storyState.unreadCount > 0) onRead(); }, [career.storyState.unreadCount, onRead]);
  return <MobileViewportFrame tabs={[{ id: 'DECISION', label: 'Решение', badge: open ? '!' : undefined }, { id: 'ARCS', label: 'Линии', badge: arcs.length }, { id: 'TIMELINE', label: 'Хроника', badge: timeline.length }]} active={view} onTab={id => setView(id as typeof view)} className="mvp-stories">
    {view === 'DECISION' && (open ? <section className="mvp-story-decision"><small>{storyKindLabel[open.kind]} · этап {open.stage + 1}</small><h2>{open.title}</h2><p>{open.summary}</p><div className="mvp-avatars">{open.npcIds.map(id => { const person = careerStoryNpc(career, id); return person ? <span key={id}>{initials(person.name)}</span> : null; })}</div><p>{open.detail}</p><div className="mvp-story-choices">{open.choices.map((choice, index) => <button key={choice.id} onClick={() => onResolve(open.id, choice.id)}><span>{index + 1}</span><div><strong>{choice.title}</strong><small>{choice.detail}</small></div><b>→</b></button>)}</div></section> : <div className="mvp-empty"><strong>Сейчас тихо</strong><span>Новые истории появляются после тренировок, переходов и экспедиций.</span></div>)}
    {view === 'ARCS' && <div className="mvp-scroll-list">{arcs.map(arc => <article key={arc.id}><small>{storyKindLabel[arc.kind]} · этап {arc.stage + 1}</small><strong>{arc.title}</strong><span>{arc.npcIds.map(id => careerStoryNpc(career, id)?.name).filter(Boolean).join(' · ') || 'Карьера'}</span></article>)}</div>}
    {view === 'TIMELINE' && <div className="mvp-scroll-list">{timeline.map(event => <article key={event.id}><small>{compactDate(event.year, event.seasonDay)} · {storyKindLabel[event.kind]}</small><strong>{event.title}</strong><span>{event.outcome ?? event.summary}</span><b>{event.status === 'OPEN' ? 'ЖДЁТ' : event.status === 'EXPIRED' ? 'УПУЩЕНО' : 'РЕШЕНО'}</b></article>)}</div>}
  </MobileViewportFrame>;
}

export function MobileViewportArchive({ world, career }: { world: WorldState; career: CareerState }) {
  const [view, setView] = useState<'REPORTS' | 'SEASONS' | 'CAREER' | 'DATA'>('REPORTS');
  const progression = normalizeCareerProgression(career);
  const reports = [...career.reports].reverse();
  const history = [...career.log].reverse();
  const safeName = career.hero.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  return <MobileViewportFrame tabs={[{ id: 'REPORTS', label: 'Экспедиции', badge: reports.length }, { id: 'SEASONS', label: 'Сезоны', badge: progression.seasonHistory.length }, { id: 'CAREER', label: 'Карьера' }, { id: 'DATA', label: 'Данные' }]} active={view} onTab={id => setView(id as typeof view)} className="mvp-archive">
    {view === 'REPORTS' && <div className="mvp-scroll-list mvp-report-list">{reports.length ? reports.map(report => <article key={report.id} className={`is-${report.outcome.toLowerCase()}`}><small>{compactDate(report.year, report.seasonDay)} · {report.outcome}</small><strong>{report.mountainName}</strong><span>{report.routeName}</span><b>{report.highestElevation} м</b></article>) : <div className="mvp-empty"><strong>Экспедиций ещё нет</strong><span>Первый отчёт появится после возвращения с маршрута.</span></div>}</div>}
    {view === 'SEASONS' && <div className="mvp-scroll-list">{[...progression.seasonHistory].reverse().map(season => <article key={season.year}><small>СЕЗОН {season.year}</small><strong>{season.summits}/{season.expeditions} вершин</strong><span>{season.highestElevation} м · травмы {season.injuries} · потери {season.losses}</span><b>№ {season.worldRank}</b></article>)}</div>}
    {view === 'CAREER' && <div className="mvp-scroll-list">{history.slice(0, 30).map(entry => <article key={entry.id}><small>{compactDate(entry.year, entry.seasonDay)} · {entry.type}</small><strong>{entry.title}</strong><span>{entry.description}</span></article>)}</div>}
    {view === 'DATA' && <div className="mvp-data-actions">
      <button onClick={() => downloadJson(`alpine-legacy-${safeName}-save.json`, { world, career })}><div><strong>Экспортировать сохранение</strong><span>Полное состояние мира и карьеры</span></div><b>→</b></button>
      <button onClick={() => downloadJson(`alpine-legacy-${safeName}-replay.json`, { seed: world.config.seed, activeClimb: career.activeClimb, reports: career.reports })}><div><strong>Экспортировать историю</strong><span>Seed, решения и отчёты экспедиций</span></div><b>→</b></button>
      <details className="mvp-developer-data"><summary>Инструменты разработки</summary><div><button onClick={() => navigator.clipboard?.writeText(world.config.seed)}><strong>Копировать seed</strong><span>{world.config.seed}</span></button><button onClick={() => downloadJson(`alpine-legacy-${safeName}-balance-sample.json`, runBalanceSample(world.config.seed, 8, world.config.difficulty))}><strong>Balance sample</strong><span>24 детерминированных автопрохода</span></button></div></details>
    </div>}
  </MobileViewportFrame>;
}
