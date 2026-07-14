import { CareerShell } from '../components/CareerShell';
import { MobileCareerShell } from '../mobile/MobileCareerShell';
import { MobileClimbScreen } from '../mobile/MobileClimbScreen';
import { useIsMobile, useScrollReset } from '../mobile/useMobile';
import {
  MobileEquipment,
  MobileExpedition,
  MobileJournal,
  MobileNews,
  MobileOverview,
  MobilePeople,
  MobileRecords,
  MobileRivals,
  MobileRoute,
  MobileTeam,
  MobileWorld,
} from '../mobile/MobileCareerScreens';
import { CareerFlowGuide } from '../components/CareerFlowGuide';
import {
  applyEquipmentPreset,
  dismissOnboarding,
  beginDescent,
  closeClimb,
  chooseRouteDecision,
  establishCamp,
  expeditionReadiness,
  fixRope,
  issueClimbOrder,
  leaveCache,
  meltSnow,
  resolveClimbStep,
  retreatClimb,
  selectMountain,
  selectRoute,
  selectWeatherWindow,
  setGearQuantity,
  startPlannedClimb,
  toggleTeamMember,
  updateExpeditionPlan,
  waitWeather,
} from '../core/career';
import type { CareerState, CareerTabId, ClimbOrderId, ClimbPace, ClimbStepResult, ExpeditionPlan, TrainingId, WorldState } from '../core/types';
import { CareerOverviewScreen } from './CareerOverviewScreen';
import { NewsScreen } from './NewsScreen';
import { RecordsScreen } from './RecordsScreen';
import { RivalsScreen } from './RivalsScreen';
import { WorldScreen } from './WorldScreen';
import { ClimbScreen } from './ClimbScreen';
import { EquipmentScreen } from './EquipmentScreen';
import { ExpeditionScreen } from './ExpeditionScreen';
import { JournalScreen } from './JournalScreen';
import { PeopleScreen } from './PeopleScreen';
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

const preparationTabs: Array<{ id: CareerTabId; label: string; note: string }> = [
  { id: 'ROUTE', label: '1. Цель', note: 'Гора и линия' },
  { id: 'TEAM', label: '2. Команда', note: 'Кто идёт' },
  { id: 'EQUIPMENT', label: '3. Снаряжение', note: 'Что берём' },
  { id: 'EXPEDITION', label: '4. Выход', note: 'Погода и проверка' },
  { id: 'PEOPLE', label: 'Досье', note: 'Отношения и память' },
];

const worldTabs: Array<{ id: CareerTabId; label: string }> = [
  { id: 'WORLD', label: 'Обзор' },
  { id: 'NEWS', label: 'Новости' },
  { id: 'RIVALS', label: 'Соперники' },
  { id: 'RECORDS', label: 'Рекорды' },
];

function WorkspaceSubnav({ activeTab, onTab }: { activeTab: CareerTabId; onTab: (tab: CareerTabId) => void }) {
  const inPreparation = preparationTabs.some(tab => tab.id === activeTab);
  const inWorld = worldTabs.some(tab => tab.id === activeTab);
  const tabs = inPreparation ? preparationTabs : inWorld ? worldTabs : [];
  if (!tabs.length) return null;
  return (
    <nav className="workspace-subnav" aria-label={inPreparation ? 'Шаги подготовки' : 'Разделы мира'}>
      {tabs.map(tab => (
        <button key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTab(tab.id)}>
          <strong>{tab.label}</strong>{'note' in tab ? <small>{String(tab.note)}</small> : null}
        </button>
      ))}
    </nav>
  );
}

