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
export type RouteChoiceTone = 'SAFE' | 'BALANCED' | 'BOLD';

export type ParticipantActionTone = 'OBEY' | 'QUESTION' | 'REFUSE' | 'INITIATIVE' | 'CARE';
export type ParticipantSceneKind = 'ORDER' | 'ROLE' | 'FIELD' | 'MORAL';
export type ExpeditionApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type RegionId = string;
export type MountainId = string;
export type RouteId = string;
export type NpcId = string;
export type OrganizationId = string;
export type ExpeditionOfferId = string;

export interface EntityTable<T extends { id: string }> {
  byId: Record<string, T>;
  allIds: string[];
}

export type OrganizationKind = 'ALPINE_CLUB' | 'EXPEDITION_COMPANY' | 'GUIDE_BUREAU';
export type CareerEntryMode = 'ORGANIZATION' | 'INDEPENDENT';
export type ExpeditionRank = 'NOVICE' | 'MEMBER' | 'SPECIALIST' | 'ROPE_LEAD' | 'DEPUTY' | 'LEADER' | 'ORGANIZER';
export type ExpeditionAuthority = 'PARTICIPANT' | 'SPECIALIST' | 'COMMAND';
export type ExpeditionPhaseNode = 'APPROACH' | 'BASE_CAMP' | 'ACCLIMATIZATION' | 'CARRY' | 'CAMP' | 'TECHNICAL' | 'HAZARD' | 'DECISION' | 'SUMMIT' | 'DESCENT' | 'EXIT';
export type ExpeditionScale = 'SMALL' | 'MAJOR' | 'GIANT';
export type TerrainModuleId = 'APPROACH_TRAIL' | 'MORAINE' | 'GLACIER' | 'CREVASSE_FIELD' | 'ICEFALL' | 'ROCK_WALL' | 'MIXED_FACE' | 'SNOW_SLOPE' | 'RIDGE' | 'ALTITUDE_PLATEAU' | 'CAMP_ZONE' | 'EXIT_TRAIL';
export type ExpeditionPreparationTag = 'ROUTE_SCOUTED' | 'SURFACE_CHECKED' | 'ANCHOR_PLACED' | 'ROPE_FIXED' | 'TEAM_STABILIZED';
export type ExpeditionDirection = 'ASCENT' | 'DESCENT';
export type ExpeditionSimulationStatus = 'ACTIVE' | 'STRANDED' | 'SUMMIT' | 'SAFE' | 'DEAD' | 'EVACUATED';
export type ExpeditionFieldActionId =
  | 'MOVE_CAUTIOUS'
  | 'MOVE_STEADY'
  | 'MOVE_FAST'
  | 'SCOUT_LINE'
  | 'PLACE_ANCHOR'
  | 'FIX_ROPE'
  | 'CHECK_SURFACE'
  | 'REST_SHORT'
  | 'EAT_DRINK'
  | 'MAKE_CAMP'
  | 'MELT_SNOW'
  | 'HELP_TEAM'
  | 'DROP_LOAD'
  | 'REQUEST_AID'
  | 'CHALLENGE_ORDER'
  | 'TURN_BACK';

export interface RouteGraphNode {
  id: string;
  phase: ExpeditionPhaseNode;
  label: string;
  segmentId: string | null;
  campPossible: boolean;
  estimatedMinutes: number;
  requiredActionCount: number;
}

export interface RouteGraphEdge {
  id: string;
  from: string;
  to: string;
  choiceId: string | null;
  conditionTag: string | null;
}

export interface RouteGraph {
  startNodeId: string;
  summitNodeId: string;
  exitNodeId: string;
  nodes: RouteGraphNode[];
  edges: RouteGraphEdge[];
}

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
  id: MountainId;
  regionId?: RegionId;
  routeIds?: RouteId[];
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
  id: RegionId;
  mountainIds?: MountainId[];
  organizationIds?: OrganizationId[];
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

export interface OrganizationDefinition {
  id: OrganizationId;
  regionId: RegionId;
  kind: OrganizationKind;
  name: string;
  headquarters: string;
  foundedYear: number;
  prestige: number;
  doctrine: string;
  specialty: string;
  acceptsNovices: boolean;
  memberNpcIds: NpcId[];
}

export interface NpcDefinition {
  id: NpcId;
  regionId: RegionId;
  organizationId: OrganizationId | null;
  name: string;
  birthYear: number;
  role: TeamRole;
  specialty: SkillId;
  skill: number;
  endurance: number;
  temperament: string;
  note: string;
  personality: PersonalityProfile;
  personalGoal: string;
}

