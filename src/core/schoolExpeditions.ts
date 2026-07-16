import { createRng } from './rng';
import type {
  CareerState,
  ExpeditionOffer,
  ExpeditionRank,
  ExpeditionRoute,
  MentorRoutePreference,
  NpcDefinition,
  OrganizationDefinition,
  SchoolExpeditionPhase,
  SkillId,
  WorldState,
} from './types';

const CYCLE_DAYS = 30;
const phaseLabels: Record<SchoolExpeditionPhase, string> = {
  ANNOUNCED: 'объявлена цель',
  RECRUITING: 'идёт набор',
  PREPARING: 'группа готовится',
  WEATHER_HOLD: 'ждут окно',
  DEPARTING: 'выход в ближайшие дни',
  ON_ROUTE: 'группа на маршруте',
  RECOVERING: 'разбор и восстановление',
  CANCELLED: 'план отменён',
};

export const SCHOOL_EXPEDITION_PHASE_LABELS = phaseLabels;

function routeScore(route: ExpeditionRoute) {
  return route.objectiveRisk * .45 + route.technicality * .4 + Math.max(0, route.summitElevation - route.startElevation) / 180;
}

function rankForMentor(index: number): ExpeditionRank {
  return index === 0 ? 'NOVICE' : index === 1 ? 'MEMBER' : 'SPECIALIST';
}

function routeSkill(route: ExpeditionRoute): SkillId {
  const counts = route.segments.reduce((result, segment) => {
    result[segment.skill] = (result[segment.skill] ?? 0) + 1;
    return result;
  }, {} as Partial<Record<SkillId, number>>);
  return (Object.entries(counts).sort((a, b) => b[1]! - a[1]!)[0]?.[0] as SkillId | undefined) ?? 'ENDURANCE';
}

function routePool(routes: ExpeditionRoute[], preference: MentorRoutePreference) {
  const sorted = [...routes].sort((a, b) => routeScore(a) - routeScore(b));
  if (preference === 'EASY') return sorted.slice(0, Math.max(3, Math.ceil(sorted.length * .42)));
  if (preference === 'HARD') return sorted.slice(Math.max(0, Math.floor(sorted.length * .56)));
  return sorted.slice(Math.floor(sorted.length * .18), Math.max(Math.floor(sorted.length * .18) + 3, Math.ceil(sorted.length * .82)));
}

function cycleAnchor(day: number, mentorIndex: number, organizationIndex: number) {
  const offset = mentorIndex * 7 + (organizationIndex % 3) * 2;
  let anchor = 1 + offset;
  while (anchor + CYCLE_DAYS <= day) anchor += CYCLE_DAYS;
  return anchor;
}

export function schoolExpeditionPhase(offer: ExpeditionOffer, seasonDay: number): SchoolExpeditionPhase {
  if (offer.scheduleStatus === 'CANCELLED' || offer.cancellationReason) return 'CANCELLED';
  if (!offer.departureDay) return offer.phase ?? 'RECRUITING';
  const announced = offer.opensOnDay;
  const recruitment = announced;
  const recruitmentClose = offer.recruitmentClosesDay ?? offer.departureDay - 10;
  if (seasonDay < recruitment) return 'ANNOUNCED';
  if (seasonDay <= recruitmentClose) return 'RECRUITING';
  if (seasonDay <= offer.departureDay - 4) return 'PREPARING';
  if (seasonDay < offer.departureDay) return 'WEATHER_HOLD';
  if (seasonDay <= offer.departureDay + 1) return 'DEPARTING';
  if (seasonDay <= (offer.expectedReturnDay ?? offer.departureDay + 7)) return 'ON_ROUTE';
  return 'RECOVERING';
}

function chooseRoute(
  routes: ExpeditionRoute[],
  leader: NpcDefinition,
  organizationIndex: number,
  mentorIndex: number,
  cycle: number,
  seed: string,
) {
  const pool = routePool(routes, leader.routePreference);
  if (leader.routePreference === 'EASY') return pool[(cycle + organizationIndex) % Math.min(3, pool.length)] ?? pool[0]!;
  if (leader.routePreference === 'HARD') return pool[Math.max(0, pool.length - 1 - ((cycle + organizationIndex) % Math.min(3, pool.length)))] ?? pool[pool.length - 1]!;
  const rng = createRng(`${seed}:school-board:${leader.id}:${cycle}`);
  const shifted = pool.filter((_, index) => (index + organizationIndex + mentorIndex + cycle) % 3 !== 1);
  return rng.pick(shifted.length ? shifted : pool);
}

