import { useEffect, useState, type ReactNode } from 'react';
import { formatSeasonDate } from '../core/career';
import type { CareerState, CareerTabId, WorldState } from '../core/types';
import { resetAppScroll } from './useMobile';

const primary = [
  { id: 'OVERVIEW' as const, label: 'Штаб', icon: '⌂' },
  { id: 'ROUTE' as const, label: 'Цель', icon: '△' },
  { id: 'TEAM' as const, label: 'Сбор', icon: '≡' },
  { id: 'CLIMB' as const, label: 'Путь', icon: '↑' },
];

const prepTabs: CareerTabId[] = ['TEAM', 'EQUIPMENT', 'EXPEDITION'];
const moreTabs: CareerTabId[] = ['WORLD', 'NEWS', 'RIVALS', 'RECORDS', 'JOURNAL', 'PEOPLE'];

function isPrep(tab: CareerTabId) { return prepTabs.includes(tab); }
function isMore(tab: CareerTabId) { return moreTabs.includes(tab); }

function pageTitle(activeTab: CareerTabId, career: CareerState) {
  if (activeTab === 'OVERVIEW') return career.hero.name;
  if (activeTab === 'ROUTE') return 'Цель';
  if (isPrep(activeTab)) return 'Подготовка';
  if (activeTab === 'CLIMB') return 'Восхождение';
  if (activeTab === 'JOURNAL') return 'Архив';
  if (activeTab === 'PEOPLE') return 'Досье';
  if (activeTab === 'NEWS') return 'Новости';
  if (activeTab === 'RIVALS') return 'Соперники';
  if (activeTab === 'RECORDS') return 'Рекорды';
  return 'Живой мир';
}

export function MobileCareerShell({ world, career, activeTab, onTab, onExit, onAtlas, children }: {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onExit: () => void;
  onAtlas: () => void;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const title = pageTitle(activeTab, career);

  useEffect(() => setMoreOpen(false), [activeTab]);

  const navigate = (tab: CareerTabId) => {
    setMoreOpen(false);
    resetAppScroll();
    onTab(tab);
  };

  return (
    <main className="m-career-shell">
      <header className="m-career-topbar">
        <button className="m-topbar-back" onClick={() => { resetAppScroll(); onExit(); }} aria-label="В главное меню">←</button>
        <div className="m-topbar-title"><strong>{title}</strong><small>{formatSeasonDate(career.year, career.seasonDay)}</small></div>
        <div className="m-topbar-money"><strong>{career.hero.money}</strong><small>кр.</small></div>
      </header>

      <section className="m-career-content" data-app-scroll>{children}</section>

      <nav className="m-bottom-nav" aria-label="Основные разделы">
        {primary.map(item => {
          const active = item.id === 'TEAM' ? isPrep(activeTab) : activeTab === item.id;
          const disabled = item.id === 'CLIMB' && !career.activeClimb;
          return (
            <button key={item.id} disabled={disabled} className={active ? 'is-active' : ''} onClick={() => navigate(item.id)}>
              <b>{item.icon}</b><span>{item.label}</span>
            </button>
          );
        })}
        <button className={isMore(activeTab) || moreOpen ? 'is-active' : ''} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen}>
          <b>•••</b><span>Ещё</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="m-more-layer" onClick={() => setMoreOpen(false)}>
          <section className="m-more-sheet" onClick={event => event.stopPropagation()}>
            <header><div><small>{world.region.name}</small><strong>Разделы</strong></div><button onClick={() => setMoreOpen(false)} aria-label="Закрыть">×</button></header>
            <div className="m-more-menu">
              <button onClick={() => navigate('WORLD')}><span>Живой мир</span><small>Обзор региона</small><b>›</b></button>
              <button onClick={() => navigate('NEWS')}><span>Новости</span><small>События сезона</small><b>›</b></button>
              <button onClick={() => navigate('RIVALS')}><span>Соперники</span><small>Активные альпинисты</small><b>›</b></button>
              <button onClick={() => navigate('RECORDS')}><span>Рекорды</span><small>Лучшие результаты</small><b>›</b></button>
              <button onClick={() => navigate('JOURNAL')}><span>Архив карьеры</span><small>Экспедиции и записи</small><b>›</b></button>
              <button onClick={() => navigate('PEOPLE')}><span>Досье людей</span><small>Отношения и память</small><b>›</b></button>
              <button onClick={() => { setMoreOpen(false); resetAppScroll(); onAtlas(); }}><span>Горный атлас</span><small>Все вершины региона</small><b>›</b></button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
