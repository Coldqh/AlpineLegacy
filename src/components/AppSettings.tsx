import { useCallback, useEffect, useMemo, useState } from 'react';
import packageInfo from '../../package.json';
import { loadCareer, loadWorld } from '../core/storage';
import { runBalanceSample } from '../core/playtest';

type ThemeMode = 'system' | 'light' | 'dark';
type DensityMode = 'compact' | 'comfortable';

type UiSettings = {
  theme: ThemeMode;
  density: DensityMode;
  reducedMotion: boolean;
};

type UpdateState = 'idle' | 'checking' | 'current' | 'available' | 'error' | 'updating';

const SETTINGS_KEY = 'alpine-legacy:ui-settings:v1';
const CURRENT_VERSION = packageInfo.version;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function diagnosticSnapshot() {
  const world = loadWorld();
  const career = world ? loadCareer(world) : null;
  return { world, career };
}

const DEFAULT_SETTINGS: UiSettings = {
  theme: 'system',
  density: 'compact',
  reducedMotion: false,
};

function loadSettings(): UiSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as UiSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function resolveTheme(mode: ThemeMode) {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applySettings(settings: UiSettings) {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(settings.theme);
  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = settings.theme;
  root.dataset.density = settings.density;
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  root.style.colorScheme = resolvedTheme;

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = resolvedTheme === 'dark' ? '#111719' : '#eae7df';
}

async function fetchRemoteVersion() {
  const url = new URL(`${import.meta.env.BASE_URL}version.json`, window.location.href);
  url.searchParams.set('_', Date.now().toString());
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`Version check failed: ${response.status}`);
  const payload = await response.json() as { version?: string };
  return payload.version ?? CURRENT_VERSION;
}

async function forceUpdateApplication() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  }

  const nextUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  nextUrl.searchParams.set('v', CURRENT_VERSION);
  nextUrl.searchParams.set('__update', Date.now().toString());
  nextUrl.hash = '';

  try {
    await fetch(nextUrl.toString(), {
      cache: 'reload',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch {
    // Navigation below still forces a new document request.
  }

  window.localStorage.setItem('alpine-legacy:last-force-update', Date.now().toString());
  window.location.replace(nextUrl.toString());
}

export function AppSettings() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<UiSettings>(() => loadSettings());
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    applySettings(settings);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemTheme = () => {
      if (settings.theme === 'system') applySettings(settings);
    };
    media.addEventListener('change', handleSystemTheme);
    return () => media.removeEventListener('change', handleSystemTheme);
  }, [settings]);

  const checkForUpdate = useCallback(async (silent = false) => {
    if (!silent) setUpdateState('checking');
    try {
      const remote = await fetchRemoteVersion();
      setRemoteVersion(remote);
      setUpdateState(remote !== CURRENT_VERSION ? 'available' : 'current');
    } catch {
      if (!silent) setUpdateState('error');
    }
  }, []);

  useEffect(() => {
    void checkForUpdate(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkForUpdate(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const timer = window.setInterval(() => void checkForUpdate(true), 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(timer);
    };
  }, [checkForUpdate]);

  const updateLabel = useMemo(() => {
    if (updateState === 'checking') return 'Проверяем…';
    if (updateState === 'available') return `Доступна ${remoteVersion}`;
    if (updateState === 'current') return 'Установлена свежая версия';
    if (updateState === 'error') return 'Не удалось проверить';
    return 'Обновления не проверялись';
  }, [remoteVersion, updateState]);

  async function runForcedUpdate() {
    setUpdateState('updating');
    try {
      await forceUpdateApplication();
    } catch {
      window.location.reload();
    }
  }

  return (
    <>
      <button
        className={`app-settings-trigger ${updateState === 'available' ? 'has-update' : ''}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть настройки"
        title="Настройки"
      >
        <span>⚙</span>
        {updateState === 'available' && <i />}
      </button>

      {open && (
        <div className="app-settings-layer" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="app-settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <small>ALPINE LEGACY / SYSTEM</small>
                <h2 id="settings-title">Настройки</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть настройки">×</button>
            </header>

            <div className="settings-group">
              <div className="settings-group__copy">
                <strong>Тема</strong>
                <span>Можно привязать оформление к системе.</span>
              </div>
              <div className="settings-segmented" role="group" aria-label="Тема интерфейса">
                {([
                  ['system', 'Система'],
                  ['light', 'Светлая'],
                  ['dark', 'Тёмная'],
                ] as Array<[ThemeMode, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={settings.theme === value ? 'is-active' : ''} onClick={() => setSettings(current => ({ ...current, theme: value }))}>{label}</button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group__copy">
                <strong>Размер интерфейса</strong>
                <span>Компактный режим выбран по умолчанию.</span>
              </div>
              <div className="settings-segmented" role="group" aria-label="Плотность интерфейса">
                <button type="button" className={settings.density === 'compact' ? 'is-active' : ''} onClick={() => setSettings(current => ({ ...current, density: 'compact' }))}>Компактный</button>
                <button type="button" className={settings.density === 'comfortable' ? 'is-active' : ''} onClick={() => setSettings(current => ({ ...current, density: 'comfortable' }))}>Обычный</button>
              </div>
            </div>

            <label className="settings-toggle">
              <span><strong>Меньше анимаций</strong><small>Отключает появления и движения интерфейса.</small></span>
              <input type="checkbox" checked={settings.reducedMotion} onChange={event => setSettings(current => ({ ...current, reducedMotion: event.target.checked }))} />
            </label>

            <div className="settings-update-card">
              <div>
                <small>ТЕКУЩАЯ ВЕРСИЯ</small>
                <strong>{CURRENT_VERSION}</strong>
                <span>{updateLabel}</span>
              </div>
              <div className="settings-update-actions">
                <button type="button" onClick={() => void checkForUpdate(false)} disabled={updateState === 'checking' || updateState === 'updating'}>Проверить</button>
                <button type="button" className="is-primary" onClick={() => void runForcedUpdate()} disabled={updateState === 'updating'}>{updateState === 'updating' ? 'Обновляем…' : 'Принудительно обновить'}</button>
              </div>
              <p>Кнопка удаляет старые кэши приложения, отключает зависший service worker и заново открывает сайт с новым адресом. Сохранение карьеры останется.</p>
            </div>

            <details className="settings-diagnostics">
              <summary>Диагностика и экспорт</summary>
              <p>Служебные файлы убраны из игрового архива. Они нужны только для проверки сейва и баланса.</p>
              <div>
                <button type="button" onClick={() => { const snapshot = diagnosticSnapshot(); if (snapshot.world) downloadJson('alpine-legacy-save.json', snapshot); }}>Экспортировать сейв</button>
                <button type="button" onClick={() => { const snapshot = diagnosticSnapshot(); if (snapshot.career) downloadJson('alpine-legacy-replay.json', { seed: snapshot.world?.config.seed, activeClimb: snapshot.career.activeClimb, reports: snapshot.career.reports }); }}>Экспортировать replay</button>
                <button type="button" onClick={() => { const snapshot = diagnosticSnapshot(); if (snapshot.world) void navigator.clipboard?.writeText(snapshot.world.config.seed); }}>Копировать seed</button>
                <button type="button" onClick={() => { const snapshot = diagnosticSnapshot(); if (snapshot.world) downloadJson('alpine-legacy-balance-sample.json', runBalanceSample(snapshot.world.config.seed, 8, snapshot.world.config.difficulty)); }}>Balance sample</button>
              </div>
            </details>
          </section>
        </div>
      )}
    </>
  );
}
