import { useMemo, useState } from 'react';
import { MountainArt } from './components/MountainArt';
import { ScreenShell } from './components/ScreenShell';
import { applyTraining, createCareer, formatSeasonDate } from './core/career';
import { generateWorld } from './core/generator';
import { deleteCareer, deleteWorld, loadCareer, loadWorld, saveCareer, saveWorld } from './core/storage';
import type {
  CareerDraft,
  CareerState,
  CareerTabId,
  DifficultyId,
  EraId,
  MountainData,
  ScreenId,
  TrainingId,
  WorldSeedConfig,
  WorldState,
} from './core/types';
import { CharacterCreationScreen } from './screens/CharacterCreationScreen';
import { MobileCharacterCreation } from './mobile/MobileCharacterCreation';
import { MobileGeneratingScreen, MobileMenu, MobileMountainScreen, MobileRegionScreen, MobileWorldSetup } from './mobile/MobilePublicScreens';
import { useIsMobile, useScrollReset } from './mobile/useMobile';
import { CareerWorkspaceScreen } from './screens/CareerWorkspaceScreen';

const ERA_YEARS: Record<EraId, [number, number]> = {
  PIONEER: [1860, 1935],
  EXPEDITION: [1936, 1988],
  MODERN: [1989, 2035],
};

const eraCopy: Record<EraId, { title: string; subtitle: string }> = {
  PIONEER: { title: 'Эра первопроходцев', subtitle: 'Тяжёлое снаряжение. Белые пятна. Первые маршруты.' },
  EXPEDITION: { title: 'Эра экспедиций', subtitle: 'Большие команды. Национальные амбиции. Высотные лагеря.' },
  MODERN: { title: 'Современная эра', subtitle: 'Лёгкое снаряжение. Скорость. Жёсткая конкуренция.' },
};

const difficultyCopy: Record<DifficultyId, { title: string; subtitle: string }> = {
  EXPLORER: { title: 'Explorer', subtitle: 'Полная физика, больше информации и автоматизации.' },
  CLIMBER: { title: 'Climber', subtitle: 'Основной режим. Ограниченные подсказки и ответственность.' },
  EXPEDITION: { title: 'Expedition', subtitle: 'Неполные данные. Ручное планирование. Цена каждой ошибки.' },
};

