import type { CareerState } from '../core/types';

type Props = { career: CareerState };

export function JournalScreen({ career }: Props) {
  const climbLines = career.activeClimb?.log ?? [];
  return (
    <section className="workspace-page journal-page">
      <header className="workspace-title workspace-title--compact"><div><p className="eyebrow">STRUCTURED MEMORY / CAREER LEDGER</p><h1>Журнал</h1><p>Все решения, травмы, отказы и возвращения сохраняются как история карьеры.</p></div><div className="workspace-title__mark"><span>{career.log.length}</span><small>ЗАПИСЕЙ</small></div></header>
      {climbLines.length > 0 && <section className="workspace-panel live-journal"><div className="panel-heading"><div><p className="eyebrow">ACTIVE EXPEDITION</p><h2>Полевой журнал</h2></div><span>{climbLines.length} LINES</span></div>{[...climbLines].reverse().map((line, index) => <article key={`${line}-${index}`}><span>{String(climbLines.length - index).padStart(2, '0')}</span><p>{line}</p></article>)}</section>}
      <section className="workspace-panel career-ledger"><div className="panel-heading"><div><p className="eyebrow">CAREER HISTORY</p><h2>{career.hero.name}</h2></div><span>{career.highestElevation} M</span></div>{[...career.log].reverse().map(entry => <article key={entry.id}><div><strong>{entry.year}</strong><small>DAY {entry.seasonDay}</small></div><i /><div><small>{entry.type}</small><h3>{entry.title}</h3><p>{entry.description}</p></div></article>)}</section>
    </section>
  );
}
