import { useEffect, useState, type ReactNode } from 'react';
import { formatSeasonDate } from '../core/career';
import type { CareerState, CareerTabId, WorldState } from '../core/types';
import { resetAppScroll } from './useMobile';

const primary = [
  { id: 'OVERVIEW' as const, label: 'Штаб', icon: '⌂' },
  { id: 'EXPEDITION' as const, label: 'Экспедиция', icon: '△' },
  { id: 'WORLD' as const, label: 'Мир', icon: '◉' },
  { id: 'JOURNAL' as const, label: 'Архив', icon: '▤' },
];

const prepTabs: CareerTabId[] = ['ROUTE', 'TEAM', 'EQUIPMENT', 'EXPEDITION'];
const worldTabs: CareerTabId[] = ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'];
const moreTabs: CareerTabId[] = ['PEOPLE'];

function isPrep(tab: CareerTabId) { return prepTabs.includes(tab); }
function isWorld(tab: CareerTabId) { return worldTabs.includes(tab); }
function isMore(tab: CareerTabId) { return moreTabs.includes(tab); }

function pageTitle(activeTab: CareerTabId, career: CareerState) {
  if (activeTab === 'OVERVIEW') return career.hero.name;
  if (isPrep(activeTab)) return 'Экспедиция';
  if (isWorld(activeTab)) return 'Живой мир';
  if (activeTab === 'JOURNAL') return 'Архив';
  if (activeTab === 'PEOPLE') return 'Досье';
  if (activeTab === 'CLIMB') return career.activeClimb ? 'Экспедиция' : 'Восхождение';
  return 'Карьера';
}

export function MobileCareerShell({ world, career, activeTab, onTab, onExit, onAtlas, locked = false, children }: {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onExit: () => void;
  onAtlas: () => void;
  locked?: boolean;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const title = pageTitle(activeTab, career);

  useEffect(() => setMoreOpen(false), [activeTab, locked]);

  const navigate = (tab: CareerTabId) => {
    if (locked && tab !== 'CLIMB') return;
    setMoreOpen(false);
    resetAppScroll();
    onTab(tab);
  };

  return (
    <main className={`m-career-shell ${locked ? 'is-expedition-locked' : ''}`}>
      <header className="m-career-topbar">
        <button className="m-topbar-back" disabled={locked} onClick={() => { if (!locked) { resetAppScroll(); onExit(); } }} aria-label={locked ? 'Экспедиция продолжается' : 'В главное меню'}>{locked ? '↑' : '←'}</button>
        <div className="m-topbar-title"><strong>{title}</strong><small>{locked ? 'Остальные разделы заблокированы до возвращения' : formatSeasonDate(career.year, career.seasonDay)}</small></div>
        <div className="m-topbar-money"><strong>{locked ? `${career.activeClimb?.currentElevation ?? 0}` : career.hero.money}</strong><small>{locked ? 'м' : 'кр.'}</small></div>
      </header>

      <section className="m-career-content" data-app-scroll>{children}</section>

      {!locked && <nav className="m-bottom-nav" aria-label="Основные разделы">
        {primary.map(item => {
          const active = item.id === 'EXPEDITION' ? isPrep(activeTab) : item.id === 'WORLD' ? isWorld(activeTab) : activeTab === item.id;
          const disabled = false;
          return <button key={item.id} disabled={disabled} className={active ? 'is-active' : ''} onClick={() => navigate(item.id)}><b>{item.icon}</b><span>{item.label}</span></button>;
        })}
        <button className={isMore(activeTab) || moreOpen ? 'is-active' : ''} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen}><b>•••</b><span>Ещё</span></button>
      </nav>}

      {!locked && moreOpen && <div className="m-more-layer" onClick={() => setMoreOpen(false)}><section className="m-more-sheet" onClick={event => event.stopPropagation()}><header><strong>Разделы</strong><button onClick={() => setMoreOpen(false)} aria-label="Закрыть">×</button></header><div className="m-more-menu"><button onClick={() => navigate('PEOPLE')}><span>Досье команды</span><b>›</b></button><button onClick={() => { setMoreOpen(false); resetAppScroll(); onAtlas(); }}><span>Горный атлас</span><b>›</b></button></div></section></div>}
    </main>
  );
}
