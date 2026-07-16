import { SKILL_LABELS, schoolExpeditionBoard } from '../core/career';
import { SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase } from '../core/schoolExpeditions';
import type { CareerState, ClubRiskProfile, WorldState } from '../core/types';

const outcomeLabel = { SUMMIT: 'ВЕРШИНА', RETREAT: 'ОТХОД', FAILED: 'АВАРИЯ', TRAGEDY: 'ТРАГЕДИЯ' } as const;
const riskLabel: Record<ClubRiskProfile, string> = { CAUTIOUS: 'бережная', BALANCED: 'сбалансированная', AGGRESSIVE: 'рисковая' };

export function WorldScreen({ world, career }: { world: WorldState; career: CareerState }) {
  const living = career.livingWorld;
  const active = living.athletes.filter(item => item.status === 'ACTIVE' && item.recoveryDays === 0).length;
  const recovering = living.athletes.filter(item => item.status === 'INJURED' || item.recoveryDays > 0).length;
  const losses = living.athletes.filter(item => item.status === 'DEAD' || item.status === 'MISSING').length;
  const unclimbed = living.mountainHistory.filter(item => item.firstAscentYear === null).length;
  const latest = living.expeditions.slice(-7).reverse();
  const schoolPlans = schoolExpeditionBoard(world, career, true);

  return (
    <section className="workspace-page world-page">
      <header className="workspace-title">
        <div><p className="eyebrow">LIVING ALPINISM / REGIONAL SIMULATION</p><h1>Мир движется без тебя.</h1><p>Школы готовят людей, наставники водят собственные группы, сильные участники растут, а травмированные выпадают из сезона.</p></div>
        <div className="workspace-title__mark"><span>{living.tick}</span><small>WORLD TICKS</small></div>
      </header>

      <div className="world-metric-grid">
        <article><small>ГОТОВЫ К ВЫХОДУ</small><strong>{active}</strong><p>Сейчас могут присоединиться к новой экспедиции.</p></article>
        <article><small>ВОССТАНАВЛИВАЮТСЯ</small><strong>{recovering}</strong><p>Отдых, лечение и возвращение формы занимают время.</p></article>
        <article><small>НЕПОКОРЁННЫЕ ВЕРШИНЫ</small><strong>{unclimbed}</strong><p>Клубы могут забрать первое восхождение раньше игрока.</p></article>
        <article className={losses ? 'is-danger' : ''}><small>ПОГИБШИЕ И ПРОПАВШИЕ</small><strong>{losses}</strong><p>Потери навсегда остаются в истории региона.</p></article>
      </div>

      <section className="workspace-panel regional-expedition-board">
        <div className="panel-heading"><div><p className="eyebrow">SCHOOL PROGRAMS</p><h2>Кто куда собирается</h2></div><span>{schoolPlans.length} ПЛАНОВ</span></div>
        <div className="regional-expedition-list">
          {schoolPlans.map(plan => {
            const route = career.routes.find(item => item.id === plan.routeId);
            const leader = plan.leaderNpcId ? world.ecosystem.content.npcs.byId[plan.leaderNpcId] : null;
            const club = living.clubs.find(item => item.id === plan.organizationId);
            const phase = schoolExpeditionPhase(plan, career.seasonDay);
            return <article key={plan.id} className={`is-${phase.toLowerCase()}`}><span>{SCHOOL_EXPEDITION_PHASE_LABELS[phase]}</span><div><small>{club?.name ?? 'Независимая группа'} · {leader?.name ?? 'Инструктор'}</small><strong>{route?.mountainName ?? 'Неизвестная гора'} · {route?.name ?? 'Маршрут'}</strong><p>{plan.briefing}</p></div><b>день {plan.departureDay ?? '—'}</b></article>;
          })}
        </div>
      </section>

      <section className="workspace-panel mountain-state-board">
        <div className="panel-heading"><div><p className="eyebrow">MOUNTAIN STATE</p><h2>{world.region.name}</h2></div><span>{living.mountainHistory.length} SUMMITS</span></div>
        <div className="mountain-state-list">
          {living.mountainHistory.map(history => {
            const mountain = world.region.mountains.find(item => item.id === history.mountainId);
            return (
              <article key={history.mountainId}>
                <div className="mountain-state-rank">{String(world.region.mountains.findIndex(item => item.id === history.mountainId) + 1).padStart(2, '0')}</div>
                <div><small>{mountain?.elevation ?? 0} М · ВНИМАНИЕ {history.currentAttention}</small><h3>{history.mountainName}</h3><p>{mountain?.dangerProfile}</p></div>
                <div className="mountain-state-stats"><span>ПОПЫТКИ <b>{history.attempts}</b></span><span>ВЕРШИНЫ <b>{history.summits}</b></span><span>ПОТЕРИ <b>{history.deaths}</b></span></div>
                <div className={`mountain-state-status ${history.firstAscentYear ? 'is-climbed' : 'is-open'}`}><small>{history.firstAscentYear ? 'FIRST ASCENT' : 'OPEN OBJECTIVE'}</small><strong>{history.firstAscentYear ?? 'НЕ ПОКОРЕНА'}</strong></div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="world-columns">
        <section className="workspace-panel club-table">
          <div className="panel-heading"><div><p className="eyebrow">SCHOOL INDEX</p><h2>Школы региона</h2></div><span>IDENTITY</span></div>
          {living.clubs.slice().sort((a, b) => b.prestige - a.prestige).map((club, index) => {
            const clubAthletes = living.athletes.filter(item => item.clubId === club.id);
            const clubReady = clubAthletes.filter(item => item.status === 'ACTIVE' && item.recoveryDays === 0).length;
            const clubRecovering = clubAthletes.filter(item => item.status === 'INJURED' || item.recoveryDays > 0).length;
            return (
              <article key={club.id} className={club.id === career.club.id ? 'is-player-club' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><small>{club.country} · {club.foundedYear}</small><h3>{club.name}</h3><p>{club.doctrine}</p><div className="club-profile-facts"><span>{SKILL_LABELS[club.focusSkill]}</span><span>{riskLabel[club.riskProfile]}</span><span>подготовка {club.trainingQuality}</span><span>отдых {club.recoveryStandard}</span></div></div>
                <div><b>{club.prestige}</b><small>{clubReady} готовы · {clubRecovering} отдыхают</small><small>{club.summits} вершин · {club.losses} потерь</small></div>
              </article>
            );
          })}
        </section>

        <section className="workspace-panel world-expedition-strip">
          <div className="panel-heading"><div><p className="eyebrow">RECENT FIELD ACTIVITY</p><h2>Последние экспедиции</h2></div><span>LIVE</span></div>
          {latest.length === 0 ? <div className="empty-world-state"><strong>Сезон только начался.</strong><p>Продвинь время тренировкой — другие команды начнут действовать.</p></div> : latest.map(item => {
            const leader = living.athletes.find(athlete => athlete.id === item.leaderAthleteId);
            return <article key={item.id}><div className={`world-outcome is-${item.outcome.toLowerCase()}`}>{outcomeLabel[item.outcome]}</div><div><small>{item.year} · DAY {item.seasonDay} · {item.teamSize} ЧЕЛ. · {item.durationDays} ДН.</small><h3>{item.mountainName}</h3><p><b>{item.routeName}</b> · {item.summary}</p><em>После выхода: {item.recoveryDays} дн. восстановления</em></div><strong>{leader?.name ?? career.hero.name}</strong></article>;
          })}
        </section>
      </div>
    </section>
  );
}
