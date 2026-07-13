import type { ReactNode } from 'react';
import { formatSeasonDate } from '../core/career';
import type { CareerState, CareerTabId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onExit: () => void;
  onAtlas: () => void;
  children: ReactNode;
};

const tabs: Array<{ id: CareerTabId; index: string; label: string; short: string }> = [
  { id: 'OVERVIEW', index: '01', label: 'Штаб', short: 'Ш' },
  { id: 'ROUTE', index: '02', label: 'Маршрут', short: 'М' },
  { id: 'TEAM', index: '03', label: 'Команда', short: 'К' },
  { id: 'EQUIPMENT', index: '04', label: 'Снаряжение', short: 'С' },
  { id: 'EXPEDITION', index: '05', label: 'Экспедиция', short: 'Э' },
  { id: 'CLIMB', index: '06', label: 'Восхождение', short: 'В' },
  { id: 'JOURNAL', index: '07', label: 'Журнал', short: 'Ж' },
];

export function CareerShell({ world, career, activeTab, onTab, onExit, onAtlas, children }: Props) {
  const initials = career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <main className="career-shell">
      <aside className="career-sidebar">
        <button className="career-sidebar__brand" onClick={onExit} aria-label="В главное меню">
          <span>AL</span>
          <small>0.3</small>
        </button>

        <nav className="career-sidebar__nav" aria-label="Разделы карьеры">
          {tabs.map(tab => {
            const disabled = tab.id === 'CLIMB' && !career.activeClimb;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'is-active' : ''}
                disabled={disabled}
                onClick={() => onTab(tab.id)}
                title={tab.label}
              >
                <span className="career-sidebar__short">{tab.short}</span>
                <span className="career-sidebar__index">{tab.index}</span>
                <strong>{tab.label}</strong>
                {tab.id === 'CLIMB' && career.activeClimb && <i />}
              </button>
            );
          })}
        </nav>

        <div className="career-sidebar__footer">
          <button onClick={onAtlas} title="Горный атлас">△</button>
          <div><span>{initials}</span><small>{career.hero.reputation} REP</small></div>
        </div>
      </aside>

      <section className="career-workspace">
        <header className="career-topbar">
          <div>
            <small>{world.region.name}</small>
            <strong>{formatSeasonDate(career.year, career.seasonDay)}</strong>
          </div>
          <div className="career-topbar__status">
            <span>ФОРМА <b>{Math.round(career.hero.form)}</b></span>
            <span>УСТАЛОСТЬ <b>{Math.round(career.hero.fatigue)}</b></span>
            <span>СРЕДСТВА <b>{career.hero.money} кр.</b></span>
          </div>
          <button onClick={() => window.print()} aria-label="Печать">⎙</button>
        </header>
        <div className="career-workspace__content page-enter">{children}</div>
      </section>
    </main>
  );
}
