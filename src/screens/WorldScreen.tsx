import type { CareerState, WorldState } from '../core/types';

const outcomeLabel = { SUMMIT: 'ВЕРШИНА', RETREAT: 'ОТХОД', FAILED: 'АВАРИЯ', TRAGEDY: 'ТРАГЕДИЯ' } as const;

export function WorldScreen({ world, career }: { world: WorldState; career: CareerState }) {
  const living = career.livingWorld;
  const active = living.athletes.filter(item => item.status === 'ACTIVE').length;
  const losses = living.athletes.filter(item => item.status === 'DEAD' || item.status === 'MISSING').length;
  const unclimbed = living.mountainHistory.filter(item => item.firstAscentYear === null).length;
  const latest = living.expeditions.slice(-5).reverse();

  return (
    <section className="workspace-page world-page">
      <header className="workspace-title">
        <div><p className="eyebrow">LIVING ALPINISM / REGIONAL SIMULATION</p><h1>Мир движется без тебя.</h1><p>Клубы строят планы, конкуренты выходят на маршруты, вершины получают первых покорителей, а ошибки остаются в архиве.</p></div>
        <div className="workspace-title__mark"><span>{living.tick}</span><small>WORLD TICKS</small></div>
      </header>

      <div className="world-metric-grid">
        <article><small>АКТИВНЫЕ АЛЬПИНИСТЫ</small><strong>{active}</strong><p>Из {living.athletes.length} персонажей текущего поколения.</p></article>
        <article><small>НЕПОКОРЁННЫЕ ВЕРШИНЫ</small><strong>{unclimbed}</strong><p>Каждая может получить историю до твоего выхода.</p></article>
        <article><small>ЭКСПЕДИЦИИ МИРА</small><strong>{living.expeditions.length}</strong><p>Автономные попытки клубов региона.</p></article>
        <article className={losses ? 'is-danger' : ''}><small>ПОГИБШИЕ И ПРОПАВШИЕ</small><strong>{losses}</strong><p>Люди не возвращаются в активный пул.</p></article>
      </div>

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
          <div className="panel-heading"><div><p className="eyebrow">CLUB INDEX</p><h2>Клубы региона</h2></div><span>PRESTIGE</span></div>
          {living.clubs.slice().sort((a, b) => b.prestige - a.prestige).map((club, index) => (
            <article key={club.id} className={club.id === career.club.id ? 'is-player-club' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span><div><small>{club.country} · {club.foundedYear}</small><h3>{club.name}</h3><p>{club.doctrine}</p></div><div><b>{club.prestige}</b><small>{club.summits} SUMMITS · {club.losses} LOSSES</small></div>
            </article>
          ))}
        </section>

        <section className="workspace-panel world-expedition-strip">
          <div className="panel-heading"><div><p className="eyebrow">RECENT FIELD ACTIVITY</p><h2>Последние экспедиции</h2></div><span>LIVE</span></div>
          {latest.length === 0 ? <div className="empty-world-state"><strong>Сезон только начался.</strong><p>Продвинь время тренировкой — другие команды начнут действовать.</p></div> : latest.map(item => {
            const leader = living.athletes.find(athlete => athlete.id === item.leaderAthleteId);
            return <article key={item.id}><div className={`world-outcome is-${item.outcome.toLowerCase()}`}>{outcomeLabel[item.outcome]}</div><div><small>{item.year} · DAY {item.seasonDay} · {item.durationDays} ДНЕЙ</small><h3>{item.mountainName}</h3><p>{item.summary}</p></div><strong>{leader?.name ?? career.hero.name}</strong></article>;
          })}
        </section>
      </div>
    </section>
  );
}
