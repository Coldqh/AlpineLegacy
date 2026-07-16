import { MountainArt } from '../components/MountainArt';
import { EXPEDITION_RANK_LABELS, expeditionReadiness, getSelectedRoute, routesForMountain } from '../core/career';
import type { CareerState, ExpeditionOffer, WorldState } from '../core/types';
import { buildMountainMemory } from '../core/mountainMemory';
import { buildMountainDynamics } from '../core/mountainDynamics';
import { SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase, schoolOfferCanAccept } from '../core/schoolExpeditions';

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


const expeditionRankOrder = ['NOVICE', 'MEMBER', 'SPECIALIST', 'ROPE_LEAD', 'DEPUTY', 'LEADER', 'ORGANIZER'] as const;
function rankAllows(actual: CareerState['membership']['rank'], required: ExpeditionOffer['requiredRank']) {
  return expeditionRankOrder.indexOf(actual) >= expeditionRankOrder.indexOf(required);
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
  const latestApplication = career.applications[career.applications.length - 1] ?? null;
  const mountainMemory = buildMountainMemory(career, mountain.id);
  const routeDynamics = buildMountainDynamics(career, mountain.id, route.id);

  if (!career.membership.permissions.canChooseRoute) {
    return (
      <section className="workspace-page route-planning-page">
        <header className="workspace-title workspace-title--compact">
          <div><p className="eyebrow">ШАГ 1 ИЗ 4 · ПЛАНЫ ШКОЛЫ</p><h1>Найди место в группе.</h1><p>Инструкторы ведут разные экспедиции параллельно. Сначала объявляют цель, потом набирают людей, готовят груз, ждут погоду и только после этого выходят.</p></div>
          <div className="workspace-title__mark"><span>{EXPEDITION_RANK_LABELS[career.membership.rank]}</span><small>ТВОЙ РАНГ</small></div>
        </header>
        {latestApplication && <section className={`application-result is-${latestApplication.status.toLowerCase()}`}><strong>{latestApplication.status === 'ACCEPTED' ? 'Заявка принята' : 'Заявка отклонена'}</strong><p>{latestApplication.reason}</p><span>Оценка заявки: {latestApplication.score}</span></section>}
        <section className="workspace-panel school-expedition-board">
          <div className="panel-heading"><div><p className="eyebrow">SCHOOL EXPEDITION PROGRAM</p><h2>Экспедиции инструкторов</h2></div><span>{offers.length} ПЛАНА</span></div>
          <div className="school-expedition-grid">
            {offers.map((offer, index) => {
              const offerRoute = world.ecosystem.content.routes.byId[offer.routeId] ?? career.routes.find(item => item.id === offer.routeId);
              const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null;
              const leader = offer.leaderNpcId ? world.ecosystem.content.npcs.byId[offer.leaderNpcId] : null;
              const phase = schoolExpeditionPhase(offer, career.seasonDay);
              const active = career.selectedOfferId === offer.id;
              const rankOk = rankAllows(career.membership.rank, offer.requiredRank);
              const canApply = rankOk && schoolOfferCanAccept(offer, career.seasonDay);
              return (
                <article key={offer.id} className={`school-expedition-card is-${phase.toLowerCase()} ${active ? 'is-active' : ''}`}>
                  <header><span>{String(index + 1).padStart(2, '0')}</span><b>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]}</b></header>
                  <small>{leader?.mentorLevel ?? 'ИНСТРУКТОР'} · {leader?.name ?? 'Руководитель школы'}</small>
                  <h3>{offerMountain?.name ?? offerRoute?.mountainName}</h3>
                  <strong>{offerRoute?.name}</strong>
                  <p>{offer.briefing}</p>
                  <div className="school-plan-progress"><i><b style={{ width: `${offer.preparationProgress ?? 0}%` }} /></i><span>{offer.scheduleStatus === 'CANCELLED' ? 'ОТМЕНЕНО' : `ГОТОВНОСТЬ ${offer.preparationProgress ?? 0}%${offer.delayDays ? ` · +${offer.delayDays} ДН.` : ''}`}</span></div>
                  <dl>
                    <div><dt>Выход</dt><dd>день {offer.departureDay ?? '—'}</dd></div>
                    <div><dt>Возврат</dt><dd>день {offer.expectedReturnDay ?? '—'}</dd></div>
                    <div><dt>Состав</dt><dd>{offer.memberNpcIds.length + 1} чел. · {offer.openSlots ?? 0} мест</dd></div>
                    <div><dt>Допуск</dt><dd>{EXPEDITION_RANK_LABELS[offer.requiredRank]}</dd></div>
                  </dl>
                  <button disabled={!canApply && !active} onClick={() => onAcceptOffer(offer.id)}>{active ? 'МЕСТО ПОДТВЕРЖДЕНО' : !rankOk ? 'НЕДОСТАТОЧНЫЙ РАНГ' : canApply ? 'ПОДАТЬ ЗАЯВКУ' : SCHOOL_EXPEDITION_PHASE_LABELS[phase].toUpperCase()}</button>
                </article>
              );
            })}
          </div>
        </section>
        {career.selectedOfferId && <section className="route-summary-panel"><div><p className="eyebrow">ASSIGNED EXPEDITION</p><h2>{route.mountainName} · {route.name}</h2><p>Место подтверждено. До выхода группа проходит подготовку, распределяет груз и ждёт своё погодное окно.</p></div><div className="route-summary-panel__metrics"><span><small>ВЫХОД</small><strong>день {career.acceptedOffer?.departureDay ?? career.seasonDay}</strong></span><span><small>ВЕРШИНА</small><strong>{route.summitElevation} м</strong></span><span><small>СОСТАВ</small><strong>{career.expeditionPlan.teamMemberIds.length + 1}</strong></span><span><small>РОЛЬ</small><strong>{career.expeditionPlan.playerRole}</strong></span></div></section>}
        <button className="flow-next-action" disabled={!career.selectedOfferId} onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>{career.selectedOfferId ? 'Посмотреть состав и подготовку' : 'Выбери план инструктора'}</strong></span><b>→</b></button>
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

      {career.membership.mode === 'INDEPENDENT' && offers.some(offer => !offer.solo) && <section className="workspace-panel independent-offers-panel"><div className="panel-heading"><div><p className="eyebrow">JOIN AN EXPEDITION</p><h2>Чужие походы</h2></div><span>{offers.filter(offer => !offer.solo).length}</span></div><div className="expedition-offer-list">{offers.filter(offer => !offer.solo).map(offer => { const offerRoute = world.ecosystem.content.routes.byId[offer.routeId]; const offerMountain = offerRoute ? world.ecosystem.content.mountains.byId[offerRoute.mountainId] : null; const active = career.selectedOfferId === offer.id; return <button key={offer.id} className={active ? 'is-active' : ''} onClick={() => onAcceptOffer(offer.id)}><div><small>{offer.playerRole} · ПОД РУКОВОДСТВОМ NPC</small><strong>{offerMountain?.name ?? offerRoute?.mountainName}</strong><span>{offerRoute?.name} · ≈ {offerRoute?.expectedPlayMinutes ?? 20} мин</span></div><b>{active ? 'МЕСТО ПРИНЯТО' : 'ПОДАТЬ ЗАЯВКУ'}</b></button>; })}</div></section>}

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
          <div className="mountain-authorship-facts">
            <span><small>ФОРМА</small><strong>{mountain.identity.formTitle}</strong></span>
            <span><small>ОРИЕНТИР</small><strong>{mountain.identity.signatureFeature}</strong></span>
            <span><small>ЛАГЕРЯ</small><strong>{mountain.identity.campPattern}</strong></span>
            <span><small>СПУСК</small><strong>{mountain.identity.descentProblem}</strong></span>
          </div>
          {route.isSignature && <div className="signature-mountain-note"><strong>Эталонная цель школы.</strong><span>Она выбрана для первого допуска, но остальные вершины используют тот же полноценный генератор маршрутов и решений.</span></div>}
        </div>
      </div>

      <section className={`mountain-dynamic-banner is-${routeDynamics.status.toLowerCase()}`}>
        <div><small>СОСТОЯНИЕ МАССИВА · ДЕНЬ {career.seasonDay}</small><strong>{routeDynamics.seasonTitle}</strong><p>{routeDynamics.seasonSummary}</p></div>
        <span><small>МАРШРУТ</small><b>{routeDynamics.statusLabel}</b>{routeDynamics.closureReason && <em>{routeDynamics.closureReason}</em>}</span>
      </section>

      <details className="workspace-panel mountain-memory-panel">
        <summary className="mountain-memory-summary">
          <div><small>MOUNTAIN MEMORY</small><strong>Память горы</strong></div>
          <span>{mountainMemory.attempts} выходов · {mountainMemory.summits} вершин · {mountainMemory.successRate}% успех</span>
        </summary>
        <div className="mountain-memory-grid">
          <article className="mountain-memory-card">
            <small>СТАТУС</small>
            <strong>{mountainMemory.mountainName}</strong>
            <div className="mountain-memory-facts">
              <span><b>{mountainMemory.summits}</b><i>вершин</i></span>
              <span><b>{mountainMemory.successRate}%</b><i>успех</i></span>
              <span><b>{mountainMemory.deaths}</b><i>потери</i></span>
              <span><b>{mountainMemory.firstAscentLabel}</b><i>первая вершина</i></span>
            </div>
            <p className="mountain-memory-lead">Сейчас гора {mountainMemory.attentionLabel}. История восхождений влияет на ожидания школ, темп маршрута и то, сколько готовых ориентиров уже существует.</p>
          </article>

          <article className="mountain-memory-card">
            <small>СЛЕДЫ И РЕПУТАЦИЯ</small>
            <strong>Что можно встретить на линии</strong>
            <ul className="mountain-memory-list">
              {mountainMemory.signs.map(item => <li key={item}>{item}</li>)}
            </ul>
            {(mountainMemory.activeClubs.length > 0 || mountainMemory.tracedRoutes.length > 0) && (
              <div className="mountain-memory-tags">
                {mountainMemory.activeClubs.slice(0, 3).map(item => <span key={item}>ШКОЛА · {item}</span>)}
                {mountainMemory.tracedRoutes.slice(0, 3).map(item => <span key={item}>ЛИНИЯ · {item}</span>)}
              </div>
            )}
          </article>

          <article className="mountain-memory-card mountain-memory-card--stories">
            <small>ПОСЛЕДНИЕ ИСТОРИИ</small>
            <strong>Кто и что уже оставил здесь</strong>
            {mountainMemory.stories.length > 0 ? (
              <div className="mountain-memory-story-list">
                {mountainMemory.stories.map(story => (
                  <article key={story.id}>
                    <header><span>{story.tag}</span><strong>{story.title}</strong></header>
                    <p>{story.detail}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mountain-memory-empty">Пока история пустая. Если выйдешь сюда первым, гора начнёт запоминать уже твою связку.</p>
            )}
          </article>
        </div>
      </details>

      <section className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">ROUTE OPTIONS</p><h2>Как подниматься</h2></div><span>ВЫБЕРИ ОДНУ ЛИНИЮ</span></div>
        <div className="route-choice-grid route-choice-grid--clear">
          {routes.map((item, index) => {
            const active = item.id === route.id;
            const dynamics = buildMountainDynamics(career, mountain.id, item.id);
            const closed = dynamics.status === 'CLOSED';
            return (
              <button key={item.id} disabled={closed} className={`${active ? 'is-active' : ''} is-dynamic-${dynamics.status.toLowerCase()}`} onClick={() => onSelectRoute(item.id)}>
                <div><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
                <small>{item.isSignature ? 'VERTICAL SLICE · ' : ''}{mountain.characterTitle} · {item.style} · {dynamics.statusLabel}</small>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <dl>
                  <div><dt>Время</dt><dd>≈ {item.estimatedHours} ч</dd></div>
                  <div><dt>Техника</dt><dd>{level(item.technicality)}</dd></div>
                  <div><dt>Риск</dt><dd>{level(item.objectiveRisk)}</dd></div>
                  <div><dt>Решения</dt><dd>{item.decisions?.length ?? 0}</dd></div>
                </dl>
                <footer>{closed ? dynamics.closureReason ?? 'ВРЕМЕННО ЗАКРЫТ' : active ? 'ВЫБРАНО' : 'ВЫБРАТЬ МАРШРУТ'}</footer>
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

      <button className="flow-next-action" disabled={routeDynamics.status === 'CLOSED'} onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>{routeDynamics.status === 'CLOSED' ? 'Выбери открытую линию' : 'Подобрать команду'}</strong></span><b>→</b></button>
    </section>
  );
}
