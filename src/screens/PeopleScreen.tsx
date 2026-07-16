import { useMemo, useState } from 'react';
import { SKILL_LABELS } from '../core/career';
import { SkillBars } from '../components/SkillBars';
import type { CareerState, TeamMember } from '../core/types';

type Props = { career: CareerState };

const roleLabel = { LEADER: 'Руководитель', ROPE_LEAD: 'Ведущий', MEDIC: 'Медик', NAVIGATOR: 'Навигатор', SUPPORT: 'Участник' } as const;
const statusLabel = { ACTIVE: 'АКТИВЕН', INJURED: 'ВОССТАНОВЛЕНИЕ', LEFT: 'УШЁЛ', RETIRED: 'ЗАВЕРШИЛ', DEAD: 'ПОГИБ' } as const;

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function relationName(member: TeamMember) {
  const { bond, rivalry, resentment, trust } = member.relationship;
  if (member.status === 'DEAD') return 'Память';
  if (resentment > 45) return 'Конфликт';
  if (rivalry > 55) return 'Соперник';
  if (bond > 55 && trust > 60) return 'Близкий напарник';
  if (trust > 65) return 'Надёжный партнёр';
  if (trust < 35) return 'Не доверяет';
  return 'Знакомый по клубу';
}

function Meter({ label, value }: { label: string; value: number }) {
  return <div className="person-meter"><span>{label}</span><strong>{Math.round(value)}</strong><i style={{ '--value': `${value}%` } as React.CSSProperties} /></div>;
}

