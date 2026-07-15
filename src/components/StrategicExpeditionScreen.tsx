import { useEffect, useMemo, useState } from 'react';
import { ExpeditionHeightScale } from './ExpeditionHeightScale';
import {
  currentStrategicSector,
  defaultStrategicPlan,
  getStrategicLeaderPlan,
  previewStrategicPlan,
} from '../core/strategicEngine';
import type {
  CareerState,
  ClimbStepResult,
  DifficultyId,
  StrategicFocusId,
  StrategicFormationId,
  StrategicPaceId,
  StrategicPositionId,
  StrategicProtectionId,
  StrategicRestId,
  StrategicSectorPlan,
} from '../core/types';

type Props = {
  career: CareerState;
  difficulty: DifficultyId;
  mobile?: boolean;
  onResolve: (plan: StrategicSectorPlan) => ClimbStepResult;
  onRest: (choice: StrategicRestId) => ClimbStepResult;
  onBeginDescent: () => void;
  onRetreat: () => void;
};

const paceOptions: Array<{ id: StrategicPaceId; title: string; note: string }> = [
  { id: 'CONSERVE', title: 'Беречь силы', note: 'Медленнее; меньше расход.' },
  { id: 'WORK', title: 'Рабочий темп', note: 'Ровная нагрузка.' },
  { id: 'PUSH', title: 'Форсировать', note: 'Быстрее; высокий расход.' },
];
const protectionOptions: Array<{ id: StrategicProtectionId; title: string; note: string }> = [
  { id: 'LIGHT', title: 'Минимум', note: '0 м верёвки; мало запаса.' },
  { id: 'STANDARD', title: 'Рабочая', note: '2 м резерва; баланс.' },
  { id: 'FULL', title: 'Полная', note: '6 м резерва; больше времени.' },
];
const formationOptions: Array<{ id: StrategicFormationId; title: string; note: string }> = [
  { id: 'COMPACT', title: 'Плотно', note: 'Связь лучше; нагрузка вместе.' },
  { id: 'BALANCED', title: 'Обычно', note: 'Стандартная дистанция.' },
  { id: 'SPREAD', title: 'Растянуть', note: 'Меньше общей нагрузки.' },
];
const focusOptions: Array<{ id: StrategicFocusId; title: string; note: string }> = [
  { id: 'FOLLOW', title: 'Выполнить', note: 'Точно держать план лидера.' },
  { id: 'VERIFY', title: 'Перепроверить', note: 'Искать слабое место решения.' },
  { id: 'SUPPORT', title: 'Следить за группой', note: 'Отдать силы слабым.' },
  { id: 'CHALLENGE', title: 'Возразить', note: 'Потребовать изменить плохой план.' },
];
const positionOptions: Array<{ id: StrategicPositionId; title: string; note: string }> = [
  { id: 'FRONT', title: 'Впереди', note: 'Чтение линии и первая нагрузка.' },
  { id: 'MIDDLE', title: 'В центре', note: 'Связь с обеими частями группы.' },
  { id: 'REAR', title: 'Сзади', note: 'Контроль отстающих и груза.' },
];

function durationLabel(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return `${days ? `${days} д ` : ''}${hours} ч ${String(rest).padStart(2, '0')} мин`;
}

function SelectRow<T extends string>({ title, value, options, onChange }: { title: string; value: T; options: Array<{ id: T; title: string; note: string }>; onChange: (value: T) => void }) {
  return <section className="strategy-choice-row"><header><small>{title}</small></header><div>{options.map(option => <button key={option.id} className={value === option.id ? 'is-active' : ''} onClick={() => onChange(option.id)}><strong>{option.title}</strong><span>{option.note}</span></button>)}</div></section>;
}

