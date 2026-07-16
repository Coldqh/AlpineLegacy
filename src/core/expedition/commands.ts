import type { EntrySide, GridPoint, GridWeather, LocalStageMap } from '../../topography/mountainGridEngine';
import type { IntegratedPace, IntegratedRestMode } from './state';

export interface IntegratedExpeditionContext {
  stageId: string;
  stageTitle: string;
  stageCount: number;
  localMap: LocalStageMap;
  weather: GridWeather;
}

export type IntegratedExpeditionCommand =
  | { type: 'SET_ENTRY'; side: EntrySide; routeChoice: string }
  | { type: 'SET_ROUTE'; routeChoice: string }
  | { type: 'SET_PACE'; pace: IntegratedPace }
  | { type: 'SET_TUTORIAL_STEP'; step: number }
  | { type: 'REGENERATE' }
  | { type: 'ENSURE_STAGE_PATH'; stageId: string; path: GridPoint[]; currentElevation: number; replace?: boolean }
  | { type: 'APPLY_MOUNTAIN_MEMORY'; stageId: string; revealed: string[]; camps: string[] }
  | { type: 'SET_STAGE_PATH'; stageId: string; path: GridPoint[] }
  | { type: 'START' }
  | { type: 'STEP' }
  | { type: 'SCOUT'; point: GridPoint; radius: number; minutes: number }
  | { type: 'TOGGLE_ROPE'; point: GridPoint }
  | { type: 'MAKE_CAMP'; point: GridPoint }
  | { type: 'REST'; mode: IntegratedRestMode }
  | { type: 'REORDER'; index: number; delta: number }
  | { type: 'BEGIN_RETREAT' }
  | { type: 'REQUEST_RESCUE' };