export interface NpcRuntimeState {
  id: NpcId;
  status: MemberStatus;
  condition: number;
  morale: number;
  trust: number;
  injuries: string[];
  hiddenIssue: string | null;
  availability: number;
  relationship: RelationshipProfile;
  memories: PersonMemory[];
  sharedClimbs: number;
  summits: number;
  rescues: number;
  refusals: number;
}

export interface OrganizationRuntimeState {
  id: OrganizationId;
  prestige: number;
  funds: number;
  expeditions: number;
  summits: number;
  losses: number;
}

export interface MountainRuntimeState {
  id: MountainId;
  attempts: number;
  summits: number;
  deaths: number;
  firstAscentYear: number | null;
  routeAvailability: Record<RouteId, 'OPEN' | 'CLOSED' | 'UNKNOWN'>;
}

export interface ExpeditionOffer {
  id: ExpeditionOfferId;
  organizationId: OrganizationId | null;
  routeId: RouteId;
  leaderNpcId: NpcId | null;
  memberNpcIds: NpcId[];
  playerRole: TeamRole;
  requiredRank: ExpeditionRank;
  authority: ExpeditionAuthority;
  solo: boolean;
  status: 'OPEN' | 'ACCEPTED' | 'EXPIRED' | 'CLOSED';
  opensOnDay: number;
  expiresOnDay: number;
}

export interface WorldContentRegistry {
  version: 1;
  primaryRegionId: RegionId;
  regions: EntityTable<RegionData>;
  mountains: EntityTable<MountainData>;
  routes: EntityTable<ExpeditionRoute>;
  organizations: EntityTable<OrganizationDefinition>;
  npcs: EntityTable<NpcDefinition>;
  gear: EntityTable<GearDefinition>;
}

export interface WorldRuntimeRegistry {
  version: 1;
  mountains: EntityTable<MountainRuntimeState>;
  organizations: EntityTable<OrganizationRuntimeState>;
  npcs: EntityTable<NpcRuntimeState>;
  expeditionOffers: EntityTable<ExpeditionOffer>;
}

export interface WorldEcosystem {
  schemaVersion: 1;
  contentFingerprint: string;
  content: WorldContentRegistry;
  runtime: WorldRuntimeRegistry;
}

export interface WorldState {
  schemaVersion: 2;
  id: string;
  config: WorldSeedConfig;
  createdAt: string;
  worldAge: number;
  /** Compatibility projection. Ecosystem registries are authoritative. */
  region: RegionData;
  ecosystem: WorldEcosystem;
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
  decisionId?: string;
  linkedAscentSegmentId?: string;
  noReturn?: boolean;
  safeHaven?: boolean;
  descentNote?: string;
  terrainModuleId?: TerrainModuleId;
}

export interface RouteDecisionOption {
  id: string;
  title: string;
  tone: RouteChoiceTone;
  description: string;
  durationModifier: number;
  energyModifier: number;
  riskModifier: number;
  requiresGearId?: string;
  requiresRopeMeters?: number;
  resultNote: string;
}

export interface RouteDecisionPoint {
  id: string;
  segmentId: string;
  title: string;
  situation: string;
  options: RouteDecisionOption[];
}

