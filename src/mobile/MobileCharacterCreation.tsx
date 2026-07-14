import { useMemo, useState } from 'react';
import { ORIGINS, SKILL_LABELS } from '../core/career';
import { getEntryOrganizations } from '../core/ecosystem';
import type { CareerDraft, CareerEntryMode, OrganizationId, OriginId, WorldState } from '../core/types';
import { useScrollReset } from './useMobile';

const originOrder: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];
const kindLabel = { ALPINE_CLUB: 'Альпклуб', EXPEDITION_COMPANY: 'Экспедиционная компания', GUIDE_BUREAU: 'Бюро проводников' } as const;

type Props = { world: WorldState; onBack: () => void; onCreate: (draft: CareerDraft) => void };

export function MobileCharacterCreation({ world, onBack, onCreate }: Props) {
  const organizations = useMemo(() => getEntryOrganizations(world), [world]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Алексей Ветров');
  const [age, setAge] = useState(20);
  const [originId, setOriginId] = useState<OriginId>('CLUB_SCHOOL');
  const [entryMode, setEntryMode] = useState<CareerEntryMode>('ORGANIZATION');
  const [organizationId, setOrganizationId] = useState<OrganizationId | null>(organizations[0]?.id ?? null);
  const origin = ORIGINS[originId];
  const organization = organizations.find(item => item.id === organizationId) ?? organizations[0] ?? null;
  useScrollReset(step);

  const chooseOrganization = (id: OrganizationId) => {
    setEntryMode('ORGANIZATION');
    setOrganizationId(id);
  };

  const finish = () => onCreate({ name: name.trim(), age, originId, entryMode, organizationId: entryMode === 'ORGANIZATION' ? organizationId : null });

  return (
    <main className="m-public-shell">
      <header className="m-public-topbar"><button onClick={step === 0 ? onBack : () => setStep(value => value - 1)}>←</button><strong>Новый герой</strong><span>{step + 1}/4</span></header>
      <section className="m-wizard">
        <div className="m-wizard-progress">{[0, 1, 2, 3].map(index => <i key={index} className={index <= step ? 'is-active' : ''} />)}</div>
        {step === 0 && <><h1>Кто ты</h1><label className="m-field"><span>Имя</span><input value={name} maxLength={34} onChange={event => setName(event.target.value)} /></label><label className="m-field"><span>Возраст <b>{age}</b></span><input type="range" min="18" max="29" value={age} onChange={event => setAge(Number(event.target.value))} /></label><div className="m-inline-meta"><span>{world.region.name}</span><span>{world.config.startYear}</span></div></>}

        {step === 1 && <><h1>Происхождение</h1><div className="m-option-list">{originOrder.map(id => { const item = ORIGINS[id]; return <button key={id} className={id === originId ? 'is-active' : ''} onClick={() => setOriginId(id)}><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><b>{id === originId ? '✓' : '○'}</b></button>; })}</div><div className="m-origin-summary"><strong>{origin.signature}</strong><div><span>{origin.startingMoney} кр.</span><span>Форма {origin.startingForm}</span></div></div></>}

        {step === 2 && <><h1>Где начать</h1><div className="m-option-list m-entry-list">{organizations.map(item => <button key={item.id} className={entryMode === 'ORGANIZATION' && organizationId === item.id ? 'is-active' : ''} onClick={() => chooseOrganization(item.id)}><span><strong>{item.name}</strong><small>{kindLabel[item.kind]} · {item.headquarters} · {item.specialty}</small></span><b>{entryMode === 'ORGANIZATION' && organizationId === item.id ? '✓' : '○'}</b></button>)}<button className={entryMode === 'INDEPENDENT' ? 'is-active' : ''} onClick={() => { setEntryMode('INDEPENDENT'); setOrganizationId(null); }}><span><strong>Независимый путь</strong><small>Без клуба, постоянной команды и гарантированных приглашений. Доступны одиночные выходы.</small></span><b>{entryMode === 'INDEPENDENT' ? '✓' : '○'}</b></button></div></>}

        {step === 3 && <><h1>{name}</h1><div className="m-review-card"><div><span>Возраст</span><strong>{age}</strong></div><div><span>Школа</span><strong>{origin.title}</strong></div><div><span>Старт</span><strong>{entryMode === 'INDEPENDENT' ? 'Соло' : 'Новичок'}</strong></div><div><span>Организация</span><strong>{entryMode === 'INDEPENDENT' ? 'Нет' : organization?.name ?? 'Не выбрана'}</strong></div></div><details className="m-details"><summary>Навыки</summary><div className="m-skill-list">{Object.entries(origin.skills).map(([id, value]) => <div key={id}><span>{SKILL_LABELS[id as keyof typeof SKILL_LABELS]}</span><strong>{value}/10</strong><i><b style={{ width: `${Number(value) * 10}%` }} /></i></div>)}</div></details><div className="m-note">{entryMode === 'INDEPENDENT' ? 'Ты начинаешь без группы. Сам выбираешь доступные одиночные маршруты и отвечаешь за весь риск.' : 'Ты входишь как новичок. Сначала подаёшься в чужие экспедиции и выполняешь роль, назначенную руководителем.'}</div></>}
      </section>
      <footer className="m-wizard-action"><button disabled={!name.trim() || (step === 3 && entryMode === 'ORGANIZATION' && !organizationId)} onClick={() => step < 3 ? setStep(value => value + 1) : finish()}>{step < 3 ? 'Далее' : 'Начать карьеру'}<b>→</b></button></footer>
    </main>
  );
}
