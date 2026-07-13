import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute, preparationInsights, selectedTeam } from '../core/career';
import type { CareerState, GearCategory } from '../core/types';

type Props = {
  career: CareerState;
  onSetQuantity: (gearId: string, quantity: number) => void;
  onSetPlan: (patch: Partial<CareerState['expeditionPlan']>) => void;
  onPreset: (preset: 'MINIMUM' | 'RECOMMENDED') => void;
  onContinue: () => void;
};

const categoryLabel: Record<GearCategory, string> = {
  PROTECTION: 'СТРАХОВКА', SHELTER: 'УКРЫТИЕ', SURVIVAL: 'ЖИЗНЕОБЕСПЕЧЕНИЕ', COMMUNICATION: 'СВЯЗЬ',
};

const effectLabel: Record<string, string> = {
  rope: 'Даёт движение в связке, страховку и организованный спуск.',
  'rock-kit': 'Снижает риск задержки и срыва на скалах.',
  'ice-kit': 'Позволяет безопасно проходить лёд, фирн и крутые снежные склоны.',
  tent: 'Разрешает полноценный лагерь на подходящем участке.',
  stove: 'Даёт воду из снега и позволяет группе нормально отдыхать.',
  medkit: 'Снижает последствия травм, холода и плохого состояния участника.',
  radio: 'Повышает шанс связи с клубом и организации спасения.',
  bivy: 'Даёт аварийное укрытие, когда график сорван или спуск затянулся.',
};

function weightEffect(weight: number) {
  if (weight <= 13) return { tone: 'GOOD', title: 'Лёгкая загрузка', text: 'Штрафа к движению нет. Группа сохранит больше сил к спуску.' };
  if (weight <= 16) return { tone: 'GOOD', title: 'Рабочая загрузка', text: 'Нормальный экспедиционный вес без отдельного штрафа.' };
  if (weight <= 18) return { tone: 'WARNING', title: 'Тяжёлый груз', text: 'Каждый участок будет забирать больше энергии. Быстрый темп станет опаснее.' };
  return { tone: 'DANGER', title: 'Перегруз', text: 'Темп и запас сил резко ухудшатся. Убери лишнее или добавь участника.' };
}