export interface ExpeditionRoute {
  id: RouteId;
  regionId?: RegionId;
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
  descentSegments?: RouteSegment[];
  decisions?: RouteDecisionPoint[];
  isSignature?: boolean;
  routeStory?: string[];
  descentSummary?: string;
  graph?: RouteGraph;
  expectedPlayMinutes?: number;
  estimatedDecisionCount?: number;
  expeditionScale?: ExpeditionScale;
  contentVersion?: number;
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
  routeId: RouteId;
  offerId: ExpeditionOfferId | null;
  leaderNpcId: NpcId | null;
  playerRole: TeamRole;
  authorityMode: ExpeditionAuthority;
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

export interface ClimbCache {
  id: string;
  segmentId: string;
  elevation: number;
  foodUnits: number;
  waterUnits: number;
  fuelUnits: number;
  recovered: boolean;
}

export interface RouteChoiceRecord {
  decisionId: string;
  optionId: string;
  title: string;
  note: string;
  elapsedMinutes: number;
}


export interface ExpeditionApplication {
  id: string;
  offerId: ExpeditionOfferId;
  status: ExpeditionApplicationStatus;
  score: number;
  reason: string;
  appliedYear: number;
  appliedDay: number;
}

export interface ParticipantSceneOption {
  id: string;
  title: string;
  detail: string;
  tone: ParticipantActionTone;
  energyDelta: number;
  conditionDelta: number;
  teamDelta: number;
  leaderTrustDelta: number;
  groupTrustDelta: number;
  disciplineDelta: number;
  initiativeDelta: number;
  careDelta: number;
  competenceDelta: number;
  rankDelta: number;
  advanceMinutes: number;
  skill?: SkillId;
  skillDifficulty?: number;
  pace?: ClimbPace;
}

export interface ParticipantScene {
  id: string;
  kind: ParticipantSceneKind;
  phase: ExpeditionPhaseNode;
  nodeId: string;
  nodeLabel: string;
  title: string;
  situation: string;
  orderText: string | null;
  leaderNpcId: NpcId | null;
  leaderName: string;
  roleLabel: string;
  options: ParticipantSceneOption[];
}

export interface ParticipantDecisionRecord {
  id: string;
  sceneId: string;
  nodeId: string;
  optionId: string;
  optionTitle: string;
  tone: ParticipantActionTone;
  success: boolean;
  detail: string;
  elapsedMinutes: number;
}

export interface ParticipantEvaluation {
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  score: number;
  rankPoints: number;
  summary: string;
  tags: string[];
}

export interface ExpeditionSimulationStage {
  id: string;
  terrainModuleId: TerrainModuleId;
  sourceSegmentId: string | null;
  linkedAscentStageId: string | null;
  phase: ExpeditionPhaseNode;
  label: string;
  terrain: string;
  hazard: string;
  skill: SkillId;
  difficulty: number;
  exposure: number;
  relativeStart: number;
  relativeEnd: number;
  progress: number;
  requiredProgress: number;
  preparation: number;
  routeKnowledge: number;
  surfaceKnowledge: number;
  anchorsPlaced: number;
  ropeFixed: boolean;
  campPossible: boolean;
  critical: boolean;
  preparationOptions: ExpeditionPreparationTag[][];
  preparationTags: ExpeditionPreparationTag[];
  recommendedActions: ExpeditionFieldActionId[];
  repetitionKey: string;
  incidentHistory: string[];
  completed: boolean;
}

export interface ExpeditionLeaderOrder {
  id: string;
  text: string;
  preferredAction: ExpeditionFieldActionId;
  issuedAtAction: number;
  strictness: number;
  resolved: boolean;
  obeyed: boolean | null;
}

export interface ExpeditionActionRecord {
  id: string;
  actionId: ExpeditionFieldActionId;
  stageId: string;
  success: boolean;
  detail: string;
  elapsedMinutes: number;
  relativeElevation: number;
  energyAfter: number;
  conditionAfter: number;
  stageProgressAfter: number;
  suppliesAfter: ClimbSupplies;
}

export interface ExpeditionFailureTrace {
  id: string;
  actionNumber: number;
  stageId: string;
  cause: string;
  energy: number;
  condition: number;
  food: number;
  water: number;
  temperatureC: number;
  windKmh: number;
}

export interface ExpeditionSimulationState {
  version: 4;
  direction: ExpeditionDirection;
  status: ExpeditionSimulationStatus;
  ascentStages: ExpeditionSimulationStage[];
  descentStages: ExpeditionSimulationStage[];
  stageIndex: number;
  relativeElevation: number;
  maxRelativeElevation: number;
  highestRelativeElevation: number;
  totalActions: number;
  totalMovementActions: number;
  eventSerial: number;
  actionsUntilEvent: number;
  activeEvent: ParticipantScene | null;
  leaderOrder: ExpeditionLeaderOrder | null;
  survivalTurns: number;
  forcedRetreat: boolean;
  returnReason: string | null;
  loadDroppedKg: number;
  rescueEtaMinutes: number | null;
  actionLog: ExpeditionActionRecord[];
  failureTrace: ExpeditionFailureTrace[];
  lastCheckpointAction: number;
}

export interface ExpeditionActionPreview {
  id: ExpeditionFieldActionId;
  title: string;
  detail: string;
  durationMinutes: number;
  energyDelta: number;
  progressDelta: number;
  successChance: number | null;
  riskLabel: 'НИЗКИЙ' | 'СРЕДНИЙ' | 'ВЫСОКИЙ' | 'КРИТИЧЕСКИЙ';
  disabled: boolean;
  disabledReason: string | null;
  skill: SkillId | null;
}


export interface TerrainModuleDefinition {
  id: TerrainModuleId;
  label: string;
  terrainKeywords: string[];
  primarySkill: SkillId;
  baseDifficulty: number;
  baseExposure: number;
  progressMultiplier: number;
  preparationOptions: ExpeditionPreparationTag[][];
  recommendedActions: ExpeditionFieldActionId[];
  campCompatible: boolean;
  descentDifficultyModifier: number;
  description: string;
}

export interface RouteContentReport {
  routeId: RouteId;
  scale: ExpeditionScale;
  ascentStages: number;
  descentStages: number;
  estimatedActions: number;
  expectedPlayMinutes: number;
  moduleCounts: Record<string, number>;
  warnings: string[];
  errors: string[];
}

export interface ContentValidationReport {
  valid: boolean;
  routeReports: RouteContentReport[];
  warnings: string[];
  errors: string[];
}

export interface ParticipantExpeditionState {
  graphNodeIndex: number;
  nodeActionIndex: number;
  totalActions: number;
  targetActions: number;
  leaderTrust: number;
  groupTrust: number;
  discipline: number;
  initiative: number;
  care: number;
  competence: number;
  ordersReceived: number;
  ordersObeyed: number;
  ordersRefused: number;
  rankPointsEarned: number;
  decisions: ParticipantDecisionRecord[];
  routeComplete: boolean;
  evaluation: ParticipantEvaluation | null;
}

export interface QualificationClimb {
  id: string;
  expeditionOfferId: ExpeditionOfferId | null;
  leaderNpcId: NpcId | null;
  playerRole: TeamRole;
  authorityMode: ExpeditionAuthority;
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
  ascentRoute: RouteSegment[];
  descentRoute: RouteSegment[];
  segmentChoices: Record<string, string>;
  routeChoices: RouteChoiceRecord[];
  fixedRopeSegmentIds: string[];
  ropeMetersRemaining: number;
  caches: ClimbCache[];
  log: string[];
  injuries: string[];
  casualties: string[];
  rescuedMemberIds: string[];
  earnedReputation: number;
  earnedMoney: number;
  participant: ParticipantExpeditionState | null;
  simulation: ExpeditionSimulationState | null;
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
  routeChoices?: RouteChoiceRecord[];
  fixedRopes?: number;
  cachesRecovered?: number;
  playtest?: PlaytestReportData;
  participantEvaluation?: ParticipantEvaluation;
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

export interface OnboardingState {
  dismissed: boolean;
  completed: boolean;
}

export interface PlaytestReportData {
  seed: string;
  difficulty: DifficultyId;
  mountainId: string;
  routeId: string;
  actionCount: number;
  moveCount: number;
  finalEnergy: number;
  finalTeamCondition: number;
  finalFood: number;
  finalWater: number;
  finalFuel: number;
  packWeightKg: number;
  teamSize: number;
  acclimatizationDays: number;
  weatherWindowId: string;
  causeTags: string[];
}

export type CareerTier = 'NOVICE' | 'CLUB' | 'REGIONAL' | 'ELITE' | 'LEGEND';
export type SeasonPhase = 'PREPARATION' | 'CLIMBING' | 'LATE';
export type CareerMilestoneId = 'FIRST_SUMMIT' | 'FIVE_THOUSAND' | 'FIRST_ASCENT' | 'THREE_SUMMITS' | 'SEVEN_THOUSAND' | 'LEGACY';

export interface CareerMilestone {
  id: CareerMilestoneId;
  title: string;
  description: string;
  completed: boolean;
  completedYear: number | null;
  rewardMoney: number;
  rewardReputation: number;
}

export interface SeasonSummary {
  year: number;
  expeditions: number;
  summits: number;
  retreats: number;
  highestElevation: number;
  injuries: number;
  losses: number;
  moneyDelta: number;
  reputationDelta: number;
  worldRank: number;
  milestoneIds: CareerMilestoneId[];
}

export interface SponsorDeal {
  id: string;
  name: string;
  stipend: number;
  summitBonus: number;
  tier: CareerTier;
}

export interface CareerProgression {
  tier: CareerTier;
  seasonNumber: number;
  seasonStartMoney: number;
  seasonStartReputation: number;
  seasonStartCompletedClimbs: number;
  seasonStartReportCount: number;
  seasonHistory: SeasonSummary[];
  milestones: CareerMilestone[];
  sponsor: SponsorDeal | null;
}

export interface CareerPermissions {
  canChooseRoute: boolean;
  canChooseTeam: boolean;
  canIssueOrders: boolean;
  canOrganize: boolean;
  canStartSolo: boolean;
}

export interface CareerMembership {
  mode: CareerEntryMode;
  organizationId: OrganizationId | null;
  rank: ExpeditionRank;
  authority: ExpeditionAuthority;
  rankPoints: number;
  permissions: CareerPermissions;
}

export interface CareerState {
  schemaVersion: 15;
  id: string;
  worldId: string;
  rootSeed: string;
  difficulty: DifficultyId;
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
  onboarding: OnboardingState;
  livingWorld: LivingWorldState;
  progression: CareerProgression;
  membership: CareerMembership;
  selectedOfferId: ExpeditionOfferId | null;
  applications: ExpeditionApplication[];
  knownNpcIds: NpcId[];
}

export interface CareerDraft {
  name: string;
  age: number;
  originId: OriginId;
  entryMode?: CareerEntryMode;
  organizationId?: OrganizationId | null;
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
