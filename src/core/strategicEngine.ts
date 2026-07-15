import { detectTerrainModule, terrainModuleById } from '../content/terrainModules';
import { defaultDescentSegments } from './routeFactory';
import { createRng } from './rng';
import type {
  CareerState,
  ClimbStepResult,
  ExpeditionRoute,
  QualificationClimb,
  RouteSegment,
  StrategicExpeditionState,
  StrategicFocusId,
  StrategicFormationId,
  StrategicLineId,
  StrategicLineOption,
  StrategicOutcome,
  StrategicPaceId,
  StrategicPlanPreview,
  StrategicPositionId,
  StrategicProtectionId,
  StrategicRestId,
  StrategicSector,
  StrategicSectorPlan,
  StrategicSectorResult,
  StrategicStatus,
  TeamRole,
  TerrainModuleId,
} from './types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clock = (minutes: number) => `${String(Math.floor((310 + minutes) / 60) % 24).padStart(2, '0')}:${String((310 + minutes) % 60).padStart(2, '0')}`;

const paceFactor: Record<StrategicPaceId, { time: number; energy: number; risk: number }> = {
  CONSERVE: { time: 1.18, energy: .78, risk: -.08 },
  WORK: { time: 1, energy: 1, risk: 0 },
  PUSH: { time: .82, energy: 1.28, risk: .12 },
};

const protectionFactor: Record<StrategicProtectionId, { time: number; energy: number; risk: number; rope: number }> = {
  LIGHT: { time: .92, energy: .96, risk: .14, rope: 0 },
  STANDARD: { time: 1.06, energy: 1, risk: -.04, rope: 2 },
  FULL: { time: 1.28, energy: 1.12, risk: -.16, rope: 6 },
};

const formationFactor: Record<StrategicFormationId, { time: number; energy: number }> = {
  COMPACT: { time: 1.06, energy: 1.02 },
  BALANCED: { time: 1, energy: 1 },
  SPREAD: { time: 1.1, energy: 1.04 },
};

function lineOptions(moduleId: TerrainModuleId): StrategicLineOption[] {
  const common: Record<StrategicLineId, Omit<StrategicLineOption, 'skill'>> = {
    DIRECT: { id: 'DIRECT', title: 'Прямая линия', description: 'Короче и быстрее. Дольше остаётся под открытой опасностью.', timeModifier: .86, energyModifier: 1.08, riskModifier: .12 },
    SHELTERED: { id: 'SHELTERED', title: 'Защищённый обход', description: 'Длиннее. Даёт укрытие от ветра и объективной опасности.', timeModifier: 1.2, energyModifier: .94, riskModifier: -.12 },
    TECHNICAL: { id: 'TECHNICAL', title: 'Техническая линия', description: 'Требует точной работы. При хорошем навыке экономит силы и защищает отход.', timeModifier: 1.06, energyModifier: .9, riskModifier: -.04 },
  };
  if (['GLACIER', 'CREVASSE_FIELD', 'SNOW_SLOPE', 'ICEFALL'].includes(moduleId)) {
    return [
      { ...common.DIRECT, title: moduleId === 'ICEFALL' ? 'Короткий коридор' : 'Центральная линия', skill: moduleId === 'GLACIER' || moduleId === 'CREVASSE_FIELD' ? 'NAVIGATION' : 'ICE' },
      { ...common.SHELTERED, title: 'Внешняя дуга', skill: 'NAVIGATION' },
      { ...common.TECHNICAL, title: moduleId === 'SNOW_SLOPE' ? 'Линия у скал' : 'Проверяемая линия', skill: 'ICE' },
    ];
  }
  if (['ROCK_WALL', 'MIXED_FACE', 'RIDGE'].includes(moduleId)) {
    return [
      { ...common.DIRECT, title: 'Прямой выход', skill: 'ROCK' },
      { ...common.SHELTERED, title: 'Полка и обход', skill: 'NAVIGATION' },
      { ...common.TECHNICAL, title: 'Система рёбер', skill: 'ROCK' },
    ];
  }
  return [
    { ...common.DIRECT, title: 'Короткая линия', skill: 'ENDURANCE' },
    { ...common.SHELTERED, title: 'Плавный обход', skill: 'NAVIGATION' },
    { ...common.TECHNICAL, title: 'Устойчивая линия', skill: moduleId === 'MORAINE' ? 'NAVIGATION' : 'ENDURANCE' },
  ];
}

function terrainFacts(segment: RouteSegment, moduleId: TerrainModuleId, direction: 'ASCENT' | 'DESCENT') {
  const gain = Math.abs(segment.elevationGain);
  const facts = [
    `${direction === 'ASCENT' ? 'Набор' : 'Сброс'} ${gain} м; базовая работа ${Math.max(30, segment.baseDurationMinutes)} мин.`,
    `Сложность ${Math.round(segment.difficulty)}/100; открытость ${Math.round(segment.exposure)}/100.`,
  ];
  if (moduleId === 'ICEFALL') facts.push('Чем дольше группа находится внутри ледопада, тем выше объективная опасность.');
  if (moduleId === 'CREVASSE_FIELD') facts.push('Снежные мосты нельзя оценить только по внешнему виду. Дистанция в связке критична.');
  if (moduleId === 'SNOW_SLOPE') facts.push('Нагрузка всей группы на одну линию повышает риск разрушения слоя.');
  if (moduleId === 'RIDGE') facts.push('Ветер и карнизы делают сторону движения важнее кратчайшего пути.');
  if (moduleId === 'ROCK_WALL' || moduleId === 'MIXED_FACE') facts.push('Недостаточная страховка экономит время сейчас и усложняет обратный путь.');
  if (moduleId === 'ALTITUDE_PLATEAU') facts.push('Рельеф простой, но высота медленно снижает рабочий темп.');
  if (direction === 'DESCENT') facts.push('Знакомый рельеф проходится на накопленной усталости; ошибка хуже контролируется.');
  return facts;
}

