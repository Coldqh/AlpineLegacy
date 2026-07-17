import { useMemo, useState } from 'react';
import { MountainModel } from '../components/MountainModel';
import {
  GEAR_CATALOG,
  expeditionCost,
  expeditionReadiness,
  expeditionWeight,
  getSelectedRoute,
  getSelectedWeather,
  routesForMountain,
  selectedTeam,
} from '../core/career';
import { analyzeRouteEquipment, ROPE_BUNDLE_METERS } from '../core/gearPlanning';
import { daysUntilSchoolDeparture, SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase, schoolOfferCanAccept } from '../core/schoolExpeditions';
import type { CareerState, ExpeditionOffer, ExpeditionPlan, MountainData, WorldState } from '../core/types';

type PrepStage = 'TARGET' | 'TEAM' | 'GEAR' | 'LAUNCH';

type Props = {
  world: WorldState;
  career: CareerState;
  offers: ExpeditionOffer[];
  onAcceptOffer: (offerId: string) => void;
  onSelectMountain: (mountainId: string) => void;
  onSelectRoute: (routeId: string) => void;
  onToggleMember: (memberId: string) => void;
  onSetGearQuantity: (gearId: string, quantity: number) => void;
  onSetPlan: (patch: Partial<ExpeditionPlan>) => void;
  onPreset: (preset: 'MINIMUM' | 'RECOMMENDED') => void;
  onSelectWeather: (windowId: string) => void;
  onOpenPeople: () => void;
  onLaunch: () => void;
  onWaitForDeparture: () => void;
  launchMessage?: string | null;
};

const stages: Array<{ id: PrepStage; index: string; title: string }> = [
  { id: 'TARGET', index: '01', title: 'Цель' },
  { id: 'TEAM', index: '02', title: 'Команда' },
  { id: 'GEAR', index: '03', title: 'Груз' },
  { id: 'LAUNCH', index: '04', title: 'Выход' },
];

const roleLabel = {
  LEADER: 'Руководитель',
  ROPE_LEAD: 'Ведущий',
  MEDIC: 'Медик',
  NAVIGATOR: 'Навигатор',
  SUPPORT: 'Участник',
} as const;

function mountainScore(mountain: MountainData) {
  return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32;
}

function riskLabel(value: number) {
  if (value < 38) return 'низкий';
  if (value < 58) return 'средний';
  if (value < 76) return 'высокий';
  return 'предельный';
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function nextStage(stage: PrepStage): PrepStage {
  const index = stages.findIndex(item => item.id === stage);
  return stages[Math.min(stages.length - 1, index + 1)]!.id;
}

function SchoolBoard({ world, career, offers, onAcceptOffer }: Pick<Props, 'world' | 'career' | 'offers' | 'onAcceptOffer'>) {
  const visible = offers.filter(offer => offer.scheduleStatus !== 'CANCELLED').slice(0, 6);
  return (
    <section className="school-board-clean workspace-page">
      <header className="school-board-clean__header">
        <div><span>ПЛАНЫ ШКОЛЫ</span><h1>Выбери экспедицию</h1><p>Инструктор сам собирает людей, груз и погодное окно. Тебе нужно получить место и дождаться даты выхода.</p></div>
        <strong>{visible.length}<small>активных планов</small></strong>
      </header>
      <div className="school-board-clean__list">
        {visible.map(offer => {
          const route = world.ecosystem.content.routes.byId[offer.routeId];
          const leader = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
          const phase = schoolExpeditionPhase(offer, career.seasonDay);
          const canAccept = schoolOfferCanAccept(offer, career.seasonDay);
          const days = daysUntilSchoolDeparture(offer, career.seasonDay);
          return (
            <article key={offer.id} className={canAccept ? '' : 'is-locked'}>
              <div className="school-board-clean__date"><b>{days}</b><small>дн. до выхода</small></div>
              <div className="school-board-clean__copy">
                <small>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]} · {leader?.name ?? 'Инструктор не назначен'}</small>
                <strong>{route?.mountainName ?? 'Гора'} · {route?.name ?? 'Маршрут'}</strong>
                <span>{roleLabel[offer.playerRole]} · {offer.memberNpcIds.length + 1} человек · риск {riskLabel(route?.objectiveRisk ?? 50)}</span>
              </div>
              <button disabled={!canAccept} onClick={() => onAcceptOffer(offer.id)}>{canAccept ? 'Подать заявку' : phase === 'RECRUITING' ? 'Набор закрыт' : SCHOOL_EXPEDITION_PHASE_LABELS[phase]}</button>
            </article>
          );
        })}
      </div>
      {!visible.length && <div className="school-board-clean__empty"><strong>Новых планов пока нет</strong><p>Проведи тренировку или восстановление. Календарь сдвинется, и инструкторы объявят новые цели.</p></div>}
    </section>
  );
}

