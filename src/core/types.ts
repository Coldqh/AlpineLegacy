export type EraId = 'PIONEER' | 'EXPEDITION' | 'MODERN';
export type DifficultyId = 'EXPLORER' | 'CLIMBER' | 'EXPEDITION';
export type ScreenId = 'MENU' | 'SETUP' | 'GENERATING' | 'REGION' | 'MOUNTAIN' | 'ARCHIVE' | 'SETTINGS';

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
