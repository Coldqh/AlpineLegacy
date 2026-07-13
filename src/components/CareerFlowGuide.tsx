import { expeditionReadiness, getSelectedRoute, selectedTeam } from '../core/career';
import type { CareerState, CareerTabId } from '../core/types';

type Props = {
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onDismiss: () => void;
};

const preparationTabs: CareerTabId[] = ['ROUTE', 'TEAM', 'PEOPLE', 'EQUIPMENT', 'EXPEDITION'];

export function CareerFlowGuide({ career, activeTab, onTab, onDismiss }: Props) {
  if (career.onboarding.dismissed || career.onboarding.completed || career.activeClimb || !preparationTabs.includes(activeTab)) return null;

  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const teamReady = selectedTeam(career).length + 1 >= route.recommendedTeamSize;
  const equipmentReady = readiness.blockers.every(item => !item.includes('снаряжения') && !item.includes('еды') && !item.includes('топлива') && !item.includes('средств'));
  const launchReady = readiness.blockers.length === 0 && readiness.total >= 54;
  const steps = [
    { id: 'ROUTE' as const, label: 'Цель', detail: `${route.mountainName} · ${route.name}`, done: true },
    { id: 'TEAM' as const, label: 'Команда', detail: teamReady ? 'Состав готов' : `Нужно ${route.recommendedTeamSize} человека`, done: teamReady },
    { id: 'EQUIPMENT' as const, label: 'Груз', detail: equipmentReady ? 'Минимум собран' : 'Есть пробелы', done: equipmentReady },
    { id: 'EXPEDITION' as const, label: 'Выход', detail: launchReady ? 'Можно начинать' : 'Нужна проверка', done: launchReady },
  ];
  const currentIndex = Math.max(0, steps.findIndex(step => !step.done));
  const current = steps[currentIndex] ?? steps[steps.length - 1]!;
  const instruction = current.id === 'TEAM'
    ? 'Собери рабочую связку.'
    : current.id === 'EQUIPMENT'
      ? 'Закрой обязательный минимум.'
      : current.id === 'EXPEDITION'
        ? 'Проверь погоду и акклиматизацию.'
        : 'Выбери гору и маршрут.';

  return (
    <section className="career-flow-guide" aria-label="Путь первой экспедиции">
      <div className="career-flow-guide__mobile">
        <button className="career-flow-guide__mobile-main" onClick={() => onTab(current.id)}>
          <span>ШАГ {currentIndex + 1} ИЗ {steps.length}</span>
          <strong>{current.label}</strong>
          <small>{instruction}</small>
          <b>→</b>
        </button>
        <div className="career-flow-guide__mobile-progress" aria-hidden="true">
          {steps.map((step, index) => <i key={step.id} className={`${step.done ? 'is-done' : ''} ${index === currentIndex ? 'is-current' : ''}`} />)}
        </div>
        <button className="career-flow-guide__mobile-dismiss" onClick={onDismiss} aria-label="Скрыть обучение">×</button>
      </div>

      <div className="career-flow-guide__desktop">
        <div className="career-flow-guide__intro">
          <small>ПЕРВАЯ ЭКСПЕДИЦИЯ</small>
          <strong>Сейчас: {current.label}</strong>
          <span>{instruction}</span>
          <div><button onClick={() => onTab(current.id)}>Открыть шаг →</button><button onClick={onDismiss}>Скрыть обучение</button></div>
        </div>
        <div className="career-flow-guide__steps">
          {steps.map((step, index) => (
            <button key={step.id} className={`${activeTab === step.id ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`} onClick={() => onTab(step.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><b>{step.done ? '✓' : '→'}</b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