function hiddenHazard(moduleId: TerrainModuleId) {
  const hazards: Record<TerrainModuleId, string> = {
    APPROACH_TRAIL: 'У одного участника рано проявилась перегрузка от веса.',
    MORAINE: 'Часть выбранной линии лежит на подвижной осыпи.',
    GLACIER: 'Под свежим снегом проходит закрытая трещина.',
    CREVASSE_FIELD: 'Один из мостов держит только одиночную нагрузку.',
    ICEFALL: 'В верхней части сектора активен нависающий серак.',
    ROCK_WALL: 'Очевидная трещина заканчивается разрушенным блоком.',
    MIXED_FACE: 'На переходе со льда на камень страховка работает хуже.',
    SNOW_SLOPE: 'Под гребнем сформировалась локальная ветровая доска.',
    RIDGE: 'Подветренная кромка является карнизом.',
    ALTITUDE_PLATEAU: 'Слабый участник скрывает первые высотные симптомы.',
    CAMP_ZONE: 'Площадка хуже защищена от ветра, чем казалось снизу.',
    EXIT_TRAIL: 'На простом выходе группа теряет внимание из-за усталости.',
  };
  return hazards[moduleId];
}

function scaleAscentMinutes(route: ExpeditionRoute) {
  const raw = Math.max(1, route.segments.reduce((sum, segment) => sum + Math.max(30, segment.baseDurationMinutes), 0));
  // Route estimatedHours describes the whole operational load. Roughly 62% belongs to ascent movement;
  // the rest is descent and unavoidable transitions. Unlike the old cap, this keeps a 2200 m route
  // materially shorter than a 7000 m expedition instead of giving every mountain the same clock.
  const ascentTarget = route.estimatedHours * 60 * .5;
  const target = clamp(ascentTarget, raw * .72, raw * 3.6);
  return target / raw;
}

function makeSector(route: ExpeditionRoute, segment: RouteSegment, index: number, startElevation: number, direction: 'ASCENT' | 'DESCENT', minuteScale: number): StrategicSector {
  const module = segment.terrainModuleId ? terrainModuleById(segment.terrainModuleId) : detectTerrainModule(segment.terrain);
  const vertical = Math.abs(segment.elevationGain);
  const endElevation = direction === 'ASCENT' ? startElevation + vertical : Math.max(route.startElevation, startElevation - vertical);
  const baseMinutes = Math.max(35, Math.round(segment.baseDurationMinutes * minuteScale));
  const distanceKm = Math.max(.5, Math.round((baseMinutes / 60 * 1.15 + vertical / 900) * 10) / 10);
  return {
    id: `${route.id}:strategic:${direction.toLowerCase()}:${index + 1}`,
    label: direction === 'ASCENT' ? segment.name : segment.name.replace(/^Спуск:\s*/, ''),
    terrainModuleId: module.id,
    terrain: segment.terrain,
    direction,
    startElevation,
    endElevation,
    verticalMeters: vertical,
    distanceKm,
    baseMinutes,
    difficulty: clamp(segment.difficulty + (direction === 'DESCENT' ? 4 : 0)),
    exposure: clamp(segment.exposure + (direction === 'DESCENT' ? 5 : 0)),
    primarySkill: segment.skill,
    hazard: segment.hazard,
    visibleFacts: terrainFacts(segment, module.id, direction),
    hiddenHazard: hiddenHazard(module.id),
    lineOptions: lineOptions(module.id),
    attempts: 0,
    completed: false,
  };
}

function aggregateDescent(route: ExpeditionRoute, source: RouteSegment[]) {
  const desired = source.length <= 4 ? source.length : 3;
  const groups: RouteSegment[][] = Array.from({ length: desired }, () => []);
  source.forEach((segment, index) => groups[Math.min(desired - 1, Math.floor(index * desired / source.length))]!.push(segment));
  return groups.map((items, index) => {
    const dominant = [...items].sort((a, b) => (b.difficulty + b.exposure) - (a.difficulty + a.exposure))[0]!;
    return {
      ...dominant,
      id: `${route.id}:descent-group:${index + 1}`,
      name: index === groups.length - 1 ? 'Выход к старту' : index === 0 ? 'Верхний спуск' : 'Средний спуск',
      terrain: items.map(item => item.terrain).join(' · '),
      elevationGain: items.reduce((sum, item) => sum + Math.abs(item.elevationGain), 0),
      baseDurationMinutes: items.reduce((sum, item) => sum + item.baseDurationMinutes, 0),
      difficulty: Math.round(items.reduce((sum, item) => sum + item.difficulty, 0) / items.length),
      exposure: Math.round(items.reduce((sum, item) => sum + item.exposure, 0) / items.length),
      hazard: items.map(item => item.hazard).filter((value, itemIndex, all) => all.indexOf(value) === itemIndex).slice(0, 2).join('; '),
      campPossible: items.some(item => item.campPossible),
      skill: dominant.skill,
    } satisfies RouteSegment;
  });
}

