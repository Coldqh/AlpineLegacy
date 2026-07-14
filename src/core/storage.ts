import { migrateCareerV2, migrateCareerV3, migrateCareerV4, migrateCareerV5, migrateCareerV6, migrateCareerV7, migrateCareerV8 } from './career';
import { hydrateCareerProgression } from './progression';
import { hydrateWorld } from './generator';
import type { CareerState, WorldState } from './types';

const WORLD_KEY = 'alpine-legacy:world:v1';
const CAREER_KEY_V2 = 'alpine-legacy:career:v2';
const CAREER_KEY_V3 = 'alpine-legacy:career:v3';
const CAREER_KEY_V4 = 'alpine-legacy:career:v4';
const CAREER_KEY_V5 = 'alpine-legacy:career:v5';
const CAREER_KEY_V6 = 'alpine-legacy:career:v6';
const CAREER_KEY_V7 = 'alpine-legacy:career:v7';
const CAREER_KEY_V8 = 'alpine-legacy:career:v8';
const CAREER_KEY_V9 = 'alpine-legacy:career:v9';
const CAREER_KEY = 'alpine-legacy:career:v10';

export function saveWorld(world: WorldState) {
  localStorage.setItem(WORLD_KEY, JSON.stringify(world));
}

export function loadWorld(): WorldState | null {
  const raw = localStorage.getItem(WORLD_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorldState;
    if (!parsed?.id || !parsed?.region?.mountains?.length) throw new Error('Invalid world save');
    return hydrateWorld(parsed);
  } catch {
    localStorage.removeItem(WORLD_KEY);
    return null;
  }
}

export function saveCareer(career: CareerState) {
  localStorage.setItem(CAREER_KEY, JSON.stringify(career));
}

export function loadCareer(world?: WorldState): CareerState | null {
  const raw = localStorage.getItem(CAREER_KEY) ?? localStorage.getItem(CAREER_KEY_V9) ?? localStorage.getItem(CAREER_KEY_V8) ?? localStorage.getItem(CAREER_KEY_V7) ?? localStorage.getItem(CAREER_KEY_V6) ?? localStorage.getItem(CAREER_KEY_V5) ?? localStorage.getItem(CAREER_KEY_V4) ?? localStorage.getItem(CAREER_KEY_V3) ?? localStorage.getItem(CAREER_KEY_V2);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed?.hero?.name || !parsed?.club?.id) throw new Error('Invalid career save');
    if (world && parsed.worldId !== world.id) return null;
    if (parsed.schemaVersion === 10) return hydrateCareerProgression(parsed as CareerState);
    if (parsed.schemaVersion === 9 && world) {
      const migrated = hydrateCareerProgression({ ...parsed, schemaVersion: 10 } as CareerState);
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V9);
      return migrated;
    }
    if (parsed.schemaVersion === 8 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV8(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V9);
    localStorage.removeItem(CAREER_KEY_V8);
      return migrated;
    }
    if (parsed.schemaVersion === 7 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV7(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V8);
      localStorage.removeItem(CAREER_KEY_V7);
      return migrated;
    }
    if (parsed.schemaVersion === 6 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV6(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V7);
      localStorage.removeItem(CAREER_KEY_V6);
      return migrated;
    }
    if (parsed.schemaVersion === 5 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV5(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V6);
      localStorage.removeItem(CAREER_KEY_V5);
      return migrated;
    }
    if (parsed.schemaVersion === 4 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV4(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V4);
      return migrated;
    }
    if (parsed.schemaVersion === 3 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV3(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V3);
      return migrated;
    }
    if (parsed.schemaVersion === 2 && world) {
      const migrated = hydrateCareerProgression(migrateCareerV2(parsed, world));
      saveCareer(migrated);
      localStorage.removeItem(CAREER_KEY_V2);
      return migrated;
    }
    throw new Error('Unsupported career save');
  } catch {
    localStorage.removeItem(CAREER_KEY);
    localStorage.removeItem(CAREER_KEY_V9);
    localStorage.removeItem(CAREER_KEY_V8);
    localStorage.removeItem(CAREER_KEY_V7);
    localStorage.removeItem(CAREER_KEY_V6);
    localStorage.removeItem(CAREER_KEY_V5);
    localStorage.removeItem(CAREER_KEY_V4);
    localStorage.removeItem(CAREER_KEY_V3);
    localStorage.removeItem(CAREER_KEY_V2);
    return null;
  }
}

export function deleteCareer() {
  localStorage.removeItem(CAREER_KEY);
  localStorage.removeItem(CAREER_KEY_V9);
  localStorage.removeItem(CAREER_KEY_V8);
  localStorage.removeItem(CAREER_KEY_V7);
  localStorage.removeItem(CAREER_KEY_V6);
  localStorage.removeItem(CAREER_KEY_V5);
  localStorage.removeItem(CAREER_KEY_V4);
  localStorage.removeItem(CAREER_KEY_V3);
  localStorage.removeItem(CAREER_KEY_V2);
}

export function deleteWorld() {
  localStorage.removeItem(WORLD_KEY);
  deleteCareer();
}
