import { migrateCareerV2, migrateCareerV3, migrateCareerV4 } from './career';
import type { CareerState, WorldState } from './types';

const WORLD_KEY = 'alpine-legacy:world:v1';
const CAREER_KEY_V2 = 'alpine-legacy:career:v2';
const CAREER_KEY_V3 = 'alpine-legacy:career:v3';
const CAREER_KEY_V4 = 'alpine-legacy:career:v4';
const CAREER_KEY = 'alpine-legacy:career:v5';

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

export function loadCareer(world?: WorldState): CareerState | null {
  const raw = localStorage.getItem(CAREER_KEY) ?? localStorage.getItem(CAREER_KEY_V4) ?? localStorage.getItem(CAREER_KEY_V3) ?? localStorage.getItem(CAREER_KEY_V2);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed?.hero?.name || !parsed?.club?.id) throw new Error('Invalid career save');
    if (world && parsed.worldId !== world.id) return null;
    if (parsed.schemaVersion === 5) return parsed as CareerState;
    if (parsed.schemaVersion === 4 && world) {
      const migrated = migrateCareerV4(parsed, world);
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V4);
      return migrated;
    }
    if (parsed.schemaVersion === 3 && world) {
      const migrated = migrateCareerV3(parsed, world);
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V3);
      return migrated;
    }
    if (parsed.schemaVersion === 2 && world) {
      const migrated = migrateCareerV2(parsed, world);
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V2);
      return migrated;
    }
    throw new Error('Unsupported career save');
  } catch {
    localStorage.removeItem(CAREER_KEY);
    localStorage.removeItem(CAREER_KEY_V4);
    localStorage.removeItem(CAREER_KEY_V3);
    localStorage.removeItem(CAREER_KEY_V2);
    return null;
  }
}

export function deleteCareer() {
  localStorage.removeItem(CAREER_KEY);
  localStorage.removeItem(CAREER_KEY_V4);
  localStorage.removeItem(CAREER_KEY_V3);
  localStorage.removeItem(CAREER_KEY_V2);
}

export function deleteWorld() {
  localStorage.removeItem(WORLD_KEY);
  deleteCareer();
}