export function CareerWorkspaceScreen({ world, career, activeTab, onTab, onPersist, onTrain, onExit, onAtlas }: Props) {
  const mobile = useIsMobile();
  useScrollReset(activeTab);
  function persistResult(result: ClimbStepResult) {
    onPersist(result.career);
    return result;
  }

  function renderMobileTab() {
    if (activeTab === 'OVERVIEW') return <MobileOverview world={world} career={career} onTrain={onTrain} onOpenExpedition={() => onTab(career.activeClimb ? 'CLIMB' : 'ROUTE')} onOpenWorld={() => onTab('WORLD')} />;
    if (activeTab === 'WORLD') return <MobileWorld world={world} career={career} />;
    if (activeTab === 'NEWS') return <MobileNews career={career} />;
    if (activeTab === 'RIVALS') return <MobileRivals career={career} />;
    if (activeTab === 'RECORDS') return <MobileRecords career={career} />;
    if (activeTab === 'JOURNAL') return <MobileJournal career={career} />;
    if (activeTab === 'PEOPLE') return <MobilePeople career={career} />;
    if (activeTab === 'ROUTE') return <MobileRoute world={world} career={career} onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))} onSelectRoute={routeId => onPersist(selectRoute(career, routeId))} onContinue={() => onTab('TEAM')} />;
    if (activeTab === 'TEAM') return <MobileTeam career={career} onToggle={memberId => onPersist(toggleTeamMember(career, memberId))} onContinue={() => onTab('EQUIPMENT')} onPeople={() => onTab('PEOPLE')} />;
    if (activeTab === 'EQUIPMENT') return <MobileEquipment career={career} onSetQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))} onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))} onPreset={preset => onPersist(applyEquipmentPreset(career, preset))} onContinue={() => onTab('EXPEDITION')} />;
    if (activeTab === 'EXPEDITION') return <MobileExpedition career={career} difficulty={world.config.difficulty} onOpenTab={onTab} onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))} onSetAcclimatization={days => onPersist(updateExpeditionPlan(career, { acclimatizationDays: days }))} onLaunch={() => { const readiness = expeditionReadiness(career); const next = startPlannedClimb(career); onPersist(next); if (next.activeClimb && readiness.blockers.length === 0) onTab('CLIMB'); }} />;
    if (activeTab === 'CLIMB' && career.activeClimb) return <MobileClimbScreen career={career} difficulty={world.config.difficulty} onStep={(pace: ClimbPace) => persistResult(resolveClimbStep(career, pace))} onCamp={() => persistResult(establishCamp(career))} onMeltSnow={() => persistResult(meltSnow(career))} onWait={() => persistResult(waitWeather(career))} onOrder={(order: ClimbOrderId) => persistResult(issueClimbOrder(career, order))} onChooseDecision={optionId => persistResult(chooseRouteDecision(career, optionId))} onFixRope={() => persistResult(fixRope(career))} onLeaveCache={() => persistResult(leaveCache(career))} onBeginDescent={() => onPersist(beginDescent(career))} onRetreat={() => onPersist(retreatClimb(career))} onClose={() => { onPersist(closeClimb(career)); onTab('OVERVIEW'); }} />;
    return <MobileJournal career={career} />;
  }

  function renderTab() {
    if (activeTab === 'OVERVIEW') {
      return <CareerOverviewScreen world={world} career={career} onTrain={onTrain} onOpenExpedition={() => onTab(career.activeClimb ? 'CLIMB' : 'ROUTE')} onOpenWorld={() => onTab('WORLD')} />;
    }
    if (activeTab === 'WORLD') return <WorldScreen world={world} career={career} />;
    if (activeTab === 'NEWS') return <NewsScreen career={career} />;
    if (activeTab === 'RIVALS') return <RivalsScreen career={career} />;
    if (activeTab === 'RECORDS') return <RecordsScreen career={career} />;
    if (activeTab === 'ROUTE') {
      return (
        <RoutePlanningScreen
          world={world}
          career={career}
          onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))}
          onSelectRoute={routeId => onPersist(selectRoute(career, routeId))}
          onContinue={() => onTab('TEAM')}
        />
      );
    }
    if (activeTab === 'TEAM') {
      return <TeamScreen career={career} onToggle={memberId => onPersist(toggleTeamMember(career, memberId))} onContinue={() => onTab('EQUIPMENT')} onPeople={() => onTab('PEOPLE')} />;
    }
    if (activeTab === 'PEOPLE') return <PeopleScreen career={career} />;
    if (activeTab === 'EQUIPMENT') {
      return (
        <EquipmentScreen
          career={career}
          onSetQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))}
          onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))}
          onPreset={preset => onPersist(applyEquipmentPreset(career, preset))}
          onContinue={() => onTab('EXPEDITION')}
        />
      );
    }
    if (activeTab === 'EXPEDITION') {
      return (
        <ExpeditionScreen
          career={career}
          difficulty={world.config.difficulty}
          onOpenTab={onTab}
          onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))}
          onSetAcclimatization={days => onPersist(updateExpeditionPlan(career, { acclimatizationDays: days }))}
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
          difficulty={world.config.difficulty}
          onStep={(pace: ClimbPace) => persistResult(resolveClimbStep(career, pace))}
          onCamp={() => persistResult(establishCamp(career))}
          onMeltSnow={() => persistResult(meltSnow(career))}
          onWait={() => persistResult(waitWeather(career))}
          onOrder={(order: ClimbOrderId) => persistResult(issueClimbOrder(career, order))}
          onChooseDecision={optionId => persistResult(chooseRouteDecision(career, optionId))}
          onFixRope={() => persistResult(fixRope(career))}
          onLeaveCache={() => persistResult(leaveCache(career))}
          onBeginDescent={() => onPersist(beginDescent(career))}
          onRetreat={() => onPersist(retreatClimb(career))}
          onClose={() => { onPersist(closeClimb(career)); onTab('OVERVIEW'); }}
        />
      );
    }
    return <JournalScreen career={career} world={world} />;
  }

  const mobilePrep = ['TEAM', 'EQUIPMENT', 'EXPEDITION'].includes(activeTab);
  const mobileWorld = ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'].includes(activeTab);

  if (mobile) {
    return (
      <MobileCareerShell world={world} career={career} activeTab={activeTab} onTab={onTab} onExit={onExit} onAtlas={onAtlas}>
        {mobilePrep && <nav className="m-subnav" aria-label="Подготовка"><button className={activeTab === 'TEAM' ? 'is-active' : ''} onClick={() => onTab('TEAM')}>Люди</button><button className={activeTab === 'EQUIPMENT' ? 'is-active' : ''} onClick={() => onTab('EQUIPMENT')}>Груз</button><button className={activeTab === 'EXPEDITION' ? 'is-active' : ''} onClick={() => onTab('EXPEDITION')}>Выход</button></nav>}
        {mobileWorld && <nav className="m-subnav m-subnav--world" aria-label="Живой мир"><button className={activeTab === 'WORLD' ? 'is-active' : ''} onClick={() => onTab('WORLD')}>Обзор</button><button className={activeTab === 'NEWS' ? 'is-active' : ''} onClick={() => onTab('NEWS')}>Новости</button><button className={activeTab === 'RIVALS' ? 'is-active' : ''} onClick={() => onTab('RIVALS')}>Люди</button><button className={activeTab === 'RECORDS' ? 'is-active' : ''} onClick={() => onTab('RECORDS')}>Рекорды</button></nav>}
        {renderMobileTab()}
      </MobileCareerShell>
    );
  }

  return (
    <CareerShell world={world} career={career} activeTab={activeTab} onTab={onTab} onExit={onExit} onAtlas={onAtlas}>
      <WorkspaceSubnav activeTab={activeTab} onTab={onTab} />
      <CareerFlowGuide career={career} activeTab={activeTab} onTab={onTab} onDismiss={() => onPersist(dismissOnboarding(career))} />
      {renderTab()}
    </CareerShell>
  );
}
