import { useMemo } from 'react';
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
import type { CareerState, ExpeditionOffer, ExpeditionPlan, MountainData, WorldState } from '../core/types';
import { analyzeRouteEquipment, ROPE_BUNDLE_METERS } from '../core/gearPlanning';

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
};

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
}: Props) {
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
  const selectedOffer = offers.find(offer => offer.id === career.selectedOfferId) ?? null;
  const assignedOffer = selectedOffer && !selectedOffer.solo;
  const requiredTeam = Math.max(1, route.recommendedTeamSize);
  const teamCount = team.length + 1;
  const equipment = analyzeRouteEquipment(route, career.expeditionPlan, teamCount);
  const ropeBundles = career.expeditionPlan.gear.rope ?? 0;
  const effectiveRope = equipment.plannedRopeMeters;
  const expectedNights = equipment.expectedNights;

  return (
    <section className="prep-hub workspace-page">
      <header className="prep-hub__hero">
        <div className="prep-hub__copy">
          <span>ЭКСПЕДИЦИЯ · ЕДИНЫЙ ПЛАН</span>
          <h1>{mountain.name}</h1>
          <p>{route.name} · {route.summitElevation} м · {route.estimatedHours} ч · риск {riskLabel(route.objectiveRisk)}</p>
          <div className="prep-hub__quick-stats">
            <span><small>ГРУППА</small><strong>{teamCount}/{requiredTeam}</strong></span>
            <span><small>ВЕС</small><strong>{weight.toFixed(1)} кг</strong></span>
            <span><small>НОЧЁВКИ</small><strong>{expectedNights}</strong></span>
            <span><small>ВЕРЁВКА</small><strong>{effectiveRope} / {equipment.recommendedRopeMeters} м</strong></span>
          </div>
        </div>
        <div className="prep-hub__mountain">
          <MountainModel mountain={mountain} seed={world.config.seed} variant="card" label={mountain.name} />
        </div>
      </header>

      <div className="prep-hub__layout">
        <div className="prep-hub__steps">
          <details className="prep-step" open>
            <summary><span>01</span><div><strong>Цель и линия</strong><small>{mountain.name} · {route.name}</small></div><b>{Math.round(readiness.routeFit)}%</b></summary>
            <div className="prep-step__body">
              {offers.length > 0 && (
                <section className="prep-offers">
                  <header><strong>Планы школы</strong><small>Набор, ожидание погоды и готовые выходы обновляются вместе с миром</small></header>
                  <div>{offers.slice(0, 4).map(offer => {
                    const offerRoute = world.ecosystem.content.routes.byId[offer.routeId];
                    const leader = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
                    const active = career.selectedOfferId === offer.id;
                    return <button key={offer.id} className={active ? 'is-active' : ''} onClick={() => onAcceptOffer(offer.id)}><span><small>{leader?.name ?? 'Самостоятельный план'} · {roleLabel[offer.playerRole]}</small><strong>{offerRoute?.mountainName ?? 'Гора'} · {offerRoute?.name ?? 'Маршрут'}</strong></span><b>{active ? 'Выбрано' : 'Вступить'}</b></button>;
                  })}</div>
                  {assignedOffer && <button className="prep-wait-button" onClick={onWaitForDeparture}>Подождать до выхода школы →</button>}
                </section>
              )}

              {!assignedOffer && (
                <>
                  <div className="prep-selector-row">
                    <label><span>Вершина</span><select value={mountain.id} onChange={event => onSelectMountain(event.target.value)}>{mountains.map(item => <option key={item.id} value={item.id}>{item.name} · {item.elevation} м</option>)}</select></label>
                    <label><span>Маршрут</span><select value={route.id} onChange={event => onSelectRoute(event.target.value)}>{routes.map(item => <option key={item.id} value={item.id}>{item.name} · риск {riskLabel(item.objectiveRisk)}</option>)}</select></label>
                  </div>
                  <div className="prep-route-note"><strong>{route.summary}</strong><span>{route.descentSummary ?? 'Спуск проходит по отдельной линии и требует запаса сил.'}</span></div>
                </>
              )}
            </div>
          </details>

          <details className="prep-step" open>
            <summary><span>02</span><div><strong>Команда</strong><small>{teamCount} участников · {career.expeditionPlan.authorityMode === 'COMMAND' ? 'ты руководишь' : 'руководит инструктор'}</small></div><b>{Math.round(readiness.team)}%</b></summary>
            <div className="prep-step__body">
              <div className="prep-team-grid">
                <article className="prep-person is-selected"><span>{initials(career.hero.name)}</span><div><strong>{career.hero.name}</strong><small>{roleLabel[career.expeditionPlan.playerRole]} · выносливость {career.hero.skills.ENDURANCE}</small></div><b>✓</b></article>
                {career.teamRoster.slice(0, 10).map(member => {
                  const selected = career.expeditionPlan.teamMemberIds.includes(member.id);
                  const locked = !career.membership.permissions.canChooseTeam || member.required || member.status !== 'ACTIVE' || member.availability < 45;
                  return <button key={member.id} className={`prep-person ${selected ? 'is-selected' : ''}`} disabled={locked} onClick={() => onToggleMember(member.id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{roleLabel[member.role]} · {member.specialty.toLowerCase()} {member.skill}/10</small></div><b>{selected ? '✓' : '+'}</b></button>;
                })}
              </div>
              <button className="prep-link-button" onClick={onOpenPeople}>Открыть досье и отношения →</button>
            </div>
          </details>

          <details className="prep-step" open>
            <summary><span>03</span><div><strong>Снаряжение и запасы</strong><small>{weight.toFixed(1)} кг · {cost} кр. · {effectiveRope} м из бухт</small></div><b>{Math.round(readiness.equipment)}%</b></summary>
            <div className="prep-step__body">
              <div className="prep-presets"><button onClick={() => onPreset('MINIMUM')}>Минимум маршрута</button><button className="is-primary" onClick={() => onPreset('RECOMMENDED')}>Рекомендуемый комплект</button></div>
              <section className="prep-equipment-forecast">
                <div><small>ТЕХНИЧЕСКИЕ УЧАСТКИ</small><strong>{equipment.technicalProtectionSites}</strong><span>{equipment.rockSections} скальных · {equipment.iceSections} ледовых</span></div>
                <div><small>ВЕРЁВКА</small><strong>{effectiveRope} м</strong><span>минимум {equipment.minimumRopeMeters} · рекомендуется {equipment.recommendedRopeMeters} · полная защита {equipment.fullProtectionRopeMeters}</span></div>
                <div><small>НОЧЁВКИ</small><strong>{expectedNights}</strong><span>палаток рекомендуется {equipment.recommendedTentUnits} · бивак {equipment.recommendedBivyUnits ? 'нужен в резерве' : 'не обязателен'}</span></div>
                <div><small>ЗАПАСЫ</small><strong>{equipment.recommendedFoodDays} дн.</strong><span>топливо минимум {equipment.minimumFuelUnits} · рекомендуется {equipment.recommendedFuelUnits}</span></div>
              </section>
              <div className="prep-gear-grid">{GEAR_CATALOG.map(item => {
                const quantity = career.expeditionPlan.gear[item.id] ?? 0;
                const need = equipment.needs[item.id];
                const required = route.requiredGearIds.includes(item.id) || (need?.minimum ?? 0) > 0;
                const recommended = need?.recommended ?? 0;
                const tone = need?.tone.toLowerCase() ?? 'neutral';
                return <article key={item.id} className={`${quantity ? 'is-packed' : ''} ${required && !quantity ? 'is-missing' : ''} is-${tone}`}>
                  <header><div><small>{required ? 'НУЖНО МАРШРУТУ' : recommended ? 'РЕКОМЕНДУЕТСЯ' : 'НЕ ОБЯЗАТЕЛЬНО'}</small><strong>{item.name}</strong></div><span>{item.id === 'rope' ? `${ROPE_BUNDLE_METERS} м · ` : ''}{item.weightKg} кг</span></header>
                  <dl className="prep-gear-impact">
                    <div><dt>Открывает</dt><dd>{need?.opens ?? item.description}</dd></div>
                    <div><dt>Даёт</dt><dd>{need?.effect ?? item.description}</dd></div>
                    <div><dt>Без него</dt><dd>{need?.without ?? 'Только лишний резерв и вес.'}</dd></div>
                  </dl>
                  <div className="prep-gear-need"><span>Минимум <b>{need?.minimum ?? 0}</b></span><span>Рекомендуется <b>{recommended}</b></span><span>Взято <b>{quantity}</b></span></div>
                  <footer><button onClick={() => onSetGearQuantity(item.id, quantity - 1)}>−</button><b>{quantity}</b><button onClick={() => onSetGearQuantity(item.id, quantity + 1)}>+</button></footer>
                </article>;
              })}</div>
              <div className="prep-supply-grid prep-supply-grid--two">
                <label className={career.expeditionPlan.foodDays < equipment.minimumFoodDays ? 'is-danger' : career.expeditionPlan.foodDays < equipment.recommendedFoodDays ? 'is-warning' : 'is-good'}><span>Еда <b>{career.expeditionPlan.foodDays} дн.</b></span><small>минимум {equipment.minimumFoodDays} · рекомендуется {equipment.recommendedFoodDays}</small><input type="range" min="1" max="10" value={career.expeditionPlan.foodDays} onChange={event => onSetPlan({ foodDays: Number(event.target.value) })} /></label>
                <label className={career.expeditionPlan.fuelUnits < equipment.minimumFuelUnits ? 'is-danger' : career.expeditionPlan.fuelUnits < equipment.recommendedFuelUnits ? 'is-warning' : 'is-good'}><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span><small>минимум {equipment.minimumFuelUnits} · рекомендуется {equipment.recommendedFuelUnits}</small><input type="range" min="0" max="10" value={career.expeditionPlan.fuelUnits} onChange={event => onSetPlan({ fuelUnits: Number(event.target.value) })} /></label>
              </div>
              <div className={`prep-rope-explanation ${effectiveRope < equipment.minimumRopeMeters ? 'is-danger' : effectiveRope < equipment.recommendedRopeMeters ? 'is-warning' : 'is-good'}`}>
                <div><small>РАБОЧАЯ ВЕРЁВКА СЧИТАЕТСЯ ИЗ БУХТ</small><strong>{ropeBundles} × {ROPE_BUNDLE_METERS} м = {effectiveRope} м</strong></div>
                <p>Закрепление клетки расходует 20 м. Снятая линия возвращается в запас, потерянная или повреждённая — нет. Отдельного ползунка больше нет.</p>
              </div>
            </div>
          </details>

          <details className="prep-step" open>
            <summary><span>04</span><div><strong>Условия выхода</strong><small>{weather.label} · {weather.temperatureC}° · ветер {weather.windKmh}</small></div><b>{Math.round((readiness.weather + readiness.acclimatization) / 2)}%</b></summary>
            <div className="prep-step__body">
              <div className="prep-weather-grid">{career.weatherWindows.map(item => <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}><small>через {item.startsInDays} дн.</small><strong>{item.label}</strong><span>{item.temperatureC}° · {item.windKmh} км/ч · стабильность {item.stability}%</span></button>)}</div>
              <label className="prep-acclimatization"><span>Акклиматизация <b>{career.expeditionPlan.acclimatizationDays} дн.</b></span><input type="range" min="0" max="12" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetPlan({ acclimatizationDays: Number(event.target.value) })} /></label>
            </div>
          </details>
        </div>

        <aside className="prep-summary">
          <div className={`prep-readiness ${canLaunch ? 'is-ready' : 'is-blocked'}`}>
            <small>ОБЩАЯ ГОТОВНОСТЬ</small>
            <strong>{Math.round(readiness.total)}%</strong>
            <i><b style={{ width: `${Math.max(0, Math.min(100, readiness.total))}%` }} /></i>
            <p>{canLaunch ? 'Группа, груз и условия позволяют выходить.' : readiness.blockers[0] ?? 'План требует доработки.'}</p>
          </div>
          <dl className="prep-summary__facts">
            <div><dt>Маршрут</dt><dd>{route.name}</dd></div>
            <div><dt>Группа</dt><dd>{teamCount} чел.</dd></div>
            <div><dt>Вес</dt><dd>{weight.toFixed(1)} кг</dd></div>
            <div><dt>Ночёвки</dt><dd>{expectedNights}</dd></div>
            <div><dt>Верёвка</dt><dd>{effectiveRope} м / рек. {equipment.recommendedRopeMeters}</dd></div>
            <div><dt>Стоимость</dt><dd>{cost} кр.</dd></div>
          </dl>
          {readiness.blockers.length > 0 && <ul className="prep-blockers">{readiness.blockers.map(item => <li key={item}>{item}</li>)}</ul>}
          <button className="prep-launch" disabled={!canLaunch} onClick={onLaunch}>{canLaunch ? 'Начать экспедицию' : 'План не готов'}<b>→</b></button>
        </aside>
      </div>
    </section>
  );
}