function AcceptedSchoolPlan({ world, career, offer, onWaitForDeparture, launchMessage }: { world: WorldState; career: CareerState; offer: ExpeditionOffer; onWaitForDeparture: () => void; launchMessage?: string | null }) {
  const route = world.ecosystem.content.routes.byId[offer.routeId] ?? getSelectedRoute(career);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId] ?? world.region.mountains[0]!;
  const leader = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
  const waitDays = daysUntilSchoolDeparture(offer, career.seasonDay);
  const phase = schoolExpeditionPhase(offer, career.seasonDay);
  const teamNames = [offer.leaderNpcId, ...offer.memberNpcIds]
    .filter((id): id is string => Boolean(id))
    .map(id => world.ecosystem.content.npcs.byId[id]?.name)
    .filter((name): name is string => Boolean(name));
  const weather = getSelectedWeather(career);
  const equipment = analyzeRouteEquipment(route, career.expeditionPlan, Math.max(1, teamNames.length + 1));

  return (
    <section className="school-plan-clean workspace-page">
      <header className="school-plan-clean__hero">
        <div className="school-plan-clean__copy">
          <span>МЕСТО ПОДТВЕРЖДЕНО</span>
          <h1>{mountain.name}</h1>
          <p>{route.name} · руководитель {leader?.name ?? 'назначается школой'}</p>
          <div className="school-plan-clean__countdown"><b>{waitDays}</b><span>{waitDays === 1 ? 'день' : 'дней'} до выхода<small>день сезона {offer.departureDay ?? career.seasonDay}</small></span></div>
          <button className="school-plan-clean__launch" disabled={offer.scheduleStatus === 'CANCELLED'} onClick={onWaitForDeparture}>
            <span><strong>{waitDays > 0 ? `Подождать ${waitDays} дн. и начать` : 'Начать экспедицию'}</strong><small>время и мир промотаются автоматически</small></span><b>→</b>
          </button>
          {launchMessage && <p className="prep-launch-message" role="alert">{launchMessage}</p>}
        </div>
        <div className="school-plan-clean__mountain"><MountainModel mountain={mountain} seed={world.config.seed} variant="card" interactive={false} label={mountain.name} /></div>
      </header>

      <section className="school-plan-clean__facts">
        <span><small>СТАДИЯ</small><strong>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]}</strong></span>
        <span><small>ТВОЯ РОЛЬ</small><strong>{roleLabel[offer.playerRole]}</strong></span>
        <span><small>ГРУППА</small><strong>{offer.memberNpcIds.length + 2} чел.</strong></span>
        <span><small>ВЕРШИНА</small><strong>{route.summitElevation} м</strong></span>
      </section>

      <div className="school-plan-clean__body">
        <section>
          <header><small>СОСТАВ</small><strong>Кто идёт</strong></header>
          <div className="school-plan-clean__team">
            <span><b>{initials(career.hero.name)}</b><i>{career.hero.name}</i><small>{roleLabel[offer.playerRole]}</small></span>
            {teamNames.map((name, index) => <span key={`${name}-${index}`}><b>{initials(name)}</b><i>{name}</i><small>{index === 0 ? 'Инструктор' : 'Участник'}</small></span>)}
          </div>
        </section>
        <details>
          <summary>Что подготовила школа</summary>
          <div className="school-plan-clean__prepared">
            <span><small>Погода</small><strong>{weather.label}</strong><i>{weather.temperatureC}° · ветер {weather.windKmh} км/ч</i></span>
            <span><small>Верёвка</small><strong>{equipment.plannedRopeMeters} м</strong><i>рекомендуется {equipment.recommendedRopeMeters} м</i></span>
            <span><small>Ночёвки</small><strong>{equipment.expectedNights}</strong><i>укрытие и топливо собраны инструктором</i></span>
            <span><small>План</small><strong>{offer.briefing ?? 'Подготовка идёт по расписанию.'}</strong></span>
          </div>
        </details>
      </div>

      <div className="school-plan-clean__mobile-action">
        <button disabled={offer.scheduleStatus === 'CANCELLED'} onClick={onWaitForDeparture}>{waitDays > 0 ? `Подождать ${waitDays} дн. и начать` : 'Начать экспедицию'}<b>→</b></button>
      </div>
    </section>
  );
}

