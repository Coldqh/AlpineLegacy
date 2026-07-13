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
  | 'ARCHIVE'
  | 'SETTINGS';

export type CareerTabId = 'OVERVIEW' | 'WORLD' | 'NEWS' | 'RIVALS' | 'RECORDS' | 'ROUTE' | 'TEAM' | 'PEOPLE' | 'EQUIPMENT' | 'EXPEDITION' | 'CLIMB' | 'JOURNAL';
export type OriginId = 'CLUB_SCHOOL' | 'HIGHLAND_LOCAL' | 'ROCK_SECTION';
export type SkillId = 'ENDURANCE' | 'ROCK' | 'ICE' | 'NAVIGATION' | 'MEDICINE' | 'LEADERSHIP';
export type TrainingId = 'CONDITIONING' | 'ROCK_PRACTICE' | 'ICE_PRACTICE' | 'MAP_ROOM' | 'FIRST_AID' | 'CLUB_DUTY' | 'RECOVERY';
export type ClimbPace = 'CAUTIOUS' | 'STEADY' | 'FAST';
export type ClimbPhase = 'READY' | 'ASCENT' | 'SUMMIT' | 'DESCENT' | 'COMPLETE' | 'FAILED' | 'RETREATED';
export type GearCategory = 'PROTECTION' | 'SHELTER' | 'SURVIVAL' | 'COMMUNICATION';
export type TeamRole = 'LEADER' | 'ROPE_LEAD' | 'MEDIC' | 'NAVIGATOR' | 'SUPPORT';
export type MemberStatus = 'ACTIVE' | 'INJURED' | 'LEFT' | 'RETIRED' | 'DEAD';
export type ClimbMemberStatus = 'ACTIVE' | 'TURNED_BACK' | 'INCAPACITATED' | 'DEAD';
export type MemoryType = 'FIRST_MEETING' | 'ORDER' | 'REFUSAL' | 'SUMMIT' | 'RETREAT' | 'RESCUE' | 'INJURY' | 'CONFLICT' | 'LOYALTY' | 'LOSS';
export type ClimbOrderId = 'SLOW_DOWN' | 'PRESS_ON' | 'TURN_BACK_WEAKEST' | 'ASSIGN_HELPER';
export type WorldAthleteStatus = 'ACTIVE' | 'INJURED' | 'RETIRED' | 'DEAD' | 'MISSING';
export type WorldEventType = 'EXPEDITION' | 'SUMMIT' | 'RETREAT' | 'RECORD' | 'INJURY' | 'DEATH' | 'RETIREMENT' | 'CLUB' | 'RIVALRY';
export type WorldExpeditionOutcome = 'SUMMIT' | 'RETREAT' | 'FAILED' | 'TRAGEDY';
export type MountainCharacterId = 'WEATHER' | 'TECHNICAL' | 'ENDURANCE' | 'ALTITUDE' | 'DESCENT';

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
  characterId: MountainCharacterId;
  characterTitle: string;
  characterDescription: string;
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
  type: 'CAREER' | 'TRAINING' | 'CLIMB' | 'INJURY' | 'CLUB' | 'EXPEDITION' | 'RELATIONSHIP' | 'PRESS';
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
  campPossible: boolean;
  hazard: string;
}

export interface ExpeditionRoute {
  id: string;
  mountainId: string;
  mountainName: string;
  mountainCharacterId: MountainCharacterId;
  name: string;
  style: string;
  summary: string;
  startElevation: number;
  summitElevation: number;
  estimatedHours: number;
  technicality: number;
  objectiveRisk: number;
  recommendedTeamSize: number;
  requiredGearIds: string[];
  segments: RouteSegment[];
}

export interface PersonalityProfile {
  caution: number;
  ambition: number;
  discipline: number;
  loyalty: number;
  empathy: number;
  ego: number;
}

export interface RelationshipProfile {
  trust: number;
  respect: number;
  bond: number;
  rivalry: number;
  resentment: number;
  debt: number;
}

