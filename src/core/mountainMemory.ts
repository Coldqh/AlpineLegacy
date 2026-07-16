import type { CareerState, MountainId, WorldExpedition, WorldNewsItem } from './types';

export interface MountainMemoryStory {
  id: string;
  title: string;
  detail: string;
  tag: string;
}

export interface MountainMemorySnapshot {
  mountainId: MountainId;
  mountainName: string;
  attempts: number;
  summits: number;
  deaths: number;
  successRate: number;
  firstAscentLabel: string;
  attention: number;
  attentionLabel: string;
  activeClubs: string[];
  tracedRoutes: string[];
  signs: string[];
  stories: MountainMemoryStory[];
}

function formatYearDay(year: number, day: number) {
  return `${year} · день ${day}`;
}

function compareTimeline<T extends { year: number; seasonDay: number }>(a: T, b: T) {
  return b.year - a.year || b.seasonDay - a.seasonDay;
}

function attentionLabel(value: number) {
  if (value >= 78) return 'маршрут на слуху';
  if (value >= 56) return 'хорошо изучена';
  if (value >= 32) return 'известна по нескольким выходам';
  return 'почти не изучена';
}

function outcomeLabel(expedition: WorldExpedition) {
  if (expedition.outcome === 'SUMMIT') return 'ВЕРШИНА';
  if (expedition.outcome === 'RETREAT') return 'ОТХОД';
  if (expedition.outcome === 'TRAGEDY') return 'ТРАГЕДИЯ';
  return 'АВАРИЯ';
}

function expeditionStory(expedition: WorldExpedition, clubName: string | undefined): MountainMemoryStory {
  const base = `${formatYearDay(expedition.year, expedition.seasonDay)} · ${clubName ?? 'неизвестная школа'} · ${expedition.routeName}`;
  const reportNote = expedition.summary ? ` ${expedition.summary}` : '';
  if (expedition.outcome === 'SUMMIT') {
    return {
      id: expedition.id,
      title: `${expedition.mountainName}: линия пройдена`,
      detail: `${base}. Группа дошла до вершины за ${expedition.durationDays} дн. и вернулась без потерь.${reportNote}`,
      tag: outcomeLabel(expedition),
    };
  }
  if (expedition.outcome === 'TRAGEDY') {
    return {
      id: expedition.id,
      title: `${expedition.mountainName}: аварийная история`,
      detail: `${base}. На маршруте были потери — ${expedition.casualties.length}. После таких случаев на линии остаются тревожные ориентиры и закрытые решения.${reportNote}`,
      tag: outcomeLabel(expedition),
    };
  }
  return {
    id: expedition.id,
    title: `${expedition.mountainName}: попытка без вершины`,
    detail: `${base}. Команда дошла до ${expedition.highestElevation} м и ушла вниз. Такие отчёты часто раскрывают слабые места маршрута.${reportNote}`,
    tag: outcomeLabel(expedition),
  };
}

function newsStory(news: WorldNewsItem): MountainMemoryStory {
  return {
    id: news.id,
    title: news.headline,
    detail: `${formatYearDay(news.year, news.seasonDay)} · ${news.summary}`,
    tag: news.type,
  };
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function fallbackSnapshot(mountainId: MountainId, mountainName: string): MountainMemorySnapshot {
  return {
    mountainId,
    mountainName,
    attempts: 0,
    summits: 0,
    deaths: 0,
    successRate: 0,
    firstAscentLabel: 'подтверждённых восхождений ещё нет',
    attention: 0,
    attentionLabel: 'почти не изучена',
    activeClubs: [],
    tracedRoutes: [],
    signs: [
      'Подтверждённых восхождений пока нет — ты можешь стать первым, кто оставит на этой горе настоящую историю.',
      'Маршрут не забит чужими следами: лагеря, старая верёвка и описанные обходы ещё не сформировали готовую тропу.',
    ],
    stories: [],
  };
}

export function buildMountainMemory(career: CareerState, mountainId: MountainId): MountainMemorySnapshot {
  const history = career.livingWorld.mountainHistory.find(item => item.mountainId === mountainId);
  const mountainName = history?.mountainName ?? career.routes.find(route => route.mountainId === mountainId)?.mountainName ?? 'Неизвестная гора';
  if (!history) return fallbackSnapshot(mountainId, mountainName);

  const expeditions = career.livingWorld.expeditions
    .filter(item => item.mountainId === mountainId)
    .slice()
    .sort(compareTimeline);
  const news = career.livingWorld.news
    .filter(item => item.mountainId === mountainId)
    .slice()
    .sort(compareTimeline);
  const clubsById = Object.fromEntries(career.livingWorld.clubs.map(club => [club.id, club.name]));

  const successRate = history.attempts > 0 ? Math.round((history.summits / history.attempts) * 100) : 0;
  const activeClubs = unique(expeditions.slice(0, 6).map(item => clubsById[item.clubId]).filter(Boolean) as string[]);
  const tracedRoutes = unique(expeditions.map(item => item.routeName).filter(Boolean)).slice(0, 4);
  const stories = [
    ...expeditions.slice(0, 3).map(item => expeditionStory(item, clubsById[item.clubId])),
    ...news.slice(0, 2).map(newsStory),
  ].slice(0, 4);

  const signs: string[] = [];
  if (history.attempts === 0) {
    signs.push('Подтверждённых выходов пока не было — линия ещё не имеет устоявшейся репутации.');
  } else {
    if (expeditions.some(item => item.outcome === 'SUMMIT')) {
      signs.push('На популярных линиях могут встречаться старые площадки лагерей, примятые снежные полки и следы прошлых станций.');
    }
    if (expeditions.some(item => item.outcome === 'TRAGEDY' || item.outcome === 'FAILED')) {
      signs.push('В памяти горы есть аварийные отчёты: часть проходов считается подозрительной, а обходы описаны осторожнее обычного.');
    }
    if (history.deaths > 0) {
      signs.push(`Гора уже забрала людей (${history.deaths}); это влияет на репутацию маршрута и отношение школ к риску.`);
    }
    if (history.currentAttention >= 55) {
      signs.push('Гора сейчас активно обсуждается в школах: ориентиры и ключевые участки уже разошлись по журналам и разговорам.');
    }
    if (successRate >= 60) {
      signs.push('При хорошей погоде линия считается рабочей: связки чаще идут по уже проверенному ритму лагерей и переносок.');
    } else if (history.attempts >= 2) {
      signs.push('Даже опытные группы нередко отступают — это не вершина, которая прощает сырой план.');
    }
  }

  return {
    mountainId,
    mountainName,
    attempts: history.attempts,
    summits: history.summits,
    deaths: history.deaths,
    successRate,
    firstAscentLabel: history.firstAscentYear ? `${history.firstAscentYear}` : 'ещё не открыта',
    attention: history.currentAttention,
    attentionLabel: attentionLabel(history.currentAttention),
    activeClubs,
    tracedRoutes,
    signs: signs.slice(0, 4),
    stories,
  };
}
