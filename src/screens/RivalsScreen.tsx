import { useMemo, useState } from 'react';
import { SKILL_LABELS } from '../core/career';
import type { CareerState, WorldAthlete } from '../core/types';

function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
function statusLabel(person: WorldAthlete) { return person.status === 'ACTIVE' ? 'АКТИВЕН' : person.status === 'INJURED' ? 'ТРАВМИРОВАН' : person.status === 'RETIRED' ? 'ЗАВЕРШИЛ' : person.status === 'MISSING' ? 'ПРОПАЛ' : 'ПОГИБ'; }

export function RivalsScreen({ career }: { career: CareerState }) {
  const candidates = useMemo(() => [...career.livingWorld.athletes].sort((a, b) => (b.rivalry + b.fame + (b.knownToHero ? 24 : 0)) - (a.rivalry + a.fame + (a.knownToHero ? 24 : 0))), [career.livingWorld.athletes]);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? '');
  const selected = candidates.find(item => item.id === selectedId) ?? candidates[0];
  if (!selected) return null;
  const club = career.livingWorld.clubs.find(item => item.id === selected.clubId);
  const ranking = [...career.livingWorld.athletes].filter(item => item.status === 'ACTIVE').sort((a, b) => b.fame - a.fame).findIndex(item => item.id === selected.id) + 1;
  return (
    <section className="workspace-page rivals-page">
      <header className="workspace-title workspace-title--compact"><div><p className="eyebrow">COMPETITIVE FIELD / GENERATIONAL RACE</p><h1>Соперники</h1><p>Они борются за те же вершины, первые линии и место в истории. Некоторые знают тебя лично.</p></div><div className="workspace-title__mark"><span>{career.livingWorld.athletes.filter(item => item.status === 'ACTIVE').length}</span><small>ACTIVE</small></div></header>
      <div className="rivals-layout">
        <aside className="workspace-panel rival-index">
          <div className="panel-heading"><div><p className="eyebrow">WATCH LIST</p><h2>Поле конкурентов</h2></div><span>FAME</span></div>
          {candidates.slice(0, 18).map(person => <button key={person.id} className={selected.id === person.id ? 'is-active' : ''} onClick={() => setSelectedId(person.id)}><span>{initials(person.name)}</span><div><small>{person.country} · {statusLabel(person)}</small><strong>{person.name}</strong><em>{person.currentGoal}</em></div><b>{person.fame}</b></button>)}
        </aside>
        <section className="workspace-panel rival-file">
          <div className="rival-file__head"><div className="rival-monogram">{initials(selected.name)}</div><div><p className="eyebrow">RIVAL FILE / #{String(Math.max(1, ranking)).padStart(2, '0')}</p><h2>{selected.name}</h2><p>{selected.age} лет · {selected.country} · {club?.name}</p></div><div className={`rival-status is-${selected.status.toLowerCase()}`}>{statusLabel(selected)}</div></div>
          <div className="rival-scoreline"><div><small>ИЗВЕСТНОСТЬ</small><strong>{selected.fame}</strong></div><div><small>СОПЕРНИЧЕСТВО</small><strong>{selected.rivalry}</strong></div><div><small>ВЕРШИНЫ</small><strong>{selected.summits}</strong></div><div><small>ПЕРВЫЕ</small><strong>{selected.firstAscents}</strong></div></div>
          <div className="rival-columns">
            <div><p className="eyebrow">CURRENT OBJECTIVE</p><h3>{selected.currentGoal}</h3><p>{selected.relationshipNote}</p></div>
            <div><p className="eyebrow">LAST VERIFIED EVENT</p><h3>{selected.lastEvent}</h3><p>{selected.injuries.length ? `Последствия: ${selected.injuries.join(', ')}.` : 'Серьёзных подтверждённых травм нет.'}</p></div>
          </div>
          <div className="rival-bars">
            {[['Техника', selected.skill], ['Выносливость', selected.endurance], ['Высота', selected.altitude]].map(([label, value]) => <div key={String(label)}><span>{label}</span><i style={{ '--value': `${Number(value) * 10}%` } as React.CSSProperties} /><b>{value}/10</b></div>)}
          </div>
          <div className="rival-traits"><span>{SKILL_LABELS[selected.specialty]}</span><span>Осторожность {selected.caution}</span><span>Амбиции {selected.ambition}</span><span>Опыт {selected.experience}</span><span>Спасения {selected.rescues}</span></div>
        </section>
      </div>
    </section>
  );
}
