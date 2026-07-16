import type {
  CareerMilestone,
  CareerMilestoneId,
  CareerProgression,
  CareerState,
  CareerTier,
  SeasonPhase,
  SeasonSummary,
  SponsorDeal,
} from './types';

const MILESTONES: Array<Omit<CareerMilestone, 'completed' | 'completedYear'>> = [
  { id: 'FIRST_SUMMIT', title: 'Первая вершина', description: 'Вернуться с первого засчитанного восхождения.', rewardMoney: 100, rewardReputation: 8 },
  { id: 'FIVE_THOUSAND', title: 'Выше 5000', description: 'Подтвердить высоту не ниже 5000 м.', rewardMoney: 150, rewardReputation: 12 },
  { id: 'FIRST_ASCENT', title: 'Первопроходец', description: 'Совершить первое подтверждённое восхождение.', rewardMoney: 250, rewardReputation: 20 },
  { id: 'THREE_SUMMITS', title: 'Серия', description: 'Завершить три восхождения.', rewardMoney: 200, rewardReputation: 16 },
  { id: 'SEVEN_THOUSAND', title: 'Большая высота', description: 'Вернуться с вершины выше 7000 м.', rewardMoney: 300, rewardReputation: 25 },
  { id: 'LEGACY', title: 'Наследие', description: 'Восемь вершин и два первых восхождения.', rewardMoney: 500, rewardReputation: 40 },
];

const TIER_ORDER: CareerTier[] = ['NOVICE', 'CLUB', 'REGIONAL', 'ELITE', 'LEGEND'];

export const CAREER_TIER_LABELS: Record<CareerTier, string> = {
  NOVICE: 'Новичок',
  CLUB: 'Клубный',
  REGIONAL: 'Региональный',
  ELITE: 'Элита',
  LEGEND: 'Легенда',
};