export interface PersonMemory {
  id: string;
  year: number;
  seasonDay: number;
  type: MemoryType;
  title: string;
  description: string;
  trustDelta: number;
  respectDelta: number;
  resentmentDelta: number;
}

export interface TeamMember {
  id: string;
  name: string;
  age: number;
  role: TeamRole;
  specialty: SkillId;
  skill: number;
  endurance: number;
  trust: number;
  condition: number;
  temperament: string;
  note: string;
  required?: boolean;
  morale: number;
  status: MemberStatus;
  injuries: string[];
  hiddenIssue: string | null;
  personalGoal: string;
  personality: PersonalityProfile;
  relationship: RelationshipProfile;
  memories: PersonMemory[];
  sharedClimbs: number;
  summits: number;
  rescues: number;
  refusals: number;
  availability: number;
}

export interface GearDefinition {
  id: string;
  name: string;
  category: GearCategory;
  description: string;
  weightKg: number;
  unitCost: number;
  maxQuantity: number;
}

export interface WeatherWindow {
  id: string;
  label: string;
  startsInDays: number;
  durationHours: number;
  temperatureC: number;
  windKmh: number;
  snowfallCm: number;
  stability: number;
  description: string;
}

export interface ExpeditionPlan {
  routeId: string;
  weatherWindowId: string;
  teamMemberIds: string[];
  gear: Record<string, number>;
  foodDays: number;
  fuelUnits: number;
  ropeMeters: number;
  acclimatizationDays: number;
}

export interface ExpeditionReadiness {
  total: number;
  hero: number;
  routeFit: number;
  team: number;
  equipment: number;
  weather: number;
  acclimatization: number;
  blockers: string[];
}

export interface ClimbSupplies {
  foodUnits: number;
  waterUnits: number;
  fuelUnits: number;
}

export interface ClimbMemberState {
  memberId: string;
  condition: number;
  fatigue: number;
  morale: number;
  status: ClimbMemberStatus;
  visibleInjury: string | null;
  hiddenInjury: string | null;
  summitReached: boolean;
  refusedOrders: number;
  helperForMemberId: string | null;
}

export interface TeamDecisionRecord {
  id: string;
  order: ClimbOrderId;
  memberId: string | null;
  accepted: boolean;
  description: string;
  elapsedMinutes: number;
}

export interface QualificationClimb {
  id: string;
  mountainId: string;
  mountainName: string;
  routeId: string;
  routeName: string;
  routeStyle: string;
  startElevation: number;
  summitElevation: number;
  phase: ClimbPhase;
  summitReached: boolean;
  retreating: boolean;
  segmentIndex: number;
  moveCount: number;
  currentElevation: number;
  elapsedMinutes: number;
  energy: number;
  condition: number;
  weather: string;
  temperatureC: number;
  windKmh: number;
  visibility: number;
  weatherStep: number;
  packWeightKg: number;
  teamMemberIds: string[];
  teamCondition: number;
  teamStates: ClimbMemberState[];
  decisions: TeamDecisionRecord[];
  supplies: ClimbSupplies;
  hoursAwake: number;
  campEstablished: boolean;
  route: RouteSegment[];
  log: string[];
  injuries: string[];
  casualties: string[];
  rescuedMemberIds: string[];
  earnedReputation: number;
  earnedMoney: number;
}

export interface ReputationProfile {
  leadership: number;
  reliability: number;
  care: number;
  ambition: number;
}

export interface ExpeditionReport {
  id: string;
  year: number;
  seasonDay: number;
  mountainName: string;
  routeName: string;
  outcome: 'SUMMIT' | 'RETREAT' | 'FAILED';
  highestElevation: number;
  elapsedMinutes: number;
  teamMemberIds: string[];
  casualties: string[];
  injuries: string[];
  decisions: TeamDecisionRecord[];
  clubReaction: string;
  pressReaction: string;
  reputationDelta: number;
  moneyDelta: number;
}


