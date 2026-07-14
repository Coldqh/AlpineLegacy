import { MountainArt } from '../components/MountainArt';
import { EXPEDITION_RANK_LABELS, expeditionReadiness, getSelectedRoute, routesForMountain } from '../core/career';
import type { CareerState, ExpeditionOffer, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  offers: ExpeditionOffer[];
  onAcceptOffer: (offerId: string) => void;
  onSelectMountain: (mountainId: string) => void;
  onSelectRoute: (routeId: string) => void;
  onContinue: () => void;
};

function level(value: number) {
  if (value < 38) return 'Низкая';
  if (value < 58) return 'Средняя';
  if (value < 76) return 'Высокая';
  return 'Предельная';
}

function mountainScore(mountain: WorldState['region']['mountains'][number]) {
  return mountain.elevation * .01 + mountain.technicality * .72 + mountain.altitudeSeverity * .55 + mountain.remoteness * .32;
}

export function RoutePlanningScreen({ world, career, offers, onAcceptOffer, onSelectMountain, onSelectRoute, onContinue }: Props) {
  const route = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === route.mountainId) ?? world.region.mountains[0]!;
  const routes = routesForMountain(career, mountain.id);
  const readiness = expeditionReadiness(career);
  const mountains = [...world.region.mountains].sort((a, b) => mountainScore(a) - mountainScore(b));

  if (!career.membership.permissions.canChooseRoute) {
    return (
      <section className="workspace-page route-planning-page">
        <header className="workspace-title workspace-title--compact"><div><p className="eyebrow">ШАГ 1 ИЗ 4 · ЧУЖИЕ ЭКСПЕДИЦИИ</p><h1>Получи место в группе.</h1><p>Пока ты новичок, маршрут, состав и общую стратегию определяет руководитель. Ты выбираешь, к какой экспедиции подать заявку.</p></div><div className="workspace-title__mark"><span>{EXPEDITION_RANK_LABELS[career.membership.rank]}</span><small>ТВОЙ РАНГ</small></div></header>
        <section className="workspace-panel"><div className="panel-heading"><div><p className="eyebrow">OPEN EXPEDITIONS</p><h2>Доступные заявки</h2></div><span>{offers.length}</span></div><div className="route-choice-grid route-choice-grid--clear expedition-offer-grid">{offers.map((offer, index) => { const offerRoute = world.ecosystem.content.routes.byId[offer.routeId]; const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null; const active = career.selectedOfferId === offer.id; return <button key={offer.id} className={active ? 'is-active' : ''} onClick={() => onAcceptOffer(offer.id)}><div><span>{String(index + 1).padStart(2, '0')}</span><i /></div><small>{offer.playerRole} · ПОД РУКОВОДСТВОМ NPC</small><h3>{offerMountain?.name ?? offerRoute?.mountainName}</h3><p>{offerRoute?.name}. Ты отвечаешь за личные решения и свою роль, но не формируешь всю группу.</p><dl><div><dt>Роль</dt><dd>{offer.playerRole}</dd></div><div><dt>Состав</dt><dd>{offer.memberNpcIds.length + (offer.leaderNpcId ? 1 : 0)} NPC</dd></div><div><dt>Игра</dt><dd>≈ {offerRoute?.expectedPlayMinutes ?? 20} мин</dd></div><div><dt>Ранг</dt><dd>{offer.requiredRank}</dd></div></dl><footer>{active ? 'МЕСТО ПОДТВЕРЖДЕНО' : 'ПРИНЯТЬ МЕСТО'}</footer></button>; })}</div>{!offers.length && <p>Сейчас нет открытых заявок. Продвинь время тренировками.</p>}</section>
        {career.selectedOfferId && <section className="route-summary-panel"><div><p className="eyebrow">ASSIGNED ROUTE</p><h2>{route.mountainName} · {route.name}</h2><p>Руководитель назначил тебе роль {career.expeditionPlan.playerRole}. Общие приказы недоступны до повышения ранга.</p></div><div className="route-summary-panel__metrics"><span><small>ВЕРШИНА</small><strong>{route.summitElevation} м</strong></span><span><small>ИГРОВОЕ ВРЕМЯ</small><strong>≈ {route.expectedPlayMinutes ?? 20} мин</strong></span><span><small>УЗЛЫ</small><strong>{route.graph?.nodes.length ?? route.segments.length}</strong></span><span><small>РОЛЬ</small><strong>{career.expeditionPlan.playerRole}</strong></span></div></section>}
        <button className="flow-next-action" disabled={!career.selectedOfferId} onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>{career.selectedOfferId ? 'Посмотреть состав' : 'Выбери экспедицию'}</strong></span><b>→</b></button>
      </section>
    );
  }

  return (
    <section className="workspace-page route-planning-page">
      <header className="workspace-title workspace-title--compact">
        <div>
          <p className="eyebrow">ШАГ 1 ИЗ 4 · ЦЕЛЬ ЭКСПЕДИЦИИ</p>
          <h1>Выбери гору.</h1>
          <p>Сначала вершина, потом линия. Все показатели ниже влияют на время, состав, груз и шанс вернуться.</p>
        </div>
        <div className="workspace-title__mark"><span>{readiness.routeFit}</span><small>ТВОЁ СООТВЕТСТВИЕ</small></div>
      </header>

      <section className="decision-guide">
        <strong>Что делать сейчас</strong>
        <p>{career.membership.mode === 'INDEPENDENT' ? 'Выбери собственный маршрут или получи место в чужой экспедиции. В чужой группе общие приказы остаются у её руководителя.' : 'Выбери вершину, сравни три маршрута и нажми «Команда». Число соответствия показывает, насколько твои текущие навыки подходят выбранной линии.'}</p>
      </section>

      {career.membership.mode === 'INDEPENDENT' && offers.some(offer => !offer.solo) && <section className="workspace-panel independent-offers-panel"><div className="panel-heading"><div><p className="eyebrow">JOIN AN EXPEDITION</p><h2>Чужие походы</h2></div><span>{offers.filter(offer => !offer.solo).length}</span></div><div className="expedition-offer-list">{offers.filter(offer => !offer.solo).map(offer => { const offerRoute = world.ecosystem.content.routes.byId[offer.routeId]; const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null; const active = career.selectedOfferId === offer.id; return <button key={offer.id} className={active ? 'is-active' : ''} onClick={() => onAcceptOffer(offer.id)}><div><small>{offer.playerRole} · ПОД РУКОВОДСТВОМ NPC</small><strong>{offerMountain?.name ?? offerRoute?.mountainName}</strong><span>{offerRoute?.name} · ≈ {offerRoute?.expectedPlayMinutes ?? 20} мин</span></div><b>{active ? 'МЕСТО ПРИНЯТО' : 'ПРИСОЕДИНИТЬСЯ'}</b></button>; })}</div></section>}

      <section className="workspace-panel objective-selector">
        <div className="panel-heading"><div><p className="eyebrow">MOUNTAIN REGISTER</p><h2>Доступные вершины</h2></div><span>{mountains.length} ЦЕЛЕЙ</span></div>
        <div className="mountain-choice-grid">
          {mountains.map((item, index) => {
            const active = item.id === mountain.id;
            const history = career.livingWorld.mountainHistory.find(entry => entry.mountainId === item.id);
            const signature = routesForMountain(career, item.id).some(entry => entry.isSignature);
            return (
              <button key={item.id} className={active ? 'is-active' : ''} onClick={() => onSelectMountain(item.id)}>
                <span className="mountain-choice-grid__index">{String(index + 1).padStart(2, '0')}</span>
                <div><small>{signature ? 'ЭТАЛОННАЯ ГОРА · ' : ''}{item.characterTitle}</small><h3>{item.name}</h3><p>{item.epithet}</p></div>
                <strong>{item.elevation}<small>м</small></strong>
                <footer><span>Техника {level(item.technicality)}</span><span>{history?.summits ? `${history.summits} восх.` : 'не покорена'}</span></footer>
              </button>
            );
          })}
        </div>
      </section>

      <div className="route-hero-panel route-hero-panel--clear">
        <MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} />
        <div className="selected-objective-card">
          <small>{route.isSignature ? 'ЭТАЛОННЫЙ ВЕРТИКАЛЬНЫЙ СРЕЗ' : 'ВЫБРАННАЯ ВЕРШИНА'}</small>
          <strong>{mountain.name}</strong>
          <span>{mountain.elevation} м · {mountain.dangerProfile}</span>
          <div className="mountain-character-callout"><small>{mountain.characterTitle}</small><p>{mountain.characterDescription}</p></div>
          <p>{mountain.summary}</p>
          {route.isSignature && <div className="signature-mountain-note"><strong>Эта гора проработана глубже остальных.</strong><span>Здесь есть выбор линии внутри маршрута, закладки, стационарные верёвки и отдельный спуск.</span></div>}
        </div>
      </div>

      <section className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">ROUTE OPTIONS</p><h2>Как подниматься</h2></div><span>ВЫБЕРИ ОДНУ ЛИНИЮ</span></div>
        <div className="route-choice-grid route-choice-grid--clear">
          {routes.map((item, index) => {
            const active = item.id === route.id;
            return (
              <button key={item.id} className={active ? 'is-active' : ''} onClick={() => onSelectRoute(item.id)}>
                <div><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
                <small>{item.isSignature ? 'VERTICAL SLICE · ' : ''}{mountain.characterTitle} · {item.style}</small>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <dl>
                  <div><dt>Время</dt><dd>≈ {item.estimatedHours} ч</dd></div>
                  <div><dt>Техника</dt><dd>{level(item.technicality)}</dd></div>
                  <div><dt>Риск</dt><dd>{level(item.objectiveRisk)}</dd></div>
                  <div><dt>Решения</dt><dd>{item.decisions?.length ?? 0}</dd></div>
                </dl>
                <footer>{active ? 'ВЫБРАНО' : 'ВЫБРАТЬ МАРШРУТ'}</footer>
              </button>
            );
          })}
        </div>
      </section>

      <section className="route-summary-panel">
        <div>
          <p className="eyebrow">SELECTED ROUTE</p>
          <h2>{route.name}</h2>
          <p>{route.summary}</p>
        </div>
        <div className="route-summary-panel__metrics">
          <span><small>СТАРТ</small><strong>{route.startElevation} м</strong></span>
          <span><small>ВЕРШИНА</small><strong>{route.summitElevation} м</strong></span>
          <span><small>ГРУППА</small><strong>{route.recommendedTeamSize}+</strong></span>
          <span><small>СООТВЕТСТВИЕ</small><strong>{readiness.routeFit}/100</strong></span>
        </div>

        {route.routeStory && (
          <div className="route-story-grid">
            {route.routeStory.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></article>)}
          </div>
        )}
        <section className="descent-plan-card">
          <div><p className="eyebrow">DESCENT PLAN</p><h3>Спуск — отдельная линия</h3><p>{route.descentSummary}</p></div>
          <strong>{route.descentSegments?.length ?? route.segments.length}<small>участков вниз</small></strong>
        </section>
        {route.decisions && route.decisions.length > 0 && (
          <details className="route-decisions-disclosure" open>
            <summary>Ключевые решения на маршруте ({route.decisions.length})</summary>
            <div>{route.decisions.map(decision => <article key={decision.id}><div><small>ВЫБОР ЛИНИИ</small><h3>{decision.title}</h3><p>{decision.situation}</p></div><span>{decision.options.map(option => option.title).join(' / ')}</span></article>)}</div>
          </details>
        )}
        <details className="route-segments-disclosure">
          <summary>Показать участки маршрута ({route.segments.length})</summary>
          <div className="route-segment-list">
            {route.segments.map((segment, index) => (
              <article key={segment.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><small>{segment.terrain} · +{segment.elevationGain} м</small><h3>{segment.name}</h3><p>{segment.note}</p></div>
                <div><strong>{segment.difficulty}</strong><small>{segment.hazard}</small></div>
              </article>
            ))}
          </div>
        </details>
      </section>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Подобрать команду</strong></span><b>→</b></button>
    </section>
  );
}
