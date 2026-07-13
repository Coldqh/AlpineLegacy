import { MountainArt } from '../components/MountainArt';
import { SkillBars } from '../components/SkillBars';
import { TRAINING_ACTIONS, careerReadiness, expeditionReadiness, getSelectedRoute } from '../core/career';
import type { CareerState, TrainingId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onTrain: (trainingId: TrainingId) => void;
  onOpenExpedition: () => void;
};

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];

export function CareerOverviewScreen({ world, career, onTrain, onOpenExpedition }: Props) {
  const target = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === target.mountainId) ?? world.region.mountains[0]!;
  const readiness = careerReadiness(career);
  const expedition = expeditionReadiness(career);

  return (
    <section className="workspace-page overview-page">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">ACTIVE CAREER / {career.hero.originTitle}</p>
          <h1>{career.hero.name}</h1>
          <p>{career.hero.age} лет · {career.club.name} · {career.club.town}</p>
        </div>
        <div className="workspace-title__mark"><span>{career.completedClimbs}</span><small>ВОСХОЖДЕНИЙ</small></div>
      </header>

      <div className="overview-poster">
        <MountainArt points={mountain.profilePoints} variant="hero" label={target.mountainName} elevation={target.summitElevation} />
        <div className="overview-poster__plate">
          <small>CURRENT OBJECTIVE</small>
          <strong>{target.mountainName}</strong>
          <span>{target.name}</span>
        </div>
      </div>

      <div className="workspace-metrics">
        <div><span>Личная готовность</span><strong>{readiness}</strong><i style={{ '--value': `${readiness}%` } as React.CSSProperties} /></div>
        <div><span>План экспедиции</span><strong>{expedition.total}</strong><i style={{ '--value': `${expedition.total}%` } as React.CSSProperties} /></div>
        <div><span>Здоровье</span><strong>{Math.round(career.hero.health)}</strong><i style={{ '--value': `${career.hero.health}%` } as React.CSSProperties} /></div>
        <div><span>Высшая точка</span><strong>{career.highestElevation} м</strong></div>
      </div>

      <div className="overview-columns">
        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">PERSONAL CAPABILITY</p><h2>Навыки</h2></div><span>MAX 10</span></div>
          <SkillBars skills={career.hero.skills} />
          <div className="club-card club-card--compact">
            <div className="club-card__number">AL<br />{String(career.club.foundedYear).slice(-2)}</div>
            <div><p className="eyebrow">YOUR CLUB</p><h3>{career.club.name}</h3><p>{career.club.specialty}. Уровень: {career.club.standing}/100.</p><small>{career.club.mentorName} · {career.club.mentorTitle}</small></div>
          </div>
        </section>

        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">EXPEDITION STATUS</p><h2>Следующий выход</h2></div><span>{target.summitElevation} M</span></div>
          <article className="objective-card objective-card--workspace">
            <div className="objective-card__top"><span>{target.style}</span><span>{expedition.blockers.length ? 'INCOMPLETE' : 'READY'}</span></div>
            <h3>{target.name}</h3>
            <p>{target.summary}</p>
            <div className="objective-data">
              <span><small>ВРЕМЯ</small><strong>≈ {target.estimatedHours} ч</strong></span>
              <span><small>РИСК</small><strong>{target.objectiveRisk}/100</strong></span>
              <span><small>ГРУППА</small><strong>{career.expeditionPlan.teamMemberIds.length + 1}</strong></span>
            </div>
            <button className="objective-launch" onClick={onOpenExpedition}><span>Открыть план экспедиции</span><b>→</b></button>
          </article>
        </section>
      </div>

      <section className="workspace-panel training-section training-section--workspace">
        <div className="panel-heading"><div><p className="eyebrow">WEEKLY ACTIONS</p><h2>Подготовка</h2></div><span>ВРЕМЯ ДВИЖЕТСЯ</span></div>
        <div className="training-grid training-grid--workspace">
          {trainingOrder.map((id, index) => {
            const action = TRAINING_ACTIONS[id];
            const unavailable = action.cost > 0 && career.hero.money < action.cost;
            return (
              <button key={id} disabled={unavailable} className="training-card" onClick={() => onTrain(id)}>
                <span className="training-card__index">{String(index + 1).padStart(2, '0')}</span>
                <small>{action.label}</small>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <div><span>{action.days} ДНЕЙ</span><strong>{action.cost < 0 ? `+${Math.abs(action.cost)}` : `−${action.cost}`} КР.</strong></div>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
