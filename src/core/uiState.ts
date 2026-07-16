import type { CareerState, CareerTabId, MountainData, ScreenId, WorldState } from './types';

const UI_STATE_KEY = 'alpine-legacy:ui:v1';

export type AtlasReturnScreen = 'MENU' | 'CAREER';

export interface PersistedUiState {
  screen: ScreenId;
  careerTab: CareerTabId;
  atlasReturnScreen: AtlasReturnScreen;
  selectedMountainId: string | null;
}

const validTabs = new Set<CareerTabId>([
  'OVERVIEW', 'WORLD', 'NEWS', 'RIVALS', 'RECORDS', 'ROUTE', 'TEAM', 'PEOPLE', 'EQUIPMENT', 'EXPEDITION', 'CLIMB', 'JOURNAL',
]);

const restorableScreens = new Set<ScreenId>(['MENU', 'REGION', 'MOUNTAIN', 'CAREER']);

export const DEFAULT_UI_STATE: PersistedUiState = {
  screen: 'MENU',
  careerTab: 'OVERVIEW',
  atlasReturnScreen: 'MENU',
  selectedMountainId: null,
};

function readRaw(): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function normalizeUiState(raw: unknown, world: WorldState | null, career: CareerState | null): PersistedUiState {
  const source = raw && typeof raw === 'object' ? raw as Partial<PersistedUiState> : {};
  const careerTab = validTabs.has(source.careerTab as CareerTabId) ? source.careerTab as CareerTabId : 'OVERVIEW';
  const atlasReturnScreen: AtlasReturnScreen = source.atlasReturnScreen === 'CAREER' ? 'CAREER' : 'MENU';
  const selectedMountainId = typeof source.selectedMountainId === 'string' && world?.ecosystem.content.mountains.byId[source.selectedMountainId]
    ? source.selectedMountainId
    : null;

  let screen: ScreenId = restorableScreens.has(source.screen as ScreenId) ? source.screen as ScreenId : 'MENU';
  if (!world && screen !== 'MENU') screen = 'MENU';
  if (!career && screen === 'CAREER') screen = world ? 'REGION' : 'MENU';
  if (screen === 'MOUNTAIN' && !selectedMountainId) screen = world ? 'REGION' : 'MENU';

  if (career?.activeClimb) {
    return {
      screen: 'CAREER',
      careerTab: 'CLIMB',
      atlasReturnScreen: 'CAREER',
      selectedMountainId,
    };
  }

  return { screen, careerTab, atlasReturnScreen, selectedMountainId };
}

export function loadUiState(world: WorldState | null, career: CareerState | null) {
  return normalizeUiState(readRaw(), world, career);
}

export function saveUiState(state: PersistedUiState) {
  try {
    globalThis.localStorage?.setItem(UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // UI state is optional. Career saves remain authoritative.
  }
}

export function selectedMountainFromUi(world: WorldState | null, ui: PersistedUiState): MountainData | null {
  if (!world || !ui.selectedMountainId) return null;
  return world.ecosystem.content.mountains.byId[ui.selectedMountainId] ?? null;
}
