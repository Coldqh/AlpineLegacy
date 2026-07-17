import { useMemo, useState } from 'react';
import { runBalanceAudit } from '../core/playtest';

const LABELS = { EXPLORER: 'Explorer', CLIMBER: 'Climber', EXPEDITION: 'Expedition' } as const;
const sampleOptions = [10, 20, 50, 100] as const;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function BalanceLabScreen({ onClose }: { onClose: () => void }) {
  const [sampleCount, setSampleCount] = useState(20);
  const [serial, setSerial] = useState(0);
  const audit = useMemo(() => runBalanceAudit(`BALANCE-LAB-026-${serial}`, sampleCount), [sampleCount, serial]);

  return (
    <main className="balance-lab">
      <header className="balance-lab__header">
        <div><span>ALPINE LEGACY / 0.27.0 / DEV</span><h1>Лаборатория баланса</h1><p>{audit.totalRuns} детерминированных прохождений. Здесь видно, насколько различаются сложности и действительно ли груз меняет результат.</p></div>
        <button onClick={onClose}>Закрыть</button>
      </header>

      <nav className="balance-lab__controls" aria-label="Размер выборки">
        {sampleOptions.map(count => <button key={count} className={sampleCount === count ? 'is-active' : ''} onClick={() => setSampleCount(count)}>{count * 9} прогонов</button>)}
        <button onClick={() => setSerial(value => value + 1)}>Новый seed</button>
      </nav>

      <section className="balance-lab__difficulty-grid">
        {audit.difficultySummary.map(sample => (
          <article key={sample.difficulty}>
            <header><span>{LABELS[sample.difficulty]}</span><strong>{percent(sample.successRate)}</strong></header>
            <div className="balance-lab__bar"><i style={{ width: percent(sample.successRate) }} /></div>
            <dl>
              <div><dt>Вершина и возврат</dt><dd>{percent(sample.successRate)}</dd></div>
              <div><dt>Отход</dt><dd>{percent(sample.retreatRate)}</dd></div>
              <div><dt>Среднее число движений</dt><dd>{sample.averageMoves}</dd></div>
              <div><dt>Остаток сил</dt><dd>{sample.averageFinalEnergy}</dd></div>
              <div><dt>Состояние группы</dt><dd>{sample.averageFinalTeamCondition}</dd></div>
              <div><dt>Травмы</dt><dd>{percent(sample.injuryRate)}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <section className="balance-lab__equipment">
        <header><span>СНАРЯЖЕНИЕ</span><h2>Чувствительность плана</h2></header>
        <div>
          <article><small>Риск с верёвкой</small><strong>−{audit.equipment.ropeRiskReduction}</strong><p>Максимальное снижение риска на техническом участке.</p></article>
          <article><small>Без верёвки</small><strong>{audit.equipment.noRopeReadiness}/100</strong><p>Против {audit.equipment.recommendedReadiness}/100 у рекомендуемого груза.</p></article>
          <article><small>Без укрытия</small><strong>{audit.equipment.noShelterReadiness}/100</strong><p>Ожидаемых ночёвок: {audit.equipment.expectedNights}.</p></article>
          <article><small>Без аптечки</small><strong>{audit.equipment.noMedkitReadiness}/100</strong><p>Аптечка снижает тяжесть травмы примерно на {audit.equipment.medkitSeverityReduction}%.</p></article>
          <article><small>Верёвка по плану</small><strong>{audit.equipment.recommendedRopeMeters} м</strong><p>Средняя экономия сил на защищённом шаге: {audit.equipment.ropeEnergyReduction}.</p></article>
        </div>
      </section>

      <section className={`balance-lab__warnings ${audit.warnings.length ? 'has-warnings' : 'is-clear'}`}>
        <header><span>АВТОМАТИЧЕСКИЙ ВЕРДИКТ</span><strong>{audit.warnings.length ? `${audit.warnings.length} проблем` : 'Целевые диапазоны выдержаны'}</strong></header>
        {audit.warnings.length ? <ul>{audit.warnings.map(item => <li key={item}>{item}</li>)}</ul> : <p>Сложности разделены, а ключевое снаряжение заметно влияет на готовность и риск.</p>}
      </section>
    </main>
  );
}