export function StrategicExpeditionScreen({ career, difficulty, mobile = false, onResolve, onRest, onBeginDescent, onRetreat }: Props) {
  const climb = career.activeClimb!;
  const strategic = climb.strategic!;
  const sector = currentStrategicSector(career);
  const [plan, setPlan] = useState<StrategicSectorPlan>(() => defaultStrategicPlan());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlan(defaultStrategicPlan());
    setFeedback(null);
    setTouched(new Set());
  }, [sector?.id, strategic.status, strategic.direction]);

  const preview = useMemo(() => sector && strategic.status === 'ACTIVE' ? previewStrategicPlan(career, plan) : null, [career, plan, sector, strategic.status]);
  const leaderPlan = getStrategicLeaderPlan(career);
  const sectors = strategic.direction === 'ASCENT' ? strategic.ascentSectors : strategic.descentSectors;
  const authority = climb.authorityMode === 'COMMAND';
  const remaining = strategic.direction === 'ASCENT' ? Math.max(0, climb.summitElevation - climb.currentElevation) : Math.max(0, climb.currentElevation - climb.startElevation);

  async function resolve(action: () => ClimbStepResult) {
    if (busy) return;
    setBusy(true);
    await new Promise<void>(done => requestAnimationFrame(() => done()));
    try {
      const result = action();
      setFeedback({ headline: result.headline, detail: result.detail, severity: result.severity });
    } finally {
      requestAnimationFrame(() => setBusy(false));
    }
  }

  if (strategic.status === 'SUMMIT') {
    return <section className={`strategic-expedition strategic-summit ${mobile ? 'is-mobile' : ''}`}>
      <p className="eyebrow">ВЕРШИНА · ВОЗВРАЩЕНИЕ ОБЯЗАТЕЛЬНО</p>
      <h1>{climb.mountainName}</h1>
      <ExpeditionHeightScale climb={climb} />
      <div className="strategy-summary-metrics"><span>Время <b>{durationLabel(climb.elapsedMinutes)}</b></span><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>План <b>{durationLabel(strategic.baselineMinutes)}</b></span></div>
      <p>Подъём закончен. Внизу {strategic.descentSectors.length} крупных участков, которые требуют отдельного плана.</p>
      <button className="strategy-execute" onClick={onBeginDescent}>Начать планирование спуска <b>↓</b></button>
    </section>;
  }

  if (strategic.status === 'REST_REQUIRED') {
    return <section className={`strategic-expedition strategic-rest ${mobile ? 'is-mobile' : ''}`}>
      <header><p className="eyebrow">ОСТАНОВКА МЕЖДУ УЧАСТКАМИ</p><h1>{authority ? 'Реши, как восстановить группу.' : 'Руководитель остановил экспедицию.'}</h1><p>{strategic.restReason}</p></header>
      <ExpeditionHeightScale climb={climb} />
      <div className="strategy-summary-metrics"><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Без сна <b>{Math.round(climb.hoursAwake)} ч</b></span><span>Топливо <b>{climb.supplies.fuelUnits}</b></span></div>
      <div className="strategy-rest-options">
        <button disabled={busy} onClick={() => void resolve(() => onRest('CONTINUE'))}><strong>{authority ? 'Продолжить без сна' : 'Остаться в движении'}</strong><span>20 мин · резерв не вернётся · следующий участок станет тяжелее</span></button>
        <button disabled={busy || climb.supplies.fuelUnits < 1} onClick={() => void resolve(() => onRest('BIVY'))}><strong>{authority ? 'Короткий бивак' : 'Короткий сон'}</strong><span>4 ч · топливо −1 · частичное восстановление</span></button>
        <button disabled={busy || climb.supplies.fuelUnits < 2} onClick={() => void resolve(() => onRest('CAMP'))}><strong>{authority ? 'Полный лагерь' : 'Лагерная работа и сон'}</strong><span>7 ч · топливо −2 · полный рабочий резерв</span></button>
      </div>
      {feedback && <div className={`strategy-feedback is-${feedback.severity.toLowerCase()}`}><strong>{feedback.headline}</strong><span>{feedback.detail}</span></div>}
    </section>;
  }

  if (!sector) return null;

  const update = <K extends keyof StrategicSectorPlan>(key: K, value: StrategicSectorPlan[K]) => {
    setPlan(current => ({ ...current, [key]: value }));
    setTouched(current => new Set([...current, key]));
  };
  const requiredChoices = authority ? ['line', 'pace', 'protection', 'formation'] : ['position', 'pace', 'focus'];
  const planReady = requiredChoices.every(key => touched.has(key));
  return <section className={`strategic-expedition ${mobile ? 'is-mobile' : ''}`}>
    <header className="strategy-head"><div><p className="eyebrow">{strategic.direction === 'ASCENT' ? 'ПОДЪЁМ' : climb.retreating ? 'ОТХОД' : 'СПУСК'} · УЧАСТОК {strategic.sectorIndex + 1}/{sectors.length}</p><h1>{sector.label}</h1><span>{sector.terrain}</span></div><div><strong>{climb.currentElevation} м</strong><small>осталось {remaining} м</small></div></header>
    <ExpeditionHeightScale climb={climb} />

    <div className="strategy-summary-metrics"><span>Время <b>{durationLabel(climb.elapsedMinutes)}</b></span><span>План маршрута <b>{durationLabel(strategic.baselineMinutes)}</b></span><span>Силы <b>{Math.round(climb.energy)}%</b></span><span>Группа <b>{Math.round(climb.teamCondition)}%</b></span></div>

    {strategic.lastResult && <section className={`strategy-last-result is-${strategic.lastResult.outcome.toLowerCase()}`}><small>ПРЕДЫДУЩИЙ УЧАСТОК</small><strong>{strategic.lastResult.title}</strong><p>{strategic.lastResult.summary}</p><details><summary>Почему так вышло</summary>{strategic.lastResult.causes.map(cause => <span key={cause}>— {cause}</span>)}</details></section>}

    <section className="strategy-sector-brief"><header><div><small>ЧТО ИЗВЕСТНО</small><h2>{sector.hazard}</h2></div><b>{sector.startElevation} → {sector.endElevation} м</b></header><div className="strategy-facts">{sector.visibleFacts.map(fact => <p key={fact}>{fact}</p>)}</div>{sector.attempts > 0 && <p className="strategy-revealed">После первой попытки ясно: {sector.hiddenHazard}</p>}</section>

    {authority ? <div className="strategy-plan-builder">
      <SelectRow title="ЛИНИЯ" value={plan.line} options={sector.lineOptions.map(option => ({ id: option.id, title: option.title, note: option.description }))} onChange={value => update('line', value)} />
      <SelectRow title="ТЕМП" value={plan.pace} options={paceOptions} onChange={value => update('pace', value)} />
      <SelectRow title="СТРАХОВКА" value={plan.protection} options={protectionOptions} onChange={value => update('protection', value)} />
      <SelectRow title="ПОРЯДОК ГРУППЫ" value={plan.formation} options={formationOptions} onChange={value => update('formation', value)} />
    </div> : <div className="strategy-participant-plan">
      <section className="strategy-leader-plan"><small>ПЛАН РУКОВОДИТЕЛЯ</small><h2>{leaderPlan?.line === 'DIRECT' ? 'Короткая линия' : leaderPlan?.line === 'SHELTERED' ? 'Защищённый обход' : 'Техническая линия'}</h2><p>{leaderPlan?.pace === 'PUSH' ? 'Форсировать участок' : leaderPlan?.pace === 'CONSERVE' ? 'Беречь силы' : 'Рабочий темп'} · {leaderPlan?.protection === 'FULL' ? 'полная страховка' : leaderPlan?.protection === 'STANDARD' ? 'рабочая страховка' : 'минимальная страховка'} · {leaderPlan?.formation === 'SPREAD' ? 'растянутая группа' : leaderPlan?.formation === 'COMPACT' ? 'плотная группа' : 'обычная дистанция'}</p></section>
      <SelectRow title="ТВОЯ ПОЗИЦИЯ" value={plan.position} options={positionOptions} onChange={value => update('position', value)} />
      <SelectRow title="ТВОЯ НАГРУЗКА" value={plan.pace} options={paceOptions} onChange={value => update('pace', value)} />
      <SelectRow title="ТВОЁ РЕШЕНИЕ" value={plan.focus} options={focusOptions} onChange={value => update('focus', value)} />
    </div>}

    {preview && <section className="strategy-preview"><header><small>ОЦЕНКА ДО ВЫХОДА</small><strong>{durationLabel(preview.timeMin)}–{durationLabel(preview.timeMax)}</strong></header><div><span>Расход сил <b>{preview.energyMin}–{preview.energyMax}</b></span><span>Остаток <b>около {preview.reserveAfter}%</b></span></div><ul>{preview.warnings.slice(0, difficulty === 'EXPEDITION' ? 1 : 3).map(item => <li key={item}>{item}</li>)}</ul></section>}

    {feedback && <div className={`strategy-feedback is-${feedback.severity.toLowerCase()}`}><strong>{feedback.headline}</strong><span>{feedback.detail}</span></div>}
    {!planReady && <p className="strategy-plan-required">Выбери каждый параметр плана. Кнопка не подставляет решение автоматически.</p>}
    <button className="strategy-execute" disabled={busy || !planReady} onClick={() => void resolve(() => onResolve(plan))}>{busy ? 'Исполнение участка…' : sector.attempts ? 'Пересобрать план и пройти участок' : 'Исполнить план на весь участок'} <b>→</b></button>
    {strategic.direction === 'ASCENT' && <button className="strategy-retreat" disabled={busy} onClick={onRetreat}>{authority ? 'Принять решение об отходе' : 'Потребовать начать отход'}</button>}

    <details className="strategy-field-details"><summary>Группа, запасы и журнал</summary><div><span>Еда <b>{climb.supplies.foodUnits}</b></span><span>Вода <b>{climb.supplies.waterUnits}</b></span><span>Верёвка <b>{climb.ropeMetersRemaining} м</b></span><span>Без сна <b>{Math.round(climb.hoursAwake)} ч</b></span></div><p>{climb.log.slice(-3).join(' · ')}</p></details>
  </section>;
}
