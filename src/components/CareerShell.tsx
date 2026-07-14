import type { ReactNode } from 'react';
import { MobileCareerShell } from '../mobile/MobileCareerShell';
import { useIsMobile } from '../mobile/useMobile';
import { formatSeasonDate } from '../core/career';
import type { CareerState, CareerTabId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onExit: () => void;
  onAtlas: () => void;
  locked?: boolean;
  children: ReactNode;
};

type PrimaryTab = {
  id: CareerTabId;
  label: string;
  mobileLabel: string;
  short: string;
  description: string;
  children?: CareerTabId[];
};

const tabs: PrimaryTab[] = [
  { id: 'OVERVIEW', label: 'Штаб', mobileLabel: 'Штаб', short: 'Ш', description: 'Состояние и действия' },
  { id: 'ROUTE', label: 'Цель', mobileLabel: 'Цель', short: 'Ц', description: 'Гора и маршрут' },
  { id: 'EXPEDITION', label: 'Подготовка', mobileLabel: 'Сбор', short: 'П', description: 'Люди, груз, выход', children: ['TEAM', 'PEOPLE', 'EQUIPMENT', 'EXPEDITION'] },
  { id: 'CLIMB', label: 'Восхождение', mobileLabel: 'Путь', short: 'В', description: 'Маршрут в реальном времени' },
  { id: 'WORLD', label: 'Мир', mobileLabel: 'Мир', short: 'М', description: 'Новости и соперники', children: ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'] },
  { id: 'JOURNAL', label: 'Архив', mobileLabel: 'Архив', short: 'А', description: 'История карьеры' },
];

function isPrimaryActive(tab: PrimaryTab, activeTab: CareerTabId) {
  return tab.id === activeTab || tab.children?.includes(activeTab);
}

export function CareerShell({ world, career, activeTab, onTab, onExit, onAtlas, locked = false, children }: Props) {
  const mobile = useIsMobile();
  if (mobile) return <MobileCareerShell world={world} career={career} activeTab={activeTab} onTab={onTab} onExit={onExit} onAtlas={onAtlas} locked={locked}>{children}</MobileCareerShell>;

  const initials = career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const current = tabs.find(tab => isPrimaryActive(tab, activeTab)) ?? tabs[0]!;

  return (
    <main className={`career-shell ${locked ? 'is-expedition-locked' : ''}`}>
      <aside className="career-sidebar">
        <nav className="career-sidebar__nav" aria-label="Главные разделы карьеры">
          {tabs.map((tab, index) => {
            const disabled = locked ? tab.id !== 'CLIMB' : tab.id === 'CLIMB' && !career.activeClimb;
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
                <span className="career-sidebar__mobile-label">{tab.mobileLabel}</span>
                {tab.id === 'CLIMB' && career.activeClimb && <i />}
              </button>
            );
          })}
        </nav>

        <div className="career-sidebar__footer">
          <button disabled={locked} onClick={onAtlas} title="Горный атлас" aria-label="Открыть горный атлас">△</button>
          <div><span>{initials}</span><small>{career.hero.reputation} REP</small></div>
        </div>
      </aside>

      <section className="career-workspace">
        <header className="career-topbar">
          <button className="career-topbar__menu" disabled={locked} onClick={onExit}>{locked ? "Экспедиция идёт" : "← Меню"}</button>
          <div className="career-topbar__place">
            <small>{current.label} · {world.region.name}</small>
            <strong>{formatSeasonDate(career.year, career.seasonDay)}</strong>
          </div>
          <div className="career-topbar__status">
            <span>Форма <b>{Math.round(career.hero.form)}</b></span>
            <span>Усталость <b>{Math.round(career.hero.fatigue)}</b></span>
            <span>Средства <b>{career.hero.money} кр.</b></span>
          </div>
          <button className="career-topbar__print" onClick={() => window.print()} aria-label="Печать">⎙</button>
        </header>
        <div className="career-workspace__content page-enter">{children}</div>
      </section>
    </main>
  );
}
