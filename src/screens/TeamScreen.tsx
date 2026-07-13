import { SKILL_LABELS, expeditionReadiness, getSelectedRoute, selectedTeam } from '../core/career';
import type { CareerState } from '../core/types';

type Props = { career: CareerState; onToggle: (memberId: string) => void; onContinue: () => void; onPeople: () => void };

const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;

export function TeamScreen({ career, onToggle, onContinue, onPeople }: Props) {
  const selected = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const route = getSelectedRoute(career);
  const enough = selected.length + 1 >= route.recommendedTeamSize;

  return (
    <section className="workspace-page team-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 2 ИЗ 4 · СОСТАВ</p><h1>Кто идёт.</h1><p>Выбирай людей под маршрут. Большая группа несёт больше груза, но движется медленнее и создаёт больше человеческих рисков.</p></div>
        <div className="workspace-title__mark"><span>{selected.length + 1}</span><small>В ГРУППЕ</small></div>
      </header>

      <section className={`decision-guide ${enough ? 'is-good' : 'is-warning'}`}>
        <strong>{enough ? 'Состав достаточный' : 'Нужен ещё участник'}</strong>
        <p>{route.name} рекомендует минимум {route.recommendedTeamSize} человек. Сейчас в группе {selected.length + 1}. Нажатие на карточку добавляет или убирает человека.</p>
      </section>

      <div className="team-summary-strip team-summary-strip--clear">
        <div><span>Командная готовность</span><strong>{readiness.team}/100</strong><small>Навыки, состояние и доверие</small></div>
        <div><span>Нужные роли</span><strong>{route.technicality >= 58 ? 'Скалы + лёд' : 'Связка + медицина'}</strong><small>Определяются маршрутом</small></div>
        <div><span>Лимит</span><strong>5 человек</strong><small>Включая героя</small></div>
        <button onClick={onPeople}><strong>Открыть досье</strong><small>Память, характер, отношения →</small></button>
      </div>

      <div className="team-grid team-grid--clear">
        <article className="team-card team-card--hero is-selected">
          <div className="team-card__portrait">{career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
          <small>ТЫ · ОБЯЗАТЕЛЬНО</small><h2>{career.hero.name}</h2><p>{career.hero.originTitle}. Управляешь собственными действиями и общим планом.</p>
          <div className="team-card__stats"><span>Форма <b>{Math.round(career.hero.form)}</b></span><span>Здоровье <b>{Math.round(career.hero.health)}</b></span></div>
        </article>
        {career.teamRoster.map(member => {
          const active = career.expeditionPlan.teamMemberIds.includes(member.id);
          const unavailable = member.status !== 'ACTIVE' || member.availability < 45;
          return (
            <button key={member.id} className={`team-card ${active ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}`} onClick={() => onToggle(member.id)} disabled={member.required || unavailable}>
              <div className="team-card__portrait">{member.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
              <small>{roleLabel[member.role]} · {unavailable ? member.status : member.required ? 'ОБЯЗАТЕЛЕН' : active ? 'В СОСТАВЕ' : 'НАЖМИ, ЧТОБЫ ДОБАВИТЬ'}</small>
              <h2>{member.name}</h2><p>{member.note}</p>
              <div className="team-card__specialty"><span>{SKILL_LABELS[member.specialty]}</span><strong>{member.skill}/10</strong></div>
              <div className="team-card__stats"><span>Доверие <b>{member.relationship.trust}</b></span><span>Состояние <b>{member.condition}</b></span></div>
              <i>{active ? 'В СОСТАВЕ' : member.temperament}</i>
            </button>
          );
        })}
      </div>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Собрать снаряжение</strong></span><b>→</b></button>
    </section>
  );
}
