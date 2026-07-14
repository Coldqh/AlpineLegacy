import { useMemo, useState } from 'react';
import { ORIGINS, SKILL_LABELS } from '../core/career';
import type { CareerDraft, OriginId, WorldState } from '../core/types';
import { useScrollReset } from './useMobile';

const originOrder: OriginId[] = ['CLUB_SCHOOL', 'HIGHLAND_LOCAL', 'ROCK_SECTION'];

type Props = { world: WorldState; onBack: () => void; onCreate: (draft: CareerDraft) => void };

export function MobileCharacterCreation({ world, onBack, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Алексей Ветров');
  const [age, setAge] = useState(20);
  const [originId, setOriginId] = useState<OriginId>('CLUB_SCHOOL');
  const origin = ORIGINS[originId];
  const initials = useMemo(() => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'AL', [name]);
  useScrollReset(step);

  return (
    <main className="m-public-shell">
      <header className="m-public-topbar"><button onClick={step === 0 ? onBack : () => setStep(value => value - 1)}>←</button><strong>Новый герой</strong><span>{step + 1}/3</span></header>
      <section className="m-wizard">
        <div className="m-wizard-progress">{[0, 1, 2].map(index => <i key={index} className={index <= step ? 'is-active' : ''} />)}</div>
        {step === 0 && <>
          <p className="m-kicker">ЛИЧНОЕ ДЕЛО</p><h1>Кто ты</h1>
          <div className="m-identity-card"><span>{initials}</span><div><strong>{name || 'Без имени'}</strong><small>{world.region.name} · {world.config.startYear}</small></div></div>
          <label className="m-field"><span>Имя</span><input value={name} maxLength={34} onChange={event => setName(event.target.value)} /></label>
          <label className="m-field"><span>Возраст <b>{age}</b></span><input type="range" min="18" max="29" value={age} onChange={event => setAge(Number(event.target.value))} /></label>
          <p className="m-note">Молодой герой быстрее восстанавливается, но начинает без репутации.</p>
        </>}

        {step === 1 && <>
          <p className="m-kicker">ПРОИСХОЖДЕНИЕ</p><h1>Откуда ты</h1>
          <div className="m-option-list">{originOrder.map(id => { const item = ORIGINS[id]; return <button key={id} className={id === originId ? 'is-active' : ''} onClick={() => setOriginId(id)}><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><b>{id === originId ? '✓' : '○'}</b></button>; })}</div>
          <div className="m-origin-summary"><strong>{origin.signature}</strong><p>{origin.description}</p><div><span>{origin.startingMoney} кр.</span><span>Форма {origin.startingForm}</span></div></div>
        </>}

        {step === 2 && <>
          <p className="m-kicker">ПРОВЕРКА</p><h1>{name}</h1>
          <div className="m-review-card"><div><span>Возраст</span><strong>{age}</strong></div><div><span>Школа</span><strong>{origin.title}</strong></div><div><span>Деньги</span><strong>{origin.startingMoney} кр.</strong></div><div><span>Форма</span><strong>{origin.startingForm}</strong></div></div>
          <div className="m-skill-list">{Object.entries(origin.skills).map(([id, value]) => <div key={id}><span>{SKILL_LABELS[id as keyof typeof SKILL_LABELS]}</span><strong>{value}/10</strong><i><b style={{ width: `${Number(value) * 10}%` }} /></i></div>)}</div>
        </>}
      </section>
      <footer className="m-wizard-action"><button disabled={!name.trim()} onClick={() => step < 2 ? setStep(value => value + 1) : onCreate({ name: name.trim(), age, originId })}>{step < 2 ? 'Далее' : 'Вступить в клуб'}<b>→</b></button></footer>
    </main>
  );
}