function randomSeed() {
  const a = ['ICE', 'RIDGE', 'NORTH', 'SERAC', 'ALPINE', 'SUMMIT'];
  return `${a[Math.floor(Math.random() * a.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function App() {
  const mobile = useIsMobile();
  const initial = useMemo(() => {
    const loadedWorld = loadWorld();
    return { world: loadedWorld, career: loadedWorld ? loadCareer(loadedWorld) : null };
  }, []);

  const [screen, setScreen] = useState<ScreenId>('MENU');
  const [careerTab, setCareerTab] = useState<CareerTabId>('OVERVIEW');
  const [world, setWorld] = useState<WorldState | null>(initial.world);
  const [career, setCareer] = useState<CareerState | null>(initial.career);
  const [selectedMountain, setSelectedMountain] = useState<MountainData | null>(null);
  const [config, setConfig] = useState<WorldSeedConfig>({
    seed: randomSeed(),
    eraId: 'EXPEDITION',
    startYear: 1968,
    difficulty: 'CLIMBER',
  });

  useScrollReset(screen, careerTab, selectedMountain?.id);

  function updateEra(eraId: EraId) {
    const [min, max] = ERA_YEARS[eraId];
    setConfig(current => ({ ...current, eraId, startYear: Math.round((min + max) / 2) }));
  }

  function createWorld() {
    setScreen('GENERATING');
    window.setTimeout(() => {
      const created = generateWorld(config);
      saveWorld(created);
      deleteCareer();
      setWorld(created);
      setCareer(null);
      setScreen('REGION');
    }, 900);
  }

  function openMountain(mountain: MountainData) {
    setSelectedMountain(mountain);
    setScreen('MOUNTAIN');
  }

  function persistCareer(next: CareerState) {
    saveCareer(next);
    setCareer(next);
  }

  function startCharacterCreation() {
    if (!world) {
      setScreen('SETUP');
      return;
    }
    if (career) setCareerTab(career.activeClimb ? 'CLIMB' : 'OVERVIEW');
    setScreen(career ? 'CAREER' : 'CHARACTER');
  }

  function createHero(draft: CareerDraft) {
    if (!world) return;
    const created = createCareer(world, draft);
    persistCareer(created);
    setCareerTab('OVERVIEW');
    setScreen('CAREER');
  }

  function train(trainingId: TrainingId) {
    if (!career) return;
    persistCareer(applyTraining(career, trainingId));
  }

  function continueCareer() {
    if (career) {
      setCareerTab(career.activeClimb ? 'CLIMB' : 'OVERVIEW');
      setScreen('CAREER');
    } else if (world) {
      setScreen('REGION');
    }
  }

  if (screen === 'CHARACTER' && world) {
    return mobile
      ? <MobileCharacterCreation world={world} onBack={() => setScreen('REGION')} onCreate={createHero} />
      : <CharacterCreationScreen world={world} onBack={() => setScreen('REGION')} onCreate={createHero} />;
  }

  if (screen === 'CAREER' && world && career) {
    return (
      <CareerWorkspaceScreen
        world={world}
        career={career}
        activeTab={careerTab}
        onTab={setCareerTab}
        onPersist={persistCareer}
        onTrain={train}
        onExit={() => setScreen('MENU')}
        onAtlas={() => setScreen('REGION')}
      />
    );
  }

  if (screen === 'SETUP') {
    if (mobile) return <MobileWorldSetup config={config} onConfig={setConfig} onRandomSeed={() => setConfig(current => ({ ...current, seed: randomSeed() }))} onCreate={createWorld} onBack={() => setScreen('MENU')} />;
    const [minYear, maxYear] = ERA_YEARS[config.eraId];
    return (
      <ScreenShell onBack={() => setScreen('MENU')} rightLabel="WORLD CREATION / 01">
        <section className="setup-grid page-enter">
          <div className="setup-intro">
            <p className="eyebrow">NEW WORLD / NEW LIFE</p>
            <h1>Создай мир, который переживёт тебя.</h1>
            <p className="lead">Один seed определит географию, историю, вершины и людей. Смерть героя завершит карьеру, но не обязательно уничтожит мир.</p>
            <div className="edition-stamp"><span>AL</span><strong>WORLD ENGINE</strong><small>SEED BASED / V0.6.5</small></div>
          </div>

          <div className="setup-form">
            <div className="form-section">
              <div className="section-index">01</div>
              <div>
                <label className="field-label" htmlFor="seed">Seed мира</label>
                <div className="seed-row">
                  <input id="seed" value={config.seed} onChange={e => setConfig({ ...config, seed: e.target.value.toUpperCase() })} />
                  <button className="square-button" onClick={() => setConfig({ ...config, seed: randomSeed() })}>↻</button>
                </div>
                <p className="field-note">Один seed всегда создаёт тот же регион.</p>
              </div>
            </div>

            <div className="form-section">
              <div className="section-index">02</div>
              <div className="wide">
                <span className="field-label">Эпоха</span>
                <div className="choice-stack">
                  {(Object.keys(eraCopy) as EraId[]).map(era => (
                    <button key={era} className={`choice-card ${config.eraId === era ? 'is-active' : ''}`} onClick={() => updateEra(era)}>
                      <span className="choice-card__mark" />
                      <span><strong>{eraCopy[era].title}</strong><small>{eraCopy[era].subtitle}</small></span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="section-index">03</div>
              <div className="wide">
                <div className="year-head"><span className="field-label">Год начала</span><strong>{config.startYear}</strong></div>
                <input className="year-range" type="range" min={minYear} max={maxYear} value={config.startYear} onChange={e => setConfig({ ...config, startYear: Number(e.target.value) })} />
                <div className="range-labels"><span>{minYear}</span><span>{maxYear}</span></div>
              </div>
            </div>

            <div className="form-section">
              <div className="section-index">04</div>
              <div className="wide">
                <span className="field-label">Сложность управления</span>
                <div className="difficulty-grid">
                  {(Object.keys(difficultyCopy) as DifficultyId[]).map(level => (
                    <button key={level} className={`difficulty-card ${config.difficulty === level ? 'is-active' : ''}`} onClick={() => setConfig({ ...config, difficulty: level })}>
                      <strong>{difficultyCopy[level].title}</strong>
                      <small>{difficultyCopy[level].subtitle}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className="primary-action" onClick={createWorld}><span>Сгенерировать мир</span><b>→</b></button>
          </div>
        </section>
      </ScreenShell>
    );
  }

  if (screen === 'GENERATING') {
    if (mobile) return <MobileGeneratingScreen seed={config.seed} />;
    return (
      <ScreenShell rightLabel="GENERATIVE ATLAS / RUNNING">
        <section className="generation-screen page-enter">
          <div className="generation-code">{config.seed}</div>
          <h1>Поднимаем хребты.</h1>
          <p>Формируем геологию, вершины, климат и десятилетия истории.</p>
          <div className="generation-bars">
            {['География', 'Массивы', 'Климат', 'История', 'Архив'].map((label, index) => (
              <div className="generation-bar" key={label} style={{ '--delay': `${index * 110}ms` } as React.CSSProperties}>
                <span>{String(index + 1).padStart(2, '0')}</span><div /><strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>
      </ScreenShell>
    );
  }

  if (screen === 'REGION' && world) {
    if (mobile) return <MobileRegionScreen world={world} career={career} onBack={() => setScreen('MENU')} onCareer={startCharacterCreation} onMountain={openMountain} />;
    const { region } = world;
    return (
      <ScreenShell onBack={() => setScreen('MENU')} rightLabel={`${world.config.startYear} / ${world.config.seed}`} onPrint={() => window.print()}>
        <section className="region-page page-enter">
          <div className="region-title-block">
            <div>
              <p className="eyebrow">PROCEDURAL ALPINE REGION · {region.coordinates}</p>
              <h1>{region.name}</h1>
              <p className="region-subtitle">{region.subtitle}</p>
            </div>
            <div className="region-index-number">01</div>
          </div>

          <MountainArt points={region.mountains[0]!.profilePoints} variant="hero" label={region.name} elevation={region.elevationMax} />

          <div className="region-metrics">
            <div><span>Вершины</span><strong>{region.mountains.length}</strong></div>
            <div><span>Высотный предел</span><strong>{region.elevationMax} м</strong></div>
            <div><span>Престиж региона</span><strong>{region.prestige}/100</strong></div>
            <div><span>Климат</span><strong>{region.climate}</strong></div>
          </div>

          <div className="region-copy-grid">
            <div>
              <p className="eyebrow">FIELD NOTE / 001</p>
              <p className="large-copy">{region.summary}</p>
            </div>
            <div className="timeline">
              {region.history.map(item => <div key={item}><span /><p>{item}</p></div>)}
            </div>
          </div>

          <div className="career-entry-banner">
            <div>
              <p className="eyebrow">CAREER MODULE / 0.6.5</p>
              <h2>{career ? career.hero.name : 'Горы уже существуют. Теперь войди в их историю.'}</h2>
              <p>{career
                ? `${career.club.name}. ${career.completedClimbs} засчитанных восхождений. Высшая точка: ${career.highestElevation} м.`
                : 'Создай одного героя, вступи в региональный клуб и пройди первое квалификационное восхождение.'}
              </p>
            </div>
            <button onClick={startCharacterCreation}><span>{career ? 'Открыть карьеру' : 'Создать альпиниста'}</span><b>→</b></button>
          </div>

          <div className="mountain-list-head"><div><p className="eyebrow">MOUNTAIN REGISTER</p><h2>Вершины региона</h2></div><span>{region.mountains.length.toString().padStart(2, '0')} OBJECTS</span></div>
          <div className="mountain-grid">
            {region.mountains.map((mountain, index) => (
              <button className="mountain-card" key={mountain.id} onClick={() => openMountain(mountain)}>
                <div className="mountain-card__head"><span>{String(index + 1).padStart(2, '0')}</span><strong>{mountain.status}</strong></div>
                <MountainArt points={mountain.profilePoints} variant="card" />
                <div className="mountain-card__name"><h3>{mountain.name}</h3><span>{mountain.elevation} M</span></div>
                <p>{mountain.epithet}</p>
                <div className="mountain-card__stats"><span>TECH {mountain.technicality}</span><span>ALT {mountain.altitudeSeverity}</span><span>REM {mountain.remoteness}</span></div>
              </button>
            ))}
          </div>
        </section>
      </ScreenShell>
    );
  }

  if (screen === 'MOUNTAIN' && selectedMountain) {
    if (mobile) return <MobileMountainScreen mountain={selectedMountain} onBack={() => setScreen('REGION')} onCareer={startCharacterCreation} />;
    const mountain = selectedMountain;
    return (
      <ScreenShell onBack={() => setScreen('REGION')} rightLabel={`${mountain.name} / OBJECT`} onPrint={() => window.print()}>
        <section className="mountain-detail page-enter">
          <div className="detail-title">
            <div><p className="eyebrow">MOUNTAIN OBJECT / {mountain.status}</p><h1>{mountain.name}</h1><p>{mountain.epithet}</p></div>
            <div className="detail-elevation"><strong>{mountain.elevation}</strong><span>METRES ABOVE SEA LEVEL</span></div>
          </div>

          <MountainArt points={mountain.profilePoints} variant="detail" label={mountain.name} elevation={mountain.elevation} />

          <div className="detail-grid">
            <div className="detail-summary"><p className="eyebrow">MOUNTAIN CHARACTER</p><p className="large-copy">{mountain.summary}</p></div>
            <div className="technical-table">
              {[
                ['Массив', mountain.massifType], ['Климат', mountain.climateBand], ['Преобладающий риск', mountain.dangerProfile],
                ['Выдающаяся высота', `${mountain.prominence} м`], ['Техническая сложность', `${mountain.technicality}/100`],
                ['Высотная нагрузка', `${mountain.altitudeSeverity}/100`], ['Удалённость', `${mountain.remoteness}/100`], ['Престиж', `${mountain.prestige}/100`],
              ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </div>

          <div className="history-panel"><p className="eyebrow">ARCHIVE / KNOWN HISTORY</p>{mountain.history.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</div>

          <div className="locked-action career-mountain-action">
            <span>CAREER MODULE / ACTIVE</span>
            <h2>{career ? 'Любая большая гора начинается с допуска.' : 'Гора уже ждёт человека.'}</h2>
            <p>{career
              ? 'Вернись в клуб, подготовься и докажи, что можешь подняться и спуститься без помощи симуляции.'
              : 'Создай героя. Его имя сможет появиться в архиве этой вершины.'}
            </p>
            <button onClick={startCharacterCreation}>{career ? 'Вернуться в карьеру' : 'Создать альпиниста'} →</button>
          </div>
        </section>
      </ScreenShell>
    );
  }

  if (screen === 'ARCHIVE') {
    return (
      <ScreenShell onBack={() => setScreen('MENU')} rightLabel={`WORLD ARCHIVE / ${career?.log.length ?? 0}`}>
        <section className="archive-page page-enter">
          <div className="archive-page__title">
            <p className="eyebrow">STRUCTURED WORLD MEMORY</p>
            <h1>{career ? 'Карьера уже оставляет след.' : 'Здесь останутся погибшие.'}</h1>
            <p>{career ? `${career.hero.name}. Начало карьеры: ${career.hero.startYear}. Все решения хранятся как записи мира.` : 'Создай мир и первого альпиниста. Архив запомнит восхождения, отказы, травмы и людей.'}</p>
          </div>
          {career && (
            <div className="archive-ledger">
              <div className="archive-ledger__hero">
                <span>{career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</span>
                <div><small>ACTIVE MOUNTAINEER</small><h2>{career.hero.name}</h2><p>{career.club.name} · {career.hero.originTitle}</p></div>
                <strong>{career.highestElevation} M</strong>
              </div>
              {[...career.log].reverse().map((entry) => (
                <article key={entry.id}>
                  <span>{entry.year}<small>DAY {entry.seasonDay}</small></span>
                  <i />
                  <div><small>{entry.type}</small><h3>{entry.title}</h3><p>{entry.description}</p></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </ScreenShell>
    );
  }

  if (screen === 'SETTINGS') {
    return (
      <ScreenShell onBack={() => setScreen('MENU')} rightLabel="SYSTEM / SETTINGS">
        <section className="empty-page page-enter">
          <p className="eyebrow">SETTINGS</p>
          <h1>Тихий интерфейс. Жёсткая гора.</h1>
          {career && <p>Активная карьера: {career.hero.name}. {formatSeasonDate(career.year, career.seasonDay)}.</p>}
          <button className="secondary-action" onClick={() => { deleteWorld(); setWorld(null); setCareer(null); }}>Удалить локальный мир и карьеру</button>
        </section>
      </ScreenShell>
    );
  }

  const archiveCount = career?.log.length ?? 0;
  if (mobile) return <MobileMenu world={world} career={career} onNew={() => setScreen('SETUP')} onContinue={continueCareer} onAtlas={() => setScreen(world ? 'REGION' : 'SETUP')} onArchive={() => { if (career) { setCareerTab('JOURNAL'); setScreen('CAREER'); } else setScreen('ARCHIVE'); }} />;
  return (
    <ScreenShell rightLabel="EDITION 0.6.5 / MOBILE APP">
      <section className="menu-page page-enter">
        <div className="menu-hero-copy">
          <p className="eyebrow">A MOUNTAINEERING CAREER ROGUELIKE</p>
          <h1><span>ALPINE</span><span>LEGACY</span></h1>
          <p className="menu-thesis">Одна жизнь. Один мир. Каждая вершина остаётся в истории.</p>
        </div>

        <div className="hero-composition">
          <div className="hero-coordinate">46°48′ N<br />9°50′ E</div>
          <MountainArt variant="hero" />
          <div className="hero-vertical-label">THE MOUNTAIN DOES NOT CARE</div>
        </div>

        <div className="menu-actions">
          <button className="menu-action menu-action--primary" onClick={() => setScreen('SETUP')}><span><small>01</small>Новая карьера</span><b>→</b></button>
          <button className="menu-action" disabled={!world} onClick={continueCareer}><span><small>02</small>Продолжить</span><b>{career ? career.hero.name : world ? world.region.name : 'Нет сохранения'}</b></button>
          <button className="menu-action" onClick={() => setScreen('ARCHIVE')}><span><small>03</small>Архив мира</span><b>{archiveCount} записей</b></button>
          <button className="menu-action" onClick={() => setScreen('SETTINGS')}><span><small>04</small>Настройки</span><b>◌</b></button>
        </div>

        <footer className="menu-footer"><span>PROCEDURAL MOUNTAINEERING WORLD</span><span>ROUTES / TEAM / EXPEDITIONS</span><span>© ALPINE LEGACY</span></footer>
      </section>
    </ScreenShell>
  );
}

export default App;
