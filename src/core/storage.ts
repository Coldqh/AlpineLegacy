import { hydrateCareerFoundation, migrateCareerV10, migrateCareerV2, migrateCareerV3, migrateCareerV4, migrateCareerV5, migrateCareerV6, migrateCareerV7, migrateCareerV8 } from './career';
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
const CAREER_KEY_V10 = 'alpine-legacy:career:v10';
const CAREER_KEY_V11 = 'alpine-legacy:career:v11';
const CAREER_KEY_V12 = 'alpine-legacy:career:v12';
const CAREER_KEY_V13 = 'alpine-legacy:career:v13';
const CAREER_KEY_V14 = 'alpine-legacy:career:v14';
const CAREER_KEY = 'alpine-legacy:career:v15';
const CAREER_BACKUP_KEY = 'alpine-legacy:career:backup:v15';
const CAREER_PENDING_KEY = 'alpine-legacy:career:pending:v15';
const RECOVERY_META_KEY = 'alpine-legacy:career:recovery-meta:v1';


let lastCareerSerialized: string | null = null;
let lastBackupFingerprint = '';

function careerFingerprint(career: CareerState) {
  const simulation = career.activeClimb?.simulation;
  if (!simulation) return `career:${career.year}:${career.seasonDay}:${career.reports.length}`;
  const stage = simulation.direction === 'ASCENT' ? simulation.ascentStages[simulation.stageIndex] : simulation.descentStages[simulation.stageIndex];
  return `${career.activeClimb?.id}:${simulation.direction}:${stage?.id ?? simulation.stageIndex}:${Math.floor(simulation.totalActions / 5)}`;
}

const LEGACY_KEYS = [CAREER_KEY_V14, CAREER_KEY_V13, CAREER_KEY_V12, CAREER_KEY_V11, CAREER_KEY_V10, CAREER_KEY_V9, CAREER_KEY_V8, CAREER_KEY_V7, CAREER_KEY_V6, CAREER_KEY_V5, CAREER_KEY_V4, CAREER_KEY_V3, CAREER_KEY_V2];

function parseJson(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw) as any; } catch { return null; }
}

function isCareerPayload(value: any) {
  return Boolean(value?.hero?.name && value?.worldId && Number(value?.schemaVersion) >= 2);
}

function recordRecoveryMeta(source: string, reason: string) {
  localStorage.setItem(RECOVERY_META_KEY, JSON.stringify({ source, reason, recoveredAt: new Date().toISOString() }));
}

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
  const serialized = JSON.stringify(career);
  if (serialized === lastCareerSerialized) return;

  const previous = lastCareerSerialized ?? localStorage.getItem(CAREER_KEY);
  const fingerprint = careerFingerprint(career);
  const checkpoint = fingerprint !== lastBackupFingerprint;

  // localStorage is synchronous on iOS. During an expedition use one primary write
  // per action and only create the heavier backup at stage/5-action checkpoints.
  if (checkpoint) localStorage.setItem(CAREER_PENDING_KEY, serialized);
  localStorage.setItem(CAREER_KEY, serialized);
  if (checkpoint) {
    if (previous && previous !== serialized) localStorage.setItem(CAREER_BACKUP_KEY, previous);
    localStorage.removeItem(CAREER_PENDING_KEY);
    lastBackupFingerprint = fingerprint;
  }
  lastCareerSerialized = serialized;
}


