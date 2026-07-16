import { SKILL_LABELS, schoolExpeditionBoard } from '../core/career';
import { SCHOOL_EXPEDITION_PHASE_LABELS, schoolExpeditionPhase } from '../core/schoolExpeditions';
import { careerRegion, regionAccessList, regionMountains } from '../core/regionalCareer';
import type { CareerState, ClubRiskProfile, WorldState } from '../core/types';

const outcomeLabel = { SUMMIT: 'ВЕРШИНА', RETREAT: 'ОТХОД', FAILED: 'АВАРИЯ', TRAGEDY: 'ТРАГЕДИЯ' } as const;
const riskLabel: Record<ClubRiskProfile, string> = { CAUTIOUS: 'бережная', BALANCED: 'сбалансированная', AGGRESSIVE: 'рисковая' };

export function WorldScreen({ world, career, onTravel }: { world: WorldState; career: CareerState; onTravel: (regionId: string) => void }) {
  const living = career.livingWorld;
  const currentRegion = careerRegion(world, career);
  const localMountains = regionMountains(world, currentRegion.id);
  const localMountainIds = new Set(localMountains.map(item => item.id));
  const localClubs = living.clubs.filter(club => club.regionId === currentRegion.id);
  const localClubIds = new Set(localClubs.map(club => club.id));
  const localAthletes = living.athletes.filter(item => localClubIds.has(item.clubId));
  const active = localAthletes.filter(item => item.status === 'ACTIVE' && item.recoveryDays === 0).length;
  const recovering = localAthletes.filter(item => item.status === 'INJURED' || item.recoveryDays > 0).length;
  const losses = localAthletes.filter(item => item.status === 'DEAD' || item.status === 'MISSING').length;
  const localHistory = living.mountainHistory.filter(item => localMountainIds.has(item.mountainId));
  const unclimbed = localHistory.filter(item => item.firstAscentYear === null).length;
  const latest = living.expeditions.filter(item => item.regionId === currentRegion.id).slice(-7).reverse();
  const schoolPlans = schoolExpeditionBoard(world, career, true);
  const regionAccess = regionAccessList(world, career);

  return (
    <section className="workspace-page world-page">
      <header className="workspace-title">
        <div><p className="eyebrow">WORLD CAREER / {currentRegion.country ?? 'РЕГИОН'}</p><h1>{currentRegion.name}</h1><p>{currentRegion.summary}</p></div>
        <div className="workspace-title__mark"><span>{living.tick}</span><small>WORLD TICKS</small></div>
      </header>

      <section className="workspace-panel world-region-board">
        <div className="panel-heading"><div><p className="eyebrow">WORLD REGIONS</p><h2>Куда ехать дальше</h2></div><span>{regionAccess.filter(item => item.unlocked).length}/{regionAccess.length} ОТКРЫТО</span></div>
        <div className="world-region-grid">
          {regionAccess.map(({ region, unlocked, current, reputationGap, affordable, travelCost, travelDays }) => (
            <article key={region.id} className={`${current ? 'is-current' : ''} ${!unlocked ? 'is-locked' : ''}`}>
              <header><small>{region.country} · {region.rangeName}</small><strong>{region.name}</strong></header>
              <p>{region.subtitle}</p>
              <div><span>{region.elevationMin}–{region.elevationMax} м</span><span>{region.climbingSeason}</span></div>
              <footer>
                <small>{current ? 'ТЫ ЗДЕСЬ' : !unlocked ? `НУЖНО +${reputationGap} РЕП.` : `${travelDays} дн. · ${travelCost} кр.`}</small>
                <button disabled={current || !unlocked || !affordable || Boolean(career.activeClimb)} onClick={() => onTravel(region.id)}>{current ? 'Текущий регион' : !unlocked ? 'Закрыто' : !affordable ? 'Нет средств' : 'Переехать'}</button>
              </footer>
            </article>
          ))}
        </div>
      </section>

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
        <div className="panel-heading"><div><p className="eyebrow">MOUNTAIN STATE</p><h2>{currentRegion.name}</h2></div><span>{localHistory.length} ВЕРШИН</span></div>
        <div className="mountain-state-list">
          {localHistory.map(history => {
            const mountain = world.ecosystem.content.mountains.byId[history.mountainId];
            return (
              <article key={history.mountainId}>
                <div className="mountain-state-rank">{String(localMountains.findIndex(item => item.id === history.mountainId) + 1).padStart(2, '0')}</div>
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
          {localClubs.slice().sort((a, b) => b.prestige - a.prestige).map((club, index) => {
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
