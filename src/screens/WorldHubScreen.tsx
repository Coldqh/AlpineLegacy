import { useEffect, useState } from 'react';
import type { CareerState, CareerTabId, WorldState } from '../core/types';
import { NewsScreen } from './NewsScreen';
import { RecordsScreen } from './RecordsScreen';
import { RivalsScreen } from './RivalsScreen';
import { WorldScreen } from './WorldScreen';

type WorldView = 'WORLD' | 'NEWS' | 'RIVALS' | 'RECORDS';

export function WorldHubScreen({ world, career, initialView, onTravel }: {
  world: WorldState;
  career: CareerState;
  initialView: CareerTabId;
  onTravel: (regionId: string) => void;
}) {
  const normalized = (['WORLD', 'NEWS', 'RIVALS', 'RECORDS'] as CareerTabId[]).includes(initialView) ? initialView as WorldView : 'WORLD';
  const [view, setView] = useState<WorldView>(normalized);
  useEffect(() => setView(normalized), [normalized]);

  return (
    <section className="world-hub">
      <header className="world-hub__header">
        <div><span>ЖИВОЙ МИР</span><h1>Горы, школы и люди</h1><p>Все мировые события собраны в одном месте. Переключай слой, не теряя контекст региона.</p></div>
        <nav aria-label="Разделы живого мира">
          <button className={view === 'WORLD' ? 'is-active' : ''} onClick={() => setView('WORLD')}>Обзор</button>
          <button className={view === 'NEWS' ? 'is-active' : ''} onClick={() => setView('NEWS')}>Новости</button>
          <button className={view === 'RIVALS' ? 'is-active' : ''} onClick={() => setView('RIVALS')}>Люди</button>
          <button className={view === 'RECORDS' ? 'is-active' : ''} onClick={() => setView('RECORDS')}>Рекорды</button>
        </nav>
      </header>
      <div className="world-hub__content">
        {view === 'WORLD' && <WorldScreen world={world} career={career} onTravel={onTravel} />}
        {view === 'NEWS' && <NewsScreen career={career} />}
        {view === 'RIVALS' && <RivalsScreen career={career} />}
        {view === 'RECORDS' && <RecordsScreen career={career} />}
      </div>
    </section>
  );
}