function migratePayload(parsed: any, world: WorldState): CareerState | null {
  if (!isCareerPayload(parsed) || parsed.worldId !== world.id) return null;
  if (parsed.schemaVersion === 15) return hydrateCareerFoundation(parsed, world, false);
  if (parsed.schemaVersion === 14 || parsed.schemaVersion === 13 || parsed.schemaVersion === 12 || parsed.schemaVersion === 11) return hydrateCareerFoundation(parsed, world, false);
  if (parsed.schemaVersion === 10) return migrateCareerV10(parsed, world);
  if (parsed.schemaVersion === 9) return hydrateCareerFoundation({ ...parsed, schemaVersion: 10 } as CareerState, world, true);
  if (parsed.schemaVersion === 8) return hydrateCareerFoundation(migrateCareerV8(parsed, world), world, true);
  if (parsed.schemaVersion === 7) return hydrateCareerFoundation(migrateCareerV7(parsed, world), world, true);
  if (parsed.schemaVersion === 6) return hydrateCareerFoundation(migrateCareerV6(parsed, world), world, true);
  if (parsed.schemaVersion === 5) return hydrateCareerFoundation(migrateCareerV5(parsed, world), world, true);
  if (parsed.schemaVersion === 4) return hydrateCareerFoundation(migrateCareerV4(parsed, world), world, true);
  if (parsed.schemaVersion === 3) return hydrateCareerFoundation(migrateCareerV3(parsed, world), world, true);
  if (parsed.schemaVersion === 2) return hydrateCareerFoundation(migrateCareerV2(parsed, world), world, true);
  return null;
}

export function loadCareer(world?: WorldState): CareerState | null {
  if (!world) return null;
  const candidates = [
    { key: CAREER_KEY, label: 'primary' },
    { key: CAREER_PENDING_KEY, label: 'pending' },
    { key: CAREER_BACKUP_KEY, label: 'backup' },
    ...LEGACY_KEYS.map(key => ({ key, label: key })),
  ];

  let primaryInvalid = false;
  for (const candidate of candidates) {
    const raw = localStorage.getItem(candidate.key);
    if (!raw) continue;
    const parsed = parseJson(raw);
    if (!parsed) {
      if (candidate.key === CAREER_KEY) primaryInvalid = true;
      continue;
    }
    try {
      const migrated = migratePayload(parsed, world);
      if (!migrated) continue;
      if (candidate.key !== CAREER_KEY || migrated.schemaVersion !== parsed.schemaVersion) {
        saveCareer(migrated);
        recordRecoveryMeta(candidate.label, primaryInvalid ? 'Основной сейв повреждён; восстановлена резервная копия.' : 'Сейв перенесён на актуальную схему.');
      }
      lastCareerSerialized = JSON.stringify(migrated);
      lastBackupFingerprint = careerFingerprint(migrated);
      return migrated;
    } catch {
      if (candidate.key === CAREER_KEY) primaryInvalid = true;
    }
  }

  if (primaryInvalid) localStorage.removeItem(CAREER_KEY);
  localStorage.removeItem(CAREER_PENDING_KEY);
  return null;
}

export function careerRecoveryStatus() {
  const primary = parseJson(localStorage.getItem(CAREER_KEY));
  const backup = parseJson(localStorage.getItem(CAREER_BACKUP_KEY));
  const pending = parseJson(localStorage.getItem(CAREER_PENDING_KEY));
  const meta = parseJson(localStorage.getItem(RECOVERY_META_KEY));
  return {
    primaryValid: isCareerPayload(primary),
    backupAvailable: isCareerPayload(backup),
    pendingAvailable: isCareerPayload(pending),
    lastRecovery: meta,
  };
}

export function restoreCareerBackup(world: WorldState): CareerState | null {
  const parsed = parseJson(localStorage.getItem(CAREER_BACKUP_KEY));
  if (!parsed) return null;
  const restored = migratePayload(parsed, world);
  if (!restored) return null;
  saveCareer(restored);
  recordRecoveryMeta('manual-backup', 'Пользователь вручную восстановил предыдущий ход.');
  return restored;
}

export function deleteCareer() {
  lastCareerSerialized = null;
  lastBackupFingerprint = '';
  localStorage.removeItem(CAREER_KEY);
  localStorage.removeItem(CAREER_BACKUP_KEY);
  localStorage.removeItem(CAREER_PENDING_KEY);
  localStorage.removeItem(RECOVERY_META_KEY);
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

export function deleteWorld() {
  localStorage.removeItem(WORLD_KEY);
  deleteCareer();
}
