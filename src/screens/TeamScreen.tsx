import { SKILL_LABELS, expeditionReadiness, getSelectedRoute, selectedTeam } from '../core/career';
import type { CareerState, PermanentTeamStyle } from '../core/types';

type Props = { career: CareerState; onToggle: (memberId: string) => void; onSavePermanent: () => void; onTeamStyle: (style: PermanentTeamStyle) => void; onUsePermanent: () => void; onContinue: () => void; onPeople: () => void };

const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;

export function TeamScreen({ career, onToggle, onSavePermanent, onTeamStyle, onUsePermanent, onContinue, onPeople }: Props) {
  const selected = selectedTeam(career);
  const readiness = expeditionReadiness(career);
  const route = getSelectedRoute(career);
  const canChoose = career.membership.permissions.canChooseTeam;
  const visibleRoster = canChoose ? career.teamRoster : career.teamRoster.filter(member => career.expeditionPlan.teamMemberIds.includes(member.id));
  const solo = career.membership.mode === 'INDEPENDENT' && selected.length === 0;
  const enough = solo || selected.length + 1 >= route.recommendedTeamSize;
  const permanentMembers = career.teamRoster.filter(member => career.permanentTeam.memberIds.includes(member.id));

  return (
    <section className="workspace-page team-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 2 ИЗ 4 · СОСТАВ</p><h1>{canChoose ? 'Кто идёт.' : 'Кто уже назначен.'}</h1><p>{canChoose ? 'Руководитель формирует связки и распределяет роли.' : 'Ты входишь в чужую экспедицию. Состав определён руководителем, а твоя роль ограничивает доступные решения.'}</p></div>
        <div className="workspace-title__mark"><span>{solo ? '1' : selected.length + 1}</span><small>В ГРУППЕ</small></div>
      </header>

      <section className={`decision-guide ${enough ? 'is-good' : 'is-warning'}`}>
        <strong>{solo ? 'Одиночный выход' : canChoose ? (enough ? 'Состав достаточный' : 'Нужен ещё участник') : `Твоя роль: ${roleLabel[career.expeditionPlan.playerRole]}`}</strong>
        <p>{canChoose ? `${route.name} рекомендует минимум ${route.recommendedTeamSize} человек.` : career.selectedOfferId ? 'Общие приказы отдаёт назначенный руководитель. Ты управляешь собственными действиями и можешь выполнять, оспаривать или нарушать приказ.' : 'Сначала прими место в доступной экспедиции.'}</p>
      </section>

      <div className="team-summary-strip team-summary-strip--clear">
        <div><span>Командная готовность</span><strong>{readiness.team}/100</strong><small>Навыки и состояние</small></div>
        <div><span>Полномочия</span><strong>{career.expeditionPlan.authorityMode === 'COMMAND' ? 'Командование' : 'Участник'}</strong><small>{career.membership.rank}</small></div>
        <div><span>Маршрут</span><strong>{route.name}</strong><small>{route.recommendedTeamSize}+ человек</small></div>
        <button onClick={onPeople}><strong>Открыть досье</strong><small>Люди и отношения →</small></button>
      </div>

      <section className="permanent-team-panel">
        <div className="permanent-team-panel__lead">
          <small>ПОСТОЯННАЯ СВЯЗКА</small>
          <h2>{career.permanentTeam.name}</h2>
          <p>{permanentMembers.length ? permanentMembers.map(member => member.name).join(' · ') : 'Пока состав не закреплён. Собери рабочую группу и сохрани её одним действием.'}</p>
        </div>
        <div className="permanent-team-panel__stats">
          <span><b>{career.permanentTeam.cohesion}</b><small>слаженность</small></span>
          <span><b>{career.permanentTeam.climbs}</b><small>выходы</small></span>
          <span><b>{career.permanentTeam.summits}</b><small>вершины</small></span>
          <span><b>{career.permanentTeam.losses}</b><small>потери</small></span>
        </div>
        {canChoose && <div className="permanent-team-panel__controls">
          <div className="permanent-team-style">
            {([['CAUTIOUS', 'Осторожная'], ['BALANCED', 'Рабочая'], ['AGGRESSIVE', 'Рисковая']] as Array<[PermanentTeamStyle, string]>).map(([style, label]) => <button key={style} className={career.permanentTeam.style === style ? 'is-active' : ''} onClick={() => onTeamStyle(style)}>{label}</button>)}
          </div>
          <button onClick={onSavePermanent} disabled={selected.length === 0}>Сохранить текущий состав</button>
          <button onClick={onUsePermanent} disabled={permanentMembers.length === 0}>Взять постоянную связку</button>
        </div>}
      </section>

      <div className="team-grid team-grid--clear">
        <article className="team-card team-card--hero is-selected">
          <div className="team-card__portrait">{career.hero.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
          <small>ТЫ · {roleLabel[career.expeditionPlan.playerRole]}</small><h2>{career.hero.name}</h2><p>{career.expeditionPlan.authorityMode === 'COMMAND' ? 'Управляешь личными действиями и всей экспедицией.' : 'Управляешь личными действиями. Общий план задаёт руководитель.'}</p>
          <div className="team-card__stats"><span>Форма <b>{Math.round(career.hero.form)}</b></span><span>Здоровье <b>{Math.round(career.hero.health)}</b></span></div>
        </article>
        {visibleRoster.map(member => {
          const active = career.expeditionPlan.teamMemberIds.includes(member.id);
          const unavailable = member.status !== 'ACTIVE' || member.availability < 45;
          const leader = career.expeditionPlan.leaderNpcId === member.id;
          return (
            <button key={member.id} className={`team-card ${active ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}`} onClick={() => onToggle(member.id)} disabled={!canChoose || member.required || unavailable}>
              <div className="team-card__portrait">{member.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</div>
              <small>{leader ? 'РУКОВОДИТЕЛЬ ЭКСПЕДИЦИИ' : roleLabel[member.role]} · {unavailable ? member.status : active ? 'В СОСТАВЕ' : 'ДОСТУПЕН'}</small>
              <h2>{member.name}</h2><p>{member.note}</p>
              <div className="team-card__specialty"><span>{SKILL_LABELS[member.specialty]}</span><strong>{member.skill}/10</strong></div>
              <div className="team-card__stats"><span>Доверие <b>{member.relationship.trust}</b></span><span>Состояние <b>{member.condition}</b></span></div>
              <i>{leader ? 'КОМАНДУЕТ' : active ? 'В СОСТАВЕ' : member.temperament}</i>
            </button>
          );
        })}
      </div>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Собрать снаряжение</strong></span><b>→</b></button>
    </section>
  );
}