export function PreparationHubScreen({
  world,
  career,
  offers,
  onAcceptOffer,
  onSelectMountain,
  onSelectRoute,
  onToggleMember,
  onSetGearQuantity,
  onSetPlan,
  onPreset,
  onSelectWeather,
  onOpenPeople,
  onLaunch,
  onWaitForDeparture,
  launchMessage,
}: Props) {
  const [activeStage, setActiveStage] = useState<PrepStage>('TARGET');
  const route = getSelectedRoute(career);
  const mountain = world.ecosystem.content.mountains.byId[route.mountainId] ?? world.region.mountains[0]!;
  const mountains = useMemo(() => Object.values(world.ecosystem.content.mountains.byId).sort((a, b) => mountainScore(a) - mountainScore(b)), [world]);
  const routes = routesForMountain(career, mountain.id);
  const team = selectedTeam(career);
  const weather = getSelectedWeather(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;
  const assignedOffer = career.acceptedOffer && !career.acceptedOffer.solo ? career.acceptedOffer : null;
  const requiredTeam = Math.max(1, route.recommendedTeamSize);
  const teamCount = team.length + 1;
  const equipment = analyzeRouteEquipment(route, career.expeditionPlan, teamCount);
  const ropeBundles = career.expeditionPlan.gear.rope ?? 0;
  const effectiveRope = equipment.plannedRopeMeters;

  if (assignedOffer) {
    return <AcceptedSchoolPlan world={world} career={career} offer={assignedOffer} onWaitForDeparture={onWaitForDeparture} launchMessage={launchMessage} />;
  }

  if (career.membership.mode === 'ORGANIZATION') {
    return <SchoolBoard world={world} career={career} offers={offers} onAcceptOffer={onAcceptOffer} />;
  }

  const currentIndex = stages.findIndex(item => item.id === activeStage);
  const primaryAction = activeStage === 'LAUNCH' ? onLaunch : () => setActiveStage(nextStage(activeStage));

  return (
    <section className="prep-hub prep-hub--clean workspace-page">
      <header className="prep-clean-header">
        <div><span>САМОСТОЯТЕЛЬНАЯ ЭКСПЕДИЦИЯ</span><h1>{mountain.name}</h1><p>{route.name} · {route.summitElevation} м · риск {riskLabel(route.objectiveRisk)}</p></div>
        <div className="prep-clean-header__stats"><span><b>{teamCount}</b><small>человек</small></span><span><b>{weight.toFixed(1)}</b><small>кг/чел.</small></span><span><b>{Math.round(readiness.total)}%</b><small>готовность</small></span></div>
      </header>

      <nav className="prep-clean-nav" aria-label="Этапы подготовки">
        {stages.map((stage, index) => <button key={stage.id} className={activeStage === stage.id ? 'is-active' : index < currentIndex ? 'is-complete' : ''} onClick={() => setActiveStage(stage.id)}><span>{stage.index}</span><strong>{stage.title}</strong></button>)}
      </nav>

      <div className="prep-clean-layout">
        <main className="prep-clean-stage">
          {activeStage === 'TARGET' && <section className="prep-clean-target">
            <div className="prep-clean-target__model"><MountainModel mountain={mountain} seed={world.config.seed} variant="card" interactive={false} label={mountain.name} /></div>
            <div className="prep-selector-row">
              <label><span>Вершина</span><select value={mountain.id} onChange={event => onSelectMountain(event.target.value)}>{mountains.map(item => <option key={item.id} value={item.id}>{item.name} · {item.elevation} м</option>)}</select></label>
              <label><span>Маршрут</span><select value={route.id} onChange={event => onSelectRoute(event.target.value)}>{routes.map(item => <option key={item.id} value={item.id}>{item.name} · риск {riskLabel(item.objectiveRisk)}</option>)}</select></label>
            </div>
            <div className="prep-route-note"><strong>{route.summary}</strong><span>{route.descentSummary ?? 'Спуск требует отдельного запаса сил.'}</span></div>
            {offers.length > 0 && <details className="prep-clean-alternative"><summary>Вместо этого вступить в чужую экспедицию</summary><div>{offers.filter(offer => !offer.solo && schoolOfferCanAccept(offer, career.seasonDay)).slice(0, 3).map(offer => { const itemRoute = world.ecosystem.content.routes.byId[offer.routeId]; return <button key={offer.id} onClick={() => onAcceptOffer(offer.id)}><span><strong>{itemRoute?.mountainName}</strong><small>{itemRoute?.name}</small></span><b>Вступить</b></button>; })}</div></details>}
          </section>}

          {activeStage === 'TEAM' && <section>
            <header className="prep-clean-stage__title"><div><small>02 · КОМАНДА</small><h2>{teamCount} участников</h2></div><button onClick={onOpenPeople}>Досье</button></header>
            <div className="prep-team-grid prep-team-grid--clean">
              <article className="prep-person is-selected"><span>{initials(career.hero.name)}</span><div><strong>{career.hero.name}</strong><small>Руководитель · выносливость {career.hero.skills.ENDURANCE}</small></div><b>✓</b></article>
              {career.teamRoster.slice(0, 10).map(member => {
                const selected = career.expeditionPlan.teamMemberIds.includes(member.id);
                const locked = member.required || member.status !== 'ACTIVE' || member.availability < 45;
                return <button key={member.id} className={`prep-person ${selected ? 'is-selected' : ''}`} disabled={locked} onClick={() => onToggleMember(member.id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{roleLabel[member.role]} · {member.skill}/10</small></div><b>{selected ? '✓' : '+'}</b></button>;
              })}
            </div>
            {teamCount < requiredTeam && <p className="prep-inline-warning">Рекомендуется минимум {requiredTeam} человек.</p>}
          </section>}

          {activeStage === 'GEAR' && <section>
            <header className="prep-clean-stage__title"><div><small>03 · ГРУЗ</small><h2>{weight.toFixed(1)} кг на человека</h2></div><div className="prep-presets"><button onClick={() => onPreset('MINIMUM')}>Минимум</button><button className="is-primary" onClick={() => onPreset('RECOMMENDED')}>Рекомендуемый</button></div></header>
            <div className="prep-equipment-forecast prep-equipment-forecast--clean">
              <div><small>ВЕРЁВКА</small><strong>{effectiveRope} м</strong><span>рекомендуется {equipment.recommendedRopeMeters}</span></div>
              <div><small>НОЧЁВКИ</small><strong>{equipment.expectedNights}</strong><span>палатки {equipment.recommendedTentUnits}</span></div>
              <div><small>ЗАПАСЫ</small><strong>{equipment.recommendedFoodDays} дн.</strong><span>топливо {equipment.recommendedFuelUnits}</span></div>
            </div>
            <div className="prep-gear-list-clean">{GEAR_CATALOG.map(item => {
              const quantity = career.expeditionPlan.gear[item.id] ?? 0;
              const need = equipment.needs[item.id];
              const required = route.requiredGearIds.includes(item.id) || (need?.minimum ?? 0) > 0;
              return <article key={item.id} className={`${quantity ? 'is-packed' : ''} ${required && !quantity ? 'is-missing' : ''}`}>
                <div><small>{required ? 'НУЖНО' : need?.recommended ? 'РЕКОМЕНДУЕТСЯ' : 'ДОПОЛНИТЕЛЬНО'}</small><strong>{item.name}</strong><span>{need?.effect ?? item.description}</span></div>
                <em>{item.id === 'rope' ? `${ROPE_BUNDLE_METERS} м · ` : ''}{item.weightKg} кг</em>
                <footer><button onClick={() => onSetGearQuantity(item.id, quantity - 1)}>−</button><b>{quantity}</b><button onClick={() => onSetGearQuantity(item.id, quantity + 1)}>+</button></footer>
              </article>;
            })}</div>
            <div className="prep-supply-grid prep-supply-grid--two">
              <label><span>Еда <b>{career.expeditionPlan.foodDays} дн.</b></span><small>рекомендуется {equipment.recommendedFoodDays}</small><input type="range" min="1" max="10" value={career.expeditionPlan.foodDays} onChange={event => onSetPlan({ foodDays: Number(event.target.value) })} /></label>
              <label><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span><small>рекомендуется {equipment.recommendedFuelUnits}</small><input type="range" min="0" max="10" value={career.expeditionPlan.fuelUnits} onChange={event => onSetPlan({ fuelUnits: Number(event.target.value) })} /></label>
            </div>
            <p className="prep-rope-one-line">Верёвка: {ropeBundles} × {ROPE_BUNDLE_METERS} м. Один закреплённый участок использует 20 м.</p>
          </section>}

          {activeStage === 'LAUNCH' && <section>
            <header className="prep-clean-stage__title"><div><small>04 · ВЫХОД</small><h2>Когда идти</h2></div><strong>{cost} кр.</strong></header>
            <div className="prep-weather-grid">{career.weatherWindows.map(item => <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}><small>через {item.startsInDays} дн.</small><strong>{item.label}</strong><span>{item.temperatureC}° · ветер {item.windKmh} · стабильность {item.stability}%</span></button>)}</div>
            <label className="prep-acclimatization"><span>Акклиматизация <b>{career.expeditionPlan.acclimatizationDays} дн.</b></span><input type="range" min="0" max="12" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetPlan({ acclimatizationDays: Number(event.target.value) })} /></label>
            {readiness.blockers.length > 0 && <div className="prep-clean-blockers"><strong>До выхода нужно исправить:</strong><ul>{readiness.blockers.slice(0, 4).map(item => <li key={item}>{item}</li>)}</ul></div>}
            {launchMessage && <p className="prep-launch-message" role="alert">{launchMessage}</p>}
          </section>}
        </main>

        <aside className="prep-summary prep-summary--clean">
          <div className={`prep-readiness ${canLaunch ? 'is-ready' : 'is-blocked'}`}><small>ГОТОВНОСТЬ</small><strong>{Math.round(readiness.total)}%</strong><i><b style={{ width: `${Math.max(0, Math.min(100, readiness.total))}%` }} /></i></div>
          <dl><div><dt>Группа</dt><dd>{teamCount} чел.</dd></div><div><dt>Вес</dt><dd>{weight.toFixed(1)} кг</dd></div><div><dt>Верёвка</dt><dd>{effectiveRope} м</dd></div></dl>
          <button className="prep-launch" disabled={activeStage === 'LAUNCH' && !canLaunch} onClick={primaryAction}><span>{activeStage === 'LAUNCH' ? canLaunch ? 'Начать экспедицию' : 'План не готов' : `Далее: ${stages[currentIndex + 1]?.title ?? 'Выход'}`}</span><b>→</b></button>
        </aside>
      </div>
    </section>
  );
}