export function PeopleScreen({ career }: Props) {
  const firstAvailable = career.teamRoster[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(firstAvailable);
  const selected = useMemo(() => career.teamRoster.find(member => member.id === selectedId) ?? career.teamRoster[0], [career.teamRoster, selectedId]);
  const worldAthlete = selected ? career.livingWorld.athletes.find(athlete => athlete.id === selected.id) : undefined;
  const lastExpedition = selected ? [...career.livingWorld.expeditions].reverse().find(item => item.leaderAthleteId === selected.id || item.memberAthleteIds.includes(selected.id)) : undefined;

  if (!selected) return null;

  return (
    <section className="workspace-page people-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">HUMAN ARCHIVE / LONG MEMORY</p><h1>Люди</h1><p>Не состав на один выход, а те, кто помнит твои решения, спорит с тобой и несёт последствия дальше.</p></div>
        <div className="workspace-title__mark"><span>{career.teamRoster.filter(member => member.isMentor).length}</span><small>НАСТАВНИКА</small></div>
      </header>

      <div className="people-layout">
        <aside className="people-index workspace-panel">
          <div className="panel-heading"><div><p className="eyebrow">CLUB ROSTER</p><h2>{career.club.name}</h2></div><span>{career.teamRoster.length} PERSONS</span></div>
          <div className="people-list">
            {career.teamRoster.map(member => (
              <button key={member.id} className={selected.id === member.id ? 'is-active' : ''} onClick={() => setSelectedId(member.id)}>
                <span className="people-list__portrait">{initials(member.name)}</span>
                <span><small>{member.isMentor ? 'НАСТАВНИК · ' : ''}{roleLabel[member.role]} · {statusLabel[member.status]}</small><strong>{member.name}</strong><em>{relationName(member)}</em></span>
                <b>{member.relationship.trust}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="person-file workspace-panel">
          <div className="person-file__hero">
            <div className="person-file__portrait">{initials(selected.name)}</div>
            <div><p className="eyebrow">{selected.isMentor ? 'MENTOR FILE' : 'PERSON FILE'} / {selected.id.toUpperCase()}</p><h2>{selected.name}</h2><p>{selected.age} лет · {selected.isMentor ? 'наставник · ' : ''}{roleLabel[selected.role]} · {SKILL_LABELS[selected.specialty]} {selected.skill}/10</p></div>
            <div className={`person-status is-${selected.status.toLowerCase()}`}>{statusLabel[selected.status]}</div>
          </div>

          <div className="person-core-grid">
            <div><small>ХАРАКТЕР</small><strong>{selected.temperament}</strong><p>{selected.note}</p></div>
            {selected.isMentor && <div><small>ПРОФИЛЬ НАСТАВНИКА</small><strong>{selected.mentorLevel === 'HEAD' ? 'Главный инструктор' : selected.mentorLevel === 'SENIOR' ? 'Старший наставник' : 'Инструктор'}</strong><p>{selected.routePreference === 'EASY' ? 'Ведёт учебные и надёжные маршруты.' : selected.routePreference === 'HARD' ? 'Берёт сложные технические цели.' : 'Чередует учебные и серьёзные маршруты.'}</p></div>}
            <div><small>ЛИЧНАЯ ЦЕЛЬ</small><strong>{selected.personalGoal}</strong><p>Цель влияет на отношение к риску, приказам и чужому успеху.</p></div>
            <div><small>СОСТОЯНИЕ</small><strong>{Math.round(worldAthlete?.condition ?? selected.condition)}/100</strong><p>{worldAthlete?.recoveryDays ? `Восстановление ещё ${worldAthlete.recoveryDays} дн. · усталость ${Math.round(worldAthlete.fatigue)}` : selected.injuries.length ? selected.injuries.join(' · ') : 'Готов к следующему выходу.'}</p></div>
            <div><small>ОБЩАЯ ИСТОРИЯ</small><strong>{worldAthlete?.expeditionCount ?? selected.sharedClimbs} выходов</strong><p>{worldAthlete?.summits ?? selected.summits} вершин · {selected.rescues} спасательных эпизодов · {selected.refusals} отказов.</p></div>
            <div><small>ПОСЛЕДНИЙ МАРШРУТ</small><strong>{lastExpedition?.routeName ?? 'Нет данных'}</strong><p>{lastExpedition ? `${lastExpedition.mountainName} · группа ${lastExpedition.teamSize} чел. · ${lastExpedition.durationDays} дн.` : worldAthlete?.lastEvent ?? 'Ещё не выходил в самостоятельную экспедицию.'}</p></div>
          </div>

          <div className="person-section-title"><p className="eyebrow">ALPINIST SKILLS</p><h3>Индивидуальные навыки</h3></div>
          <SkillBars skills={selected.skills} compact />

          <div className="person-section-title"><p className="eyebrow">RELATIONSHIP WITH PLAYER</p><h3>{relationName(selected)}</h3></div>
          <div className="relationship-grid">
            <Meter label="Доверие" value={selected.relationship.trust} />
            <Meter label="Уважение" value={selected.relationship.respect} />
            <Meter label="Связь" value={selected.relationship.bond} />
            <Meter label="Соперничество" value={selected.relationship.rivalry} />
            <Meter label="Обида" value={selected.relationship.resentment} />
            <Meter label="Долг" value={selected.relationship.debt} />
          </div>

          <div className="person-section-title"><p className="eyebrow">PERSONALITY PROFILE</p><h3>Как он принимает решения</h3></div>
          <div className="personality-grid">
            <Meter label="Осторожность" value={selected.personality.caution} />
            <Meter label="Амбиции" value={selected.personality.ambition} />
            <Meter label="Дисциплина" value={selected.personality.discipline} />
            <Meter label="Верность" value={selected.personality.loyalty} />
            <Meter label="Эмпатия" value={selected.personality.empathy} />
            <Meter label="Эго" value={selected.personality.ego} />
          </div>

          <div className="person-section-title"><p className="eyebrow">MEMORY LEDGER</p><h3>Что он помнит</h3></div>
          <div className="memory-ledger">
            {[...selected.memories].reverse().map((entry, index) => (
              <article key={entry.id}>
                <span>{String(selected.memories.length - index).padStart(2, '0')}</span>
                <i />
                <div><small>{entry.year} · DAY {entry.seasonDay} · {entry.type}</small><h4>{entry.title}</h4><p>{entry.description}</p><em>{entry.trustDelta >= 0 ? '+' : ''}{entry.trustDelta} trust · {entry.respectDelta >= 0 ? '+' : ''}{entry.respectDelta} respect · {entry.resentmentDelta >= 0 ? '+' : ''}{entry.resentmentDelta} resentment</em></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
