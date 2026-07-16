import { CareerShell } from '../components/CareerShell';
import { MobileCareerShell } from '../mobile/MobileCareerShell';
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
  applyToExpeditionOffer,
  applyEquipmentPreset,
  schoolExpeditionBoard,
  dismissOnboarding, setCareerTutorialStep,
  closeClimb,
  expeditionReadiness,
  selectMountain,
  selectRoute,
  selectWeatherWindow,
  setGearQuantity,
  startPlannedClimb,
  toggleTeamMember,
  setPermanentTeamStyle,
  saveCurrentAsPermanentTeam,
  usePermanentTeam,
  updateExpeditionPlan,
} from '../core/career';
import type { CareerState, CareerTabId, ExpeditionPlan, TrainingId, WorldState } from '../core/types';
import { CareerOverviewScreen } from './CareerOverviewScreen';
import { NewsScreen } from './NewsScreen';
import { RecordsScreen } from './RecordsScreen';
import { RivalsScreen } from './RivalsScreen';
import { WorldScreen } from './WorldScreen';
import { EquipmentScreen } from './EquipmentScreen';
import { ExpeditionScreen } from './ExpeditionScreen';
import { JournalScreen } from './JournalScreen';
import { PeopleScreen } from './PeopleScreen';
import { RoutePlanningScreen } from './RoutePlanningScreen';
import { TeamScreen } from './TeamScreen';
import { TopoExpeditionPrototype } from '../topography/TopoExpeditionPrototype';

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
  const expeditionLocked = Boolean(career.activeClimb);
  const tab = expeditionLocked ? 'CLIMB' as const : activeTab;
  const navigate = (next: CareerTabId) => { if (!expeditionLocked || next === 'CLIMB') onTab(next); };
  useScrollReset(tab);
  if (tab === 'CLIMB' && career.activeClimb) {
    return <TopoExpeditionPrototype
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
  function renderMobileTab() {
    if (tab === 'OVERVIEW') return <MobileOverview world={world} career={career} onTrain={onTrain} onOpenExpedition={() => onTab(career.activeClimb ? 'CLIMB' : 'ROUTE')} onOpenWorld={() => onTab('WORLD')} />;
    if (tab === 'WORLD') return <MobileWorld world={world} career={career} />;
    if (tab === 'NEWS') return <MobileNews career={career} />;
    if (tab === 'RIVALS') return <MobileRivals career={career} />;
    if (tab === 'RECORDS') return <MobileRecords career={career} />;
    if (tab === 'JOURNAL') return <MobileJournal career={career} />;
    if (tab === 'PEOPLE') return <MobilePeople career={career} />;
    if (tab === 'ROUTE') return <MobileRoute world={world} career={career} offers={schoolExpeditionBoard(world, career)} onAcceptOffer={offerId => onPersist(applyToExpeditionOffer(world, career, offerId))} onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))} onSelectRoute={routeId => onPersist(selectRoute(career, routeId))} onContinue={() => onTab('TEAM')} />;
    if (tab === 'TEAM') return <MobileTeam career={career} onToggle={memberId => onPersist(toggleTeamMember(career, memberId))} onSavePermanent={() => onPersist(saveCurrentAsPermanentTeam(career))} onTeamStyle={style => onPersist(setPermanentTeamStyle(career, style))} onUsePermanent={() => onPersist(usePermanentTeam(career))} onContinue={() => onTab('EQUIPMENT')} onPeople={() => onTab('PEOPLE')} />;
    if (tab === 'EQUIPMENT') return <MobileEquipment career={career} onSetQuantity={(gearId, quantity) => onPersist(setGearQuantity(career, gearId, quantity))} onSetPlan={(patch: Partial<ExpeditionPlan>) => onPersist(updateExpeditionPlan(career, patch))} onPreset={preset => onPersist(applyEquipmentPreset(career, preset))} onContinue={() => onTab('EXPEDITION')} />;
    if (tab === 'EXPEDITION') return <MobileExpedition career={career} difficulty={world.config.difficulty} onOpenTab={navigate} onSelectWeather={windowId => onPersist(selectWeatherWindow(career, windowId))} onSetAcclimatization={days => onPersist(updateExpeditionPlan(career, { acclimatizationDays: days }))} onLaunch={() => { const readiness = expeditionReadiness(career); const next = startPlannedClimb(career); onPersist(next); if (next.activeClimb && readiness.blockers.length === 0) onTab('CLIMB'); }} />;
    return <MobileJournal career={career} />;
  }

  function renderTab() {
    if (tab === 'OVERVIEW') {
      return <CareerOverviewScreen world={world} career={career} onTrain={onTrain} onOpenExpedition={() => onTab(career.activeClimb ? 'CLIMB' : 'ROUTE')} onOpenWorld={() => onTab('WORLD')} />;
    }
    if (tab === 'WORLD') return <WorldScreen world={world} career={career} />;
    if (tab === 'NEWS') return <NewsScreen career={career} />;
    if (tab === 'RIVALS') return <RivalsScreen career={career} />;
    if (tab === 'RECORDS') return <RecordsScreen career={career} />;
    if (tab === 'ROUTE') {
      return (
        <RoutePlanningScreen
          world={world}
          career={career}
          offers={schoolExpeditionBoard(world, career)}
          onAcceptOffer={offerId => onPersist(applyToExpeditionOffer(world, career, offerId))}
          onSelectMountain={mountainId => onPersist(selectMountain(career, mountainId))}
          onSelectRoute={routeId => onPersist(selectRoute(career, routeId))}
          onContinue={() => onTab('TEAM')}
        />
      );
    }
    if (tab === 'TEAM') {
      return <TeamScreen career={career} onToggle={memberId => onPersist(toggleTeamMember(career, memberId))} onSavePermanent={() => onPersist(saveCurrentAsPermanentTeam(career))} onTeamStyle={style => onPersist(setPermanentTeamStyle(career, style))} onUsePermanent={() => onPersist(usePermanentTeam(career))} onContinue={() => onTab('EQUIPMENT')} onPeople={() => onTab('PEOPLE')} />;
    }
    if (tab === 'PEOPLE') return <PeopleScreen career={career} />;
    if (tab === 'EQUIPMENT') {
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
    if (tab === 'EXPEDITION') {
      return (
        <ExpeditionScreen
          career={career}
          difficulty={world.config.difficulty}
          onOpenTab={navigate}
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
    if (tab === 'CLIMB' && career.activeClimb) {
      return <TopoExpeditionPrototype
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
    return <JournalScreen career={career} world={world} />;
  }

  const mobilePrep = !expeditionLocked && ['TEAM', 'EQUIPMENT', 'EXPEDITION'].includes(tab);
  const mobileWorld = !expeditionLocked && ['WORLD', 'NEWS', 'RIVALS', 'RECORDS'].includes(tab);

  if (mobile) {
    return (
      <MobileCareerShell world={world} career={career} activeTab={tab} onTab={navigate} locked={expeditionLocked} onExit={onExit} onAtlas={onAtlas}>
        {!expeditionLocked && <CareerFlowGuide career={career} activeTab={tab} onTab={navigate} onStep={step => onPersist(setCareerTutorialStep(career, step))} onDismiss={() => onPersist(dismissOnboarding(career))} />}
        {mobilePrep && <nav className="m-subnav" aria-label="Подготовка"><button className={tab === 'TEAM' ? 'is-active' : ''} onClick={() => navigate('TEAM')}>Люди</button><button className={tab === 'EQUIPMENT' ? 'is-active' : ''} onClick={() => navigate('EQUIPMENT')}>Груз</button><button className={tab === 'EXPEDITION' ? 'is-active' : ''} onClick={() => navigate('EXPEDITION')}>Выход</button></nav>}
        {mobileWorld && <nav className="m-subnav m-subnav--world" aria-label="Живой мир"><button className={tab === 'WORLD' ? 'is-active' : ''} onClick={() => navigate('WORLD')}>Обзор</button><button className={tab === 'NEWS' ? 'is-active' : ''} onClick={() => navigate('NEWS')}>Новости</button><button className={tab === 'RIVALS' ? 'is-active' : ''} onClick={() => navigate('RIVALS')}>Люди</button><button className={tab === 'RECORDS' ? 'is-active' : ''} onClick={() => navigate('RECORDS')}>Рекорды</button></nav>}
        {renderMobileTab()}
      </MobileCareerShell>
    );
  }

  return (
    <CareerShell world={world} career={career} activeTab={tab} onTab={navigate} locked={expeditionLocked} onExit={onExit} onAtlas={onAtlas}>
      <WorkspaceSubnav activeTab={tab} onTab={navigate} />
      {!expeditionLocked && <CareerFlowGuide career={career} activeTab={tab} onTab={navigate} onStep={step => onPersist(setCareerTutorialStep(career, step))} onDismiss={() => onPersist(dismissOnboarding(career))} />}
      {renderTab()}
    </CareerShell>
  );
}
