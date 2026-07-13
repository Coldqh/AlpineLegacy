import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute } from '../core/career';
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
  rope: 'Позволяет двигаться связкой, страховать и спускаться.',
  'rock-kit': 'Снижает риск срыва на скальных участках.',
  'ice-kit': 'Нужен для льда, фирна и жёстких склонов.',
  tent: 'Даёт полноценный лагерь и безопасный сон.',
  stove: 'Превращает снег в воду и поддерживает ночёвку.',
  medkit: 'Снижает последствия травм и переохлаждения.',
  radio: 'Улучшает связь и шанс организовать помощь.',
  bivy: 'Аварийное укрытие при сорванном графике.',
};

export function EquipmentScreen({ career, onSetQuantity, onSetPlan, onPreset, onContinue }: Props) {
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);
  const missing = route.requiredGearIds.filter(id => (career.expeditionPlan.gear[id] ?? 0) <= 0);

  return (
    <section className="workspace-page equipment-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">ШАГ 3 ИЗ 4 · ГРУЗ</p><h1>Что берём.</h1><p>Обязательные предметы блокируют выход. Остальное покупает безопасность ценой денег и веса.</p></div>
        <div className="workspace-title__mark"><span>{weight.toFixed(1)}</span><small>КГ НА ЧЕЛОВЕКА</small></div>
      </header>

      <section className={`decision-guide ${missing.length ? 'is-warning' : 'is-good'}`}>
        <strong>{missing.length ? `Не хватает: ${missing.length}` : 'Обязательный комплект собран'}</strong>
        <p>{missing.length ? 'Красные строки нужно закрыть. Можно нажать «Рекомендуемый комплект» и затем вручную убрать лишнее.' : `Текущая загрузка даёт ${readiness.equipment}/100 готовности. Следи, чтобы вес не ушёл далеко выше 16 кг на человека.`}</p>
      </section>

      <div className="equipment-preset-row">
        <button onClick={() => onPreset('MINIMUM')}><strong>Обязательный минимум</strong><small>Только то, без чего маршрут нельзя начать.</small></button>
        <button className="is-primary" onClick={() => onPreset('RECOMMENDED')}><strong>Рекомендуемый комплект</strong><small>Безопасный стартовый набор под выбранную линию.</small></button>
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
                  <small>{categoryLabel[item.category]} {required ? '· ОБЯЗАТЕЛЬНО' : '· ДОПОЛНИТЕЛЬНО'}</small>
                  <h3>{item.name}</h3>
                  <p>{effectLabel[item.id] ?? item.description}</p>
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
          <p className="eyebrow">РАСХОДУЕМЫЕ ЗАПАСЫ</p><h2>На сколько хватит</h2>
          <label><span>Еда</span><strong>{career.expeditionPlan.foodDays} дней</strong><small>Расходуется при движении и в лагере.</small><input type="range" min="1" max="7" value={career.expeditionPlan.foodDays} onChange={e => onSetPlan({ foodDays: Number(e.target.value) })} /></label>
          <label><span>Топливо</span><strong>{career.expeditionPlan.fuelUnits} ед.</strong><small>Нужно для воды и полноценного отдыха.</small><input type="range" min="0" max="8" value={career.expeditionPlan.fuelUnits} onChange={e => onSetPlan({ fuelUnits: Number(e.target.value) })} /></label>
          <label><span>Верёвка</span><strong>{career.expeditionPlan.ropeMeters} м</strong><small>Длиннее — безопаснее на технике, но тяжелее.</small><input type="range" min="30" max="100" step="10" value={career.expeditionPlan.ropeMeters} onChange={e => onSetPlan({ ropeMeters: Number(e.target.value) })} /></label>
          <div className="manifest-total"><small>НАГРУЗКА</small><strong>{weight.toFixed(1)} кг</strong><span>на одного участника</span></div>
        </aside>
      </div>

      <button className="flow-next-action" onClick={onContinue}><span><small>СЛЕДУЮЩИЙ ШАГ</small><strong>Проверить погоду и выйти</strong></span><b>→</b></button>
    </section>
  );
}