export function createStrategicExpedition(route: ExpeditionRoute): StrategicExpeditionState {
  const ascentScale = scaleAscentMinutes(route);
  let elevation = route.startElevation;
  const ascentSectors = route.segments.map((segment, index) => {
    const sector = makeSector(route, segment, index, elevation, 'ASCENT', ascentScale);
    elevation = sector.endElevation;
    return sector;
  });
  if (ascentSectors.length) ascentSectors[ascentSectors.length - 1]!.endElevation = route.summitElevation;

  const descentSource = aggregateDescent(route, route.descentSegments ?? defaultDescentSegments(route));
  elevation = route.summitElevation;
  const descentScale = clamp(ascentScale * .58, .5, 1.85);
  const descentSectors = descentSource.map((segment, index) => {
    const sector = makeSector(route, segment, index, elevation, 'DESCENT', descentScale);
    elevation = sector.endElevation;
    return sector;
  });
  if (descentSectors.length) descentSectors[descentSectors.length - 1]!.endElevation = route.startElevation;

  const movementMinutes = [...ascentSectors, ...descentSectors].reduce((sum, sector) => sum + sector.baseMinutes, 0);
  const expectedNights = Math.max(0, Math.floor(movementMinutes / (16 * 60)));
  return {
    version: 1,
    direction: 'ASCENT',
    status: 'ACTIVE',
    ascentSectors,
    descentSectors,
    sectorIndex: 0,
    baselineMinutes: movementMinutes + expectedNights * 420,
    leaderPlan: null,
    lastResult: null,
    history: [],
    restReason: null,
    previousCampElevation: route.startElevation,
    nights: 0,
    randomPlanFailures: 0,
  };
}

export function hydrateStrategicExpedition(climb: QualificationClimb, route: ExpeditionRoute): StrategicExpeditionState {
  if (climb.strategic?.version === 1) return climb.strategic;
  const fresh = createStrategicExpedition(route);
  const descending = climb.phase === 'DESCENT' || climb.retreating || climb.simulation?.direction === 'DESCENT';
  const sectors = descending ? fresh.descentSectors : fresh.ascentSectors;
  const current = clamp(climb.currentElevation, route.startElevation, route.summitElevation);
  let sectorIndex = sectors.findIndex(sector => descending
    ? current <= sector.startElevation && current >= sector.endElevation
    : current >= sector.startElevation && current <= sector.endElevation);
  if (sectorIndex < 0) sectorIndex = 0;
  return { ...fresh, direction: descending ? 'DESCENT' : 'ASCENT', sectorIndex };
}

export function currentStrategicSector(career: CareerState) {
  const strategic = career.activeClimb?.strategic;
  if (!strategic) return null;
  const sectors = strategic.direction === 'ASCENT' ? strategic.ascentSectors : strategic.descentSectors;
  return sectors[Math.min(strategic.sectorIndex, Math.max(0, sectors.length - 1))] ?? null;
}

export function defaultStrategicPlan(): StrategicSectorPlan {
  return { line: 'DIRECT', pace: 'WORK', protection: 'LIGHT', formation: 'BALANCED', focus: 'FOLLOW', position: 'MIDDLE' };
}

