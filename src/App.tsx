import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MountainModel } from './components/MountainModel';
import { ScreenShell } from './components/ScreenShell';
import { applyTraining, createCareer, formatSeasonDate } from './core/career';
import { generateWorld } from './core/generator';
import { careerRecoveryStatus, deleteCareer, deleteWorld, loadCareer, loadWorld, saveCareer, saveWorld } from './core/storage';
import { loadUiState, saveUiState, selectedMountainFromUi } from './core/uiState';
import { releaseSafeCareerTab, repairCareerForRelease } from './core/releaseCandidate';
import { pushRuntimeNotice } from './components/RuntimeNotice';
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
import { TopoExpeditionLoader } from './components/TopoExpeditionLoader';

const BalanceLabScreen = lazy(async () => {
  const module = await import('./screens/BalanceLabScreen');
  return { default: module.BalanceLabScreen };
});

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
    const loadedCareer = loadedWorld ? loadCareer(loadedWorld) : null;
    const repaired = loadedWorld && loadedCareer ? repairCareerForRelease(loadedWorld, loadedCareer) : { career: loadedCareer, repairs: [] };
    const ui = loadUiState(loadedWorld, repaired.career);
    return { world: loadedWorld, career: repaired.career, repairs: repaired.repairs, ui, recovery: careerRecoveryStatus().lastRecovery };
  }, []);

  const [screen, setScreen] = useState<ScreenId>(initial.ui.screen);
  const [atlasReturnScreen, setAtlasReturnScreen] = useState<'MENU' | 'CAREER'>(initial.ui.atlasReturnScreen);
  const [careerTab, setCareerTab] = useState<CareerTabId>(() => releaseSafeCareerTab(initial.career, initial.ui.careerTab));
  const [world, setWorld] = useState<WorldState | null>(initial.world);
  const [career, setCareer] = useState<CareerState | null>(initial.career);
  const [selectedMountain, setSelectedMountain] = useState<MountainData | null>(() => selectedMountainFromUi(initial.world, initial.ui));
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [topoPreview, setTopoPreview] = useState(() => new URLSearchParams(window.location.search).get('topo') === '1');
  const [balanceLab, setBalanceLab] = useState(() => new URLSearchParams(window.location.search).get('balance') === '1');
  const [config, setConfig] = useState<WorldSeedConfig>({
    seed: randomSeed(),
    eraId: 'EXPEDITION',
    startYear: 1968,
    difficulty: 'CLIMBER',
  });

  useScrollReset(screen, careerTab, selectedMountain?.id);

  useEffect(() => {
    saveUiState({
      screen,
      careerTab,
      atlasReturnScreen,
      selectedMountainId: selectedMountain?.id ?? null,
    });
  }, [screen, careerTab, atlasReturnScreen, selectedMountain?.id]);


  useEffect(() => {
    if (initial.career && initial.repairs.length) {
      try {
        saveCareer(initial.career);
        pushRuntimeNotice({ tone: 'WARNING', title: 'Сейв восстановлен', message: initial.repairs.join(' ') });
      } catch (error) {
        pushRuntimeNotice({ tone: 'DANGER', title: 'Сейв открыт, но не записан', message: error instanceof Error ? error.message : 'Не удалось сохранить исправленное состояние.' });
      }
    } else if (initial.recovery?.reason) {
      pushRuntimeNotice({ tone: 'INFO', title: 'Карьерный сейв восстановлен', message: initial.recovery.reason });
    }
  }, [initial.career, initial.recovery?.reason, initial.repairs]);

  if (balanceLab) {
    return <Suspense fallback={<main className="balance-lab"><p>Сбор результатов…</p></main>}><BalanceLabScreen onClose={() => { const url = new URL(window.location.href); url.searchParams.delete('balance'); window.history.replaceState({}, '', url); setBalanceLab(false); }} /></Suspense>;
  }

  if (topoPreview) {
    if (!career?.activeClimb) return <main className="mg-app"><header className="mg-header"><div><span>ALPINE LEGACY / 0.27.1</span><h1>Нет активной экспедиции</h1></div><div className="mg-header-actions"><button onClick={() => setTopoPreview(false)}>Вернуться</button></div></header></main>;
    return <TopoExpeditionLoader career={career} onPersist={next => { setCareer(next); saveCareer(next); }} onExit={() => setTopoPreview(false)} allowRegenerate={false} />;
  }

  function updateEra(eraId: EraId) {
    const [min, max] = ERA_YEARS[eraId];
    setConfig(current => ({ ...current, eraId, startYear: Math.round((min + max) / 2) }));
  }

  function createWorld() {
    const safeConfig = { ...config, seed: config.seed.trim().toUpperCase() || randomSeed() };
    setConfig(safeConfig);
    setGenerationError(null);
    setScreen('GENERATING');
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          const created = generateWorld(safeConfig);
          saveWorld(created);
          deleteCareer();
          setWorld(created);
          setCareer(null);
          setSelectedMountain(null);
          setCareerTab('OVERVIEW');
          setAtlasReturnScreen('MENU');
          setScreen('REGION');
        } catch (error) {
          console.error('World generation failed', error);
          const message = error instanceof Error ? error.message : 'Неизвестная ошибка генерации.';
          setGenerationError(`Мир не создан: ${message}`);
        }
      }, 40);
    });
  }

  function openMountain(mountain: MountainData) {
    setSelectedMountain(mountain);
    setScreen('MOUNTAIN');
  }

  function persistCareer(next: CareerState) {
    if (!world) return;
    const repaired = repairCareerForRelease(world, next);
    try {
      saveCareer(repaired.career);
      setCareer(repaired.career);
      if (repaired.repairs.length) pushRuntimeNotice({ tone: 'WARNING', title: 'Состояние исправлено', message: repaired.repairs.join(' ') });
    } catch (error) {
      pushRuntimeNotice({
        tone: 'DANGER',
        title: 'Карьера не сохранена',
        message: error instanceof Error ? error.message : 'Браузер не смог записать текущий ход.',
        timeoutMs: 12000,
      });
    }
  }

  function startCharacterCreation() {
    if (!world) {
      setScreen('SETUP');
      return;
    }
    if (career?.activeClimb) setCareerTab('CLIMB');
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
      if (career.activeClimb) setCareerTab('CLIMB');
      setScreen('CAREER');
    } else if (world) {
      setScreen('REGION');
    }
  }

  function closeAtlas() {
    if (atlasReturnScreen === 'CAREER' && career && world) {
      setScreen('CAREER');
      return;
    }
    setScreen('MENU');
  }

  function openAtlasFromCareer() {
    setAtlasReturnScreen('CAREER');
    setScreen('REGION');
  }

  function openAtlasFromMenu() {
    setAtlasReturnScreen('MENU');
    setScreen(world ? 'REGION' : 'SETUP');
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
        onAtlas={openAtlasFromCareer}
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
            <div className="edition-stamp"><span>AL</span><strong>WORLD ENGINE</strong><small>SEED BASED / V0.27.1</small></div>
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
    if (mobile) return <MobileGeneratingScreen seed={config.seed} error={generationError} onRetry={createWorld} onBack={() => { setGenerationError(null); setScreen('SETUP'); }} />;
    return (
      <ScreenShell rightLabel={generationError ? "GENERATION / ERROR" : "GENERATIVE ATLAS / RUNNING"}>
        {generationError ? <section className="generation-screen page-enter"><div className="generation-error"><h2>Генерация остановлена</h2><p>{generationError}</p><div><button onClick={createWorld}>Повторить</button><button onClick={() => { setGenerationError(null); setScreen('SETUP'); }}>Вернуться к настройкам</button></div></div></section> : <section className="generation-screen page-enter">
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
        </section>}
      </ScreenShell>
    );
  }

  if (screen === 'REGION' && world) {
    if (mobile) return <MobileRegionScreen world={world} career={career} onBack={closeAtlas} onCareer={startCharacterCreation} onMountain={openMountain} />;
    const { region } = world;
    return (
      <ScreenShell onBack={closeAtlas} rightLabel={`${world.config.startYear} / ${world.config.seed}`} onPrint={() => window.print()}>
        <section className="region-page page-enter">
          <div className="region-title-block">
            <div>
              <p className="eyebrow">PROCEDURAL ALPINE REGION · {region.coordinates}</p>
              <h1>{region.name}</h1>
              <p className="region-subtitle">{region.subtitle}</p>
            </div>
            <div className="region-index-number">01</div>
          </div>

          <MountainModel mountain={region.mountains[0]!} seed={world.config.seed} variant="hero" label={region.name} />

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
              <p className="eyebrow">CAREER MODULE / 0.7.1</p>
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
                <MountainModel mountain={mountain} seed={world.config.seed} variant="card" interactive={false} />
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

          <MountainModel mountain={mountain} seed={world?.config.seed ?? config.seed} variant="detail" label={mountain.name} />

          <div className="detail-grid">
            <div className="detail-summary"><p className="eyebrow">MOUNTAIN CHARACTER</p><p className="large-copy">{mountain.summary}</p></div>
            <div className="technical-table">
              {[
                ['Массив', mountain.massifType], ['Ключевой ориентир', mountain.identity.signatureFeature], ['Климат', mountain.climateBand],
                ['Логика лагерей', mountain.identity.campPattern], ['Преобладающий риск', mountain.dangerProfile], ['Проблема спуска', mountain.identity.descentProblem],
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
  if (mobile) return <MobileMenu world={world} career={career} onNew={() => setScreen('SETUP')} onContinue={continueCareer} onAtlas={openAtlasFromMenu} onArchive={() => { if (career) { setCareerTab('JOURNAL'); setScreen('CAREER'); } else setScreen('ARCHIVE'); }} onTopo={() => setTopoPreview(true)} />;
  return (
    <ScreenShell rightLabel="EDITION 0.27.1 / INTEGRATED EXPEDITION">
      <section className="menu-page page-enter">
        <div className="menu-hero-copy">
          <p className="eyebrow">A MOUNTAINEERING CAREER ROGUELIKE</p>
          <h1><span>ALPINE</span><span>LEGACY</span></h1>
          <p className="menu-thesis">Одна жизнь. Один мир. Каждая вершина остаётся в истории.</p>
        </div>

        <div className="hero-composition">
          <div className="hero-coordinate">46°48′ N<br />9°50′ E</div>
          <MountainModel mountain={world?.region.mountains[0]} seed={world?.config.seed ?? 'ALPINE-MENU'} variant="hero" label="Alpine Legacy" />
          <div className="hero-vertical-label">THE MOUNTAIN DOES NOT CARE</div>
        </div>

        <div className="menu-actions">
          <button className="menu-action menu-action--primary" disabled={!career?.activeClimb} onClick={() => setTopoPreview(true)}><span><small>00</small>Активная экспедиция</span><b>{career?.activeClimb ? 'ПРОДОЛЖИТЬ' : 'НЕТ ВЫХОДА'}</b></button>
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
