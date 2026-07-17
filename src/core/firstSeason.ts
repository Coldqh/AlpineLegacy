import type {
  CareerState,
  ExpeditionPurpose,
  ExpeditionReport,
  ExpeditionRoute,
  FirstSeasonStage,
  FirstSeasonState,
  QualificationClimb,
} from './types';

export const EXPEDITION_PURPOSE_LABELS: Record<ExpeditionPurpose, string> = {
  TRAINING: 'Учебный выход',
  ACCLIMATIZATION: 'Акклиматизация',
  RECON: 'Разведка линии',
  CARRY: 'Заброска груза',
  RESCUE: 'Спасательный выход',
  SUMMIT: 'Попытка вершины',
  FINALE: 'Главная экспедиция сезона',
};

export const FIRST_SEASON_STAGE_LABELS: Record<FirstSeasonStage, string> = {
  FIRST_OUTING: 'Первый выход',
  RECOVERY: 'Восстановление',
  SKILL_TEST: 'Проверка навыков',
  FINALE: 'Финал сезона',
  COMPLETE: 'Сезон завершён',
};

export interface FirstSeasonObjectiveView {
  stage: FirstSeasonStage;
  step: number;
  total: number;
  title: string;
  detail: string;
  action: string;
  complete: boolean;
}

function routeDifficulty(route: ExpeditionRoute) {
  return route.objectiveRisk * .45 + route.technicality * .4 + Math.max(0, route.summitElevation - route.startElevation) / 180;
}

function chooseMentor(career: Pick<CareerState, 'teamRoster'>) {
  return career.teamRoster.find(member => member.isMentor)?.id ?? career.teamRoster.find(member => member.role === 'LEADER')?.id ?? null;
}

function chooseRival(career: Pick<CareerState, 'teamRoster' | 'storyState'>) {
  const knownRival = career.storyState?.rivalNpcIds?.find(id => career.teamRoster.some(member => member.id === id));
  if (knownRival) return knownRival;
  return [...career.teamRoster]
    .filter(member => !member.isMentor && member.status === 'ACTIVE')
    .sort((a, b) => (b.skill + b.endurance) - (a.skill + a.endurance))[0]?.id ?? null;
}

function chooseFinaleRoute(career: Pick<CareerState, 'routes' | 'currentRegionId'>) {
  const regional = career.routes
    .filter(route => route.regionId === career.currentRegionId)
    .sort((a, b) => routeDifficulty(a) - routeDifficulty(b));
  if (!regional.length) return career.routes[0]?.id ?? null;
  return regional[Math.min(regional.length - 1, Math.max(0, Math.floor(regional.length * .72)))]?.id ?? regional.at(-1)?.id ?? null;
}

function derivedStage(career: Pick<CareerState, 'reports' | 'year' | 'recoveryDays'>): FirstSeasonStage {
  const reports = career.reports.filter(report => report.year === career.year);
  if (reports.length >= 3) return 'COMPLETE';
  if (reports.length === 2) return 'FINALE';
  if (reports.length === 1) return career.recoveryDays > 0 ? 'RECOVERY' : 'SKILL_TEST';
  return 'FIRST_OUTING';
}

export function createFirstSeasonState(career: Pick<CareerState, 'year' | 'seasonDay' | 'reports' | 'recoveryDays' | 'routes' | 'currentRegionId' | 'teamRoster' | 'storyState' | 'progression'>): FirstSeasonState {
  const stage = career.progression?.seasonNumber > 1 ? 'COMPLETE' : derivedStage(career);
  return {
    version: 1,
    year: career.year,
    stage,
    stageStartedDay: career.seasonDay,
    mentorNpcId: chooseMentor(career),
    rivalNpcId: chooseRival(career),
    mentorScore: stage === 'COMPLETE' ? 72 : 0,
    rivalScore: stage === 'COMPLETE' ? 66 : 0,
    finaleRouteId: chooseFinaleRoute(career),
    completedObjectiveIds: stage === 'COMPLETE' ? ['FIRST_OUTING', 'RECOVERY', 'SKILL_TEST', 'FINALE'] : [],
    debriefs: [],
    graduated: stage === 'COMPLETE',
  };
}

