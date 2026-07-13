import { GEAR_CATALOG, expeditionCost, expeditionReadiness, expeditionWeight, getSelectedRoute } from '../core/career';
import type { CareerState, GearCategory } from '../core/types';

type Props = {
  career: CareerState;
  onSetQuantity: (gearId: string, quantity: number) => void;
  onSetPlan: (patch: Partial<CareerState['expeditionPlan']>) => void;
};

const categoryLabel: Record<GearCategory, string> = {
  PROTECTION: 'СТРАХОВКА', SHELTER: 'УКРЫТИЕ', SURVIVAL: 'ЖИЗНЕОБЕСПЕЧЕНИЕ', COMMUNICATION: 'СВЯЗЬ',
};

export function EquipmentScreen({ career, onSetQuantity, onSetPlan }: Props) {
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const weight = expeditionWeight(career);
  const cost = expeditionCost(career);

  return (
    <section className="workspace-page equipment-page">
      <header className="workspace-title workspace-title--compact">
        <div><p className="eyebrow">LOAD MANIFEST / ROUTE SPECIFIC</p><h1>Снаряжение</h1><p>Вес делится между группой. Недостающий обязательный предмет блокирует выход, лишний груз забирает силы.</p></div>
        <div className="workspace-title__mark"><span>{weight.toFixed(1)}</span><small>КГ / ЧЕЛ.</small></div>
      </header>

      <div className="equipment-ledger-head">
        <div><span>Маршрут</span><strong>{route.name}</strong></div>
        <div><span>Подготовка</span><strong>{readiness.equipment}/100</strong></div>
        <div><span>Расходы</span><strong>{cost} кр.</strong></div>
        <div><span>Доступно</span><strong>{career.hero.money} кр.</strong></div>
      </div>

      <div className="equipment-layout">
        <section className="equipment-list">
          {GEAR_CATALOG.map((item, index) => {
            const quantity = career.expeditionPlan.gear[item.id] ?? 0;
            const required = route.requiredGearIds.includes(item.id);
            return (
              <article key={item.id} className={`${quantity > 0 ? 'is-packed' : ''} ${required && quantity === 0 ? 'is-missing' : ''}`}>
                <span className="equipment-list__index">{String(index + 1).padStart(2, '0')}</span>
                <div><small>{categoryLabel[item.category]} {required ? '· ОБЯЗАТЕЛЬНО' : ''}</small><h3>{item.name}</h3><p>{item.description}</p></div>
                <div className="equipment-list__weight"><strong>{item.weightKg} кг</strong><small>{item.unitCost} кр.</small></div>
                <div className="quantity-control">
                  <button onClick={() => onSetQuantity(item.id, quantity - 1)}>−</button><strong>{quantity}</strong><button onClick={() => onSetQuantity(item.id, quantity + 1)}>+</button>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="supply-manifest">
          <p className="eyebrow">CONSUMABLES</p><h2>Запасы</h2>
          <label><span>Еда</span><strong>{career.expeditionPlan.foodDays} дней</strong><input type="range" min="1" max="7" value={career.expeditionPlan.foodDays} onChange={e => onSetPlan({ foodDays: Number(e.target.value) })} /></label>
          <label><span>Топливо</span><strong>{career.expeditionPlan.fuelUnits} ед.</strong><input type="range" min="0" max="8" value={career.expeditionPlan.fuelUnits} onChange={e => onSetPlan({ fuelUnits: Number(e.target.value) })} /></label>
          <label><span>Верёвка</span><strong>{career.expeditionPlan.ropeMeters} м</strong><input type="range" min="30" max="100" step="10" value={career.expeditionPlan.ropeMeters} onChange={e => onSetPlan({ ropeMeters: Number(e.target.value) })} /></label>
          <div className="manifest-total"><small>РАСЧЁТНАЯ НАГРУЗКА</small><strong>{weight.toFixed(1)} кг</strong><span>на одного участника</span></div>
        </aside>
      </div>
    </section>
  );
}
