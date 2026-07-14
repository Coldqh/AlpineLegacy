import { useMemo, useState } from 'react';
import { MountainArt } from '../components/MountainArt';
import {
  GEAR_CATALOG,
  SKILL_LABELS,
  TRAINING_ACTIONS,
  careerReadiness,
  expeditionCost,
  expeditionReadiness,
  expeditionWeight,
  getSelectedRoute,
  getSelectedWeather,
  routesForMountain,
  selectedTeam,
} from '../core/career';
import type {
  CareerState,
  CareerTabId,
  DifficultyId,
  ExpeditionPlan,
  GearCategory,
  MountainData,
  TrainingId,
  WorldEventType,
  WorldState,
} from '../core/types';

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];
const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;
const categoryLabel: Record<GearCategory, string> = { PROTECTION: 'Страховка', SHELTER: 'Укрытие', SURVIVAL: 'Запасы', COMMUNICATION: 'Связь' };

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function level(value: number) { return value < 38 ? 'низкая' : value < 58 ? 'средняя' : value < 76 ? 'высокая' : 'предельная'; }
function mountainScore(mountain: MountainData) { return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32; }
function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); }

export function MobileOverview({ world, career, onTrain, onOpenExpedition, onOpenWorld }: { world: WorldState; career: CareerState; onTrain: (id: TrainingId) => void; onOpenExpedition: () => void; onOpenWorld: () => void }) {
  const route = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === route.mountainId) ?? world.region.mountains[0]!;
  const readiness = careerReadiness(career);
  const expedition = expeditionReadiness(career);
  const primaryTraining = trainingOrder.slice(0, 4);
  const extraTraining = trainingOrder.slice(4);

  const renderTraining = (id: TrainingId) => {
    const action = TRAINING_ACTIONS[id];
    const disabled = action.cost > 0 && career.hero.money < action.cost;
    const impacts = [
      action.skill && action.xp ? `${SKILL_LABELS[action.skill]} +${action.xp}` : '',
      action.form ? `форма ${signed(action.form)}` : '',
      action.fatigue ? `усталость ${signed(action.fatigue)}` : '',
      `${action.cost < 0 ? '+' : '−'}${Math.abs(action.cost)} кр.`,
    ].filter(Boolean).slice(0, 2);
    return <button key={id} disabled={disabled} onClick={() => onTrain(id)}><span className="m-action-index">{action.days}д</span><div><strong>{action.title}</strong><small>{impacts.join(' · ')}</small></div><b>›</b></button>;
  };

  return <section className="m-screen">
    <header className="m-screen-title m-screen-title--compact"><div><small>{career.club.name}</small><h1>{career.hero.name}</h1></div><span>{career.completedClimbs} вершин</span></header>
    <button className="m-focus-card m-focus-card--compact" onClick={onOpenExpedition}><div><small>СЕЙЧАС</small><strong>{career.activeClimb ? 'Вернуться на маршрут' : expedition.blockers.length ? 'Закончить подготовку' : 'Начать экспедицию'}</strong><span>{career.activeClimb ? 'Экспедиция продолжается' : expedition.blockers[0] ?? route.mountainName}</span></div><b>→</b></button>
    <div className="m-stat-strip"><span>Готовность <b>{readiness}</b></span><span>План <b>{expedition.total}</b></span><span>Здоровье <b>{Math.round(career.hero.health)}</b></span></div>
    <button className="m-target-row" onClick={onOpenExpedition}><div className="m-target-row__profile"><MountainArt points={mountain.profilePoints} variant="card" /></div><div><small>ЦЕЛЬ</small><strong>{route.mountainName}</strong><span>{route.name}</span></div><b>{route.summitElevation} м</b></button>
    <div className="m-section-head"><h2>Подготовка</h2><span>двигает время</span></div>
    <div className="m-action-list">{primaryTraining.map(renderTraining)}</div>
    <details className="m-details m-details--flat"><summary>Ещё действия</summary><div className="m-action-list">{extraTraining.map(renderTraining)}</div></details>
    {career.livingWorld.news[0] && <button className="m-news-line" onClick={onOpenWorld}><span><small>МИР</small><strong>{career.livingWorld.news[0].headline}</strong></span><b>→</b></button>}
  </section>;
}

