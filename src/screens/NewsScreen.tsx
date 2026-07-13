import { useMemo, useState } from 'react';
import type { CareerState, WorldEventType } from '../core/types';

const filters: Array<{ id: 'ALL' | WorldEventType; label: string }> = [
  { id: 'ALL', label: 'Все' }, { id: 'SUMMIT', label: 'Вершины' }, { id: 'RECORD', label: 'Рекорды' }, { id: 'RETREAT', label: 'Отходы' }, { id: 'INJURY', label: 'Аварии' }, { id: 'DEATH', label: 'Потери' },
];

export function NewsScreen({ career }: { career: CareerState }) {
  const [filter, setFilter] = useState<'ALL' | WorldEventType>('ALL');
  const items = useMemo(() => career.livingWorld.news.filter(item => filter === 'ALL' || item.type === filter), [career.livingWorld.news, filter]);
  const lead = items[0];
  return (
    <section className="workspace-page news-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">REGIONAL PRESS / VERIFIED REPORTS</p><h1>Новости</h1><p>Мир не ждёт героя. Здесь фиксируются подтверждённые восхождения, аварии, рекорды и решения других команд.</p></div>
        <div className="workspace-title__mark"><span>{career.livingWorld.news.length}</span><small>REPORTS</small></div>
      </header>
      <div className="news-filter-row">{filters.map(item => <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      {lead && (
        <article className={`news-lead ${lead.isBreaking ? 'is-breaking' : ''}`}>
          <div><small>{lead.isBreaking ? 'BREAKING / ' : ''}{lead.year} · DAY {lead.seasonDay} · {lead.type}</small><h2>{lead.headline}</h2><p>{lead.summary}</p></div><span>{String(lead.importance).padStart(2, '0')}</span>
        </article>
      )}
      <div className="news-grid">
        {items.slice(1).map((item, index) => (
          <article key={item.id} className={item.isBreaking ? 'is-breaking' : ''}>
            <div className="news-index">{String(index + 2).padStart(2, '0')}</div><small>{item.year} · DAY {item.seasonDay} · {item.type}</small><h3>{item.headline}</h3><p>{item.summary}</p><footer><span>IMPORTANCE</span><b>{item.importance}</b></footer>
          </article>
        ))}
      </div>
      {items.length === 0 && <div className="workspace-panel empty-world-state"><strong>Подходящих сообщений нет.</strong><p>Фильтр пуст для текущего этапа сезона.</p></div>}
    </section>
  );
}
