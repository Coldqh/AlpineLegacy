import type { CSSProperties } from 'react';
import type { QualificationClimb } from '../core/types';

type Props = { climb: QualificationClimb };

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function ExpeditionHeightScale({ climb }: Props) {
  const simulation = climb.simulation;
  const totalGain = Math.max(1, climb.summitElevation - climb.startElevation);
  const currentRelative = clamp(climb.currentElevation - climb.startElevation, 0, totalGain);
  const altitudePercent = clamp(currentRelative / totalGain * 100);
  const descending = simulation?.direction === 'DESCENT' || climb.retreating;
  const allStages = simulation?.ascentStages ?? [];
  const checkpoints = allStages
    .filter(stage => stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP' || stage.critical)
    .map(stage => ({
      id: stage.id,
      altitude: climb.startElevation + stage.relativeEnd,
      percent: clamp(stage.relativeEnd / totalGain * 100),
      camp: stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP',
      label: stage.phase === 'BASE_CAMP' ? 'БЛ' : stage.phase === 'CAMP' ? 'Л' : '!',
    }));
  const nextCheckpoint = descending
    ? [...checkpoints].reverse().find(point => point.altitude < climb.currentElevation)
    : checkpoints.find(point => point.altitude > climb.currentElevation);
  const currentPosition = `${altitudePercent}%`;

  return (
    <section className="exp-height-scale exp-height-scale--compact" aria-label="Высота на маршруте">
      <header>
        <span><small>СТАРТ</small><strong>{climb.startElevation}</strong></span>
        <span className="is-current"><small>СЕЙЧАС</small><strong>{climb.currentElevation} м</strong></span>
        <span><small>ВЕРШИНА</small><strong>{climb.summitElevation}</strong></span>
      </header>
      <div className="exp-height-track">
        <i className="exp-height-fill" style={{ '--height-progress': currentPosition } as CSSProperties} />
        {checkpoints.map(marker => <span key={marker.id} className={marker.camp ? 'exp-height-camp' : 'exp-height-critical'} title={`${marker.altitude} м`} style={{ '--marker-position': `${marker.percent}%` } as CSSProperties}>{marker.label}</span>)}
        <b className="exp-height-current" style={{ '--marker-position': currentPosition } as CSSProperties}><em>{descending ? '↓' : '↑'}</em></b>
      </div>
      <footer>
        <span>{descending ? 'До старта' : 'До вершины'} <b>{Math.round(descending ? currentRelative : totalGain - currentRelative)} м</b></span>
        <span>{nextCheckpoint ? `Следующая точка ${nextCheckpoint.altitude} м` : descending ? 'Финиш у старта' : 'Следующая точка — вершина'}</span>
      </footer>
    </section>
  );
}
