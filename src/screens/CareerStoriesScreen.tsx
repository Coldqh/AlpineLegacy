import { useEffect, useMemo } from 'react';
import { careerStoryNpc } from '../core/careerStories';
import type { CareerState, CareerStoryEvent, CareerStoryKind } from '../core/types';

type Props = {
  career: CareerState;
  onResolve: (eventId: string, choiceId: string) => void;
  onRead: () => void;
};

const kindLabel: Record<CareerStoryKind, string> = {
  INVITATION: 'ЛИЧНОЕ ПРИГЛАШЕНИЕ',
  RIVALRY: 'СОПЕРНИЧЕСТВО',
  MENTOR: 'ЛИНИЯ НАСТАВНИКА',
  TEAM: 'ПОСТОЯННАЯ СВЯЗКА',
  CLUB: 'ВНУТРИ ШКОЛЫ',
  TRANSFER: 'ПЕРЕХОД',
};

function eventDate(event: CareerStoryEvent) {
  return `${event.year} · день ${event.seasonDay}`;
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

export function CareerStoriesScreen({ career, onResolve, onRead }: Props) {
  const openEvent = useMemo(() => [...career.storyState.events].reverse().find(event => event.status === 'OPEN') ?? null, [career.storyState.events]);
  const timeline = useMemo(() => [...career.storyState.events].reverse(), [career.storyState.events]);
  const activeArcs = career.storyState.arcs.filter(arc => arc.status === 'ACTIVE');

  useEffect(() => {
    if (career.storyState.unreadCount > 0) onRead();
  }, [career.storyState.unreadCount, onRead]);

  return (
    <section className="career-stories workspace-page">
      <header className="workspace-title workspace-title--compact career-stories__title">
        <div>
          <p className="eyebrow">CAREER STORIES / PEOPLE REMEMBER</p>
          <h1>Истории карьеры</h1>
          <p>Редкие решения между экспедициями. Они меняют состав, соперников, отношение наставников и доступные походы.</p>
        </div>
        <div className="workspace-title__mark"><span>{career.storyState.teamReputation}</span><small>ИМЯ СВЯЗКИ</small></div>
      </header>

      <section className="career-stories__identity">
        <div><small>ПОСТОЯННАЯ КОМАНДА</small><strong>{career.storyState.teamLegacyName}</strong><span>{career.permanentTeam.memberIds.length} постоянных участников · слаженность {Math.round(career.permanentTeam.cohesion)}</span></div>
        <div><small>АКТИВНЫЕ ЛИНИИ</small><strong>{activeArcs.length}</strong><span>{career.storyState.rivalNpcIds.length} отслеживаемых соперников · {career.storyState.mentorNpcIds.length} наставников</span></div>
        <div><small>РЕШЕНИЯ</small><strong>{timeline.filter(event => event.status === 'RESOLVED').length}</strong><span>{timeline.filter(event => event.status === 'EXPIRED').length} возможностей закрылись без ответа</span></div>
      </section>

      {openEvent ? (
        <section className={`career-story-decision is-${openEvent.kind.toLowerCase()}`}>
          <header>
            <div><span>{kindLabel[openEvent.kind]} · ЭТАП {openEvent.stage + 1}</span><h2>{openEvent.title}</h2><p>{openEvent.summary}</p></div>
            <small>{eventDate(openEvent)}{openEvent.expiresOnDay ? ` · ответ до дня ${openEvent.expiresOnDay}` : ''}</small>
          </header>

          {openEvent.npcIds.length > 0 && <div className="career-story-people">{openEvent.npcIds.map(id => {
            const person = careerStoryNpc(career, id);
            if (!person) return null;
            const name = person.name;
            return <span key={id}><b>{initials(name)}</b><i>{name}</i></span>;
          })}</div>}

          <p className="career-story-decision__detail">{openEvent.detail}</p>

          {openEvent.routeId && (() => {
            const route = career.routes.find(item => item.id === openEvent.routeId);
            return route ? <div className="career-story-route"><small>СВЯЗАННАЯ ЦЕЛЬ</small><strong>{route.mountainName} · {route.name}</strong><span>{route.summitElevation} м · техника {route.technicality} · риск {route.objectiveRisk}</span></div> : null;
          })()}

          <div className="career-story-choices">
            {openEvent.choices.map((choice, index) => (
              <button key={choice.id} onClick={() => onResolve(openEvent.id, choice.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{choice.title}</strong><small>{choice.detail}</small></div>
                <b>→</b>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="career-story-quiet">
          <span>СЕЙЧАС ТИХО</span>
          <h2>Никто не требует ответа.</h2>
          <p>Продвигай время тренировками, поездками и экспедициями. Новые истории появляются редко и опираются на реальные отношения и результаты.</p>
        </section>
      )}

      <div className="career-stories__columns">
        <section className="ux-panel career-story-arcs">
          <header><div><small>ДОЛГИЕ ЛИНИИ</small><h2>Что развивается</h2></div><span>{activeArcs.length}</span></header>
          <div>{activeArcs.length ? activeArcs.map(arc => {
            const names = arc.npcIds.map(id => careerStoryNpc(career, id)?.name).filter(Boolean).join(' · ');
            return <article key={arc.id}><span>{kindLabel[arc.kind]}</span><strong>{arc.title}</strong><small>{names || 'Карьера'} · этап {arc.stage + 1}</small><i><b style={{ width: `${Math.min(100, (arc.stage + 1) * 32)}%` }} /></i></article>;
          }) : <p>Первые долгие линии появятся после нескольких недель в школе или первого совместного выхода.</p>}</div>
        </section>

        <section className="ux-panel career-story-timeline">
          <header><div><small>ХРОНИКА</small><h2>Что уже произошло</h2></div><span>{timeline.length}</span></header>
          <div>{timeline.length ? timeline.map(event => (
            <article key={event.id} className={`is-${event.status.toLowerCase()}`}>
              <span>{kindLabel[event.kind]}</span>
              <div><strong>{event.title}</strong><small>{eventDate(event)}</small><p>{event.outcome ?? event.summary}</p></div>
              <b>{event.status === 'OPEN' ? 'ЖДЁТ' : event.status === 'EXPIRED' ? 'УПУЩЕНО' : 'РЕШЕНО'}</b>
            </article>
          )) : <p>Хроника пока пуста.</p>}</div>
        </section>
      </div>
    </section>
  );
}
