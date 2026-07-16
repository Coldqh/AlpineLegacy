import { MountainModel } from '../components/MountainModel';
import { TRAINING_ACTIONS, SKILL_LABELS, careerReadiness, expeditionReadiness, getSelectedRoute } from '../core/career';
import { normalizeCareerProgression } from '../core/progression';
import { careerRegion } from '../core/regionalCareer';
import type { CareerState, SkillId, TrainingId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onTrain: (trainingId: TrainingId) => void;
  onOpenExpedition: () => void;
  onOpenWorld: () => void;
  onOpenStories: () => void;
};

const trainingForSkill: Record<SkillId, TrainingId> = {
  ENDURANCE: 'CONDITIONING',
  ROCK: 'ROCK_PRACTICE',
  ICE: 'ICE_PRACTICE',
  NAVIGATION: 'MAP_ROOM',
  MEDICINE: 'FIRST_AID',
  LEADERSHIP: 'CLUB_DUTY',
};

function routePrimarySkill(career: CareerState) {
  const route = getSelectedRoute(career);
  const count = route.segments.reduce((result, segment) => {
    result[segment.skill] = (result[segment.skill] ?? 0) + 1;
    return result;
  }, {} as Partial<Record<SkillId, number>>);
  return (Object.entries(count).sort((a, b) => b[1]! - a[1]!)[0]?.[0] as SkillId | undefined) ?? 'ENDURANCE';
}

export function CareerOverviewScreen({ world, career, onTrain, onOpenExpedition, onOpenWorld, onOpenStories }: Props) {
  const target = getSelectedRoute(career);
  const currentRegion = careerRegion(world, career);
  const mountain = world.ecosystem.content.mountains.byId[target.mountainId] ?? world.region.mountains[0]!;
  const readiness = careerReadiness(career);
  const expedition = expeditionReadiness(career);
  const progression = normalizeCareerProgression(career);
  const primarySkill = routePrimarySkill(career);
  const recommendedTraining = career.recoveryDays > 0 ? 'RECOVERY' : trainingForSkill[primarySkill];
  const trainingIds = [...new Set<TrainingId>([recommendedTraining, 'CONDITIONING', 'RECOVERY'])].slice(0, 3);
  const nextMilestone = progression.milestones.find(item => !item.completed);
  const latestNews = career.livingWorld.news[0];
  const activeStory = [...career.storyState.events].reverse().find(event => event.status === 'OPEN') ?? null;
  const nextTitle = career.recoveryDays > 0
    ? 'Вернуть силы после экспедиции'
    : career.activeClimb
      ? 'Продолжить восхождение'
      : expedition.blockers.length
        ? 'Закончить подготовку'
        : 'Группа готова к выходу';
  const nextDetail = career.recoveryDays > 0
    ? `Осталось ${career.recoveryDays} дн. восстановления.`
    : career.activeClimb
      ? `${career.activeClimb.mountainName} · ${Math.round(career.activeClimb.currentElevation)} м.`
      : expedition.blockers[0] ?? `${target.mountainName} · ${target.name}.`;

  return (
    <section className="ux-hq workspace-page">
      <header className="ux-hq__identity">
        <div><span>ШТАБ · {currentRegion.country ?? currentRegion.name}</span><h1>{career.hero.name}</h1><p>{career.club.name} · {career.hero.originTitle} · сезон {progression.seasonNumber}</p></div>
        <div className="ux-hq__identity-stats"><span><b>{career.completedClimbs}</b><small>выходов</small></span><span><b>{career.highestElevation}</b><small>макс. м</small></span><span><b>{career.hero.reputation}</b><small>репутация</small></span></div>
      </header>

      <section className="ux-hq__focus">
        <div className="ux-hq__focus-copy"><small>ГЛАВНОЕ СЕЙЧАС</small><h2>{nextTitle}</h2><p>{nextDetail}</p><button onClick={career.recoveryDays > 0 ? () => onTrain('RECOVERY') : onOpenExpedition}>{career.recoveryDays > 0 ? 'Восстановиться' : career.activeClimb ? 'Вернуться на маршрут' : 'Открыть экспедицию'}<b>→</b></button></div>
        <div className="ux-hq__focus-mountain"><MountainModel mountain={mountain} seed={world.config.seed} variant="hero" label={target.mountainName} /><footer><span>{target.mountainName}</span><strong>{target.name}</strong><small>{target.summitElevation} м · готовность {Math.round(expedition.total)}%</small></footer></div>
      </section>

      {activeStory && <button className="career-story-teaser" onClick={onOpenStories}>
        <span>{career.storyState.unreadCount || 1}</span>
        <div><small>ТРЕБУЕТ РЕШЕНИЯ · {activeStory.kind}</small><strong>{activeStory.title}</strong><p>{activeStory.summary}</p></div>
        <b>→</b>
      </button>}

      <section className="ux-hq__status" aria-label="Состояние героя">
        <article><span>Форма</span><strong>{Math.round(career.hero.form)}</strong><i><b style={{ width: `${career.hero.form}%` }} /></i></article>
        <article><span>Здоровье</span><strong>{Math.round(career.hero.health)}</strong><i><b style={{ width: `${career.hero.health}%` }} /></i></article>
        <article><span>Усталость</span><strong>{Math.round(career.hero.fatigue)}</strong><i className="is-inverted"><b style={{ width: `${career.hero.fatigue}%` }} /></i></article>
        <article><span>Готовность</span><strong>{readiness}</strong><i><b style={{ width: `${readiness}%` }} /></i></article>
      </section>

      <div className="ux-hq__columns">
        <section className="ux-panel ux-hq__actions">
          <header><div><small>РЕКОМЕНДОВАНО</small><h2>Три действия</h2></div><span>каждое двигает время</span></header>
          <div>{trainingIds.map(id => {
            const action = TRAINING_ACTIONS[id];
            const disabled = (action.cost > 0 && career.hero.money < action.cost) || (career.recoveryDays > 0 && id !== 'RECOVERY');
            return <button key={id} disabled={disabled} onClick={() => onTrain(id)}><span>{action.days}д</span><div><strong>{action.title}</strong><small>{action.skill ? `${SKILL_LABELS[action.skill]} +${action.xp ?? 0}` : 'здоровье и форма'} · {action.cost < 0 ? '+' : '−'}{Math.abs(action.cost)} кр.</small></div><b>›</b></button>;
          })}</div>
        </section>

        <section className="ux-panel ux-hq__brief">
          <header><div><small>КАРЬЕРА</small><h2>{nextMilestone?.title ?? 'Легенда региона'}</h2></div><span>{progression.milestones.filter(item => item.completed).length}/{progression.milestones.length}</span></header>
          <p>{nextMilestone?.description ?? 'Основные цели карьеры выполнены.'}</p>
          <div className="ux-hq__skill-strip">{(Object.keys(career.hero.skills) as SkillId[]).map(skill => <span key={skill}><small>{SKILL_LABELS[skill]}</small><b>{career.hero.skills[skill]}</b></span>)}</div>
        </section>
      </div>

      {latestNews && <button className="ux-hq__news" onClick={onOpenWorld}><span><small>МИР · ДЕНЬ {latestNews.seasonDay}</small><strong>{latestNews.headline}</strong><p>{latestNews.summary}</p></span><b>→</b></button>}
    </section>
  );
}
