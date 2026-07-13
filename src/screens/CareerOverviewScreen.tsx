import { MountainArt } from '../components/MountainArt';
import { SkillBars } from '../components/SkillBars';
import { TRAINING_ACTIONS, SKILL_LABELS, careerReadiness, expeditionReadiness, getSelectedRoute } from '../core/career';
import type { CareerState, TrainingId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onTrain: (trainingId: TrainingId) => void;
  onOpenExpedition: () => void;
  onOpenWorld: () => void;
};

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function CareerOverviewScreen({ world, career, onTrain, onOpenExpedition, onOpenWorld }: Props) {
  const target = getSelectedRoute(career);
  const mountain = world.region.mountains.find(item => item.id === target.mountainId) ?? world.region.mountains[0]!;
  const readiness = careerReadiness(career);
  const expedition = expeditionReadiness(career);
  const nextMessage = career.activeClimb
    ? 'Экспедиция уже идёт. Открой раздел восхождения.'
    : expedition.blockers.length
      ? `Подготовка не закончена: ${expedition.blockers[0]}`
      : 'План готов. Проверь цель и переходи к финальному выходу.';

  return (
    <section className="workspace-page overview-page overview-page--clear">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">КАРЬЕРА · {career.hero.originTitle}</p>
          <h1>{career.hero.name}</h1>
          <p>{career.hero.age} лет · {career.club.name} · {career.club.town}</p>
        </div>
        <div className="workspace-title__mark"><span>{career.completedClimbs}</span><small>ВОСХОЖДЕНИЙ</small></div>
      </header>

      <section className="career-next-step">
        <div><small>ГЛАВНОЕ СЕЙЧАС</small><strong>{career.activeClimb ? 'Вернуться на маршрут' : 'Подготовить следующую экспедицию'}</strong><p>{nextMessage}</p></div>
        <button onClick={onOpenExpedition}><span>{career.activeClimb ? 'Открыть план' : 'Выбрать гору и маршрут'}</span><b>→</b></button>
      </section>

      <div className="overview-poster overview-poster--clear">
        <MountainArt points={mountain.profilePoints} variant="hero" label={target.mountainName} elevation={target.summitElevation} />
        <div className="overview-poster__plate">
          <small>ТЕКУЩАЯ ЦЕЛЬ</small>
          <strong>{target.mountainName}</strong>
          <span>{target.name} · {target.summitElevation} м</span>
        </div>
      </div>

      <div className="workspace-metrics workspace-metrics--clear">
        <div><span>Личная готовность</span><strong>{readiness}/100</strong><small>Форма, здоровье, усталость, навыки</small><i style={{ '--value': `${readiness}%` } as React.CSSProperties} /></div>
        <div><span>План экспедиции</span><strong>{expedition.total}/100</strong><small>{expedition.blockers.length ? `${expedition.blockers.length} блокировки` : 'Можно выходить'}</small><i style={{ '--value': `${expedition.total}%` } as React.CSSProperties} /></div>
        <div><span>Здоровье</span><strong>{Math.round(career.hero.health)}/100</strong><small>{career.hero.injuries.length ? career.hero.injuries.join(', ') : 'Травм нет'}</small><i style={{ '--value': `${career.hero.health}%` } as React.CSSProperties} /></div>
        <div><span>Высшая точка</span><strong>{career.highestElevation} м</strong><small>Личный подтверждённый результат</small></div>
      </div>

      <div className="overview-columns overview-columns--clear">
        <section className="workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">ЛИЧНЫЕ ВОЗМОЖНОСТИ</p><h2>Навыки</h2></div><span>МАКС. 10</span></div>
          <SkillBars skills={career.hero.skills} />
        </section>
        <section className="workspace-panel club-brief">
          <div className="panel-heading"><div><p className="eyebrow">КЛУБ</p><h2>{career.club.name}</h2></div><span>{career.club.standing}/100</span></div>
          <p>{career.club.specialty}. {career.club.doctrine}</p>
          <strong>{career.club.mentorName}</strong><small>{career.club.mentorTitle}</small>
        </section>
      </div>

      <section className="workspace-panel training-section training-section--workspace training-section--clear">
        <div className="panel-heading"><div><p className="eyebrow">ДЕЙСТВИЯ МЕЖДУ ЭКСПЕДИЦИЯМИ</p><h2>Подготовка героя</h2></div><span>КАЖДОЕ ДЕЙСТВИЕ ДВИГАЕТ ВРЕМЯ</span></div>
        <p className="section-explainer">Здесь нет скрытых эффектов: на каждой карточке показано, что изменится сразу после нажатия. За это время соперники тоже совершают восхождения.</p>
        <div className="training-grid training-grid--workspace training-grid--clear">
          {trainingOrder.map((id, index) => {
            const action = TRAINING_ACTIONS[id];
            const unavailable = action.cost > 0 && career.hero.money < action.cost;
            return (
              <button key={id} disabled={unavailable} className="training-card training-card--clear" onClick={() => onTrain(id)}>
                <header><span>{String(index + 1).padStart(2, '0')}</span><small>{action.days} ДНЕЙ</small></header>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <div className="training-impact">
                  {action.skill && action.xp && <span><small>{SKILL_LABELS[action.skill]}</small><strong>прогресс +{action.xp}</strong></span>}
                  {action.form !== 0 && <span><small>Форма</small><strong>{signed(action.form)}</strong></span>}
                  {action.fatigue !== 0 && <span><small>Усталость</small><strong>{signed(action.fatigue)}</strong></span>}
                  {id === 'RECOVERY' && <span><small>Здоровье</small><strong>+6</strong></span>}
                  <span><small>Средства</small><strong>{action.cost < 0 ? `+${Math.abs(action.cost)}` : `−${action.cost}`} кр.</strong></span>
                </div>
                <footer>{unavailable ? 'НЕ ХВАТАЕТ СРЕДСТВ' : 'ВЫПОЛНИТЬ'}</footer>
              </button>
            );
          })}
        </div>
      </section>

      {career.livingWorld.news[0] && (
        <section className="world-signal-compact">
          <div><small>ПОСЛЕДНЯЯ НОВОСТЬ МИРА</small><strong>{career.livingWorld.news[0].headline}</strong><p>{career.livingWorld.news[0].summary}</p></div>
          <button onClick={onOpenWorld}>Открыть мир →</button>
        </section>
      )}
    </section>
  );
}