export function EquipmentScreen({ career, onSetQuantity, onSetPlan, onPreset, onContinue }: Props) {
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  const teamSize = selectedTeam(career).length + 1;
  const missing = route.requiredGearIds.filter(id => (career.expeditionPlan.gear[id] ?? 0) <= 0);
  const weightState = weightEffect(weight);
  const insights = preparationInsights(career);
  const estimatedNights = Math.max(0, Math.ceil(route.estimatedHours / 14) - 1);
  const waterCycles = career.expeditionPlan.fuelUnits;

  return (
    <section className="workspace-page equipment-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 3 ИЗ 4 · ГРУЗ</p><h1>Собери то, что работает.</h1><p>Каждая вещь должна либо открыть действие, либо снизить конкретный риск. Вес распределяется на {teamSize} человек.</p></div>
        <div className="workspace-title__mark"><span>{weight.toFixed(1)}</span><small>КГ НА ЧЕЛОВЕКА</small></div>
      </header>

      <section className={`decision-guide ${missing.length ? 'is-warning' : 'is-good'}`}>
        <strong>{missing.length ? `Не хватает: ${missing.length}` : 'Обязательный комплект собран'}</strong>
        <p>{missing.length ? 'Красные строки блокируют выход. Рекомендуемый комплект закрывает обязательное и добавляет базовый резерв.' : `Снаряжение даёт ${readiness.equipment}/100. Теперь оцени вес, воду и возможность ночёвки.`}</p>
      </section>

      <section className="impact-summary-grid">
        <article className={`is-${weightState.tone.toLowerCase()}`}><small>ВЕС</small><strong>{weightState.title}</strong><p>{weightState.text}</p></article>
        <article className={career.expeditionPlan.foodDays >= Math.max(2, estimatedNights + 2) ? 'is-good' : 'is-warning'}><small>ЕДА</small><strong>{career.expeditionPlan.foodDays} дней</strong><p>Маршрут рассчитан примерно на {route.estimatedHours} ч. Резерв нужен для ожидания и медленного спуска.</p></article>
        <article className={waterCycles >= 3 ? 'is-good' : 'is-warning'}><small>ТОПЛИВО</small><strong>{waterCycles} цикла</strong><p>Каждая единица даёт один цикл топки снега или участвует в полноценном лагере.</p></article>
      </section>

      <div className="equipment-preset-row">
        <button onClick={() => onPreset('MINIMUM')}><strong>Обязательный минимум</strong><small>Откроет маршрут, но почти не оставит резерв на плохой сценарий.</small></button>
        <button className="is-primary" onClick={() => onPreset('RECOMMENDED')}><strong>Рекомендуемый комплект</strong><small>Безопасная база под выбранную гору и её главный характер.</small></button>
      </div>

      <div className="equipment-ledger-head equipment-ledger-head--clear">
        <div><span>Маршрут</span><strong>{route.name}</strong></div>
        <div><span>Снаряжение</span><strong>{readiness.equipment}/100</strong></div>
        <div><span>Расходы</span><strong>{cost} кр.</strong></div>
        <div><span>После закупки</span><strong>{career.hero.money - cost} кр.</strong></div>
      </div>

      <div className="equipment-layout equipment-layout--clear">
        <section className="equipment-list equipment-list--clear">
          {GEAR_CATALOG.map((item, index) => {
            const quantity = career.expeditionPlan.gear[item.id] ?? 0;
            const required = route.requiredGearIds.includes(item.id);
            return (
              <article key={item.id} className={`${quantity > 0 ? 'is-packed' : ''} ${required && quantity === 0 ? 'is-missing' : ''}`}>
                <span className="equipment-list__index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>{categoryLabel[item.category]} {required ? '· ОБЯЗАТЕЛЬНО' : '· РЕЗЕРВ'}</small>
                  <h3>{item.name}</h3>
                  <p>{effectLabel[item.id] ?? item.description}</p>
                  <em>{quantity > 0 ? `В плане: ${quantity} · ${Math.round(item.weightKg * quantity * 10) / 10} кг общего веса` : required ? 'Без этого выход запрещён' : 'Не взято'}</em>
                </div>
                <div className="equipment-list__weight"><strong>{item.weightKg} кг</strong><small>{item.unitCost} кр.</small></div>
                <div className="quantity-control">
                  <button aria-label={`Убрать ${item.name}`} onClick={() => onSetQuantity(item.id, quantity - 1)}>−</button>
                  <strong>{quantity}</strong>
                  <button aria-label={`Добавить ${item.name}`} onClick={() => onSetQuantity(item.id, quantity + 1)}>+</button>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="supply-manifest supply-manifest--clear">
          <p className="eyebrow">РАСХОДУЕМЫЕ ЗАПАСЫ</p><h2>Что изменится</h2>
          <label><span>Еда</span><strong>{career.expeditionPlan.foodDays} дней</strong><small>Больше дней = больше резерв на лагерь и ожидание, но выше вес.</small><input type="range" min="1" max="7" value={career.expeditionPlan.foodDays} onChange={e => onSetPlan({ foodDays: Number(e.target.value) })} /></label>
          <label><span>Топливо</span><strong>{career.expeditionPlan.fuelUnits} ед.</strong><small>Каждая единица может дать воду. Для лагеря нужны и топливо, и еда.</small><input type="range" min="0" max="8" value={career.expeditionPlan.fuelUnits} onChange={e => onSetPlan({ fuelUnits: Number(e.target.value) })} /></label>
          <label><span>Верёвка</span><strong>{career.expeditionPlan.ropeMeters} м</strong><small>{career.expeditionPlan.ropeMeters >= 60 ? 'Хватит для большинства организованных спусков.' : 'Короткий запас ограничит страховку и спуск.'}</small><input type="range" min="30" max="100" step="10" value={career.expeditionPlan.ropeMeters} onChange={e => onSetPlan({ ropeMeters: Number(e.target.value) })} /></label>
          <div className="manifest-total"><small>НАГРУЗКА</small><strong>{weight.toFixed(1)} кг</strong><span>на одного участника</span></div>
          <div className="manifest-insight"><small>{insights[0]?.title}</small><p>{insights[0]?.detail}</p></div>
        </aside>
      </div>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Проверить погоду и выйти</strong></span><b>→</b></button>
    </section>
  );
}