export const SEASON_PHASE_LABELS: Record<SeasonPhase, string> = {
  PREPARATION: 'Подготовка',
  CLIMBING: 'Основной сезон',
  LATE: 'Конец сезона',
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function careerTierFor(reputation: number): CareerTier {
  if (reputation >= 180) return 'LEGEND';
  if (reputation >= 100) return 'ELITE';
  if (reputation >= 50) return 'REGIONAL';
  if (reputation >= 20) return 'CLUB';
  return 'NOVICE';
}

export function careerSeasonPhase(seasonDay: number): SeasonPhase {
  if (seasonDay <= 35) return 'PREPARATION';
  if (seasonDay <= 135) return 'CLIMBING';
  return 'LATE';
}

export function expeditionLimitForTier(tier: CareerTier) {
  return { NOVICE: 2, CLUB: 3, REGIONAL: 4, ELITE: 5, LEGEND: 6 }[tier];
}

function sponsorForTier(tier: CareerTier): SponsorDeal | null {
  if (tier === 'NOVICE') return null;
  if (tier === 'CLUB') return { id: 'club-fund', name: 'Фонд клуба', stipend: 60, summitBonus: 25, tier };
  if (tier === 'REGIONAL') return { id: 'regional-union', name: 'Высотный союз', stipend: 120, summitBonus: 60, tier };
  if (tier === 'ELITE') return { id: 'nordgrat', name: 'Nordgrat Equipment', stipend: 220, summitBonus: 110, tier };
  return { id: 'heritage-foundation', name: 'Alpine Heritage Foundation', stipend: 350, summitBonus: 180, tier };
}

function defaultMilestones(): CareerMilestone[] {
  return MILESTONES.map(item => ({ ...item, completed: false, completedYear: null }));
}

export function createCareerProgression(career: Pick<CareerState, 'hero' | 'completedClimbs' | 'reports'>): CareerProgression {
  const tier = careerTierFor(career.hero.reputation);
  return {
    tier,
    seasonNumber: 1,
    seasonStartMoney: career.hero.money,
    seasonStartReputation: career.hero.reputation,
    seasonStartCompletedClimbs: career.completedClimbs,
    seasonStartReportCount: career.reports.length,
    seasonHistory: [],
    milestones: defaultMilestones(),
    sponsor: sponsorForTier(tier),
  };
}

export function normalizeCareerProgression(career: CareerState): CareerProgression {
  const fallback = createCareerProgression(career);
  const saved = career.progression;
  if (!saved) return fallback;
  const savedById = new Map(saved.milestones?.map(item => [item.id, item]));
  return {
    ...fallback,
    ...saved,
    tier: careerTierFor(career.hero.reputation),
    seasonHistory: saved.seasonHistory ?? [],
    milestones: defaultMilestones().map(item => ({ ...item, ...(savedById.get(item.id) ?? {}) })),
    sponsor: saved.sponsor ?? sponsorForTier(careerTierFor(career.hero.reputation)),
  };
}

export function currentSeasonReports(career: CareerState) {
  return career.reports.filter(report => report.year === career.year);
}

export function currentSeasonExpeditionCount(career: CareerState) {
  return currentSeasonReports(career).length + (career.activeClimb && career.activeClimb.phase !== 'COMPLETE' && career.activeClimb.phase !== 'FAILED' && career.activeClimb.phase !== 'RETREATED' ? 1 : 0);
}

export function careerWorldRank(career: CareerState) {
  const score = career.hero.reputation + career.completedClimbs * 4;
  return 1 + career.livingWorld.athletes.filter(item => item.status === 'ACTIVE' && item.fame + item.summits * 3 > score).length;
}

export function nextCareerMilestone(career: CareerState) {
  const progression = normalizeCareerProgression(career);
  return progression.milestones.find(item => !item.completed) ?? null;
}

function firstAscents(career: CareerState) {
  return career.livingWorld.records.filter(record => record.category === 'FIRST_ASCENTS' && record.holderAthleteId === career.hero.id).length;
}

function milestoneReached(career: CareerState, id: CareerMilestoneId) {
  if (id === 'FIRST_SUMMIT') return career.completedClimbs >= 1;
  if (id === 'FIVE_THOUSAND') return career.highestElevation >= 5000;
  if (id === 'FIRST_ASCENT') return firstAscents(career) >= 1;
  if (id === 'THREE_SUMMITS') return career.completedClimbs >= 3;
  if (id === 'SEVEN_THOUSAND') return career.highestElevation >= 7000;
  return career.completedClimbs >= 8 && firstAscents(career) >= 2;
}

function milestoneLog(career: CareerState, milestone: CareerMilestone) {
  return {
    id: `log-milestone-${milestone.id}-${career.year}-${career.seasonDay}`,
    year: career.year,
    seasonDay: career.seasonDay,
    type: 'CAREER' as const,
    title: milestone.title,
    description: `${milestone.description} Награда: ${milestone.rewardMoney} кр., репутация +${milestone.rewardReputation}.`,
  };
}

export function syncCareerProgression(career: CareerState): CareerState {
  const progression = normalizeCareerProgression(career);
  const completedNow: CareerMilestone[] = [];
  const milestones = progression.milestones.map(milestone => {
    if (milestone.completed || !milestoneReached(career, milestone.id)) return milestone;
    const completed = { ...milestone, completed: true, completedYear: career.year };
    completedNow.push(completed);
    return completed;
  });

  const rewardMoney = completedNow.reduce((sum, item) => sum + item.rewardMoney, 0);
  const rewardReputation = completedNow.reduce((sum, item) => sum + item.rewardReputation, 0);
  const hero = rewardMoney || rewardReputation
    ? { ...career.hero, money: career.hero.money + rewardMoney, reputation: career.hero.reputation + rewardReputation }
    : career.hero;
  const tier = careerTierFor(hero.reputation);
  const previousTierIndex = TIER_ORDER.indexOf(progression.tier);
  const tierIndex = TIER_ORDER.indexOf(tier);
  const tierChanged = tierIndex > previousTierIndex;
  const sponsor = sponsorForTier(tier);
  const logs = [...career.log, ...completedNow.map(item => milestoneLog(career, item))];
  if (tierChanged) {
    logs.push({
      id: `log-tier-${tier}-${career.year}-${career.seasonDay}`,
      year: career.year,
      seasonDay: career.seasonDay,
      type: 'CAREER',
      title: `Новый уровень: ${CAREER_TIER_LABELS[tier]}`,
      description: sponsor ? `Карьера вышла на новый уровень. Поддержка: ${sponsor.name}.` : 'Карьера вышла на новый уровень.',
    });
  }

  return {
    ...career,
    hero,
    log: logs,
    progression: { ...progression, tier, milestones, sponsor },
  };
}

function summaryForSeason(career: CareerState, year: number, progression: CareerProgression): SeasonSummary {
  const reports = career.reports.filter(report => report.year === year);
  const summaries = reports.filter(report => report.outcome === 'SUMMIT');
  const completedThisYear = progression.milestones.filter(item => item.completed && item.completedYear === year).map(item => item.id);
  return {
    year,
    expeditions: reports.length,
    summits: summaries.length,
    retreats: reports.filter(report => report.outcome === 'RETREAT').length,
    highestElevation: reports.reduce((max, report) => Math.max(max, report.highestElevation), 0),
    injuries: reports.reduce((sum, report) => sum + report.injuries.length, 0),
    losses: reports.reduce((sum, report) => sum + report.casualties.length, 0),
    moneyDelta: career.hero.money - progression.seasonStartMoney,
    reputationDelta: career.hero.reputation - progression.seasonStartReputation,
    worldRank: careerWorldRank(career),
    milestoneIds: completedThisYear,
  };
}

export function rollCareerSeason(source: CareerState, next: CareerState): CareerState {
  if (next.year <= source.year) return syncCareerProgression(next);
  const sourceProgression = normalizeCareerProgression(source);
  const syncedSource = syncCareerProgression({ ...source, progression: sourceProgression });
  const syncedProgression = normalizeCareerProgression(syncedSource);
  const summary = summaryForSeason(syncedSource, source.year, syncedProgression);
  const carriedMoney = syncedSource.hero.money - source.hero.money;
  const carriedReputation = syncedSource.hero.reputation - source.hero.reputation;
  const provisionalReputation = next.hero.reputation + carriedReputation;
  const newTier = careerTierFor(provisionalReputation);
  const sponsor = sponsorForTier(newTier);
  const stipend = sponsor?.stipend ?? 0;
  const agePenalty = next.hero.age >= 35 ? 3 : next.hero.age >= 30 ? 2 : next.hero.age >= 27 ? 1 : 0;
  const nextHero = {
    ...next.hero,
    money: next.hero.money + carriedMoney + stipend,
    reputation: provisionalReputation,
    form: clamp(next.hero.form - agePenalty, 0, 100),
    health: clamp(next.hero.health - Math.max(0, agePenalty - 1), 0, 100),
    fatigue: clamp(next.hero.fatigue - 18, 0, 100),
    morale: clamp(next.hero.morale + 4, 0, 100),
  };
  const progression: CareerProgression = {
    ...syncedProgression,
    tier: newTier,
    seasonNumber: syncedProgression.seasonNumber + (next.year - source.year),
    seasonStartMoney: nextHero.money,
    seasonStartReputation: nextHero.reputation,
    seasonStartCompletedClimbs: next.completedClimbs,
    seasonStartReportCount: next.reports.length,
    seasonHistory: [...syncedProgression.seasonHistory, summary],
    sponsor,
  };
  const seasonLog = {
    id: `log-season-${source.year}`,
    year: next.year,
    seasonDay: next.seasonDay,
    type: 'CAREER' as const,
    title: `Сезон ${source.year} завершён`,
    description: `${summary.expeditions} экспедиций, ${summary.summits} вершин, место в мире: ${summary.worldRank}.${stipend ? ` Поддержка ${sponsor!.name}: +${stipend} кр.` : ''}`,
  };
  return syncCareerProgression({ ...next, hero: nextHero, log: [...next.log, seasonLog], progression });
}

export function hydrateCareerProgression(career: CareerState): CareerState {
  return syncCareerProgression({ ...career, schemaVersion: 17, progression: normalizeCareerProgression(career) });
}
