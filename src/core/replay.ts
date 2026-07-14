import type { CareerState, ExpeditionActionRecord, ExpeditionFailureTrace } from './types';

export interface ExpeditionReplayFile {
  format: 'alpine-legacy-expedition-replay';
  version: 2;
  createdAt: string;
  seed: string;
  careerId: string;
  expeditionId: string | null;
  mountain: string | null;
  route: string | null;
  direction: string | null;
  status: string | null;
  startElevation: number | null;
  highestRelativeElevation: number | null;
  finalRelativeElevation: number | null;
  actions: ExpeditionActionRecord[];
  failureTrace: ExpeditionFailureTrace[];
  journal: string[];
}

export function createExpeditionReplay(career: CareerState): ExpeditionReplayFile {
  const climb = career.activeClimb;
  const simulation = climb?.simulation;
  return {
    format: 'alpine-legacy-expedition-replay',
    version: 2,
    createdAt: new Date().toISOString(),
    seed: career.rootSeed,
    careerId: career.id,
    expeditionId: climb?.id ?? null,
    mountain: climb?.mountainName ?? null,
    route: climb?.routeName ?? null,
    direction: simulation?.direction ?? null,
    status: simulation?.status ?? null,
    startElevation: climb?.startElevation ?? null,
    highestRelativeElevation: simulation?.highestRelativeElevation ?? null,
    finalRelativeElevation: simulation?.relativeElevation ?? null,
    actions: simulation?.actionLog ?? [],
    failureTrace: simulation?.failureTrace ?? [],
    journal: climb?.log ?? [],
  };
}

export function auditExpeditionReplay(replay: ExpeditionReplayFile) {
  const errors: string[] = [];
  const warnings: string[] = [];
  let previousElapsed = -1;
  let previousAction = 0;
  for (const action of replay.actions) {
    const serial = Number(action.id.split(':').at(-1));
    if (Number.isFinite(serial) && serial < previousAction) errors.push(`Нарушен порядок действий возле ${action.id}.`);
    if (action.elapsedMinutes < previousElapsed) errors.push(`Время откатилось назад возле ${action.id}.`);
    if (action.energyAfter < 0 || action.energyAfter > 100) errors.push(`Некорректная энергия после ${action.id}.`);
    if (action.conditionAfter < 0 || action.conditionAfter > 100) errors.push(`Некорректное состояние после ${action.id}.`);
    previousAction = Number.isFinite(serial) ? serial : previousAction;
    previousElapsed = action.elapsedMinutes;
  }
  if (!replay.actions.length) warnings.push('В replay пока нет полевых действий.');
  if (replay.failureTrace.length && !replay.failureTrace.every(item => item.actionNumber >= 0)) errors.push('Повреждена цепочка причин поражения.');
  return { valid: errors.length === 0, errors, warnings, actionCount: replay.actions.length, failureCount: replay.failureTrace.length };
}
