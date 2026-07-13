import type { CareerState, WorldRecord } from '../core/types';

function recordValue(record: WorldRecord) { return `${record.value.toLocaleString('ru-RU')} ${record.unit}`; }

export function RecordsScreen({ career }: { career: CareerState }) {
  const active = career.livingWorld.athletes.filter(item => item.status === 'ACTIVE');
  const fame = [...active].sort((a, b) => b.fame - a.fame).slice(0, 10);
  const summits = [...active].sort((a, b) => b.summits - a.summits || b.firstAscents - a.firstAscents).slice(0, 10);
  return (
    <section className="workspace-page records-page">
      <header className="workspace-title workspace-title--compact"><div><p className="eyebrow">VERIFIED ACHIEVEMENTS / REGIONAL ARCHIVE</p><h1>Рекорды</h1><p>История спорта хранит не уровень персонажа, а конкретную вершину, линию, время и имя.</p></div><div className="workspace-title__mark"><span>{career.livingWorld.records.length}</span><small>RECORDS</small></div></header>
      <div className="record-poster-grid">
        {career.livingWorld.records.map((record, index) => <article key={record.id}><div className="record-number">R/{String(index + 1).padStart(2, '0')}</div><small>{record.category} · {record.year}</small><h2>{record.title}</h2><strong>{recordValue(record)}</strong><p>{record.holderName}</p><em>{record.description}</em>{record.mountainName && <span>{record.mountainName}</span>}</article>)}
      </div>
      <div className="record-rankings">
        <section className="workspace-panel ranking-table"><div className="panel-heading"><div><p className="eyebrow">WORLD RANKING</p><h2>Известность</h2></div><span>FAME</span></div>{fame.map((person, index) => <article key={person.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{person.country}</small><h3>{person.name}</h3></div><strong>{person.fame}</strong></article>)}</section>
        <section className="workspace-panel ranking-table"><div className="panel-heading"><div><p className="eyebrow">SUMMIT TABLE</p><h2>Подтверждённые вершины</h2></div><span>SUMMITS</span></div>{summits.map((person, index) => <article key={person.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{person.firstAscents} первых</small><h3>{person.name}</h3></div><strong>{person.summits}</strong></article>)}</section>
      </div>
    </section>
  );
}
