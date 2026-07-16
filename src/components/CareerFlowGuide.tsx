import { expeditionReadiness, getSelectedRoute, selectedTeam } from '../core/career';
import type { CareerState, CareerTabId } from '../core/types';

type Props = {
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onStep: (step: number) => void;
  onDismiss: () => void;
};

const tutorialTabs: CareerTabId[] = ['OVERVIEW', 'ROUTE', 'TEAM', 'EQUIPMENT', 'EXPEDITION'];

export function CareerFlowGuide({ career, activeTab, onTab, onStep, onDismiss }: Props) {
  if (career.onboarding.dismissed || career.onboarding.completed || career.activeClimb || !tutorialTabs.includes(activeTab)) return null;

  const route = getSelectedRoute(career);
  const readiness = expeditionReadiness(career);
  const teamSize = selectedTeam(career).length + 1;
  const steps = [
    { id: 'OVERVIEW' as const, label: 'Штаб', detail: 'Навыки, усталость и сезон', text: 'Здесь видно состояние персонажа. Тренировки занимают дни, а уровни навыков растут медленно и остаются на всю карьеру.' },
    { id: 'ROUTE' as const, label: 'Маршрут', detail: `${route.mountainName} · ${route.name}`, text: 'Сравни высоту, техничность, риск и длительность. Сложный маршрут требует лучшей команды, снаряжения и акклиматизации.' },
    { id: 'TEAM' as const, label: 'Люди', detail: `${teamSize}/${route.recommendedTeamSize} в группе`, text: 'У каждого человека свои навыки, характер и состояние. Наставники ведут экспедиции разной сложности и постоянно выходят на новые маршруты.' },
    { id: 'EQUIPMENT' as const, label: 'Груз', detail: readiness.blockers.length ? 'Нужно закрыть пробелы' : 'Минимум собран', text: 'Собери обязательное снаряжение, еду, топливо и верёвку. Лишний вес ускоряет усталость всей группы.' },
    { id: 'EXPEDITION' as const, label: 'Выход', detail: readiness.blockers.length ? `${readiness.blockers.length} препятствий` : 'Можно начинать', text: 'Выбери погодное окно и дни акклиматизации. Во время вылазки вершина — только половина пути: группу ещё нужно вернуть вниз.' },
  ];
  const currentIndex = Math.max(0, Math.min(steps.length - 1, career.onboarding.careerStep ?? 0));
  const current = steps[currentIndex]!;

  const go = (index: number) => {
    const safe = Math.max(0, Math.min(steps.length - 1, index));
    onStep(safe);
    onTab(steps[safe]!.id);
  };

  return (
    <section className="career-flow-guide" aria-label="Обучение первой экспедиции">
      <div className="career-flow-guide__mobile">
        <button className="career-flow-guide__mobile-dismiss" onClick={onDismiss} aria-label="Скрыть обучение">×</button>
        <button className="career-flow-guide__mobile-main" onClick={() => onTab(current.id)}>
          <span>ОБУЧЕНИЕ · {currentIndex + 1}/{steps.length}</span>
          <strong>{current.label}</strong>
          <small>{current.text}</small>
        </button>
        <div className="career-flow-guide__mobile-progress" aria-hidden="true">
          {steps.map((step, index) => <i key={step.id} className={`${index < currentIndex ? 'is-done' : ''} ${index === currentIndex ? 'is-current' : ''}`} />)}
        </div>
        <div className="career-flow-guide__mobile-nav">
          <button onClick={() => go(currentIndex - 1)} disabled={currentIndex === 0}>← Назад</button>
          <button onClick={() => go(currentIndex + 1)} disabled={currentIndex === steps.length - 1}>Далее →</button>
        </div>
      </div>

      <div className="career-flow-guide__desktop">
        <div className="career-flow-guide__intro">
          <small>ОБУЧЕНИЕ ПЕРВОЙ ЭКСПЕДИЦИИ · {currentIndex + 1}/{steps.length}</small>
          <strong>{current.label}</strong>
          <span>{current.text}</span>
          <div>
            <button onClick={() => onTab(current.id)}>Открыть раздел →</button>
            <button onClick={() => go(currentIndex + 1)} disabled={currentIndex === steps.length - 1}>Следующий шаг</button>
            <button onClick={onDismiss}>Скрыть</button>
          </div>
        </div>
        <div className="career-flow-guide__steps">
          {steps.map((step, index) => (
            <button key={step.id} className={`${activeTab === step.id ? 'is-active' : ''} ${index < currentIndex ? 'is-done' : ''}`} onClick={() => go(index)}>
              <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><b>{index < currentIndex ? '✓' : '→'}</b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