export function normalizeFirstSeasonState(career: CareerState): FirstSeasonState {
  const saved = career.firstSeason;
  if (!saved || saved.version !== 1) return createFirstSeasonState(career);
  if (saved.year !== career.year) {
    if (saved.graduated || career.progression.seasonNumber > 1) return { ...saved, year: career.year, stage: 'COMPLETE', graduated: true };
    return createFirstSeasonState(career);
  }
  const stage = saved.graduated ? 'COMPLETE' : saved.stage ?? derivedStage(career);
  return {
    version: 1,
    year: career.year,
    stage,
    stageStartedDay: Math.max(1, saved.stageStartedDay ?? career.seasonDay),
    mentorNpcId: saved.mentorNpcId && career.teamRoster.some(member => member.id === saved.mentorNpcId) ? saved.mentorNpcId : chooseMentor(career),
    rivalNpcId: saved.rivalNpcId && career.teamRoster.some(member => member.id === saved.rivalNpcId) ? saved.rivalNpcId : chooseRival(career),
    mentorScore: Math.max(0, Math.min(100, saved.mentorScore ?? 0)),
    rivalScore: Math.max(0, Math.min(100, saved.rivalScore ?? 0)),
    finaleRouteId: saved.finaleRouteId && career.routes.some(route => route.id === saved.finaleRouteId) ? saved.finaleRouteId : chooseFinaleRoute(career),
    completedObjectiveIds: [...new Set(saved.completedObjectiveIds ?? [])],
    debriefs: (saved.debriefs ?? []).slice(-8),
    graduated: Boolean(saved.graduated || stage === 'COMPLETE'),
  };
}

export function firstSeasonObjective(career: CareerState): FirstSeasonObjectiveView {
  const state = normalizeFirstSeasonState(career);
  if (state.stage === 'FIRST_OUTING') return { stage: state.stage, step: 1, total: 4, title: 'Пройди первый учебный выход', detail: 'Получи место у инструктора и вернись вместе с группой. Вершина желательна, безопасный отход тоже считается опытом.', action: 'Выбрать план школы', complete: false };
  if (state.stage === 'RECOVERY') return { stage: state.stage, step: 2, total: 4, title: 'Восстановись после выхода', detail: `До тяжёлой работы осталось ${career.recoveryDays} дн. Восстановление двигает сезон и сохраняет форму.`, action: 'Восстановиться', complete: false };
  if (state.stage === 'SKILL_TEST') return { stage: state.stage, step: 3, total: 4, title: 'Докажи пользу в связке', detail: 'Выбери второй выход: разведку, акклиматизацию или заброску. Наставник оценивает надёжность, а соперник идёт своим маршрутом.', action: 'Найти второй выход', complete: false };
  if (state.stage === 'FINALE') return { stage: state.stage, step: 4, total: 4, title: 'Главная экспедиция сезона', detail: 'Инструктор собрал сильную группу под сложную цель. Итог определит твой ранг и место в школе.', action: 'Открыть финальный план', complete: false };
  return { stage: state.stage, step: 4, total: 4, title: 'Первый сезон завершён', detail: 'Ты прошёл учебный цикл, заработал оценку наставника и получил право выбирать более серьёзные линии.', action: 'Продолжить карьеру', complete: true };
}

export function firstSeasonPurposeForOffer(career: CareerState, mentorIndex: number, planSeries: number): ExpeditionPurpose {
  const state = normalizeFirstSeasonState(career);
  if (state.stage === 'FIRST_OUTING') return 'TRAINING';
  if (state.stage === 'FINALE') return 'FINALE';
  if (state.stage === 'SKILL_TEST') {
    const purposes: ExpeditionPurpose[] = ['RECON', 'ACCLIMATIZATION', 'CARRY'];
    return purposes[(mentorIndex + planSeries) % purposes.length]!;
  }
  return mentorIndex === 0 ? 'TRAINING' : 'SUMMIT';
}

export function firstSeasonRankBonus(purpose: ExpeditionPurpose | undefined) {
  if (purpose === 'TRAINING') return 4;
  if (purpose === 'RECON' || purpose === 'ACCLIMATIZATION' || purpose === 'CARRY') return 6;
  if (purpose === 'RESCUE') return 9;
  if (purpose === 'FINALE') return 14;
  return purpose === 'SUMMIT' ? 7 : 0;
}

