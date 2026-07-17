import { useState } from 'react';
import { CareerShell } from '../components/CareerShell';
import { CareerFlowGuide } from '../components/CareerFlowGuide';
import { TopoExpeditionLoader } from '../components/TopoExpeditionLoader';
import { useIsMobile, useScrollReset } from '../mobile/useMobile';
import { MobileCareerShell } from '../mobile/MobileCareerShell';
import {
  MobileViewportArchive,
  MobileViewportOverview,
  MobileViewportPeople,
  MobileViewportPreparation,
  MobileViewportStories,
  MobileViewportWorld,
} from '../mobile/MobileViewportScreens';
import {
  applyEquipmentPreset,
  applyToExpeditionOffer,
  closeClimb,
  dismissOnboarding,
  expeditionReadiness,
  schoolExpeditionBoard,
  selectMountain,
  selectRoute,
  selectWeatherWindow,
  setCareerTutorialStep,
  setGearQuantity,
  startPlannedClimb,
  toggleTeamMember,
  saveCurrentAsPermanentTeam,
  setPermanentTeamStyle,
  usePermanentTeam,
  travelToRegion,
  updateExpeditionPlan,
  waitForSchoolDeparture,
} from '../core/career';
import type { CareerState, CareerTabId, ExpeditionPlan, TrainingId, WorldState } from '../core/types';
import { CareerOverviewScreen } from './CareerOverviewScreen';
import { JournalScreen } from './JournalScreen';
import { PeopleScreen } from './PeopleScreen';
import { PreparationHubScreen } from './PreparationHubScreen';
import { WorldHubScreen } from './WorldHubScreen';
import { CareerStoriesScreen } from './CareerStoriesScreen';
import { markCareerStoriesRead, resolveCareerStory } from '../core/careerStories';

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

const preparationTabs: CareerTabId[] = ['ROUTE', 'TEAM', 'EQUIPMENT', 'EXPEDITION'];
const worldTabs: CareerTabId[] = ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'];

