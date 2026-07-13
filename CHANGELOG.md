# Changelog

## 0.5.1 — UX Clarity & Mountain Selection

### Added

- full mountain selection across every generated summit;
- three route archetypes generated for each mountain;
- guided expedition flow: objective, team, equipment, final review;
- six primary navigation sections instead of twelve equal sidebar entries;
- secondary navigation for preparation and living-world screens;
- explicit training outcomes before committing time and money;
- mandatory and recommended equipment presets;
- clickable readiness breakdown and blocker repair actions;
- weather and acclimatization controls moved into the final expedition review;
- field-condition signal during an active climb;
- collapsible team orders to reduce climb-screen overload;
- save schema v6 and migration from v5.

### Changed

- increased operational text sizes across career and world workspaces;
- reduced card density and moved route segments behind progressive disclosure;
- preparation screens now finish with one obvious next-step action;
- mobile navigation reduced to six stable destinations;
- headquarters now states the current priority and explains training effects;
- old v0.5 objectives are mapped to the same mountain after migration.

### Fixed

- the player was locked to one qualification mountain;
- duplicate calendar identifier for the first rock camp;
- microscopic labels in several world, rival, record and climb panels;
- unclear meaning of readiness scores, equipment choices and preparation actions.

### Validation

- 19 deterministic unit, migration and balance tests;
- TypeScript strict build;
- Vite production build;
- public npm registry lockfile.

## 0.5.0 — Living World & Rivals

### Added

- autonomous regional simulation driven by career time;
- 30+ persistent world athletes with age, club, fame, specialty, ambition and career status;
- six competing clubs with prestige, expeditions, summits and losses;
- procedural NPC expeditions, team formation and target selection;
- first ascents, summit attempts, retreats, accidents, injuries, deaths and missing climbers;
- persistent mountain history with attempts, summits, losses and first-ascent holders;
- world news feed with filters and breaking reports;
- rival watch list, personal files, goals and regional rankings;
- record archive for altitude, summit count, first ascents, rescues and speed;
- club transfers for known competitors;
- new rookie generation when the career advances into a new year;
- player expeditions registered in world news and mountain history;
- dedicated **World**, **News**, **Rivals** and **Records** sidebar tabs;
- world signal card in the career headquarters.

### Changed

- every training action now advances the autonomous world;
- closing an expedition advances world simulation and publishes its result;
- club members injured, retired, lost or transferred in the world are synchronized with the player roster;
- sidebar expanded to twelve focused workspaces;
- save schema upgraded to v5 with migration from v4.

### Validation

- 16 deterministic unit and balance tests;
- TypeScript strict build;
- Vite production build;
- public npm registry lockfile.

## 0.4.0 — People & Consequences

### Added

- permanent **People** tab separated from expedition team selection;
- deterministic personality profiles for every NPC;
- personal goals, morale, availability, injuries and hidden health issues;
- six-dimensional relationship model: trust, respect, bond, rivalry, resentment and debt;
- persistent personal memory ledger for each climber;
- individual field condition, fatigue, morale, injuries and route status;
- team orders: slow down, press on, turn back the weakest member and assign a helper;
- deterministic acceptance or refusal based on personality, condition and relationship;
- shared summit, retreat, rescue, conflict and refusal memories;
- rare NPC death during severe exposed accidents;
- expedition reports with club response, press response, decisions and rewards;
- reputation profile for leadership, reliability, care and ambition;
- save schema v4 with migration from v3.

### Changed

- team selection now rejects dead, injured or unavailable climbers;
- expedition readiness uses the persistent social state of the roster;
- camps recover individual participants, not only an aggregate team bar;
- summit completion updates the history of every participant;
- failed expeditions are finalized into reports before the climb is closed;
- sidebar now contains eight focused workspaces.

### Validation

- 12 deterministic unit and balance tests;
- TypeScript strict build;
- Vite production build;
- public npm registry lockfile.

## 0.3.0 — Expedition Core

- sidebar workspace navigation;
- routes, weather windows, team selection and equipment planning;
- expedition readiness and field resources;
- camps, weather waiting, snow melting and mandatory descent.

## 0.2.0 — First Ascent

- character creation, origins, club and season;
- skills, training, health and reputation;
- first qualification climb and career journal.