export function refreshFirstSeasonAfterTime(career: CareerState): CareerState {
  const state = normalizeFirstSeasonState(career);
  if (state.stage !== 'RECOVERY' || career.recoveryDays > 0) return state === career.firstSeason ? career : { ...career, firstSeason: state };
  return {
    ...career,
    firstSeason: {
      ...state,
      stage: 'SKILL_TEST',
      stageStartedDay: career.seasonDay,
      completedObjectiveIds: [...new Set([...state.completedObjectiveIds, 'RECOVERY'])],
    },
  };
}

function mentorEvaluation(report: ExpeditionReport, climb: QualificationClimb) {
  const safe = report.casualties.length === 0;
  const clean = report.injuries.length === 0;
  const outcome = report.outcome === 'SUMMIT' ? 16 : report.outcome === 'RETREAT' ? 8 : 2;
  const participant = report.participantEvaluation?.score ? Math.round((report.participantEvaluation.score - 50) / 8) : 0;
  const delta = Math.max(-20, Math.min(24, outcome + (safe ? 5 : -18) + (clean ? 3 : -report.injuries.length * 2) + participant));
  const summary = report.outcome === 'SUMMIT'
    ? safe ? 'Наставник отметил выдержанный темп и возвращение всей группы.' : 'Вершина достигнута, но цена решения вызвала тяжёлый разбор.'
    : report.outcome === 'RETREAT'
      ? safe ? 'Отход признан взрослым решением: группа вернулась без потерь.' : 'Отход был необходим, но ошибки до разворота уже ударили по группе.'
      : 'Выход закрыт аварийно. Наставник требует повторить базовую подготовку.';
  return { delta, summary, title: `${EXPEDITION_PURPOSE_LABELS[climb.purpose ?? 'SUMMIT']}: разбор` };
}

export function advanceFirstSeasonAfterExpedition(career: CareerState, climb: QualificationClimb, report: ExpeditionReport): CareerState {
  const state = normalizeFirstSeasonState(career);
  if (state.graduated || state.year !== career.year) return { ...career, firstSeason: state };
  const evaluation = mentorEvaluation(report, climb);
  const route = career.routes.find(item => item.id === climb.routeId);
  const rivalDelta = Math.max(5, Math.min(18, 7 + Math.round((route ? routeDifficulty(route) : 50) / 18) + (report.outcome === 'SUMMIT' ? 3 : 0)));
  let nextStage: FirstSeasonStage = state.stage;
  let objectiveId = state.stage;
  if (state.stage === 'FIRST_OUTING') nextStage = career.recoveryDays > 0 ? 'RECOVERY' : 'SKILL_TEST';
  else if (state.stage === 'SKILL_TEST') nextStage = 'FINALE';
  else if (state.stage === 'FINALE') nextStage = 'COMPLETE';
  const graduated = nextStage === 'COMPLETE';
  const purpose = climb.purpose ?? report.purpose ?? 'SUMMIT';
  const debrief = {
    id: `first-season-${career.year}-${career.seasonDay}-${career.reports.length}`,
    year: career.year,
    seasonDay: career.seasonDay,
    purpose,
    outcome: report.outcome,
    title: evaluation.title,
    summary: evaluation.summary,
    mentorDelta: evaluation.delta,
    rivalDelta,
  };
  return {
    ...career,
    hero: graduated ? { ...career.hero, morale: Math.min(100, career.hero.morale + 8), reputation: career.hero.reputation + 10 } : career.hero,
    firstSeason: {
      ...state,
      stage: nextStage,
      stageStartedDay: career.seasonDay,
      mentorScore: Math.max(0, Math.min(100, state.mentorScore + evaluation.delta)),
      rivalScore: Math.max(0, Math.min(100, state.rivalScore + rivalDelta)),
      completedObjectiveIds: [...new Set([...state.completedObjectiveIds, objectiveId])],
      debriefs: [...state.debriefs, debrief].slice(-8),
      graduated,
    },
  };
}
