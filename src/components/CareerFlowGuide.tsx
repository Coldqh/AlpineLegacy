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
    { id: 'TEAM' as const, label: 'Люди', detail: teamReady ? 'Состав рабочий' : `Нужно ${route.recommendedTeamSize} человека`, done: teamReady },
    { id: 'EQUIPMENT' as const, label: 'Груз', detail: equipmentReady ? 'Критическое собрано' : 'Есть пробелы', done: equipmentReady },
    { id: 'EXPEDITION' as const, label: 'Выход', detail: launchReady ? 'Можно начинать' : 'Нужна проверка', done: launchReady },
  ];
  const current = steps.find(step => !step.done) ?? steps[steps.length - 1]!;
  const instruction = current.id === 'TEAM'
    ? 'Собери минимум рабочую связку. Сильный человек ускоряет маршрут, но характер и доверие тоже влияют на приказы.'
    : current.id === 'EQUIPMENT'
      ? 'Сначала нажми «обязательный минимум», потом проверь вес, воду, еду и свободную верёвку.'
      : current.id === 'EXPEDITION'
        ? 'Выбери погодное окно и акклиматизацию. Красные причины блокировки ведут прямо к месту исправления.'
        : 'Сравни горы и линии. Смотри не на общий рейтинг, а на характер маршрута, спуск и требуемый навык.';

  return (
    <section className="career-flow-guide" aria-label="Путь первой экспедиции">
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
    </section>
  );
}