function crewFor(
  world: WorldState,
  organization: OrganizationDefinition,
  leader: NpcDefinition,
  route: ExpeditionRoute,
  cycle: number,
) {
  const primary = routeSkill(route);
  const candidates = organization.memberNpcIds
    .map(id => world.ecosystem.content.npcs.byId[id])
    .filter((npc): npc is NpcDefinition => Boolean(npc) && npc.id !== leader.id && !npc.isMentor)
    .filter(npc => {
      const runtime = world.ecosystem.runtime.npcs.byId[npc.id];
      return !runtime || (runtime.status === 'ACTIVE' && runtime.availability >= 45);
    })
    .sort((a, b) => {
      const score = (npc: NpcDefinition) => npc.skills[primary] * 9 + npc.skills.ENDURANCE * 5 + npc.skills.MEDICINE * 2;
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
  if (!candidates.length) return [];
  const required = Math.max(2, Math.min(5, route.recommendedTeamSize - 1));
  const start = (cycle * 2 + organization.memberNpcIds.indexOf(leader.id)) % candidates.length;
  return Array.from({ length: Math.min(required, candidates.length) }, (_, index) => candidates[(start + index) % candidates.length]!.id);
}

function briefingFor(leader: NpcDefinition, route: ExpeditionRoute, phase: SchoolExpeditionPhase, delayDays = 0, cancellationReason: string | null = null) {
  if (phase === 'CANCELLED') return `${leader.name} отменил план: ${cancellationReason ?? 'состав или условия не позволяют выйти безопасно'}. Следующая цель появится в новом цикле.`;
  if (phase === 'ANNOUNCED') return `${leader.name} объявил цель и собирает сведения по линии «${route.name}».`;
  if (phase === 'RECRUITING') return `${leader.name} набирает людей под ${route.style.toLowerCase()} маршрут. Состав ещё не закрыт.`;
  if (phase === 'PREPARING') return `Состав определён. Идут тренировки, распределение груза и проверка снаряжения.`;
  if (phase === 'WEATHER_HOLD') return `Группа готова, но инструктор не выпускает людей до подходящего погодного окна.`;
  if (phase === 'DEPARTING') return `Груз собран. Команда выходит к подходу и больше не принимает новые заявки.${delayDays ? ` План уже сдвигали на ${delayDays} дн.` : ''}`;
  if (phase === 'ON_ROUTE') return `Связка находится на маршруте. Новости появятся после возвращения или аварийного сообщения.${delayDays ? ` Выход состоялся после задержки на ${delayDays} дн.` : ''}`;
  return `Команда вернулась. Инструктор разбирает решения, люди восстанавливаются и освобождают снаряжение.`;
}

export function buildSchoolExpeditionBoard(world: WorldState, career: Pick<CareerState, 'year' | 'seasonDay' | 'routes' | 'acceptedOffer'>): ExpeditionOffer[] {
  const offers: ExpeditionOffer[] = [];
  const organizations = world.ecosystem.content.organizations.allIds
    .map(id => world.ecosystem.content.organizations.byId[id])
    .filter((item): item is OrganizationDefinition => Boolean(item));

  organizations.forEach((organization, organizationIndex) => {
    const mentors = organization.mentorNpcIds
      .map(id => world.ecosystem.content.npcs.byId[id])
      .filter((item): item is NpcDefinition => Boolean(item));
    mentors.forEach((leader, mentorIndex) => {
      const baseAnchor = cycleAnchor(career.seasonDay, mentorIndex, organizationIndex);
      [0, 1].forEach(planSeries => {
        const anchor = baseAnchor + planSeries * CYCLE_DAYS;
        if (anchor > 180) return;
        const cycle = Math.floor((anchor - 1) / CYCLE_DAYS);
        const regionalRoutes = career.routes.filter(item => item.regionId === organization.regionId);
        if (!regionalRoutes.length) return;
        const route = chooseRoute(regionalRoutes, leader, organizationIndex, mentorIndex, cycle, world.config.seed);
        const scheduleRng = createRng(`${world.config.seed}:school-schedule:${organization.id}:${leader.id}:${cycle}`);
        const cancelled = scheduleRng.chance(leader.routePreference === 'HARD' ? .08 : .045);
        const delayed = !cancelled && scheduleRng.chance(.32);
        const delayDays = delayed ? scheduleRng.pick([2, 3, 4, 5]) : 0;
        const cancellationReason = cancelled ? scheduleRng.pick([
          'не удалось собрать подходящую связку',
          'школа не выделила снаряжение после аварии другой группы',
          'состояние маршрута признано нестабильным',
          'ключевой участник выбыл из состава',
        ]) : null;
        const departureDay = anchor + 17 + delayDays;
        const expectedReturnDay = Math.min(180, departureDay + 5 + mentorIndex * 2);
        const provisional: ExpeditionOffer = {
          id: `board-${career.year}-${organization.id}-${leader.id}-${cycle}`,
          organizationId: organization.id,
          routeId: route.id,
          leaderNpcId: leader.id,
          memberNpcIds: [],
          playerRole: mentorIndex === 0 ? 'SUPPORT' : mentorIndex === 1 ? 'NAVIGATOR' : 'ROPE_LEAD',
          requiredRank: rankForMentor(mentorIndex),
          authority: 'PARTICIPANT',
          solo: false,
          status: 'OPEN',
          opensOnDay: anchor,
          expiresOnDay: Math.min(180, expectedReturnDay + 5),
          recruitmentClosesDay: anchor + 7,
          departureDay,
          expectedReturnDay,
          cycle,
          openSlots: 1 + ((cycle + mentorIndex + organizationIndex) % 3),
          scheduleStatus: cancelled ? 'CANCELLED' : delayed ? 'DELAYED' : 'ON_TIME',
          delayDays,
          cancellationReason,
          preparationProgress: 0,
          planSeries,
        };
        const phase = schoolExpeditionPhase(provisional, career.seasonDay);
        const crew = crewFor(world, organization, leader, route, cycle);
        const preparationProgress = phase === 'ANNOUNCED' ? 8
          : phase === 'RECRUITING' ? Math.max(14, Math.min(38, Math.round((career.seasonDay - anchor + 1) / 8 * 38)))
            : phase === 'PREPARING' ? Math.max(42, Math.min(74, 42 + (career.seasonDay - (anchor + 8)) * 6))
              : phase === 'WEATHER_HOLD' ? 88
                : ['DEPARTING', 'ON_ROUTE', 'RECOVERING'].includes(phase) ? 100 : 0;
        offers.push({
          ...provisional,
          memberNpcIds: crew,
          phase,
          preparationProgress,
          status: phase === 'ANNOUNCED' || phase === 'RECRUITING' || phase === 'PREPARING' || phase === 'WEATHER_HOLD' ? 'OPEN' : 'CLOSED',
          briefing: briefingFor(leader, route, phase, delayDays, cancellationReason),
        });
      });
    });
  });

  if (career.acceptedOffer && !offers.some(item => item.id === career.acceptedOffer!.id)) {
    offers.push({ ...career.acceptedOffer, phase: schoolExpeditionPhase(career.acceptedOffer, career.seasonDay) });
  }

  const phaseOrder: Record<SchoolExpeditionPhase, number> = {
    RECRUITING: 0,
    ANNOUNCED: 1,
    PREPARING: 2,
    WEATHER_HOLD: 3,
    DEPARTING: 4,
    ON_ROUTE: 5,
    RECOVERING: 6,
    CANCELLED: 7,
  };
  return offers.sort((a, b) => phaseOrder[schoolExpeditionPhase(a, career.seasonDay)] - phaseOrder[schoolExpeditionPhase(b, career.seasonDay)] || (a.departureDay ?? 999) - (b.departureDay ?? 999));
}

export function schoolOfferCanAccept(offer: ExpeditionOffer, seasonDay: number) {
  return offer.scheduleStatus !== 'CANCELLED' && ['ANNOUNCED', 'RECRUITING'].includes(schoolExpeditionPhase(offer, seasonDay)) && (offer.openSlots ?? 1) > 0;
}

export function daysUntilSchoolDeparture(offer: ExpeditionOffer | null, seasonDay: number) {
  if (!offer?.departureDay) return 0;
  return Math.max(0, offer.departureDay - seasonDay);
}
