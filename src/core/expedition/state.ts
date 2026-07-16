import type { EntrySide, GridPoint } from '../../topography/mountainGridEngine';

export type IntegratedDifficulty = 'EXPLORER' | 'CLIMBER' | 'EXPEDITION';
export type IntegratedAuthority = 'PARTICIPANT' | 'SPECIALIST' | 'COMMAND';
export type IntegratedPhase = 'ASCENT' | 'DESCENT' | 'COMPLETE' | 'RETREATED' | 'FAILED';
export type IntegratedRestMode = 'BREAK' | 'BIVOUAC' | 'SLEEP';
export type IntegratedTool = 'ROPE' | 'SCOUT';
export type IntegratedPace = 'CAUTIOUS' | 'STEADY' | 'FAST';
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
  loadKg: number;
  carryCapacityKg: number;
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

export interface IntegratedGearState {
  ropeCondition: number;
  hardwareCondition: number;
  rockHardwareCondition: number;
  iceHardwareCondition: number;
  shelterCondition: number;
  stoveCondition: number;
  radioCondition: number;
  medkitCharges: number;
  oxygenUnits: number;
  lostWeightKg: number;
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
  type: 'FALL' | 'FROSTBITE' | 'ALTITUDE' | 'EXHAUSTION' | 'GEAR_LOSS' | 'SUPPLY_CRISIS' | 'RESCUE' | 'CONFLICT' | 'NEAR_MISS' | 'NAVIGATION' | 'WEATHER' | 'AVALANCHE' | 'ROCKFALL' | 'CREVASSE' | 'DESCENT';
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
  version: 5;
  seed: string;
  difficulty: IntegratedDifficulty;
  authority: IntegratedAuthority;
  pace: IntegratedPace;
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
  lastIncidentActionSerial: number;
  minutesSinceSleep: number;
  lastSleepElevation: number;
  nightsSlept: number;
  climbingDays: number;
  tutorialStep: number;
  infrastructure: Record<string, IntegratedStageInfrastructure>;
  ropeMeters: number;
  campKits: number;
  participants: IntegratedParticipantState[];
  supplies: IntegratedSupplies;
  gear: IntegratedGearState;
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
  rescueCost: number;
  rescueDurationMinutes: number;
  incidents: IntegratedIncidentRecord[];
  eventLog: IntegratedExpeditionEvent[];
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
  participants: Array<Omit<IntegratedParticipantState, 'loadKg' | 'carryCapacityKg'> & Partial<Pick<IntegratedParticipantState, 'loadKg' | 'carryCapacityKg'>>>;
  supplies: IntegratedSupplies;
  gear?: Partial<IntegratedGearState>;
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

export const DEFAULT_INTEGRATED_GEAR: IntegratedGearState = {
  ropeCondition: 100,
  hardwareCondition: 100,
  rockHardwareCondition: 100,
  iceHardwareCondition: 100,
  shelterCondition: 100,
  stoveCondition: 100,
  radioCondition: 0,
  medkitCharges: 0,
  oxygenUnits: 0,
  lostWeightKg: 0,
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function distributeIntegratedLoads(
  participants: Array<Omit<IntegratedParticipantState, 'loadKg' | 'carryCapacityKg'> & Partial<Pick<IntegratedParticipantState, 'loadKg' | 'carryCapacityKg'>>>,
  packWeightKg: number,
): IntegratedParticipantState[] {
  const mobile = participants.filter(participant => participant.status !== 'DEAD' && participant.status !== 'INCAPACITATED');
  const totalLoad = Math.max(0, packWeightKg * Math.max(1, participants.length));
  const capacities = new Map<string, number>();
  let capacityTotal = 0;
  for (const participant of participants) {
    const injuryPenalty = participant.status === 'INJURED' ? 2.5 : participant.status === 'INCAPACITATED' ? 99 : 0;
    const capacity = participant.carryCapacityKg && participant.carryCapacityKg > 0
      ? participant.carryCapacityKg
      : clamp(10.5 + participant.skills.ENDURANCE * 1.35 - injuryPenalty, 7, 25);
    capacities.set(participant.id, capacity);
    if (mobile.some(item => item.id === participant.id)) capacityTotal += capacity;
  }
  return participants.map(participant => {
    const carryCapacityKg = capacities.get(participant.id) ?? 10;
    const canCarry = mobile.some(item => item.id === participant.id);
    const loadKg = canCarry && capacityTotal > 0
      ? Math.round(totalLoad * carryCapacityKg / capacityTotal * 10) / 10
      : 0;
    return { ...participant, carryCapacityKg, loadKg };
  });
}

export function createIntegratedExpeditionState(input: CreateIntegratedExpeditionInput): IntegratedExpeditionState {
  const openingEvent: IntegratedExpeditionEvent = { serial: 0, kind: 'INFO', severity: 'CALM', text: 'Экспедиция готова к выходу.' };
  const gear: IntegratedGearState = {
    ...DEFAULT_INTEGRATED_GEAR,
    ...input.gear,
    medkitCharges: input.gear?.medkitCharges ?? (input.hasMedkit ? 3 : 0),
    stoveCondition: input.gear?.stoveCondition ?? (input.hasStove ? 100 : 0),
    shelterCondition: input.gear?.shelterCondition ?? (input.hasBivy ? 100 : 0),
  };
  return {
    version: 5,
    seed: input.seed,
    difficulty: input.difficulty,
    authority: input.authority,
    pace: 'STEADY',
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
    lastIncidentActionSerial: -99,
    minutesSinceSleep: 0,
    lastSleepElevation: input.startElevation,
    nightsSlept: 0,
    climbingDays: 0,
    tutorialStep: 0,
    infrastructure: {},
    ropeMeters: Math.max(0, Math.round(input.ropeMeters)),
    campKits: Math.max(0, Math.round(input.campKits)),
    participants: distributeIntegratedLoads(input.participants, input.packWeightKg),
    supplies: { ...input.supplies },
    gear,
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
    rescueCost: 0,
    rescueDurationMinutes: 0,
    incidents: [],
    eventLog: [openingEvent],
    message: 'План экспедиции загружен из карьеры. Проверь сторону захода, линию и рабочий темп.',
    lastEvent: openingEvent,
  };
}

export function normalizeIntegratedExpeditionState(state: IntegratedExpeditionState): IntegratedExpeditionState {
  const raw = state as IntegratedExpeditionState & {
    version?: number;
    pace?: IntegratedPace;
    gear?: Partial<IntegratedGearState>;
    eventLog?: IntegratedExpeditionEvent[];
    rescueCost?: number;
    rescueDurationMinutes?: number;
    minutesSinceSleep?: number;
    lastSleepElevation?: number;
    nightsSlept?: number;
    climbingDays?: number;
    tutorialStep?: number;
    lastIncidentActionSerial?: number;
    participants: Array<IntegratedParticipantState & { loadKg?: number; carryCapacityKg?: number }>;
  };
  const complete = raw.version === 5
    && raw.pace
    && raw.gear
    && Array.isArray(raw.eventLog)
    && raw.participants.every(participant => Number.isFinite(participant.loadKg) && Number.isFinite(participant.carryCapacityKg));
  if (complete) return state;

  const participants = distributeIntegratedLoads(raw.participants, raw.packWeightKg);
  const lastEvent = raw.lastEvent ?? { serial: 0, kind: 'INFO', severity: 'CALM', text: raw.message ?? 'Экспедиция восстановлена.' };
  return {
    ...raw,
    version: 5,
    minutesSinceSleep: raw.minutesSinceSleep ?? raw.elapsedMinutes % 1440,
    lastSleepElevation: raw.lastSleepElevation ?? raw.startElevation,
    nightsSlept: raw.nightsSlept ?? 0,
    climbingDays: raw.climbingDays ?? Math.floor(raw.elapsedMinutes / 1440),
    tutorialStep: raw.tutorialStep ?? 0,
    lastIncidentActionSerial: raw.lastIncidentActionSerial ?? -99,
    pace: raw.pace ?? 'STEADY',
    participants,
    gear: {
      ...DEFAULT_INTEGRATED_GEAR,
      ropeCondition: raw.gear?.ropeCondition ?? 100,
      hardwareCondition: raw.gear?.hardwareCondition ?? Math.min(raw.gear?.rockHardwareCondition ?? 100, raw.gear?.iceHardwareCondition ?? 100),
      rockHardwareCondition: raw.gear?.rockHardwareCondition ?? raw.gear?.hardwareCondition ?? 100,
      iceHardwareCondition: raw.gear?.iceHardwareCondition ?? raw.gear?.hardwareCondition ?? 100,
      shelterCondition: raw.gear?.shelterCondition ?? (raw.hasBivy ? 100 : 0),
      stoveCondition: raw.gear?.stoveCondition ?? (raw.hasStove ? 100 : 0),
      radioCondition: raw.gear?.radioCondition ?? 0,
      medkitCharges: raw.gear?.medkitCharges ?? (raw.hasMedkit ? 3 : 0),
      oxygenUnits: raw.gear?.oxygenUnits ?? 0,
      lostWeightKg: raw.gear?.lostWeightKg ?? 0,
    },
    rescueCost: raw.rescueCost ?? 0,
    rescueDurationMinutes: raw.rescueDurationMinutes ?? 0,
    eventLog: raw.eventLog?.length ? raw.eventLog : [lastEvent],
    lastEvent,
  };
}
