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

type PrimaryTab = {
  id: CareerTabId;
  label: string;
  short: string;
  description: string;
  children?: CareerTabId[];
};

const tabs: PrimaryTab[] = [
  { id: 'OVERVIEW', label: 'Штаб', short: 'Ш', description: 'Состояние и действия' },
  { id: 'ROUTE', label: 'Цель', short: 'Ц', description: 'Гора и маршрут' },
  { id: 'EXPEDITION', label: 'Подготовка', short: 'П', description: 'Люди, груз, выход', children: ['TEAM', 'PEOPLE', 'EQUIPMENT', 'EXPEDITION'] },
  { id: 'CLIMB', label: 'Восхождение', short: 'В', description: 'Маршрут в реальном времени' },
  { id: 'WORLD', label: 'Мир', short: 'М', description: 'Новости и соперники', children: ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'] },
  { id: 'JOURNAL', label: 'Архив', short: 'А', description: 'История карьеры' },
];

function isPrimaryActive(tab: PrimaryTab, activeTab: CareerTabId) {
  return tab.id === activeTab || tab.children?.includes(activeTab);
}

export function CareerShell({ world, career, activeTab, onTab, onExit, onAtlas, children }: Props) {
  const initials = career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const current = tabs.find(tab => isPrimaryActive(tab, activeTab)) ?? tabs[0]!;

  return (
    <main className="career-shell">
      <aside className="career-sidebar">
        <button className="career-sidebar__brand" onClick={onExit} aria-label="В главное меню">
          <span>AL</span>
          <small>0.5.3</small>
        </button>

        <nav className="career-sidebar__nav" aria-label="Главные разделы карьеры">
          {tabs.map((tab, index) => {
            const disabled = tab.id === 'CLIMB' && !career.activeClimb;
            const active = isPrimaryActive(tab, activeTab);
            return (
              <button
                key={tab.id}
                className={active ? 'is-active' : ''}
                disabled={disabled}
                onClick={() => onTab(tab.id === 'EXPEDITION' ? 'TEAM' : tab.id)}
                title={`${tab.label}: ${tab.description}`}
              >
                <span className="career-sidebar__short">{tab.short}</span>
                <span className="career-sidebar__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="career-sidebar__copy"><strong>{tab.label}</strong><small>{tab.description}</small></span>
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
          <div className="career-topbar__place">
            <small>{current.label} · {world.region.name}</small>
            <strong>{formatSeasonDate(career.year, career.seasonDay)}</strong>
          </div>
          <div className="career-topbar__status">
            <span>Форма <b>{Math.round(career.hero.form)}</b></span>
            <span>Усталость <b>{Math.round(career.hero.fatigue)}</b></span>
            <span>Средства <b>{career.hero.money} кр.</b></span>
          </div>
          <button onClick={() => window.print()} aria-label="Печать">⎙</button>
        </header>
        <div className="career-workspace__content page-enter">{children}</div>
      </section>
    </main>
  );
}
