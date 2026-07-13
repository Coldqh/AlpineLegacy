import type { CareerState, WorldState } from '../core/types';

type Props = { career: CareerState; world: WorldState };

function durationLabel(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return `${days ? `${days}д ` : ''}${hours}ч ${String(rest).padStart(2, '0')}м`;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function JournalScreen({ career, world }: Props) {
  const climbLines = career.activeClimb?.log ?? [];
  const safeName = career.hero.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  return (
    <section className="workspace-page journal-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">STRUCTURED MEMORY / CAREER LEDGER</p><h1>Журнал</h1><p>Все приказы, выборы линии, травмы, отношения и возвращения остаются в истории карьеры.</p></div>
        <div className="workspace-title__mark"><span>{career.log.length}</span><small>ЗАПИСЕЙ</small></div>
      </header>

      <section className="workspace-panel save-toolkit">
        <div className="panel-heading"><div><p className="eyebrow">FIELD DATA TOOLKIT</p><h2>Сейв и воспроизведение</h2></div><span>SCHEMA V{career.schemaVersion}</span></div>
        <p>Экспорт нужен для проверки сложных экспедиций: один файл сохраняет полное состояние, второй — только журнал действий.</p>
        <div>
          <button onClick={() => downloadJson(`alpine-legacy-${safeName}-save.json`, { world, career })}><strong>Экспортировать сейв</strong><small>Мир, герой, команда и вся симуляция</small></button>
          <button onClick={() => downloadJson(`alpine-legacy-${safeName}-replay.json`, { seed: world.config.seed, careerId: career.id, activeClimb: career.activeClimb ? { id: career.activeClimb.id, routeId: career.activeClimb.routeId, routeChoices: career.activeClimb.routeChoices, decisions: career.activeClimb.decisions, log: career.activeClimb.log } : null, reports: career.reports })}><strong>Экспортировать replay</strong><small>Seed, решения и журнал команд</small></button>
          <button onClick={() => navigator.clipboard?.writeText(world.config.seed)}><strong>Копировать seed</strong><small>{world.config.seed}</small></button>
        </div>
      </section>

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
                {report.routeChoices && report.routeChoices.length > 0 && <div className="report-route-choices">{report.routeChoices.map(choice => <span key={`${choice.decisionId}-${choice.optionId}`}><b>{choice.title}</b>{choice.note}</span>)}</div>}
                {report.decisions.length > 0 && <div className="report-decisions">{report.decisions.map(decision => <span key={decision.id} className={decision.accepted ? 'is-accepted' : 'is-refused'}>{decision.accepted ? 'ПРИНЯТ' : 'ОТКАЗ'} · {decision.description}</span>)}</div>}
              </div>
              <div className="report-numbers"><span>REP <b>{report.reputationDelta >= 0 ? '+' : ''}{report.reputationDelta}</b></span><span>КР. <b>{report.moneyDelta >= 0 ? '+' : ''}{report.moneyDelta}</b></span><span>FIX <b>{report.fixedRopes ?? 0}</b></span></div>
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
