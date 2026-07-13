import { CareerShell } from '../components/CareerShell';
import {
  beginDescent,
  closeClimb,
  establishCamp,
  expeditionReadiness,
  meltSnow,
  resolveClimbStep,
  retreatClimb,
  selectRoute,
  selectWeatherWindow,
  setGearQuantity,
  startPlannedClimb,
  toggleTeamMember,
  updateExpeditionPlan,
  waitWeather,
} from '../core/career';
import type { CareerState, CareerTabId, ClimbPace, ClimbStepResult, ExpeditionPlan, TrainingId, WorldState } from '../core/types';
import { CareerOverviewScreen } from './CareerOverviewScreen';
import { ClimbScreen } from './ClimbScreen';
import { EquipmentScreen } from './EquipmentScreen';
import { ExpeditionScreen } from './ExpeditionScreen';
import { JournalScreen } from './JournalScreen';
import { RoutePlanningScreen } from './RoutePlanningScreen';
import { TeamScreen } from './TeamScreen';

type Props = {
  world: WorldState;
  career: CareerState;
  activeTab: CareerTabId;
  onTab: (tab: CareerTabId) => void;
  onPersist: (career: CareerState) => void;
  onTrain: (trainingId: TrainingId) => void;
  onExit: () => void;
  onAtlas: () => void;
};

export function CareerWorkspaceScreen({ world, career, activeTab, onTab, onPersist, onTrain, onExit, onAtlas }: Props) {
  function persistResult(result: ClimbStepResult) {
    onPersist(result.career);
    return result;
  }

  function renderTab() {
    if (activeTab === 'OVERVIEW') {
      return <CareerOverviewScreen world={world} career={career} onTrain={onTrain} onOpenExpedition={() => onTab('EXPEDITION')} />;
    }
    if (activeTab === 'ROUTE') {
      return (
        <RoutePlanningScreen
          world={world}
          career={career}
          onSelectRoute={routeId => onPersist(selectRoute(career, routeId))}
          onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))}
          onSetAcclimatization={days => onPersist(updateExpeditionPlan(career, { acclimatizationDays: days }))}
        />
      );
    }
    if (activeTab === 'TEAM') {
      return <TeamScreen career={career} onToggle={memberId => onPersist(toggleTeamMember(career, memberId))} />;
    }
    if (activeTab === 'EQUIPMENT') {
      return (
        <EquipmentScreen
          career={career}
          onSetQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))}
          onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))}
        />
      );
    }
    if (activeTab === 'EXPEDITION') {
      return (
        <ExpeditionScreen
          career={career}
          onOpenTab={onTab}
          onLaunch={() => {
            const readiness = expeditionReadiness(career);
            const next = startPlannedClimb(career);
            onPersist(next);
            if (next.activeClimb && readiness.blockers.length === 0) onTab('CLIMB');
          }}
        />
      );
    }
    if (activeTab === 'CLIMB' && career.activeClimb) {
      return (
        <ClimbScreen
          career={career}
          onStep={(pace: ClimbPace) => persistResult(resolveClimbStep(career, pace))}
          onCamp={() => persistResult(establishCamp(career))}
          onMeltSnow={() => persistResult(meltSnow(career))}
          onWait={() => persistResult(waitWeather(career))}
          onBeginDescent={() => onPersist(beginDescent(career))}
          onRetreat={() => onPersist(retreatClimb(career))}
          onClose={() => {
            onPersist(closeClimb(career));
            onTab('OVERVIEW');
          }}
        />
      );
    }
    return <JournalScreen career={career} />;
  }

  return (
    <CareerShell world={world} career={career} activeTab={activeTab} onTab={onTab} onExit={onExit} onAtlas={onAtlas}>
      {renderTab()}
    </CareerShell>
  );
}