export interface WorldClub {
  id: string;
  name: string;
  country: string;
  foundedYear: number;
  prestige: number;
  doctrine: string;
  members: number;
  expeditions: number;
  summits: number;
  losses: number;
}

export interface WorldAthlete {
  id: string;
  name: string;
  age: number;
  country: string;
  clubId: string;
  status: WorldAthleteStatus;
  specialty: SkillId;
  skill: number;
  endurance: number;
  altitude: number;
  caution: number;
  ambition: number;
  fame: number;
  experience: number;
  summits: number;
  firstAscents: number;
  rescues: number;
  injuries: string[];
  knownToHero: boolean;
  rivalry: number;
  relationshipNote: string;
  currentGoal: string;
  lastEvent: string;
}

export interface MountainWorldHistory {
  mountainId: string;
  mountainName: string;
  elevation: number;
  technicality: number;
  altitudeSeverity: number;
  prestige: number;
  attempts: number;
  summits: number;
  deaths: number;
  firstAscentYear: number | null;
  firstAscentAthleteIds: string[];
  fastestMinutes: number | null;
  fastestAthleteId: string | null;
  winterAscentYear: number | null;
  currentAttention: number;
}

export interface WorldRecord {
  id: string;
  category: 'HIGHEST_SUMMIT' | 'MOST_SUMMITS' | 'FIRST_ASCENTS' | 'SPEED' | 'YOUNGEST' | 'RESCUES';
  title: string;
  holderAthleteId: string | null;
  holderName: string;
  value: number;
  unit: string;
  mountainId: string | null;
  mountainName: string | null;
  year: number;
  description: string;
}

export interface WorldNewsItem {
  id: string;
  year: number;
  seasonDay: number;
  type: WorldEventType;
  headline: string;
  summary: string;
  athleteIds: string[];
  clubIds: string[];
  mountainId: string | null;
  importance: number;
  isBreaking: boolean;
}

export interface WorldExpedition {
  id: string;
  year: number;
  seasonDay: number;
  mountainId: string;
  mountainName: string;
  leaderAthleteId: string;
  memberAthleteIds: string[];
  clubId: string;
  outcome: WorldExpeditionOutcome;
  highestElevation: number;
  durationDays: number;
  casualties: string[];
  recordId: string | null;
  summary: string;
}

export interface LivingWorldState {
  version: 1;
  lastSimulatedYear: number;
  lastSimulatedDay: number;
  tick: number;
  athletes: WorldAthlete[];
  clubs: WorldClub[];
  mountainHistory: MountainWorldHistory[];
  news: WorldNewsItem[];
  expeditions: WorldExpedition[];
  records: WorldRecord[];
}

export interface CareerState {
  schemaVersion: 7;
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
  routes: ExpeditionRoute[];
  teamRoster: TeamMember[];
  weatherWindows: WeatherWindow[];
  expeditionPlan: ExpeditionPlan;
  reports: ExpeditionReport[];
  reputationProfile: ReputationProfile;
  livingWorld: LivingWorldState;
}

export interface CareerDraft {
  name: string;
  age: number;
  originId: OriginId;
}


export interface ClimbActionPreview {
  pace: ClimbPace;
  durationMinutes: number;
  energyCost: number;
  incidentRisk: number;
  foodCost: number;
  waterCost: number;
  riskLabel: 'НИЗКИЙ' | 'СРЕДНИЙ' | 'ВЫСОКИЙ' | 'КРИТИЧЕСКИЙ';
  summary: string;
}

export interface PreparationInsight {
  tone: 'GOOD' | 'WARNING' | 'DANGER';
  title: string;
  detail: string;
}

export interface ClimbStepResult {
  career: CareerState;
  headline: string;
  detail: string;
  severity: 'CALM' | 'WARNING' | 'DANGER' | 'SUCCESS';
}
