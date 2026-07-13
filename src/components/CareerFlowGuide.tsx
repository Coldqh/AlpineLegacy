import { expeditionReadiness, getSelectedRoute, selectedTeam } from '../core/career';
import type { CareerState, CareerTabId } from '../core/types';

type Props = {
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
};

const preparationTabs: CareerTabId[] = ['ROUTE', 'TEAM', 'PEOPLE', 'EQUIPMENT', 'EXPEDITION'];

export function CareerFlowGuide({ career, activeTab, onTab }: Props) {
  if (career.completedClimbs > 0 || career.activeClimb || !preparationTabs.includes(activeTab)) return null;
  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const teamReady = selectedTeam(career).length + 1 >= route.recommendedTeamSize;
  const equipmentReady = readiness.blockers.every(item => !item.includes('снаряжения') && !item.includes('еды') && !item.includes('топлива') && !item.includes('средств'));
  const launchReady = readiness.blockers.length === 0 && readiness.total >= 54;
  const steps = [
    { id: 'ROUTE' as const, label: 'Цель', detail: `${route.mountainName} · ${route.name}`, done: true },
    { id: 'TEAM' as const, label: 'Люди', detail: teamReady ? 'Состав рабочий' : `Нужно ${route.recommendedTeamSize} человека`, done: teamReady },
    { id: 'EQUIPMENT' as const, label: 'Груз', detail: equipmentReady ? 'Критическое собрано' : 'Есть пробелы', done: equipmentReady },
    { id: 'EXPEDITION' as const, label: 'Выход', detail: launchReady ? 'Можно начинать' : 'Нужна проверка', done: launchReady },
  ];

  return (
    <section className="career-flow-guide" aria-label="Путь первой экспедиции">
      <div className="career-flow-guide__intro"><small>ПЕРВАЯ ЭКСПЕДИЦИЯ</small><strong>Иди слева направо.</strong><span>Каждый шаг можно открыть повторно.</span></div>
      <div className="career-flow-guide__steps">
        {steps.map((step, index) => (
          <button key={step.id} className={`${activeTab === step.id ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`} onClick={() => onTab(step.id)}>
            <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><b>{step.done ? '✓' : '→'}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
