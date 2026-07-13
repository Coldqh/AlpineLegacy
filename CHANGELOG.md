# Changelog

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
