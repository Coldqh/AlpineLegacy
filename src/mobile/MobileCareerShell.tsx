import { useState, type ReactNode } from 'react';
import { formatSeasonDate } from '../core/career';
import type { CareerState, CareerTabId, WorldState } from '../core/types';

const primary = [
  { id: 'OVERVIEW' as const, label: 'Главная', icon: '⌂' },
  { id: 'ROUTE' as const, label: 'Цель', icon: '△' },
  { id: 'TEAM' as const, label: 'Сбор', icon: '≡' },
  { id: 'CLIMB' as const, label: 'Путь', icon: '↑' },
];

function isPrep(tab: CareerTabId) { return ['TEAM', 'EQUIPMENT', 'EXPEDITION'].includes(tab); }
function isMore(tab: CareerTabId) { return ['WORLD', 'NEWS', 'RIVALS', 'RECORDS', 'JOURNAL', 'PEOPLE'].includes(tab); }

export function MobileCareerShell({ world, career, activeTab, onTab, onExit, onAtlas, children }: { world: WorldState; career: CareerState; activeTab: CareerTabId; onTab: (tab: CareerTabId) => void; onExit: () => void; onAtlas: () => void; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const title = activeTab === 'OVERVIEW' ? career.hero.name : activeTab === 'ROUTE' ? 'Цель экспедиции' : isPrep(activeTab) ? 'Подготовка' : activeTab === 'CLIMB' ? 'Восхождение' : activeTab === 'JOURNAL' ? 'Архив' : activeTab === 'PEOPLE' ? 'Досье' : 'Живой мир';

  const navigate = (tab: CareerTabId) => { setMoreOpen(false); onTab(tab); };

  return (
    <main className="m-career-shell">
      <header className="m-career-topbar">
        <button onClick={onExit} aria-label="В главное меню">←</button>
        <div><strong>{title}</strong><small>{formatSeasonDate(career.year, career.seasonDay)} · {world.region.name}</small></div>
        <span>{career.hero.money} кр.</span>
      </header>
      <section className="m-career-content">{children}</section>
      <nav className="m-bottom-nav" aria-label="Основные разделы">
        {primary.map(item => {
          const active = item.id === 'TEAM' ? isPrep(activeTab) : activeTab === item.id;
          const disabled = item.id === 'CLIMB' && !career.activeClimb;
          return <button key={item.id} disabled={disabled} className={active ? 'is-active' : ''} onClick={() => navigate(item.id)}><b>{item.icon}</b><span>{item.label}</span></button>;
        })}
        <button className={isMore(activeTab) || moreOpen ? 'is-active' : ''} onClick={() => setMoreOpen(value => !value)}><b>•••</b><span>Ещё</span></button>
      </nav>
      {moreOpen && <div className="m-more-layer" onClick={() => setMoreOpen(false)}><section className="m-more-sheet" onClick={event => event.stopPropagation()}><header><strong>Разделы</strong><button onClick={() => setMoreOpen(false)}>×</button></header><div>
        <button onClick={() => navigate('WORLD')}><span>Живой мир</span><small>Новости, соперники, рекорды</small></button>
        <button onClick={() => navigate('JOURNAL')}><span>Архив карьеры</span><small>Экспедиции и записи</small></button>
        <button onClick={() => navigate('PEOPLE')}><span>Досье людей</span><small>Отношения и память</small></button>
        <button onClick={() => { setMoreOpen(false); onAtlas(); }}><span>Горный атлас</span><small>Все вершины региона</small></button>
        <button onClick={() => { setMoreOpen(false); onExit(); }}><span>Главное меню</span><small>Выйти из карьеры</small></button>
      </div></section></div>}
    </main>
  );
}
