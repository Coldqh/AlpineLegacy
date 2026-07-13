import type { CareerState, WorldState } from './types';

const WORLD_KEY = 'alpine-legacy:world:v1';
const CAREER_KEY = 'alpine-legacy:career:v2';

export function saveWorld(world: WorldState) {
  localStorage.setItem(WORLD_KEY, JSON.stringify(world));
}

export function loadWorld(): WorldState | null {
  const raw = localStorage.getItem(WORLD_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorldState;
    if (!parsed?.id || !parsed?.region?.mountains?.length) throw new Error('Invalid world save');
    return parsed;
  } catch {
    localStorage.removeItem(WORLD_KEY);
    return null;
  }
}

export function saveCareer(career: CareerState) {
  localStorage.setItem(CAREER_KEY, JSON.stringify(career));
}

export function loadCareer(worldId?: string): CareerState | null {
  const raw = localStorage.getItem(CAREER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed?.schemaVersion !== 2 || !parsed?.hero?.name || !parsed?.club?.id) throw new Error('Invalid career save');
    if (worldId && parsed.worldId !== worldId) return null;
    return parsed;
  } catch {
    localStorage.removeItem(CAREER_KEY);
    return null;
  }
}

export function deleteCareer() {
  localStorage.removeItem(CAREER_KEY);
}

export function deleteWorld() {
  localStorage.removeItem(WORLD_KEY);
  deleteCareer();
}
