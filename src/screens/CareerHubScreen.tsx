import { MountainArt } from '../components/MountainArt';
import { ScreenShell } from '../components/ScreenShell';
import { SkillBars } from '../components/SkillBars';
import { TRAINING_ACTIONS, careerReadiness, formatSeasonDate, getQualificationTarget } from '../core/career';
import type { CareerState, TrainingId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  career: CareerState;
  onBack: () => void;
  onTrain: (trainingId: TrainingId) => void;
  onStartClimb: () => void;
  onOpenAtlas: () => void;
};

const trainingOrder: TrainingId[] = ['CONDITIONING', 'ROCK_PRACTICE', 'ICE_PRACTICE', 'MAP_ROOM', 'FIRST_AID', 'CLUB_DUTY', 'RECOVERY'];

export function CareerHubScreen({ world, career, onBack, onTrain, onStartClimb, onOpenAtlas }: Props) {
  const target = getQualificationTarget(world);
  const mountain = target.mountain;
  const readiness = careerReadiness(career);
  const qualificationPassed = career.completedClimbs > 0;

  return (
    <ScreenShell onBack={onBack} rightLabel={`${formatSeasonDate(career.year, career.seasonDay)} / WEEK ${String(career.week).padStart(2, '0')}`} onPrint={() => window.print()}>
      <section className="career-page page-enter">
        <header className="career-hero">
          <div className="career-hero__copy">
            <p className="eyebrow">ACTIVE CAREER / {career.hero.originTitle}</p>
            <h1>{career.hero.name}</h1>
            <p>{career.hero.age} лет · {career.club.name} · {career.club.town}</p>
          </div>
          <div className="career-hero__mark">
            <span>{career.completedClimbs}</span>
            <small>ЗАСЧИТАННЫХ<br />ВОСХОЖДЕНИЙ</small>
          </div>
        </header>

        <div className="career-poster">
          <MountainArt points={mountain.profilePoints} variant="hero" label={mountain.name} elevation={mountain.elevation} />
          <div className="career-poster__overlay">
            <span>OBJECTIVE 001</span>
            <strong>{qualificationPassed ? 'КВАЛИФИКАЦИЯ ПРОЙДЕНА' : 'ДОПУСК К САМОСТОЯТЕЛЬНЫМ МАРШРУТАМ'}</strong>
          </div>
        </div>

        <div className="career-metrics">
          <div><span>Готовность</span><strong>{readiness}</strong><i style={{ '--value': `${readiness}%` } as React.CSSProperties} /></div>
          <div><span>Форма</span><strong>{Math.round(career.hero.form)}</strong><i style={{ '--value': `${career.hero.form}%` } as React.CSSProperties} /></div>
          <div><span>Усталость</span><strong>{Math.round(career.hero.fatigue)}</strong><i style={{ '--value': `${career.hero.fatigue}%` } as React.CSSProperties} /></div>
          <div><span>Здоровье</span><strong>{Math.round(career.hero.health)}</strong><i style={{ '--value': `${career.hero.health}%` } as React.CSSProperties} /></div>
          <div><span>Репутация</span><strong>{career.hero.reputation}</strong><i style={{ '--value': `${Math.min(100, career.hero.reputation * 4)}%` } as React.CSSProperties} /></div>
          <div><span>Средства</span><strong>{career.hero.money} кр.</strong><i style={{ '--value': `${Math.min(100, career.hero.money / 7)}%` } as React.CSSProperties} /></div>
        </div>

        <div className="career-main-grid">
          <section className="career-section career-section--skills">
            <div className="career-section__title">
              <div><p className="eyebrow">PERSONAL CAPABILITY</p><h2>Навыки</h2></div>
              <span>MAX 10</span>
            </div>
            <SkillBars skills={career.hero.skills} xp={career.hero.skillXp} />
            <div className="club-card">
              <div className="club-card__number">AL<br />{String(career.club.foundedYear).slice(-2)}</div>
              <div>
                <p className="eyebrow">YOUR CLUB</p>
                <h3>{career.club.name}</h3>
                <p>{career.club.specialty}. Уровень клуба: {career.club.standing}/100.</p>
                <small>{career.club.mentors.map(mentor => mentor.name).join(' · ') || `${career.club.mentorName} · ${career.club.mentorTitle}`}</small>
              </div>
            </div>
          </section>

          <section className="career-section career-section--objective">
            <div className="career-section__title">
              <div><p className="eyebrow">CURRENT OBJECTIVE</p><h2>{qualificationPassed ? 'Первый результат' : 'Квалификация'}</h2></div>
              <span>{target.summitElevation} M</span>
            </div>

            <article className="objective-card">
              <div className="objective-card__top">
                <span>{world.region.name}</span>
                <span>{qualificationPassed ? 'RECORDED' : readiness >= 58 ? 'AVAILABLE' : 'PREPARE'}</span>
              </div>
              <h3>{target.displayName}</h3>
              <p>{qualificationPassed
                ? `Ты уже вернулся с вершины. Клуб готовит следующие маршруты и первые самостоятельные связки.`
                : `Клубный маршрут проходит всю гору и заканчивается только после возвращения связки. Инструктор оценивает темп, технику и решения на спуске.`}
              </p>
              <div className="objective-data">
                <span><small>НАБОР</small><strong>≈ {target.summitElevation - target.startElevation} м</strong></span>
                <span><small>УЧАСТКИ</small><strong>5 + спуск</strong></span>
                <span><small>РИСК</small><strong>Учебный</strong></span>
              </div>
              {!qualificationPassed && (
                <button className="objective-launch" disabled={readiness < 58 || career.hero.fatigue > 72} onClick={onStartClimb}>
                  <span>{readiness < 58 ? 'Готовность ниже 58' : career.hero.fatigue > 72 ? 'Слишком высокая усталость' : 'Начать восхождение'}</span>
                  <b>→</b>
                </button>
              )}
              {qualificationPassed && <button className="objective-launch" onClick={onOpenAtlas}><span>Открыть горный атлас</span><b>→</b></button>}
            </article>

            <div className="calendar-panel">
              <p className="eyebrow">SEASON CALENDAR / {career.year}</p>
              {career.calendar.map((entry) => {
                const isPast = entry.day < career.seasonDay;
                const isCurrent = Math.abs(entry.day - career.seasonDay) <= 5;
                return (
                  <div key={entry.id} className={`${isPast ? 'is-past' : ''} ${isCurrent ? 'is-current' : ''}`}>
                    <span>{String(entry.day).padStart(3, '0')}</span>
                    <i />
                    <p><strong>{entry.title}</strong><small>{entry.note}</small></p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="training-section">
          <div className="career-section__title">
            <div><p className="eyebrow">WEEKLY ACTIONS</p><h2>Подготовка</h2></div>
            <span>ВРЕМЯ ДВИЖЕТСЯ ВПЕРЁД</span>
          </div>
          <div className="training-grid">
            {trainingOrder.map((id, index) => {
              const action = TRAINING_ACTIONS[id];
              const unavailable = action.cost > 0 && career.hero.money < action.cost;
              return (
                <button key={id} disabled={unavailable} className="training-card" onClick={() => onTrain(id)}>
                  <span className="training-card__index">{String(index + 1).padStart(2, '0')}</span>
                  <small>{action.label}</small>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                  <div>
                    <span>{action.days} ДНЕЙ</span>
                    <strong>{action.cost < 0 ? `+${Math.abs(action.cost)}` : `−${action.cost}`} КР.</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="career-log">
          <div className="career-section__title">
            <div><p className="eyebrow">FIELD JOURNAL</p><h2>Последние записи</h2></div>
            <span>{career.log.length.toString().padStart(2, '0')} TOTAL</span>
          </div>
          {[...career.log].reverse().slice(0, 6).map((entry) => (
            <article key={entry.id}>
              <span>{String(entry.seasonDay).padStart(3, '0')}</span>
              <div><small>{entry.type}</small><h3>{entry.title}</h3><p>{entry.description}</p></div>
            </article>
          ))}
        </section>
      </section>
    </ScreenShell>
  );
}
