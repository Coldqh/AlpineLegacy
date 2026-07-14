import type { CSSProperties } from 'react';
import type { QualificationClimb } from '../core/types';

type Props = { climb: QualificationClimb };

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function ExpeditionHeightScale({ climb }: Props) {
  const simulation = climb.simulation;
  const totalGain = Math.max(1, climb.summitElevation - climb.startElevation);
  const currentRelative = clamp(climb.currentElevation - climb.startElevation, 0, totalGain);
  const altitudePercent = clamp(currentRelative / totalGain * 100);
  const camps = simulation?.ascentStages
    .filter(stage => stage.phase === 'BASE_CAMP' || stage.phase === 'CAMP')
    .map(stage => ({ id: stage.id, altitude: climb.startElevation + stage.relativeEnd, percent: clamp(stage.relativeEnd / totalGain * 100), label: stage.phase === 'BASE_CAMP' ? 'БЛ' : 'Л' })) ?? [];
  const critical = simulation?.ascentStages
    .filter(stage => stage.critical)
    .map(stage => ({ id: stage.id, percent: clamp(stage.relativeEnd / totalGain * 100) })) ?? [];
  const descending = simulation?.direction === 'DESCENT' || climb.retreating;
  const left = `${altitudePercent}%`;

  return (
    <section className="exp-height-scale" aria-label="Высотный профиль экспедиции">
      <header>
        <span><small>СТАРТ</small><strong>{climb.startElevation} м</strong></span>
        <span className="is-current"><small>СЕЙЧАС</small><strong>{climb.currentElevation} м</strong></span>
        <span><small>ВЕРШИНА</small><strong>{climb.summitElevation} м</strong></span>
      </header>
      <div className="exp-height-track">
        <i className="exp-height-fill" style={{ '--height-progress': left } as CSSProperties} />
        {critical.map(marker => <i key={marker.id} className="exp-height-critical" style={{ '--marker-position': `${marker.percent}%` } as CSSProperties} />)}
        {camps.map(marker => <span key={marker.id} className="exp-height-camp" title={`${marker.altitude} м`} style={{ '--marker-position': `${marker.percent}%` } as CSSProperties}>{marker.label}</span>)}
        <b className="exp-height-current" style={{ '--marker-position': left } as CSSProperties}><em>{descending ? '↓' : '↑'}</em></b>
      </div>
      <footer>
        <span>Набрано <b>{Math.round(currentRelative)} м</b></span>
        <span>{descending ? 'До старта' : 'До вершины'} <b>{Math.round(descending ? currentRelative : totalGain - currentRelative)} м</b></span>
        <span>Высотный путь <b>{Math.round(altitudePercent)}%</b></span>
      </footer>
    </section>
  );
}
