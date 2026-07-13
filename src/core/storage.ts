import type { WorldState } from './types';

const KEY = 'alpine-legacy:world:v1';

export function saveWorld(world: WorldState) {
  localStorage.setItem(KEY, JSON.stringify(world));
}

export function loadWorld(): WorldState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorldState;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function deleteWorld() {
  localStorage.removeItem(KEY);
}