export function CareerWorkspaceScreen({ world, career, activeTab, onTab, onPersist, onTrain, onExit, onAtlas }: Props) {
  const mobile = useIsMobile();
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const expeditionLocked = Boolean(career.activeClimb);
  const tab = expeditionLocked ? 'CLIMB' as const : activeTab;
  const navigate = (next: CareerTabId) => { if (!expeditionLocked || next === 'CLIMB') onTab(next); };
  useScrollReset(tab);

  if (tab === 'CLIMB' && career.activeClimb) {
    return <TopoExpeditionLoader
      career={career}
      onPersist={onPersist}
      allowRegenerate={false}
      onExit={terminal => {
        if (terminal) {
          onPersist(closeClimb(career));
          onTab('OVERVIEW');
        } else onExit();
      }}
    />;
  }

  const launch = () => {
    const next = startPlannedClimb(career);
    onPersist(next);
    if (next.activeClimb) {
      setLaunchMessage(null);
      onTab('CLIMB');
      return;
    }
    const blocker = expeditionReadiness(next).blockers[0];
    setLaunchMessage(blocker ?? 'Экспедиция не началась. Проверь план выхода.');
  };

  const waitAndLaunch = () => {
    const next = waitForSchoolDeparture(world, career);
    onPersist(next);
    if (next.activeClimb) {
      setLaunchMessage(null);
      onTab('CLIMB');
      return;
    }
    const blocker = expeditionReadiness(next).blockers.find(item => !item.includes('ещё готовится')) ?? expeditionReadiness(next).blockers[0];
    setLaunchMessage(blocker ?? 'Школа не смогла начать выход. Выбери новый план.');
  };


  if (mobile) {
    const renderMobile = () => {
      if (tab === 'OVERVIEW') {
        return <MobileViewportOverview
          world={world}
          career={career}
          onTrain={onTrain}
          onOpenExpedition={() => onTab('EXPEDITION')}
          onWaitForDeparture={waitAndLaunch}
          onOpenStories={() => onTab('STORIES')}
        />;
      }
      if (preparationTabs.includes(tab)) {
        return <MobileViewportPreparation
          world={world}
          career={career}
          activeTab={tab}
          launchMessage={launchMessage}
          onTab={navigate}
          onAcceptOffer={offerId => onPersist(applyToExpeditionOffer(world, career, offerId))}
          onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))}
          onSelectRoute={routeId => onPersist(selectRoute(career, routeId))}
          onToggleMember={memberId => onPersist(toggleTeamMember(career, memberId))}
          onSetGearQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))}
          onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))}
          onPreset={preset => onPersist(applyEquipmentPreset(career, preset))}
          onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))}
          onLaunch={launch}
          onWaitForDeparture={waitAndLaunch}
          onOpenPeople={() => onTab('PEOPLE')}
          onSavePermanent={() => onPersist(saveCurrentAsPermanentTeam(career))}
          onUsePermanent={() => onPersist(usePermanentTeam(career))}
          onTeamStyle={style => onPersist(setPermanentTeamStyle(career, style))}
        />;
      }
      if (worldTabs.includes(tab)) {
        return <MobileViewportWorld
          world={world}
          career={career}
          activeTab={tab}
          onTab={navigate}
          onTravel={regionId => onPersist(travelToRegion(world, career, regionId))}
        />;
      }
      if (tab === 'PEOPLE') return <MobileViewportPeople career={career} />;
      if (tab === 'STORIES') return <MobileViewportStories career={career} onResolve={(eventId, choiceId) => onPersist(resolveCareerStory(career, eventId, choiceId))} onRead={() => onPersist(markCareerStoriesRead(career))} />;
      return <MobileViewportArchive world={world} career={career} />;
    };

    return <MobileCareerShell world={world} career={career} activeTab={tab} onTab={navigate} locked={expeditionLocked} onExit={onExit} onAtlas={onAtlas}><CareerFlowGuide career={career} activeTab={tab} onTab={navigate} onStep={step => onPersist(setCareerTutorialStep(career, step))} onDismiss={() => onPersist(dismissOnboarding(career))} />{renderMobile()}</MobileCareerShell>;
  }

  const renderTab = () => {
    if (tab === 'OVERVIEW') {
      return <CareerOverviewScreen
        world={world}
        career={career}
        onTrain={onTrain}
        onOpenExpedition={() => onTab('EXPEDITION')}
        onOpenWorld={() => onTab('WORLD')}
        onOpenStories={() => onTab('STORIES')}
        onWaitForDeparture={waitAndLaunch}
        launchMessage={launchMessage}
      />;
    }

    if (preparationTabs.includes(tab)) {
      return <PreparationHubScreen
        world={world}
        career={career}
        offers={schoolExpeditionBoard(world, career)}
        onAcceptOffer={offerId => onPersist(applyToExpeditionOffer(world, career, offerId))}
        onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))}
        onSelectRoute={routeId => onPersist(selectRoute(career, routeId))}
        onToggleMember={memberId => onPersist(toggleTeamMember(career, memberId))}
        onSetGearQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))}
        onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))}
        onPreset={preset => onPersist(applyEquipmentPreset(career, preset))}
        onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))}
        onOpenPeople={() => onTab('PEOPLE')}
        onLaunch={launch}
        onWaitForDeparture={waitAndLaunch}
        launchMessage={launchMessage}
      />;
    }

    if (worldTabs.includes(tab)) {
      return <WorldHubScreen
        world={world}
        career={career}
        initialView={tab}
        onTravel={regionId => onPersist(travelToRegion(world, career, regionId))}
      />;
    }

    if (tab === 'PEOPLE') return <PeopleScreen career={career} />;
    if (tab === 'STORIES') return <CareerStoriesScreen career={career} onResolve={(eventId, choiceId) => onPersist(resolveCareerStory(career, eventId, choiceId))} onRead={() => onPersist(markCareerStoriesRead(career))} />;
    return <JournalScreen career={career} world={world} />;
  };

  return (
    <CareerShell world={world} career={career} activeTab={tab} onTab={navigate} locked={expeditionLocked} onExit={onExit} onAtlas={onAtlas}>
      {!expeditionLocked && <CareerFlowGuide career={career} activeTab={tab} onTab={navigate} onStep={step => onPersist(setCareerTutorialStep(career, step))} onDismiss={() => onPersist(dismissOnboarding(career))} />}
      {renderTab()}
    </CareerShell>
  );
}
