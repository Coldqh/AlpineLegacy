import { useState } from 'react';
import { MountainArt } from '../components/MountainArt';
import type { DifficultyId, EraId, MountainData, WorldSeedConfig, WorldState, CareerState } from '../core/types';
import { useScrollReset } from './useMobile';

const ERA_YEARS: Record<EraId, [number, number]> = {
  PIONEER: [1860, 1935],
  EXPEDITION: [1936, 1988],
  MODERN: [1989, 2035],
};

const ERA_COPY: Record<EraId, { title: string; subtitle: string }> = {
  PIONEER: { title: 'Первопроходцы', subtitle: 'Тяжёлое снаряжение и неизвестные линии.' },
  EXPEDITION: { title: 'Экспедиции', subtitle: 'Большие команды, лагеря и национальные амбиции.' },
  MODERN: { title: 'Современность', subtitle: 'Скорость, лёгкий груз и жёсткая конкуренция.' },
};

const DIFFICULTY_COPY: Record<DifficultyId, { title: string; subtitle: string }> = {
  EXPLORER: { title: 'Explorer', subtitle: 'Больше цифр и подсказок.' },
  CLIMBER: { title: 'Climber', subtitle: 'Основной режим без готовых ответов.' },
  EXPEDITION: { title: 'Expedition', subtitle: 'Меньше информации, ошибки видны поздно.' },
};

type SetupProps = {
  config: WorldSeedConfig;
  onConfig: (next: WorldSeedConfig) => void;
  onRandomSeed: () => void;
  onCreate: () => void;
  onBack: () => void;
};

export function MobileWorldSetup({ config, onConfig, onRandomSeed, onCreate, onBack }: SetupProps) {
  const [step, setStep] = useState(0);
  useScrollReset(step);
  const [minYear, maxYear] = ERA_YEARS[config.eraId];

  const setEra = (eraId: EraId) => {
    const [min, max] = ERA_YEARS[eraId];
    onConfig({ ...config, eraId, startYear: Math.round((min + max) / 2) });
  };

  const titles = ['Seed мира', 'Эпоха', 'Год старта', 'Сложность'];
  return (
    <main className="m-public-shell">
      <header className="m-public-topbar"><button onClick={step === 0 ? onBack : () => setStep(current => current - 1)}>←</button><strong>Новая карьера</strong><span>{step + 1}/4</span></header>
      <section className="m-wizard">
        <div className="m-wizard-progress">{titles.map((_, index) => <i key={index} className={index <= step ? 'is-active' : ''} />)}</div>
        <p className="m-kicker">WORLD ENGINE</p>
        <h1>{titles[step]}</h1>

        {step === 0 && (
          <div className="m-stack">
            <p className="m-copy">Seed навсегда определит регион, вершины и людей.</p>
            <div className="m-seed-row"><input value={config.seed} onChange={event => onConfig({ ...config, seed: event.target.value.toUpperCase() })} /><button onClick={onRandomSeed}>↻</button></div>
            <div className="m-note">Одинаковый seed создаёт одинаковый мир.</div>
          </div>
        )}

        {step === 1 && (
          <div className="m-option-list">
            {(Object.keys(ERA_COPY) as EraId[]).map(id => <button key={id} className={config.eraId === id ? 'is-active' : ''} onClick={() => setEra(id)}><span><strong>{ERA_COPY[id].title}</strong><small>{ERA_COPY[id].subtitle}</small></span><b>{config.eraId === id ? '✓' : '○'}</b></button>)}
          </div>
        )}

        {step === 2 && (
          <div className="m-range-card">
            <strong>{config.startYear}</strong>
            <input type="range" min={minYear} max={maxYear} value={config.startYear} onChange={event => onConfig({ ...config, startYear: Number(event.target.value) })} />
            <div><span>{minYear}</span><span>{maxYear}</span></div>
            <p>{ERA_COPY[config.eraId].title}. Мир начнёт жить с выбранного года.</p>
          </div>
        )}

        {step === 3 && (
          <div className="m-option-list">
            {(Object.keys(DIFFICULTY_COPY) as DifficultyId[]).map(id => <button key={id} className={config.difficulty === id ? 'is-active' : ''} onClick={() => onConfig({ ...config, difficulty: id })}><span><strong>{DIFFICULTY_COPY[id].title}</strong><small>{DIFFICULTY_COPY[id].subtitle}</small></span><b>{config.difficulty === id ? '✓' : '○'}</b></button>)}
          </div>
        )}
      </section>
      <footer className="m-wizard-action"><button onClick={() => step < 3 ? setStep(current => current + 1) : onCreate()}>{step < 3 ? 'Далее' : 'Создать мир'}<b>→</b></button></footer>
    </main>
  );
}

