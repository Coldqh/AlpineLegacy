# Changelog

## 0.2.0 — First Ascent

### Added

- character creation with name, age and three origins;
- six career skills and skill progression;
- procedural mountaineering club, mentor and club doctrine;
- season calendar and weekly training actions;
- form, fatigue, health, morale, reputation and money;
- career hub and structured field journal;
- qualification target compatible with old high-altitude worlds;
- five-stage step-by-step climbing route;
- cautious, steady and fast movement modes;
- deterministic incidents, delays, injuries and forced termination;
- summit state followed by mandatory descent;
- retreat and complete expedition result screens;
- career archive and schema v2 local save;
- balance and career tests.

### Changed

- world geography no longer depends on the chosen historical era;
- mountain history is generated strictly before the selected career year;
- mountain generation now creates an elevation ladder from club peaks to a regional flagship;
- package versions are pinned;
- package lock uses the public npm registry;
- GitHub Pages workflow uses Node 24 generation actions.

### Compatibility

World saves under `alpine-legacy:world:v1` remain readable. Careers are stored separately under `alpine-legacy:career:v2`.
