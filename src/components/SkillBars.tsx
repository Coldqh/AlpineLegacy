import { SKILL_LABELS } from '../core/career';
import type { SkillId, SkillSet } from '../core/types';

type Props = {
  skills: SkillSet;
  compact?: boolean;
};

const orderedSkills: SkillId[] = ['ENDURANCE', 'ROCK', 'ICE', 'NAVIGATION', 'MEDICINE', 'LEADERSHIP'];

export function SkillBars({ skills, compact = false }: Props) {
  return (
    <div className={`skill-bars ${compact ? 'skill-bars--compact' : ''}`}>
      {orderedSkills.map((skill) => (
        <div className="skill-row" key={skill}>
          <div className="skill-row__label">
            <span>{SKILL_LABELS[skill]}</span>
            <strong>{skills[skill]}</strong>
          </div>
          <div className="skill-row__track" aria-label={`${SKILL_LABELS[skill]}: ${skills[skill]} из 10`}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} className={index < skills[skill] ? 'is-filled' : ''} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
