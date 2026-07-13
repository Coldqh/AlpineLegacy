import { SKILL_LABELS, expeditionReadiness, selectedTeam } from '../core/career';
import type { CareerState } from '../core/types';

type Props = { career: CareerState; onToggle: (memberId: string) => void };

const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;

export function TeamScreen({ career, onToggle }: Props) {
  const selected = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  return (
    <section className="workspace-page team-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">EXPEDITION ROSTER / HUMAN FACTOR</p><h1>Команда</h1><p>Ты отдаёшь приказы, но не управляешь людьми напрямую. Сейчас выбирается состав, который выйдет на маршрут.</p></div>
        <div className="workspace-title__mark"><span>{selected.length + 1}</span><small>В ГРУППЕ</small></div>
      </header>

      <div className="team-summary-strip">
        <div><span>Командная готовность</span><strong>{readiness.team}/100</strong></div>
        <div><span>Твой статус</span><strong>Младший участник</strong></div>
        <div><span>Лимит состава</span><strong>5 человек</strong></div>
      </div>

      <div className="team-grid">
        <article className="team-card team-card--hero is-selected">
          <div className="team-card__portrait">{career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
          <small>PLAYER CHARACTER / FIXED</small><h2>{career.hero.name}</h2><p>{career.hero.originTitle}. Ты принимаешь решения только за себя и общий план.</p>
          <div className="team-card__stats"><span>ФОРМА <b>{Math.round(career.hero.form)}</b></span><span>ЗДОРОВЬЕ <b>{Math.round(career.hero.health)}</b></span></div>
        </article>
        {career.teamRoster.map(member => {
          const active = career.expeditionPlan.teamMemberIds.includes(member.id);
          const unavailable = member.status !== 'ACTIVE' || member.availability < 45;
          return (
            <button key={member.id} className={`team-card ${active ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}`} onClick={() => onToggle(member.id)} disabled={member.required || unavailable}>
              <div className="team-card__portrait">{member.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
              <small>{roleLabel[member.role]} · {unavailable ? member.status : member.required ? 'ОБЯЗАТЕЛЕН' : active ? 'В СОСТАВЕ' : 'РЕЗЕРВ'}</small>
              <h2>{member.name}</h2><p>{member.note}</p>
              <div className="team-card__specialty"><span>{SKILL_LABELS[member.specialty]}</span><strong>{member.skill}/10</strong></div>
              <div className="team-card__stats"><span>ДОВЕРИЕ <b>{member.relationship.trust}</b></span><span>СОСТОЯНИЕ <b>{member.condition}</b></span></div><small className="team-card__goal">ЦЕЛЬ · {member.personalGoal}</small>
              <i>{member.temperament}</i>
            </button>
          );
        })}
      </div>
    </section>
  );
}
