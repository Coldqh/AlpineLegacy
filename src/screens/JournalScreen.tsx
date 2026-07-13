import type { CareerState } from '../core/types';

type Props = { career: CareerState };

function durationLabel(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return `${days ? `${days}д ` : ''}${hours}ч ${String(rest).padStart(2, '0')}м`;
}

export function JournalScreen({ career }: Props) {
  const climbLines = career.activeClimb?.log ?? [];
  return (
    <section className="workspace-page journal-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">STRUCTURED MEMORY / CAREER LEDGER</p><h1>Журнал</h1><p>Все приказы, отказы, травмы, отношения и возвращения остаются в истории карьеры.</p></div>
        <div className="workspace-title__mark"><span>{career.log.length}</span><small>ЗАПИСЕЙ</small></div>
      </header>

      {climbLines.length > 0 && (
        <section className="workspace-panel live-journal">
          <div className="panel-heading"><div><p className="eyebrow">ACTIVE EXPEDITION</p><h2>Полевой журнал</h2></div><span>{climbLines.length} LINES</span></div>
          {[...climbLines].reverse().map((line, index) => <article key={`${line}-${index}`}><span>{String(climbLines.length - index).padStart(2, '0')}</span><p>{line}</p></article>)}
        </section>
      )}

      {career.reports.length > 0 && (
        <section className="workspace-panel expedition-reports">
          <div className="panel-heading"><div><p className="eyebrow">AFTER ACTION REPORTS</p><h2>Итоги экспедиций</h2></div><span>{career.reports.length} FILES</span></div>
          {[...career.reports].reverse().map(report => (
            <article key={report.id}>
              <div className={`report-outcome is-${report.outcome.toLowerCase()}`}><small>{report.outcome}</small><strong>{report.highestElevation} м</strong></div>
              <div className="report-body">
                <small>{report.year} · DAY {report.seasonDay} · {durationLabel(report.elapsedMinutes)}</small>
                <h3>{report.mountainName}</h3><p>{report.routeName}</p>
                <div className="report-reactions"><span><b>Клуб</b>{report.clubReaction}</span><span><b>Пресса</b>{report.pressReaction}</span></div>
                {report.decisions.length > 0 && <div className="report-decisions">{report.decisions.map(decision => <span key={decision.id} className={decision.accepted ? 'is-accepted' : 'is-refused'}>{decision.accepted ? 'ПРИНЯТ' : 'ОТКАЗ'} · {decision.description}</span>)}</div>}
              </div>
              <div className="report-numbers"><span>REP <b>{report.reputationDelta >= 0 ? '+' : ''}{report.reputationDelta}</b></span><span>КР. <b>{report.moneyDelta >= 0 ? '+' : ''}{report.moneyDelta}</b></span></div>
            </article>
          ))}
        </section>
      )}

      <section className="workspace-panel career-ledger">
        <div className="panel-heading"><div><p className="eyebrow">CAREER HISTORY</p><h2>{career.hero.name}</h2></div><span>{career.highestElevation} M</span></div>
        {[...career.log].reverse().map(entry => <article key={entry.id}><div><strong>{entry.year}</strong><small>DAY {entry.seasonDay}</small></div><i /><div><small>{entry.type}</small><h3>{entry.title}</h3><p>{entry.description}</p></div></article>)}
      </section>
    </section>
  );
}