export function MobileRoute({ world, career, onSelectMountain, onSelectRoute, onContinue }: { world: WorldState; career: CareerState; onSelectMountain: (id: string) => void; onSelectRoute: (id: string) => void; onContinue: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const route = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === route.mountainId) ?? world.region.mountains[0]!;
  const mountains = [...world.region.mountains].sort((a, b) => mountainScore(a) - mountainScore(b));
  const routes = routesForMountain(career, mountain.id);
  const readiness = expeditionReadiness(career);

  const chooseMountain = (id: string) => {
    onSelectMountain(id);
    setPickerOpen(false);
  };

  return <section className="m-screen m-screen--with-action">
    <header className="m-screen-title m-screen-title--compact"><div><small>ШАГ 1 ИЗ 4</small><h1>Цель</h1></div><span>{readiness.routeFit}/100</span></header>
    <section className="m-target-card m-target-card--route"><MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} /><footer><div><small>{mountain.characterTitle}</small><strong>{mountain.name}</strong><span>{mountain.dangerProfile}</span></div><b>{mountain.elevation} м</b></footer></section>
    <button className="m-picker-button" onClick={() => setPickerOpen(true)}><span>Сменить вершину</span><b>{mountains.length} доступно ›</b></button>
    <div className="m-section-head"><h2>Маршрут</h2><span>выбери один</span></div>
    <div className="m-route-list">{routes.map(item => <button key={item.id} className={item.id === route.id ? 'is-active' : ''} onClick={() => onSelectRoute(item.id)}><div><small>{item.style}</small><strong>{item.name}</strong><span>{item.estimatedHours} ч · риск {level(item.objectiveRisk)} · {item.recommendedTeamSize}+ чел.</span></div><b>{item.id === route.id ? '✓' : '○'}</b></button>)}</div>
    <details className="m-details m-details--flat"><summary>Параметры маршрута</summary><div className="m-mini-grid"><span>Старт <b>{route.startElevation} м</b></span><span>Вершина <b>{route.summitElevation} м</b></span><span>Участков <b>{route.segments.length}</b></span><span>Решений <b>{route.decisions?.length ?? 0}</b></span></div></details>
    <button className="m-sticky-action" onClick={onContinue}><span>Подобрать команду</span><b>→</b></button>

    {pickerOpen && <div className="m-modal-layer" onClick={() => setPickerOpen(false)}><section className="m-picker-sheet" onClick={event => event.stopPropagation()}><header><div><small>РЕЕСТР ГОР</small><strong>Выбери вершину</strong></div><button onClick={() => setPickerOpen(false)}>×</button></header><div className="m-list">{mountains.map((item, index) => <button key={item.id} className={item.id === mountain.id ? 'is-active' : ''} onClick={() => chooseMountain(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.characterTitle} · техника {level(item.technicality)}</small></div><b>{item.elevation} м</b></button>)}</div></section></div>}
  </section>;
}

