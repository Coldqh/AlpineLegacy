import type { EntrySide, GridPoint } from '../../topography/mountainGridEngine';

export type IntegratedDifficulty = 'EXPLORER' | 'CLIMBER' | 'EXPEDITION';
export type IntegratedAuthority = 'PARTICIPANT' | 'SPECIALIST' | 'COMMAND';
export type IntegratedPhase = 'ASCENT' | 'DESCENT' | 'COMPLETE' | 'RETREATED' | 'FAILED';
export type IntegratedRestMode = 'BREAK' | 'BIVOUAC' | 'SLEEP';
export type IntegratedTool = 'ROUTE' | 'ROPE' | 'CAMP' | 'SCOUT';
export type IntegratedParticipantStatus = 'ACTIVE' | 'INJURED' | 'INCAPACITATED' | 'DEAD';
export type IntegratedSkillId = 'ENDURANCE' | 'ROCK' | 'ICE' | 'NAVIGATION' | 'MEDICINE' | 'LEADERSHIP';

export type IntegratedSkills = Record<IntegratedSkillId, number>;

export interface IntegratedParticipantState {
  id: string;
  memberId: string | null;
  name: string;
  role: string;
  specialty: string;
  energy: number;
  condition: number;
  fatigue: number;
  morale: number;
  trust: number;
  skills: IntegratedSkills;
  status: IntegratedParticipantStatus;
  injury: string | null;
}

export interface IntegratedStageInfrastructure {
  camps: string[];
  ropes: string[];
  revealed: string[];
}

export interface IntegratedSupplies {
  foodUnits: number;
  waterUnits: number;
  fuelUnits: number;
}

export interface IntegratedWeatherWindow {
  temperatureC: number;
  windKmh: number;
  snowfallCm: number;
  stability: number;
  durationHours: number;
}

export interface IntegratedIncidentRecord {
  id: string;
  actionSerial: number;
  stageId: string;
  type: 'FALL' | 'FROSTBITE' | 'ALTITUDE' | 'EXHAUSTION' | 'GEAR_LOSS' | 'SUPPLY_CRISIS' | 'RESCUE';
  participantId: string | null;
  title: string;
  detail: string;
  severity: 'WARNING' | 'DANGER' | 'CRITICAL';
  elapsedMinutes: number;
}

export interface IntegratedExpeditionEvent {
  serial: number;
  kind: 'INFO' | 'STOP' | 'INCIDENT' | 'STAGE_COMPLETE' | 'EXPEDITION_COMPLETE';
  severity: 'CALM' | 'WARNING' | 'DANGER' | 'SUCCESS';
  text: string;
}

export interface IntegratedExpeditionState {
  version: 1;
  seed: string;
  difficulty: IntegratedDifficulty;
  authority: IntegratedAuthority;
  variant: number;
  entrySide: EntrySide;
  routeChoice: string;
  started: boolean;
  phase: IntegratedPhase;
  stageIndex: number;
  paths: Record<string, GridPoint[]>;
  completedStagePaths: Record<string, GridPoint[]>;
  positionIndex: number;
  elapsedMinutes: number;
  actionSerial: number;
  infrastructure: Record<string, IntegratedStageInfrastructure>;
  ropeMeters: number;
  campKits: number;
  participants: IntegratedParticipantState[];
  supplies: IntegratedSupplies;
  packWeightKg: number;
  acclimatizationDays: number;
  hasMedkit: boolean;
  hasStove: boolean;
  hasBivy: boolean;
  weatherWindow: IntegratedWeatherWindow;
  startElevation: number;
  summitElevation: number;
  currentElevation: number;
  highestElevation: number;
  summitReached: boolean;
  retreating: boolean;
  forcedRetreat: boolean;
  injuries: string[];
  casualties: string[];
  rescuedMemberIds: string[];
  incidents: IntegratedIncidentRecord[];
  message: string;
  lastEvent: IntegratedExpeditionEvent;
}

export interface CreateIntegratedExpeditionInput {
  seed: string;
  difficulty: IntegratedDifficulty;
  authority: IntegratedAuthority;
  entrySide?: EntrySide;
  routeChoice?: string;
  ropeMeters: number;
  campKits: number;
  participants: IntegratedParticipantState[];
  supplies: IntegratedSupplies;
  packWeightKg: number;
  acclimatizationDays: number;
  hasMedkit: boolean;
  hasStove: boolean;
  hasBivy: boolean;
  weatherWindow: IntegratedWeatherWindow;
  startElevation: number;
  summitElevation: number;
}

export const EMPTY_INTEGRATED_INFRASTRUCTURE: IntegratedStageInfrastructure = {
  camps: [],
  ropes: [],
  revealed: [],
};

export function createIntegratedExpeditionState(input: CreateIntegratedExpeditionInput): IntegratedExpeditionState {
  return {
    version: 1,
    seed: input.seed,
    difficulty: input.difficulty,
    authority: input.authority,
    variant: 0,
    entrySide: input.entrySide ?? 'SOUTH',
    routeChoice: input.routeChoice ?? (input.authority === 'COMMAND' ? 'MANUAL' : 'AUTO'),
    started: false,
    phase: 'ASCENT',
    stageIndex: 0,
    paths: {},
    completedStagePaths: {},
    positionIndex: 0,
    elapsedMinutes: 0,
    actionSerial: 0,
    infrastructure: {},
    ropeMeters: Math.max(0, Math.round(input.ropeMeters)),
    campKits: Math.max(0, Math.round(input.campKits)),
    participants: input.participants,
    supplies: { ...input.supplies },
    packWeightKg: input.packWeightKg,
    acclimatizationDays: input.acclimatizationDays,
    hasMedkit: input.hasMedkit,
    hasStove: input.hasStove,
    hasBivy: input.hasBivy,
    weatherWindow: { ...input.weatherWindow },
    startElevation: input.startElevation,
    summitElevation: input.summitElevation,
    currentElevation: input.startElevation,
    highestElevation: input.startElevation,
    summitReached: false,
    retreating: false,
    forcedRetreat: false,
    injuries: [],
    casualties: [],
    rescuedMemberIds: [],
    incidents: [],
    message: 'План экспедиции загружен из карьеры. Проверь сторону захода и линию маршрута.',
    lastEvent: { serial: 0, kind: 'INFO', severity: 'CALM', text: 'Экспедиция готова к выходу.' },
  };
}