function idealLine(career: CareerState, sector: StrategicSector): StrategicLineId {
  const climb = career.activeClimb!;
  if (climb.windKmh >= 48 || sector.exposure >= 68) return 'SHELTERED';
  if (['CREVASSE_FIELD', 'SNOW_SLOPE', 'ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId)) return 'TECHNICAL';
  if (sector.terrainModuleId === 'ICEFALL' && climb.visibility >= 55) return 'DIRECT';
  return sector.difficulty >= 52 ? 'TECHNICAL' : 'DIRECT';
}

function idealPace(career: CareerState, sector: StrategicSector): StrategicPaceId {
  const climb = career.activeClimb!;
  if (climb.energy < 45 || climb.hoursAwake >= 10 || climb.condition < 58) return 'CONSERVE';
  if (sector.terrainModuleId === 'ICEFALL' && climb.visibility >= 50 && climb.windKmh < 55) return 'PUSH';
  return 'WORK';
}

function idealProtection(sector: StrategicSector): StrategicProtectionId {
  if (sector.difficulty >= 62 || sector.exposure >= 65 || ['ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId)) return 'FULL';
  if (sector.difficulty >= 38 || sector.exposure >= 36 || ['GLACIER', 'CREVASSE_FIELD', 'RIDGE'].includes(sector.terrainModuleId)) return 'STANDARD';
  return 'LIGHT';
}

function idealFormation(career: CareerState, sector: StrategicSector): StrategicFormationId {
  const climb = career.activeClimb!;
  if (['SNOW_SLOPE', 'CREVASSE_FIELD'].includes(sector.terrainModuleId)) return 'SPREAD';
  if (climb.visibility < 42 || ['RIDGE', 'ROCK_WALL', 'MIXED_FACE'].includes(sector.terrainModuleId)) return 'COMPACT';
  return 'BALANCED';
}

function leaderPlan(career: CareerState, sector: StrategicSector): StrategicSectorPlan {
  const climb = career.activeClimb!;
  const leader = climb.leaderNpcId ? career.teamRoster.find(member => member.id === climb.leaderNpcId) : null;
  const caution = leader?.personality.caution ?? 55;
  const ambition = leader?.personality.ambition ?? 50;
  const plan = defaultStrategicPlan();
  plan.line = caution > ambition + 8 ? 'SHELTERED' : ambition > caution + 15 ? 'DIRECT' : idealLine(career, sector);
  plan.pace = ambition > 68 && climb.energy > 60 ? 'PUSH' : caution > 68 ? 'CONSERVE' : idealPace(career, sector);
  plan.protection = caution > 62 ? (idealProtection(sector) === 'LIGHT' ? 'STANDARD' : idealProtection(sector)) : idealProtection(sector);
  plan.formation = idealFormation(career, sector);
  return plan;
}

export function getStrategicLeaderPlan(career: CareerState) {
  const climb = career.activeClimb;
  const sector = currentStrategicSector(career);
  if (!climb?.strategic || !sector || climb.authorityMode === 'COMMAND') return null;
  return climb.strategic.leaderPlan ?? leaderPlan(career, sector);
}

function positionFit(role: TeamRole, position: StrategicPositionId) {
  if (role === 'ROPE_LEAD') return position === 'FRONT' ? 14 : position === 'MIDDLE' ? -4 : -14;
  if (role === 'NAVIGATOR') return position === 'FRONT' ? 10 : position === 'MIDDLE' ? 4 : -8;
  if (role === 'MEDIC') return position === 'MIDDLE' ? 12 : position === 'REAR' ? 8 : -6;
  if (role === 'SUPPORT') return position === 'REAR' ? 10 : position === 'MIDDLE' ? 7 : -8;
  return position === 'MIDDLE' ? 8 : 2;
}

function componentScore<T>(actual: T, ideal: T, harsh = false) {
  return actual === ideal ? 16 : harsh ? -18 : -7;
}

function visiblePlanContradictions(career: CareerState, sector: StrategicSector, plan: StrategicSectorPlan) {
  const climb = career.activeClimb!;
  const warnings: string[] = [];
  const line = sector.lineOptions.find(option => option.id === plan.line)!;
  const skill = career.hero.skills[line.skill];
  if (plan.line === 'DIRECT' && (climb.windKmh >= 48 || sector.exposure >= 68)) warnings.push('Прямая линия оставляет группу надолго под ветром и открытой опасностью.');
  if (plan.line === 'SHELTERED' && climb.windKmh < 32 && sector.exposure < 38) warnings.push('Защищённый обход добавляет время там, где видимой угрозы почти нет.');
  if (plan.line === 'TECHNICAL' && skill <= 4) warnings.push('Техническая линия требует навыка, которого группе сейчас не хватает.');
  if (plan.pace === 'PUSH' && (climb.energy < 55 || climb.hoursAwake >= 10)) warnings.push('Форсирование съест резерв уже уставшей группы.');
  if (plan.pace === 'CONSERVE' && sector.terrainModuleId === 'ICEFALL') warnings.push('Медленный темп увеличивает время внутри ледопада.');
  if (plan.pace === 'CONSERVE' && sector.exposure < 28 && climb.energy > 72) warnings.push('Слишком медленный темп тратит погодное окно без явной причины.');
  if (plan.protection === 'LIGHT' && (sector.difficulty >= 50 || sector.exposure >= 50)) warnings.push('Минимальная страховка не соответствует цене ошибки на этом рельефе.');
  if (plan.protection === 'FULL' && sector.difficulty < 36 && sector.exposure < 32) warnings.push('Полная страховка на простом участке съест много времени.');
  if (plan.formation === 'COMPACT' && ['SNOW_SLOPE', 'CREVASSE_FIELD'].includes(sector.terrainModuleId)) warnings.push('Плотная группа одновременно нагружает слабый снег или мост.');
  if (plan.formation === 'SPREAD' && climb.visibility < 40) warnings.push('Растянутая группа может потерять связь в плохой видимости.');
  return warnings;
}

function planQuality(career: CareerState, sector: StrategicSector, selected: StrategicSectorPlan) {
  const climb = career.activeClimb!;
  const participant = climb.authorityMode !== 'COMMAND';
  const operational = participant ? (getStrategicLeaderPlan(career) ?? selected) : selected;
  let score = 42;
  const causes: string[] = [];

  const lineIdeal = idealLine(career, sector);
  const paceIdeal = idealPace(career, sector);
  const protectionIdeal = idealProtection(sector);
  const formationIdeal = idealFormation(career, sector);

  score += componentScore(operational.line, lineIdeal, sector.exposure >= 60);
  score += componentScore(operational.pace, paceIdeal, climb.energy < 45 || sector.terrainModuleId === 'ICEFALL');
  score += componentScore(operational.protection, protectionIdeal, sector.difficulty >= 58);
  score += componentScore(operational.formation, formationIdeal, ['CREVASSE_FIELD', 'SNOW_SLOPE', 'RIDGE'].includes(sector.terrainModuleId));

  if (operational.line === lineIdeal) causes.push('Линия соответствует рельефу и погоде.');
  else causes.push('Выбранная линия спорит с видимыми условиями.');
  if (operational.pace === paceIdeal) causes.push('Темп соответствует резерву и времени под опасностью.');
  else causes.push('Темп не соответствует состоянию группы или характеру участка.');
  if (operational.protection === protectionIdeal) causes.push('Уровень страховки соответствует сложности.');
  else if (operational.protection === 'LIGHT') causes.push('Страховка оставляет слишком мало запаса.');
  else causes.push('Страховка тратит время, но увеличивает запас безопасности.');
  const requiredRope = protectionFactor[operational.protection].rope;
  if (requiredRope > climb.ropeMetersRemaining) {
    score -= 28;
    causes.push(`План требует ${requiredRope} м верёвки, но осталось ${climb.ropeMetersRemaining} м.`);
  }

  const line = sector.lineOptions.find(option => option.id === operational.line)!;
  const skill = career.hero.skills[line.skill];
  score += (skill - 5) * 2.2;

  if (participant) {
    const contradictions = visiblePlanContradictions(career, sector, operational);
    score += positionFit(climb.playerRole, selected.position);
    if (selected.focus === 'VERIFY') {
      score += contradictions.length || sector.difficulty >= 46 || sector.exposure >= 46 ? 13 : -4;
      causes.push(contradictions.length ? 'Перепроверка обнаружила слабое место плана до движения.' : 'Перепроверка не выявила нового противоречия.');
    }
    if (selected.focus === 'SUPPORT') score += climb.teamCondition < 72 ? 13 : 2;
    if (selected.focus === 'FOLLOW') score += contradictions.length === 0 ? 7 : -8;
    if (selected.focus === 'CHALLENGE') {
      const leadership = career.hero.skills.LEADERSHIP + (climb.participant?.leaderTrust ?? 50) / 20;
      const challengeWorked = contradictions.length >= 2 && leadership >= 6.5;
      score += challengeWorked ? 22 : -12;
      causes.push(challengeWorked ? 'Конкретные противоречия заставили руководителя скорректировать план.' : 'Для убедительного возражения не хватило фактов или авторитета.');
    }
    score += selected.pace === paceIdeal ? 7 : selected.pace === 'PUSH' && climb.energy < 45 ? -10 : -2;
  }

  score -= Math.max(0, climb.windKmh - 45) * .22;
  score -= Math.max(0, 45 - climb.visibility) * .18;
  score -= Math.max(0, climb.hoursAwake - 10) * 1.8;
  score -= Math.max(0, 35 - climb.energy) * .5;
  score -= Math.max(0, climb.packWeightKg - 18) * .9;
  if (sector.direction === 'DESCENT') score -= Math.max(0, 65 - climb.energy) * .14;

  return { score: clamp(score, 0, 100), operational, causes, line };
}

export function previewStrategicPlan(career: CareerState, plan: StrategicSectorPlan): StrategicPlanPreview {
  const climb = career.activeClimb!;
  const sector = currentStrategicSector(career)!;
  const participant = climb.authorityMode !== 'COMMAND';
  const operational = participant ? (getStrategicLeaderPlan(career) ?? plan) : plan;
  const line = sector.lineOptions.find(option => option.id === operational.line)!;
  const timeMultiplier = clamp(line.timeModifier * paceFactor[operational.pace].time * protectionFactor[operational.protection].time * formationFactor[operational.formation].time, .72, 1.38);
  const time = sector.baseMinutes * timeMultiplier;
  const uncertainty = 1 + sector.exposure / 500 + (100 - climb.visibility) / 700;
  const baseEnergy = Math.max(5, sector.baseMinutes / 60 * 3.1 + sector.verticalMeters / 360 + sector.difficulty / 24);
  const personalPace = participant ? plan.pace : operational.pace;
  const energy = baseEnergy * line.energyModifier * paceFactor[personalPace].energy * protectionFactor[operational.protection].energy * formationFactor[operational.formation].energy;
  const warnings: string[] = [...visiblePlanContradictions(career, sector, operational)];
  if (operational.protection === 'LIGHT' && (sector.difficulty >= 50 || sector.exposure >= 50)) warnings.push('Малая страховка оставляет тяжёлые последствия одной ошибки.');
  if (protectionFactor[operational.protection].rope > climb.ropeMetersRemaining) warnings.push('На выбранную страховку не хватает свободной верёвки.');
  if (operational.pace === 'PUSH' && climb.energy < 55) warnings.push('Ускорение съест резерв, который понадобится на следующем участке.');
  if (operational.pace === 'CONSERVE' && sector.terrainModuleId === 'ICEFALL') warnings.push('Медленное прохождение увеличивает время внутри объективной опасности.');
  if (operational.formation === 'COMPACT' && ['SNOW_SLOPE', 'CREVASSE_FIELD'].includes(sector.terrainModuleId)) warnings.push('Плотная группа одновременно нагружает слабое место.');
  if (operational.formation === 'SPREAD' && climb.visibility < 40) warnings.push('При плохой видимости растянутая группа может потерять связь.');
  if (participant && positionFit(climb.playerRole, plan.position) < 0) warnings.push('Выбранная позиция плохо использует твою роль в группе.');
  if (participant && plan.focus === 'CHALLENGE') warnings.push('Возражение полезно только при конкретном противоречии в плане руководителя.');
  if (climb.hoursAwake >= 10) warnings.push('Работа без сна уже влияет на точность оценки.');
  if (!warnings.length) warnings.push('Явного противоречия нет. Скрытые угрозы всё равно остаются.');
  return {
    timeMin: Math.round(time * .9),
    timeMax: Math.round(time * uncertainty * 1.12),
    energyMin: Math.max(1, Math.round(energy * .88)),
    energyMax: Math.max(2, Math.round(energy * 1.18)),
    reserveAfter: clamp(Math.round(climb.energy - energy)),
    warnings,
    knownAdvantages: [line.description, operational.protection === 'FULL' ? 'Полная страховка останется полезной на спуске.' : operational.pace === 'PUSH' ? 'Темп сокращает время под угрозой.' : 'План сохраняет управляемый темп.'],
  };
}

function outcomeFromScore(score: number, hazardTriggered: boolean): StrategicOutcome {
  let outcome: StrategicOutcome = score >= 76 ? 'CLEAN' : score >= 58 ? 'COSTLY' : score >= 40 ? 'DELAYED' : score >= 24 ? 'INCIDENT' : 'BLOCKED';
  if (!hazardTriggered) return outcome;
  const order: StrategicOutcome[] = ['CLEAN', 'COSTLY', 'DELAYED', 'INCIDENT', 'BLOCKED'];
  outcome = order[Math.min(order.length - 1, order.indexOf(outcome) + 1)]!;
  return outcome;
}

function evolveWeather(career: CareerState, climb: QualificationClimb, duration: number) {
  const rng = createRng(`${career.rootSeed}:${climb.id}:strategic-weather:${climb.elapsedMinutes}:${duration}`);
  return {
    temperatureC: clamp(climb.temperatureC + rng.int(-2, 1), -40, 8),
    windKmh: clamp(climb.windKmh + rng.int(-5, 6), 0, 90),
    visibility: clamp(climb.visibility + rng.int(-9, 8), 8, 100),
    weatherStep: climb.weatherStep + Math.max(1, Math.round(duration / 90)),
  };
}

function consume(climb: QualificationClimb, duration: number) {
  const group = Math.max(1, climb.teamMemberIds.length + 1);
  const food = Math.ceil(duration / 360 * group);
  const water = Math.ceil(duration / 240 * group);
  return {
    foodUnits: Math.max(0, climb.supplies.foodUnits - food),
    waterUnits: Math.max(0, climb.supplies.waterUnits - water),
    fuelUnits: climb.supplies.fuelUnits,
  };
}

function resultCopy(outcome: StrategicOutcome, sector: StrategicSector) {
  if (outcome === 'CLEAN') return { title: 'Участок пройден чисто', summary: `План сработал. ${sector.label} остался позади без серьёзной потери времени.` };
  if (outcome === 'COSTLY') return { title: 'Участок пройден с расходом', summary: 'Цель достигнута, но группа заплатила дополнительными силами или временем.' };
  if (outcome === 'DELAYED') return { title: 'План пришлось менять на ходу', summary: 'Группа прошла участок после задержки. Ошибка останется в запасах и состоянии.' };
  if (outcome === 'INCIDENT') return { title: 'Произошёл инцидент', summary: 'Участок пройден, но ошибка нанесла реальный ущерб группе.' };
  return { title: 'Путь заблокирован', summary: 'Этот план не позволил пройти участок. Повторять его вслепую нельзя.' };
}

export function resolveStrategicSector(career: CareerState, selectedPlan: StrategicSectorPlan): ClimbStepResult {
  const climb = career.activeClimb;
  const strategic = climb?.strategic;
  const sector = currentStrategicSector(career);
  if (!climb || !strategic || !sector || strategic.status !== 'ACTIVE') return { career, headline: 'План недоступен', detail: 'Сейчас нельзя исполнять новый участок.', severity: 'WARNING' };

  const evaluated = planQuality(career, sector, selectedPlan);
  const rng = createRng(`${career.rootSeed}:${climb.id}:strategic:${sector.id}:${sector.attempts}:${JSON.stringify(selectedPlan)}`);
  const operationalLine = sector.lineOptions.find(option => option.id === evaluated.operational.line)!;
  const explicitRisk = operationalLine.riskModifier + paceFactor[evaluated.operational.pace].risk + protectionFactor[evaluated.operational.protection].risk;
  const hazardChance = clamp((sector.exposure - evaluated.score * .35 + 28) / 180 + explicitRisk * .34, .02, .38);
  const hazardTriggered = rng.chance(hazardChance);
  let outcome = outcomeFromScore(evaluated.score, hazardTriggered);
  const emergencyDescent = strategic.direction === 'DESCENT' && outcome === 'BLOCKED' && sector.attempts >= 1;
  if (emergencyDescent) outcome = 'INCIDENT';
  const preview = previewStrategicPlan(career, selectedPlan);
  const delayFactor = outcome === 'CLEAN' ? .95 : outcome === 'COSTLY' ? 1.05 : outcome === 'DELAYED' ? 1.25 : outcome === 'INCIDENT' ? 1.45 : 1.15;
  const duration = Math.max(25, Math.round(((preview.timeMin + preview.timeMax) / 2) * delayFactor));
  const energyCost = Math.max(2, Math.round(((preview.energyMin + preview.energyMax) / 2) * (outcome === 'INCIDENT' ? 1.35 : outcome === 'BLOCKED' ? .8 : 1)));
  const conditionDelta = outcome === 'INCIDENT' ? -rng.int(5, 12) : outcome === 'DELAYED' ? -rng.int(1, 4) : outcome === 'BLOCKED' ? -2 : 0;
  const teamDelta = outcome === 'INCIDENT' ? -rng.int(6, 14) : outcome === 'DELAYED' ? -rng.int(2, 6) : outcome === 'BLOCKED' ? -3 : outcome === 'CLEAN' ? 2 : 0;
  const completedSector = outcome !== 'BLOCKED';
  const revealedFact = hazardTriggered || outcome === 'BLOCKED' ? sector.hiddenHazard : null;
  const copy = resultCopy(outcome, sector);
  const causes = [...evaluated.causes];
  if (hazardTriggered) causes.push(`Скрытая угроза: ${sector.hiddenHazard}`);
  if (outcome === 'BLOCKED') causes.push('План не создал достаточного запаса для продолжения.');
  if (emergencyDescent) causes.push('После повторной остановки группа прошла сектор аварийно: отступать выше уже было некуда.');

  const protection = protectionFactor[evaluated.operational.protection];
  const ropeUse = completedSector ? protection.rope : Math.ceil(protection.rope / 2);
  const weather = evolveWeather(career, climb, duration);
  const supplies = consume(climb, duration);
  const energy = clamp(climb.energy - energyCost);
  const condition = clamp(climb.condition + conditionDelta);
  const teamCondition = clamp(climb.teamCondition + teamDelta);
  const completedElevation = completedSector ? sector.endElevation : Math.round(sector.startElevation + (sector.endElevation - sector.startElevation) * .25);
  const result: StrategicSectorResult = {
    id: `${climb.id}:strategic-result:${strategic.history.length + 1}`,
    sectorId: sector.id,
    plan: selectedPlan,
    outcome,
    title: copy.title,
    summary: copy.summary,
    causes,
    durationMinutes: duration,
    energyCost,
    conditionDelta,
    teamDelta,
    completedSector,
    revealedFact,
    elevationAfter: completedElevation,
  };

  const sectors = strategic.direction === 'ASCENT' ? strategic.ascentSectors : strategic.descentSectors;
  const updatedSectors = sectors.map((item, index) => index === strategic.sectorIndex ? { ...item, attempts: item.attempts + 1, completed: completedSector } : item);
  let nextIndex = strategic.sectorIndex + (completedSector ? 1 : 0);
  let status: StrategicStatus = strategic.status;
  let direction = strategic.direction;
  let phase = climb.phase;
  let summitReached = climb.summitReached;
  let retreating = climb.retreating;
  let restReason: string | null = null;

  const forcedRetreat = !completedSector && sector.attempts >= 1;
  if (completedSector && nextIndex >= sectors.length) {
    if (strategic.direction === 'ASCENT') {
      status = 'SUMMIT';
      phase = 'SUMMIT';
      summitReached = true;
      nextIndex = Math.max(0, sectors.length - 1);
    } else {
      status = 'SAFE';
      phase = summitReached && !retreating ? 'COMPLETE' : 'RETREATED';
      nextIndex = Math.max(0, sectors.length - 1);
    }
  }

  const hoursAwake = climb.hoursAwake + duration / 60;
  if (status === 'ACTIVE' && completedSector && (hoursAwake >= 16 || energy <= 22 || supplies.waterUnits <= Math.max(2, climb.teamMemberIds.length))) {
    status = 'REST_REQUIRED';
    restReason = hoursAwake >= 16 ? 'Группа работает без сна слишком долго.' : energy <= 22 ? 'Рабочий резерв почти исчерпан.' : 'Запас воды требует остановки и топки снега.';
  }

  const strategicNext: StrategicExpeditionState = {
    ...strategic,
    direction,
    status,
    ascentSectors: strategic.direction === 'ASCENT' ? updatedSectors : strategic.ascentSectors,
    descentSectors: strategic.direction === 'DESCENT' ? updatedSectors : strategic.descentSectors,
    sectorIndex: nextIndex,
    leaderPlan: null,
    lastResult: result,
    history: [...strategic.history, result].slice(-40),
    restReason,
    randomPlanFailures: strategic.randomPlanFailures + (outcome === 'BLOCKED' || outcome === 'INCIDENT' ? 1 : 0),
  };

  const elapsedMinutes = climb.elapsedMinutes + duration;
  const participant = climb.participant ? {
    ...climb.participant,
    totalActions: climb.participant.totalActions + 1,
    competence: climb.participant.competence + (outcome === 'CLEAN' ? 2 : outcome === 'COSTLY' ? 1 : 0),
    initiative: climb.participant.initiative + (selectedPlan.focus === 'VERIFY' || selectedPlan.focus === 'CHALLENGE' ? 1 : 0),
    care: climb.participant.care + (selectedPlan.focus === 'SUPPORT' ? 2 : 0),
    discipline: climb.participant.discipline + (selectedPlan.focus === 'FOLLOW' ? 1 : 0),
  } : null;
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    phase,
    summitReached,
    retreating,
    elapsedMinutes,
    hoursAwake,
    energy,
    condition,
    teamCondition,
    teamStates: climb.teamStates.map(state => state.status === 'ACTIVE' ? { ...state, condition: clamp(state.condition + teamDelta), fatigue: clamp(state.fatigue + energyCost * .55) } : state),
    supplies,
    ropeMetersRemaining: Math.max(0, climb.ropeMetersRemaining - ropeUse),
    currentElevation: status === 'SAFE' ? climb.startElevation : status === 'SUMMIT' ? climb.summitElevation : completedElevation,
    strategic: strategicNext,
    participant,
    moveCount: climb.moveCount + (completedSector ? 1 : 0),
    log: [...climb.log, `${clock(elapsedMinutes)} — ${sector.label}: ${copy.title}. ${causes.join(' ')}`].slice(-120),
  };

  const nextCareer = { ...career, activeClimb: nextClimb };
  const resolvedCareer = forcedRetreat ? beginStrategicRetreat(nextCareer) : nextCareer;
  return {
    career: resolvedCareer,
    headline: copy.title,
    detail: `${copy.summary} Время ${Math.floor(duration / 60)} ч ${duration % 60} мин; силы −${energyCost}.`,
    severity: outcome === 'CLEAN' ? 'SUCCESS' : outcome === 'COSTLY' ? 'CALM' : outcome === 'DELAYED' ? 'WARNING' : 'DANGER',
  };
}

export function resolveStrategicRest(career: CareerState, choice: StrategicRestId): ClimbStepResult {
  const climb = career.activeClimb;
  const strategic = climb?.strategic;
  if (!climb || !strategic || strategic.status !== 'REST_REQUIRED') return { career, headline: 'Остановка не нужна', detail: 'Группа может продолжать движение.', severity: 'WARNING' };
  const participant = climb.authorityMode !== 'COMMAND';
  let duration = 0;
  let energyGain = 0;
  let teamGain = 0;
  let fuelCost = 0;
  let title = '';
  let detail = '';
  if (choice === 'CONTINUE') {
    duration = 20;
    energyGain = 0;
    teamGain = -5;
    title = participant ? 'Ты остался в движении' : 'Группа продолжает без сна';
    detail = 'Время сохранено, но следующий участок начнётся с тяжёлым штрафом усталости.';
  } else if (choice === 'BIVY') {
    duration = 240;
    energyGain = participant ? 34 : 30;
    teamGain = participant ? 4 : 7;
    fuelCost = 1;
    title = participant ? 'Короткий сон' : 'Короткий бивак';
    detail = 'Четыре часа вернули часть резерва. Полного восстановления нет.';
  } else {
    duration = 420;
    energyGain = participant ? 52 : 56;
    teamGain = participant ? 7 : 13;
    fuelCost = 2;
    title = participant ? 'Лагерная работа и сон' : 'Полный лагерь';
    detail = participant ? 'Ты выполнил свою часть работы и получил полноценный сон.' : 'Группа поставила лагерь, приготовила воду и восстановила рабочее состояние.';
  }
  if (fuelCost > climb.supplies.fuelUnits) return { career, headline: 'Не хватает топлива', detail: 'Выбери более короткую остановку или продолжай движение.', severity: 'DANGER' };
  const supplies = consume(climb, duration);
  supplies.fuelUnits = Math.max(0, supplies.fuelUnits - fuelCost);
  const weather = evolveWeather(career, climb, duration);
  const elapsedMinutes = climb.elapsedMinutes + duration;
  const nextClimb: QualificationClimb = {
    ...climb,
    ...weather,
    elapsedMinutes,
    hoursAwake: choice === 'CONTINUE' ? climb.hoursAwake + duration / 60 : 0,
    energy: clamp(climb.energy + energyGain),
    condition: clamp(climb.condition + (choice === 'CAMP' ? 4 : 1)),
    teamCondition: clamp(climb.teamCondition + teamGain),
    supplies,
    strategic: { ...strategic, status: 'ACTIVE', restReason: null, previousCampElevation: climb.currentElevation, nights: strategic.nights + (choice === 'CONTINUE' ? 0 : 1) },
    log: [...climb.log, `${clock(elapsedMinutes)} — ${title}. ${detail}`].slice(-120),
  };
  return { career: { ...career, activeClimb: nextClimb }, headline: title, detail, severity: choice === 'CONTINUE' ? 'WARNING' : 'CALM' };
}

export function beginStrategicDescent(career: CareerState): CareerState {
  const climb = career.activeClimb;
  const strategic = climb?.strategic;
  if (!climb || !strategic || strategic.status !== 'SUMMIT') return career;
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      summitReached: true,
      currentElevation: climb.summitElevation,
      strategic: { ...strategic, direction: 'DESCENT', status: 'ACTIVE', sectorIndex: 0, leaderPlan: null, restReason: null },
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — вершина оставлена. Начат отдельный план спуска.`],
    },
  };
}

export function beginStrategicRetreat(career: CareerState): CareerState {
  const climb = career.activeClimb;
  const strategic = climb?.strategic;
  if (!climb || !strategic || strategic.direction === 'DESCENT') return career;
  const current = climb.currentElevation;
  const usable = strategic.descentSectors.filter(sector => sector.endElevation < current).map((sector, index) => index === 0 ? { ...sector, startElevation: current, verticalMeters: Math.max(1, current - sector.endElevation) } : sector);
  return {
    ...career,
    activeClimb: {
      ...climb,
      phase: 'DESCENT',
      retreating: true,
      strategic: { ...strategic, direction: 'DESCENT', status: 'ACTIVE', descentSectors: usable.length ? usable : strategic.descentSectors, sectorIndex: 0, leaderPlan: null, restReason: null },
      log: [...climb.log, `${clock(climb.elapsedMinutes)} — принято решение об отходе. До безопасности остаётся физический спуск.`],
    },
  };
}
