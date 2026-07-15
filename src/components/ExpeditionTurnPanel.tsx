import { buildStageBrief } from '../core/expeditionTactics';
import type {
  CareerState,
  ClimbStepResult,
  DifficultyId,
  ExpeditionActionPreview,
  ExpeditionFieldActionId,
  ExpeditionSimulationStage,
} from '../core/types';

type Feedback = Pick<ClimbStepResult, 'headline' | 'detail' | 'severity'> | null;

type Props = {
  career: CareerState;
  stage: ExpeditionSimulationStage;
  actions: ExpeditionActionPreview[];
  difficulty: DifficultyId;
  feedback: Feedback;
  busy: boolean;
  onAction: (actionId: ExpeditionFieldActionId) => void;
};

function chanceLabel(action: ExpeditionActionPreview, difficulty: DifficultyId) {
  if (action.successChance === null) return 'без проверки';
  if (difficulty === 'EXPLORER') return `${action.successChance}%`;
  if (difficulty === 'EXPEDITION') return 'оценка скрыта';
  return action.riskLabel.toLowerCase();
}

function costLabel(action: ExpeditionActionPreview) {
  const energy = action.energyDelta > 0 ? `силы +${action.energyDelta}` : action.energyDelta < 0 ? `силы ${action.energyDelta}` : 'силы 0';
  return `${action.durationMinutes} мин · ${energy}`;
}

export function ExpeditionTurnPanel({ career, stage, actions, difficulty, feedback, busy, onAction }: Props) {
  const brief = buildStageBrief(career, stage);
  return (
    <section className="exp-turn">
      <article className="exp-turn__objective">
        <small>{brief.eyebrow}</small>
        <h2>{brief.title}</h2>
        <strong>{brief.task}</strong>
        <p>{brief.reason}</p>
        <span>{brief.clue}</span>
      </article>

      {feedback && (
        <article className={`exp-turn__feedback is-${feedback.severity.toLowerCase()}`}>
          <strong>{feedback.headline}</strong><span>{feedback.detail}</span>
        </article>
      )}

      <div className="exp-turn__actions" aria-busy={busy}>
        {actions.map(action => {
          const primary = action.id === brief.primaryActionId;
          return (
            <button
              key={action.id}
              className={primary ? 'is-primary' : ''}
              disabled={busy || action.disabled}
              onClick={() => onAction(action.id)}
            >
              <div><strong>{action.title}</strong><small>{action.detail}</small></div>
              <aside><b>{chanceLabel(action, difficulty)}</b><span>{costLabel(action)}</span></aside>
            </button>
          );
        })}
      </div>
      {busy && <div className="exp-turn__busy">Обрабатываем действие…</div>}
    </section>
  );
}
