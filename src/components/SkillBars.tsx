import { SKILL_LABELS, skillXpThreshold } from '../core/career';
import type { SkillId, SkillSet, SkillXp } from '../core/types';

type Props = {
  skills: SkillSet;
  compact?: boolean;
  xp?: SkillXp;
};

const orderedSkills: SkillId[] = ['ENDURANCE', 'ROCK', 'ICE', 'NAVIGATION', 'MEDICINE', 'LEADERSHIP'];

export function SkillBars({ skills, compact = false, xp }: Props) {
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
          {xp && skills[skill] < 10 && (
            <div className="skill-row__xp">
              <i style={{ '--skill-xp': `${Math.min(100, Math.round(xp[skill] / skillXpThreshold(skills[skill]) * 100))}%` } as React.CSSProperties} />
              <small>{xp[skill]} / {skillXpThreshold(skills[skill])} опыта</small>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
