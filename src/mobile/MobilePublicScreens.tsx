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
  EXPEDITION: { title: 'Экспедиции', subtitle: 'Большие команды и высотные лагеря.' },
  MODERN: { title: 'Современность', subtitle: 'Скорость, лёгкий груз и конкуренция.' },
};

const DIFFICULTY_COPY: Record<DifficultyId, { title: string; subtitle: string }> = {
  EXPLORER: { title: 'Explorer', subtitle: 'Больше цифр и подсказок.' },
  CLIMBER: { title: 'Climber', subtitle: 'Основной режим.' },
  EXPEDITION: { title: 'Expedition', subtitle: 'Меньше информации.' },
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
        <h1>{titles[step]}</h1>

        {step === 0 && <div className="m-seed-row"><input value={config.seed} onChange={event => onConfig({ ...config, seed: event.target.value.toUpperCase() })} /><button onClick={onRandomSeed}>↻</button></div>}

        {step === 1 && <div className="m-option-list">{(Object.keys(ERA_COPY) as EraId[]).map(id => <button key={id} className={config.eraId === id ? 'is-active' : ''} onClick={() => setEra(id)}><span><strong>{ERA_COPY[id].title}</strong><small>{ERA_COPY[id].subtitle}</small></span><b>{config.eraId === id ? '✓' : '○'}</b></button>)}</div>}

        {step === 2 && <div className="m-range-card"><strong>{config.startYear}</strong><input type="range" min={minYear} max={maxYear} value={config.startYear} onChange={event => onConfig({ ...config, startYear: Number(event.target.value) })} /><div><span>{minYear}</span><span>{maxYear}</span></div></div>}

        {step === 3 && <div className="m-option-list">{(Object.keys(DIFFICULTY_COPY) as DifficultyId[]).map(id => <button key={id} className={config.difficulty === id ? 'is-active' : ''} onClick={() => onConfig({ ...config, difficulty: id })}><span><strong>{DIFFICULTY_COPY[id].title}</strong><small>{DIFFICULTY_COPY[id].subtitle}</small></span><b>{config.difficulty === id ? '✓' : '○'}</b></button>)}</div>}
      </section>
      <footer className="m-wizard-action"><button onClick={() => step < 3 ? setStep(current => current + 1) : onCreate()}>{step < 3 ? 'Далее' : 'Создать мир'}<b>→</b></button></footer>
    </main>
  );
}

export function MobileGeneratingScreen({ seed, error, onRetry, onBack }: { seed: string; error: string | null; onRetry: () => void; onBack: () => void }) {
  if (error) return <main className="m-public-shell m-generating"><section className="generation-error"><p className="m-kicker">{seed}</p><h2>Мир не создан</h2><p>{error}</p><div><button onClick={onRetry}>Повторить</button><button onClick={onBack}>Назад</button></div></section></main>;
  return <main className="m-public-shell m-generating"><p className="m-kicker">{seed}</p><MountainArt variant="hero" /><h1>Строим хребет</h1><div className="m-loading"><i /><i /><i /><i /></div></main>;
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
        <p className="m-kicker">{region.coordinates}</p><h1>{region.name}</h1>
        <MountainArt points={region.mountains[0]?.profilePoints} variant="hero" label={region.name} elevation={region.elevationMax} />
        <div className="m-inline-meta"><span>{region.climate}</span><span>Престиж {region.prestige}</span></div>
        <button className="m-primary-card" onClick={onCareer}><span><small>{career ? 'КАРЬЕРА' : 'НОВЫЙ ГЕРОЙ'}</small><strong>{career ? career.hero.name : 'Войти в историю'}</strong></span><b>→</b></button>
        <div className="m-section-head"><h2>Вершины</h2><span>{region.mountains.length}</span></div>
        <div className="m-list">{region.mountains.map((mountain, index) => <button key={mountain.id} onClick={() => onMountain(mountain)} className="m-mountain-row"><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{mountain.name}</strong><small>{mountain.characterTitle}</small></div><b>{mountain.elevation} м</b></button>)}</div>
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
        <p className="m-kicker">{mountain.characterTitle}</p><h1>{mountain.name}</h1>
        <MountainArt points={mountain.profilePoints} variant="detail" label={mountain.name} elevation={mountain.elevation} />
        <div className="m-inline-meta"><span>Техника {mountain.technicality}</span><span>Высота {mountain.altitudeSeverity}</span><span>Удалённость {mountain.remoteness}</span></div>
        <button className="m-primary-card" onClick={onCareer}><span><small>КАРЬЕРА</small><strong>Подготовить экспедицию</strong></span><b>→</b></button>
        <details className="m-details"><summary>История вершины</summary>{mountain.history.map(item => <p key={item}>{item}</p>)}</details>
      </section>
    </main>
  );
}

export function MobileMenu({ world, career, onNew, onContinue, onAtlas, onArchive, onTopo }: { world: WorldState | null; career: CareerState | null; onNew: () => void; onContinue: () => void; onAtlas: () => void; onArchive: () => void; onTopo: () => void }) {
  return <main className="m-menu"><div className="m-menu-art"><MountainArt variant="hero" /></div><h1>Alpine<br />Legacy</h1><p>Карьера альпиниста.</p><div className="m-menu-actions"><button className="m-menu-topo" onClick={onTopo}><span>Топографическая экспедиция</span><small>прототип 0.7</small></button><button onClick={onNew}><span>Новая карьера</span><b>→</b></button><button disabled={!world} onClick={onContinue}><span>{career ? 'Продолжить' : 'Открыть мир'}</span><small>{career?.hero.name ?? world?.region.name ?? ''}</small></button><button disabled={!world} onClick={onAtlas}><span>Атлас</span><small>{world?.region.mountains.length ?? 0} вершин</small></button><button onClick={onArchive}><span>Архив</span><small>{career?.log.length ?? 0} записей</small></button></div></main>;
}