export function MobileTeam({ career, onToggle, onContinue, onPeople }: { career: CareerState; onToggle: (id: string) => void; onContinue: () => void; onPeople: () => void }) {
  const team = selectedTeam(career);
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  return <section className="m-screen m-screen--with-action">
    <header className="m-screen-title"><div><small>ШАГ 2 ИЗ 4</small><h1>Команда</h1><p>{team.length + 1} из 5 человек</p></div><span>{readiness.team}/100</span></header>
    <div className={`m-status-line ${team.length + 1 >= route.recommendedTeamSize ? 'is-good' : 'is-warning'}`}><strong>{team.length + 1 >= route.recommendedTeamSize ? 'Состав достаточный' : `Нужно минимум ${route.recommendedTeamSize}`}</strong><button onClick={onPeople}>Досье</button></div>
    <div className="m-person-list"><article className="is-active"><span>{initials(career.hero.name)}</span><div><strong>{career.hero.name}</strong><small>Руководитель · форма {Math.round(career.hero.form)} · здоровье {Math.round(career.hero.health)}</small></div><b>✓</b></article>{career.teamRoster.map(member => { const active = career.expeditionPlan.teamMemberIds.includes(member.id); const unavailable = member.status !== 'ACTIVE' || member.availability < 45; return <button key={member.id} disabled={member.required || unavailable} className={active ? 'is-active' : ''} onClick={() => onToggle(member.id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{roleLabel[member.role]} · {SKILL_LABELS[member.specialty]} {member.skill}/10 · доверие {member.relationship.trust}</small></div><b>{unavailable ? '—' : active ? '✓' : '+'}</b></button>; })}</div>
    <button className="m-sticky-action" onClick={onContinue}><span>Собрать снаряжение</span><b>→</b></button>
  </section>;
}

export function MobileEquipment({ career, onSetQuantity, onSetPlan, onPreset, onContinue }: { career: CareerState; onSetQuantity: (id: string, quantity: number) => void; onSetPlan: (patch: Partial<ExpeditionPlan>) => void; onPreset: (preset: 'MINIMUM' | 'RECOMMENDED') => void; onContinue: () => void }) {
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  return <section className="m-screen m-screen--with-action">
    <header className="m-screen-title"><div><small>ШАГ 3 ИЗ 4</small><h1>Снаряжение</h1><p>{weight.toFixed(1)} кг на человека</p></div><span>{readiness.equipment}/100</span></header>
    <div className="m-preset-row"><button onClick={() => onPreset('MINIMUM')}>Минимум</button><button className="is-primary" onClick={() => onPreset('RECOMMENDED')}>Рекомендуемый</button></div>
    <div className="m-mini-grid"><span>Расходы <b>{cost} кр.</b></span><span>Останется <b>{career.hero.money - cost} кр.</b></span><span>Еда <b>{career.expeditionPlan.foodDays} дн.</b></span><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span></div>
    <div className="m-gear-list">{GEAR_CATALOG.map(item => { const quantity = career.expeditionPlan.gear[item.id] ?? 0; const required = route.requiredGearIds.includes(item.id); return <article key={item.id} className={`${quantity ? 'is-packed' : ''} ${required && !quantity ? 'is-missing' : ''}`}><div><small>{categoryLabel[item.category]}{required ? ' · обязательно' : ''}</small><strong>{item.name}</strong><span>{item.weightKg} кг · {item.unitCost} кр.</span></div><div><button onClick={() => onSetQuantity(item.id, quantity - 1)}>−</button><b>{quantity}</b><button onClick={() => onSetQuantity(item.id, quantity + 1)}>+</button></div></article>; })}</div>
    <details className="m-details"><summary>Расходуемые запасы</summary><label className="m-range-line"><span>Еда <b>{career.expeditionPlan.foodDays} дней</b></span><input type="range" min="1" max="7" value={career.expeditionPlan.foodDays} onChange={event => onSetPlan({ foodDays: Number(event.target.value) })} /></label><label className="m-range-line"><span>Топливо <b>{career.expeditionPlan.fuelUnits}</b></span><input type="range" min="0" max="8" value={career.expeditionPlan.fuelUnits} onChange={event => onSetPlan({ fuelUnits: Number(event.target.value) })} /></label><label className="m-range-line"><span>Верёвка <b>{career.expeditionPlan.ropeMeters} м</b></span><input type="range" min="30" max="100" step="10" value={career.expeditionPlan.ropeMeters} onChange={event => onSetPlan({ ropeMeters: Number(event.target.value) })} /></label></details>
    <button className="m-sticky-action" onClick={onContinue}><span>Проверить выход</span><b>→</b></button>
  </section>;
}

function blockerTab(text: string): CareerTabId { if (/снаряж|еды|топлива|средств/i.test(text)) return 'EQUIPMENT'; if (/группа/i.test(text)) return 'TEAM'; if (/акклиматизация|утомлён/i.test(text)) return 'OVERVIEW'; return 'ROUTE'; }

export function MobileExpedition({ career, difficulty, onLaunch, onOpenTab, onSelectWeather, onSetAcclimatization }: { career: CareerState; difficulty: DifficultyId; onLaunch: () => void; onOpenTab: (tab: CareerTabId) => void; onSelectWeather: (id: string) => void; onSetAcclimatization: (days: number) => void }) {
  const route = getSelectedRoute(career); const weather = getSelectedWeather(career); const readiness = expeditionReadiness(career); const cost = expeditionCost(career); const canLaunch = readiness.total >= 54 && readiness.blockers.length === 0 && !career.activeClimb;
  return <section className="m-screen m-screen--with-action">
    <header className="m-screen-title"><div><small>ШАГ 4 ИЗ 4</small><h1>Выход</h1><p>{route.mountainName} · {route.name}</p></div><span>{difficulty === 'EXPEDITION' ? (readiness.total >= 60 ? 'рабочая' : 'слабая') : `${readiness.total}/100`}</span></header>
    <div className={`m-status-line ${canLaunch ? 'is-good' : 'is-warning'}`}><strong>{canLaunch ? 'План готов' : `${readiness.blockers.length} проблем`}</strong><span>{cost} кр.</span></div>
    <div className="m-section-head"><h2>Погода</h2><span>{weather.label}</span></div>
    <div className="m-weather-list">{career.weatherWindows.map(item => <button key={item.id} className={item.id === weather.id ? 'is-active' : ''} onClick={() => onSelectWeather(item.id)}><div><strong>{item.label}</strong><small>через {item.startsInDays} дн. · {item.temperatureC}° · {item.windKmh} км/ч</small></div><b>{item.id === weather.id ? '✓' : '○'}</b></button>)}</div>
    <label className="m-range-card m-range-card--small"><span>Акклиматизация <b>{career.expeditionPlan.acclimatizationDays} дней</b></span><input type="range" min="0" max="9" value={career.expeditionPlan.acclimatizationDays} onChange={event => onSetAcclimatization(Number(event.target.value))} /><small>Больше дней снижает высотный риск, но мир продолжает двигаться.</small></label>
    <div className="m-readiness-list">{[
      ['Герой', readiness.hero, 'OVERVIEW'], ['Маршрут', readiness.routeFit, 'ROUTE'], ['Команда', readiness.team, 'TEAM'], ['Груз', readiness.equipment, 'EQUIPMENT'], ['Погода', readiness.weather, 'EXPEDITION'], ['Высота', readiness.acclimatization, 'EXPEDITION'],
    ].map(([label, value, tab]) => <button key={String(label)} onClick={() => onOpenTab(tab as CareerTabId)}><span>{label}</span><i><b style={{ width: `${Number(value)}%` }} /></i><strong>{difficulty === 'EXPEDITION' ? (Number(value) >= 70 ? 'сильно' : Number(value) >= 50 ? 'рабоче' : 'слабо') : Math.round(Number(value))}</strong></button>)}</div>
    {readiness.blockers.length > 0 && <div className="m-blocker-list">{readiness.blockers.map(item => <button key={item} onClick={() => onOpenTab(blockerTab(item))}><span>{item}</span><b>Исправить</b></button>)}</div>}
    <button className="m-sticky-action" disabled={!canLaunch} onClick={onLaunch}><span>{canLaunch ? 'Начать экспедицию' : 'План не готов'}</span><b>→</b></button>
  </section>;
}

export function MobileWorld({ world, career }: { world: WorldState; career: CareerState }) {
  const living = career.livingWorld; const active = living.athletes.filter(item => item.status === 'ACTIVE').length; const losses = living.athletes.filter(item => item.status === 'DEAD' || item.status === 'MISSING').length; const unclimbed = living.mountainHistory.filter(item => item.firstAscentYear === null).length;
  return <section className="m-screen"><header className="m-screen-title"><div><small>ЖИВОЙ МИР</small><h1>{world.region.name}</h1><p>Сезон движется без игрока</p></div><span>tick {living.tick}</span></header><div className="m-stat-grid"><div><span>Активные</span><strong>{active}</strong></div><div><span>Непокорённые</span><strong>{unclimbed}</strong></div><div><span>Экспедиции</span><strong>{living.expeditions.length}</strong></div><div><span>Потери</span><strong>{losses}</strong></div></div><div className="m-section-head"><h2>Вершины</h2><span>{living.mountainHistory.length}</span></div><div className="m-world-mountains">{living.mountainHistory.map((history, index) => { const mountain = world.region.mountains.find(item => item.id === history.mountainId); return <article key={history.mountainId}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{history.mountainName}</strong><small>{mountain?.elevation ?? 0} м · {history.firstAscentYear ? `первая ${history.firstAscentYear}` : 'не покорена'}</small></div><b>{history.attempts}/{history.summits}</b></article>; })}</div></section>;
}

const newsFilters: Array<{ id: 'ALL' | WorldEventType; label: string }> = [{ id: 'ALL', label: 'Все' }, { id: 'SUMMIT', label: 'Вершины' }, { id: 'RECORD', label: 'Рекорды' }, { id: 'INJURY', label: 'Аварии' }, { id: 'DEATH', label: 'Потери' }];
export function MobileNews({ career }: { career: CareerState }) { const [filter, setFilter] = useState<'ALL' | WorldEventType>('ALL'); const items = useMemo(() => career.livingWorld.news.filter(item => filter === 'ALL' || item.type === filter), [career.livingWorld.news, filter]); return <section className="m-screen"><header className="m-screen-title"><div><small>ПРЕССА</small><h1>Новости</h1></div><span>{items.length}</span></header><div className="m-chip-row">{newsFilters.map(item => <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div><div className="m-news-list">{items.map(item => <article key={item.id}><small>{item.year} · день {item.seasonDay} · {item.type}</small><strong>{item.headline}</strong><p>{item.summary}</p></article>)}</div></section>; }

export function MobileRivals({ career }: { career: CareerState }) { const candidates = [...career.livingWorld.athletes].sort((a, b) => b.fame - a.fame); return <section className="m-screen"><header className="m-screen-title"><div><small>КОНКУРЕНТЫ</small><h1>Соперники</h1></div><span>{candidates.filter(item => item.status === 'ACTIVE').length}</span></header><div className="m-person-list">{candidates.slice(0, 20).map(person => <article key={person.id}><span>{initials(person.name)}</span><div><strong>{person.name}</strong><small>{person.country} · {person.currentGoal}</small></div><b>{person.fame}</b></article>)}</div></section>; }

export function MobileRecords({ career }: { career: CareerState }) { return <section className="m-screen"><header className="m-screen-title"><div><small>АРХИВ СПОРТА</small><h1>Рекорды</h1></div><span>{career.livingWorld.records.length}</span></header><div className="m-record-list">{career.livingWorld.records.map(record => <article key={record.id}><small>{record.category} · {record.year}</small><strong>{record.title}</strong><b>{record.value.toLocaleString('ru-RU')} {record.unit}</b><span>{record.holderName}{record.mountainName ? ` · ${record.mountainName}` : ''}</span></article>)}</div></section>; }

export function MobilePeople({ career }: { career: CareerState }) { const [selectedId, setSelectedId] = useState(career.teamRoster[0]?.id ?? ''); const selected = career.teamRoster.find(item => item.id === selectedId) ?? career.teamRoster[0]; if (!selected) return null; return <section className="m-screen"><header className="m-screen-title"><div><small>ДОСЬЕ</small><h1>Люди</h1></div><span>{career.teamRoster.length}</span></header><div className="m-chip-row m-chip-row--people">{career.teamRoster.map(person => <button key={person.id} className={person.id === selected.id ? 'is-active' : ''} onClick={() => setSelectedId(person.id)}>{person.name.split(' ')[0]}</button>)}</div><section className="m-person-profile"><header><span>{initials(selected.name)}</span><div><strong>{selected.name}</strong><small>{roleLabel[selected.role]} · {selected.age} лет</small></div></header><p>{selected.note}</p><div className="m-mini-grid"><span>Доверие <b>{selected.relationship.trust}</b></span><span>Уважение <b>{selected.relationship.respect}</b></span><span>Состояние <b>{selected.condition}</b></span><span>Выходы <b>{selected.sharedClimbs}</b></span></div><details className="m-details"><summary>Память</summary>{[...selected.memories].reverse().map(memory => <p key={memory.id}><b>{memory.year}</b> · {memory.title}</p>)}</details></section></section>; }

export function MobileJournal({ career }: { career: CareerState }) { return <section className="m-screen"><header className="m-screen-title"><div><small>КАРЬЕРА</small><h1>Архив</h1><p>{career.hero.name}</p></div><span>{career.log.length}</span></header>{career.reports.length > 0 && <><div className="m-section-head"><h2>Экспедиции</h2><span>{career.reports.length}</span></div><div className="m-report-list">{[...career.reports].reverse().map(report => <article key={report.id}><div><small>{report.year} · день {report.seasonDay}</small><strong>{report.mountainName}</strong><span>{report.routeName}</span></div><b>{report.highestElevation} м</b></article>)}</div></>}<div className="m-section-head"><h2>История</h2><span>{career.highestElevation} м</span></div><div className="m-ledger-list">{[...career.log].reverse().map(entry => <article key={entry.id}><span>{entry.year}</span><div><small>{entry.type} · день {entry.seasonDay}</small><strong>{entry.title}</strong><p>{entry.description}</p></div></article>)}</div></section>; }
