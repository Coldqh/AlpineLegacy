export type EraId = 'PIONEER' | 'EXPEDITION' | 'MODERN';
export type DifficultyId = 'EXPLORER' | 'CLIMBER' | 'EXPEDITION';
export type ScreenId =
  | 'MENU'
  | 'SETUP'
  | 'GENERATING'
  | 'REGION'
  | 'MOUNTAIN'
  | 'CHARACTER'
  | 'CAREER'
  | 'CLIMB'
  | 'ARCHIVE'
  | 'SETTINGS';

export type OriginId = 'CLUB_SCHOOL' | 'HIGHLAND_LOCAL' | 'ROCK_SECTION';
export type SkillId = 'ENDURANCE' | 'ROCK' | 'ICE' | 'NAVIGATION' | 'MEDICINE' | 'LEADERSHIP';
export type TrainingId = 'CONDITIONING' | 'ROCK_PRACTICE' | 'ICE_PRACTICE' | 'MAP_ROOM' | 'FIRST_AID' | 'CLUB_DUTY' | 'RECOVERY';
export type ClimbPace = 'CAUTIOUS' | 'STEADY' | 'FAST';
export type ClimbPhase = 'READY' | 'ASCENT' | 'SUMMIT' | 'DESCENT' | 'COMPLETE' | 'FAILED' | 'RETREATED';

export interface WorldSeedConfig {
  seed: string;
  eraId: EraId;
  startYear: number;
  difficulty: DifficultyId;
}

export interface ProfilePoint {
  x: number;
  y: number;
}

export interface MountainData {
  id: string;
  name: string;
  epithet: string;
  elevation: number;
  prominence: number;
  technicality: number;
  altitudeSeverity: number;
  remoteness: number;
  prestige: number;
  climateBand: string;
  massifType: string;
  dangerProfile: string;
  status: string;
  summary: string;
  profilePoints: ProfilePoint[];
  history: string[];
}

export interface RegionData {
  id: string;
  name: string;
  subtitle: string;
  climate: string;
  prestige: number;
  elevationMin: number;
  elevationMax: number;
  coordinates: string;
  summary: string;
  history: string[];
  mountains: MountainData[];
}

export interface WorldState {
  id: string;
  config: WorldSeedConfig;
  createdAt: string;
  worldAge: number;
  region: RegionData;
}

export type SkillSet = Record<SkillId, number>;
export type SkillXp = Record<SkillId, number>;

export interface OriginDefinition {
  id: OriginId;
  title: string;
  subtitle: string;
  description: string;
  signature: string;
  statLine: string;
  skills: SkillSet;
  startingMoney: number;
  startingForm: number;
}

export interface ClubData {
  id: string;
  name: string;
  town: string;
  foundedYear: number;
  standing: number;
  specialty: string;
  doctrine: string;
  mentorName: string;
  mentorTitle: string;
}

export interface CareerHero {
  id: string;
  name: string;
  age: number;
  originId: OriginId;
  originTitle: string;
  startYear: number;
  health: number;
  form: number;
  fatigue: number;
  morale: number;
  reputation: number;
  money: number;
  skills: SkillSet;
  skillXp: SkillXp;
  injuries: string[];
}

export interface CareerLogEntry {
  id: string;
  year: number;
  seasonDay: number;
  type: 'CAREER' | 'TRAINING' | 'CLIMB' | 'INJURY' | 'CLUB';
  title: string;
  description: string;
}

export interface CalendarEntry {
  id: string;
  day: number;
  type: 'TRAINING' | 'CLUB' | 'WEATHER' | 'CLIMB';
  title: string;
  note: string;
}

export interface RouteSegment {
  id: string;
  name: string;
  terrain: string;
  elevationGain: number;
  baseDurationMinutes: number;
  difficulty: number;
  exposure: number;
  skill: SkillId;
  note: string;
}

export interface QualificationClimb {
  id: string;
  mountainId: string;
  mountainName: string;
  routeName: string;
  startElevation: number;
  summitElevation: number;
  phase: ClimbPhase;
  segmentIndex: number;
  moveCount: number;
  currentElevation: number;
  elapsedMinutes: number;
  energy: number;
  condition: number;
  weather: string;
  route: RouteSegment[];
  log: string[];
  injuries: string[];
  earnedReputation: number;
  earnedMoney: number;
}

export interface CareerState {
  schemaVersion: 2;
  id: string;
  worldId: string;
  createdAt: string;
  year: number;
  seasonDay: number;
  week: number;
  hero: CareerHero;
  club: ClubData;
  calendar: CalendarEntry[];
  log: CareerLogEntry[];
  completedClimbs: number;
  highestElevation: number;
  activeClimb: QualificationClimb | null;
}

export interface CareerDraft {
  name: string;
  age: number;
  originId: OriginId;
}

export interface ClimbStepResult {
  career: CareerState;
  headline: string;
  detail: string;
  severity: 'CALM' | 'WARNING' | 'DANGER' | 'SUCCESS';
}
