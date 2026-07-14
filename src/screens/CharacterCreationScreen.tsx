import { useMemo, useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { SkillBars } from '../components/SkillBars';
import { ORIGINS } from '../core/career';
import { getEntryOrganizations } from '../core/ecosystem';
import type { CareerDraft, CareerEntryMode, OrganizationId, OriginId, WorldState } from '../core/types';

type Props = {
  world: WorldState;
  onBack: () => void;
  onCreate: (draft: CareerDraft) => void;
};

const originOrder: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];

export function CharacterCreationScreen({ world, onBack, onCreate }: Props) {
  const [name, setName] = useState('Алексей Ветров');
  const [age, setAge] = useState(20);
  const [originId, setOriginId] = useState<OriginId>('CLUB_SCHOOL');
  const organizations = useMemo(() => getEntryOrganizations(world), [world]);
  const [entryMode, setEntryMode] = useState<CareerEntryMode>('ORGANIZATION');
  const [organizationId, setOrganizationId] = useState<OrganizationId | null>(organizations[0]?.id ?? null);
  const origin = ORIGINS[originId];
  const initials = useMemo(() => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'AL', [name]);

  return (
    <ScreenShell onBack={onBack} rightLabel={`CAREER INTAKE / ${world.config.startYear}`}>
      <section className="character-page page-enter">
        <div className="character-intro">
          <p className="eyebrow">PERSONAL DOSSIER / 001</p>
          <h1>До первой вершины ты никто.</h1>
          <p className="lead">Выбери не класс, а прошлое. Оно определит, что ты уже умеешь и чего ещё не понимаешь.</p>

          <div className="identity-poster">
            <div className="identity-poster__grid" />
            <div className="identity-poster__initials">{initials}</div>
            <div className="identity-poster__ridge" />
            <div className="identity-poster__meta">
              <span>{world.region.name}</span>
              <span>{world.config.startYear}</span>
              <span>ONE LIFE</span>
            </div>
          </div>
        </div>

        <div className="character-form">
          <div className="character-fields">
            <label>
              <span className="field-label">Имя альпиниста</span>
              <input value={name} maxLength={34} onChange={event => setName(event.target.value)} />
            </label>
            <label>
              <span className="field-label">Возраст начала карьеры</span>
              <div className="age-control">
                <input type="range" min="18" max="29" value={age} onChange={event => setAge(Number(event.target.value))} />
                <strong>{age}</strong>
              </div>
              <small>Молодой герой быстрее восстанавливается, но почти ничего не доказал.</small>
            </label>
          </div>

          <div className="origin-section">
            <div className="origin-section__head">
              <div>
                <p className="eyebrow">ORIGIN / BACKGROUND</p>
                <h2>Откуда ты пришёл</h2>
              </div>
              <span>01 / 03</span>
            </div>

            <div className="origin-grid">
              {originOrder.map((id, index) => {
                const item = ORIGINS[id];
                return (
                  <button key={id} className={`origin-card ${originId === id ? 'is-active' : ''}`} onClick={() => setOriginId(id)}>
                    <span className="origin-card__index">0{index + 1}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </div>
                    <i />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="origin-detail">
            <div>
              <p className="eyebrow">{origin.signature}</p>
              <h3>{origin.title}</h3>
              <p>{origin.description}</p>
              <div className="origin-detail__ledger">
                <span>Стартовый капитал <strong>{origin.startingMoney} кр.</strong></span>
                <span>Физическая форма <strong>{origin.startingForm}/100</strong></span>
              </div>
            </div>
            <SkillBars skills={origin.skills} />
          </div>

          <div className="origin-section career-entry-section">
            <div className="origin-section__head"><div><p className="eyebrow">AFFILIATION / STARTING POSITION</p><h2>Где начнётся карьера</h2></div><span>НОВИЧОК</span></div>
            <div className="origin-grid">
              {organizations.map((item, index) => <button key={item.id} className={`origin-card ${entryMode === 'ORGANIZATION' && organizationId === item.id ? 'is-active' : ''}`} onClick={() => { setEntryMode('ORGANIZATION'); setOrganizationId(item.id); }}><span className="origin-card__index">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.headquarters} · {item.specialty}</small></div><i /></button>)}
              <button className={`origin-card ${entryMode === 'INDEPENDENT' ? 'is-active' : ''}`} onClick={() => { setEntryMode('INDEPENDENT'); setOrganizationId(null); }}><span className="origin-card__index">—</span><div><strong>Независимый путь</strong><small>Без клуба, команды и гарантированных мест в экспедициях</small></div><i /></button>
            </div>
            <p className="lead career-entry-note">{entryMode === 'INDEPENDENT' ? 'Доступны одиночные выходы. Все расходы и решения лежат на тебе.' : 'Ты начинаешь обычным участником. Маршрут, состав и общие приказы определяет руководитель экспедиции.'}</p>
          </div>

          <button
            className="primary-action character-submit"
            disabled={!name.trim()}
            onClick={() => onCreate({ name: name.trim(), age, originId, entryMode, organizationId: entryMode === 'ORGANIZATION' ? organizationId : null })}
          >
            <span>Начать карьеру</span><b>→</b>
          </button>
        </div>
      </section>
    </ScreenShell>
  );
}