export function MobileGeneratingScreen({ seed }: { seed: string }) {
  return <main className="m-public-shell m-generating"><p className="m-kicker">{seed}</p><MountainArt variant="hero" /><h1>Строим хребет</h1><p>География, климат, история, клубы и вершины.</p><div className="m-loading"><i /><i /><i /><i /></div></main>;
}

type RegionProps = {
  world: WorldState;
  career: CareerState | null;
  onBack: () => void;
  onCareer: () => void;
  onMountain: (mountain: MountainData) => void;
};

export function MobileRegionScreen({ world, career, onBack, onCareer, onMountain }: RegionProps) {
  const { region } = world;
  useScrollReset(region.id);
  return (
    <main className="m-public-shell">
      <header className="m-public-topbar"><button onClick={onBack}>←</button><strong>Атлас</strong><span>{world.config.startYear}</span></header>
      <section className="m-region">
        <p className="m-kicker">{region.coordinates}</p><h1>{region.name}</h1><p className="m-copy">{region.subtitle}</p>
        <MountainArt points={region.mountains[0]?.profilePoints} variant="hero" label={region.name} elevation={region.elevationMax} />
        <div className="m-stat-grid"><div><span>Вершин</span><strong>{region.mountains.length}</strong></div><div><span>Предел</span><strong>{region.elevationMax} м</strong></div><div><span>Престиж</span><strong>{region.prestige}</strong></div><div><span>Климат</span><strong>{region.climate}</strong></div></div>
        <button className="m-primary-card" onClick={onCareer}><span><small>{career ? 'КАРЬЕРА' : 'НОВЫЙ ГЕРОЙ'}</small><strong>{career ? career.hero.name : 'Войти в историю'}</strong><em>{career ? 'Продолжить карьеру' : 'Создать альпиниста'}</em></span><b>→</b></button>
        <div className="m-section-head"><h2>Вершины</h2><span>{region.mountains.length}</span></div>
        <div className="m-list">{region.mountains.map((mountain, index) => <button key={mountain.id} onClick={() => onMountain(mountain)} className="m-mountain-row"><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{mountain.name}</strong><small>{mountain.characterTitle} · {mountain.status}</small></div><b>{mountain.elevation} м</b></button>)}</div>
        <details className="m-details"><summary>История региона</summary>{region.history.map(item => <p key={item}>{item}</p>)}</details>
      </section>
    </main>
  );
}

export function MobileMountainScreen({ mountain, onBack, onCareer }: { mountain: MountainData; onBack: () => void; onCareer: () => void }) {
  useScrollReset(mountain.id);
  return (
    <main className="m-public-shell">
      <header className="m-public-topbar"><button onClick={onBack}>←</button><strong>Вершина</strong><span>{mountain.elevation} м</span></header>
      <section className="m-region">
        <p className="m-kicker">{mountain.status} · {mountain.characterTitle}</p><h1>{mountain.name}</h1><p className="m-copy">{mountain.epithet}</p>
        <MountainArt points={mountain.profilePoints} variant="detail" label={mountain.name} elevation={mountain.elevation} />
        <div className="m-stat-grid"><div><span>Техника</span><strong>{mountain.technicality}</strong></div><div><span>Высота</span><strong>{mountain.altitudeSeverity}</strong></div><div><span>Удалённость</span><strong>{mountain.remoteness}</strong></div><div><span>Престиж</span><strong>{mountain.prestige}</strong></div></div>
        <p className="m-copy m-copy--serif">{mountain.summary}</p>
        <button className="m-primary-card" onClick={onCareer}><span><small>КАРЬЕРА</small><strong>Подготовить экспедицию</strong><em>Открыть клуб и выбрать маршрут</em></span><b>→</b></button>
        <details className="m-details"><summary>Известная история</summary>{mountain.history.map(item => <p key={item}>{item}</p>)}</details>
      </section>
    </main>
  );
}

export function MobileMenu({ world, career, onNew, onContinue, onAtlas, onArchive }: { world: WorldState | null; career: CareerState | null; onNew: () => void; onContinue: () => void; onAtlas: () => void; onArchive: () => void }) {
  return <main className="m-menu"><div className="m-menu-art"><MountainArt variant="hero" /></div><p className="m-kicker">MOUNTAINEERING CAREER ROGUELIKE</p><h1>Alpine<br />Legacy</h1><p>Одна жизнь. Один мир. Каждая вершина остаётся в истории.</p><div className="m-menu-actions"><button onClick={onNew}><span>Новая карьера</span><b>→</b></button><button disabled={!world} onClick={onContinue}><span>{career ? 'Продолжить' : 'Открыть мир'}</span><small>{career?.hero.name ?? world?.region.name ?? 'Нет сохранения'}</small></button><button disabled={!world} onClick={onAtlas}><span>Атлас</span><small>{world?.region.mountains.length ?? 0} вершин</small></button><button onClick={onArchive}><span>Архив</span><small>{career?.log.length ?? 0} записей</small></button></div></main>;
}
