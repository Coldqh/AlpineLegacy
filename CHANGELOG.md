# Changelog

## 0.6.8 — Compact World Storage Hotfix

- полный процедурный мир больше не записывается одним многомегабайтным JSON в `localStorage`;
- сохраняется компактный manifest: seed, эпоха, год, сложность и стабильные метаданные мира;
- статическая экосистема восстанавливается детерминированно из seed при запуске;
- старые полные сохранения мира автоматически переводятся в компактный формат;
- ошибка `exceeded the quota` больше не должна останавливать генерацию на ПК;
- карьерный сейв, резервный ход и история экспедиции остаются отдельными и не удаляются.

## 0.6.7 — Strategic Decision Engine

- старое набивание `requiredProgress` заменено прохождением крупных физических участков целиком;
- маршрут теперь состоит из 5–7 содержательных секторов подъёма и не более 4 секторов спуска;
- перед сектором игрок собирает единый план: линия, темп, страховка и порядок группы;
- обычный участник не командует экспедицией: он выбирает позицию, личную нагрузку и реакцию на план руководителя;
- результат зависит от читаемых условий, совместимости решений, навыка, состояния, погоды и скрытой угрозы;
- после сектора игра показывает конкретные причины времени, потерь и успеха;
- время рассчитывается по физической длительности маршрута, а не по числу нажатий;
- низкие горы больше не получают тот же временной бюджет, что и высотные гиганты;
- повторное случайное прокликивание блокирует подъём или приводит к раннему отходу;
- повторная ошибка на спуске больше не создаёт бесконечный тупик: группа проходит сектор аварийно с последствиями;
- остановки вынесены в отдельное решение: продолжать, короткий бивак или полноценный сон;
- расход верёвки отражает потерю резерва, а не полное исчезновение рабочей линии после каждого сектора;
- активные сохранения 0.6.6 автоматически получают стратегический маршрут без сброса высоты;
- добавлены тесты против 94-часового прохождения низкой горы, случайного выбора первых кнопок и потери прогресса после перезагрузки.

## 0.6.6 — Expedition UX + Logic Rebuild

- экран экспедиции сокращён до высоты, текущей задачи, приказа и максимум четырёх действий;
- вторичные данные перенесены во вкладки группы, рюкзака, состояния и журнала;
- каждый ход показывает конкретную задачу, причину, подсказку и цену действий;
- подготовка критических участков стала последовательной: разведка, проверка поверхности, страховка и прохождение;
- на подготовленном участке успешное движение закрывает этап без бессмысленного многократного докликивания;
- правильная тактика зависит от рельефа: ледопад требует скорости после подготовки, гребень и трещины — запаса, подход — рабочего темпа;
- повторные ошибки на сложном участке усиливают последствия, а случайные движения не обходят обязательную подготовку;
- новичок выполняет порученную лагерную работу, но не принимает решение о самостоятельной остановке группы;
- шкала высоты упрощена и показывает старт, текущую отметку, вершину, следующий лагерь или ключевой участок;
- автосейв оптимизирован: основной сейв пишется один раз за действие, резервная копия — только на контрольных точках;
- журналы активной экспедиции ограничены по размеру, чтобы длительный поход не блокировал интерфейс;
- кнопки защищены от двойных нажатий, а тяжёлое действие сначала отдаёт кадр интерфейсу;
- генерация мира на ПК получила обработку ошибок, повторный запуск и возврат к настройкам вместо вечного экрана загрузки;
- добавлен анти-рандомный тест прохождения неподготовленного критического участка.

## 0.6.5 — Expedition Gameplay Fix

- все экспедиционные маршруты начинаются на высоте 0–1000 м и покрывают полный набор до настоящей вершины;
- старые маршруты и активные восхождения обновляются при загрузке сейва;
- высота показывается общей шкалой: старт, текущая отметка, лагеря, критические места и вершина;
- число этапов теперь в первую очередь зависит от полного перепада высоты и больше не упирается в один общий максимум;
- на каждом участке показываются только контекстные действия, подходящие рельефу, роли и состоянию;
- новичок не командует установкой лагеря: он выполняет лагерную работу после решения руководителя;
- базовый лагерь и промежуточные лагеря стали обязательными физическими этапами маршрута;
- точки страховки больше не расходуют метры основной верёвки, а стационарная линия остаётся отдельным дорогим решением;
- критические участки требуют подготовки, но не могут навсегда заблокироваться из-за исчерпанной верёвки;
- расход сил и длина этапов перебалансированы для полного подъёма и обязательного возвращения;
- при истощении игрок остаётся на горе и должен восстановиться, просить помощь или продолжать отход;
- схема сохранения переведена на v15 с миграцией v14.

## 0.6.4 — Expedition Hardening + Content Pipeline

- добавлены масштабы SMALL, MAJOR и GIANT с разным бюджетом этапов и действий;
- маршруты собираются из двенадцати terrain-модулей с собственными действиями, угрозами и подготовкой;
- критические участки требуют нескольких подготовительных действий перед безопасным прохождением;
- расчёт движения и расхода сил перебалансирован для длинных экспедиций;
- погода больше не уходит бесконечно в максимальный шторм и меняется вокруг климатического режима;
- неготовый критический участок может сорвать подъём, но подготовка реально снижает риск;
- поражения сохраняют подробную цепочку причин и не телепортируют игрока домой;
- участнические экспедиции получают общий организационный запас верёвки по масштабу похода;
- добавлен автосейв после каждого действия и резервная копия предыдущего хода;
- добавлено восстановление повреждённого сейва и ручной откат на один ход;
- replay сохраняет пост-состояния действий и проходит аудит последовательности;
- создан контент-пайплайн с отчётом по длительности, механикам, повторяемости и достижимости спуска;
- настройки получили экспорт контент-аудита, replay и управление резервным сохранением;
- схема сохранения переведена на v14 с миграцией v13;
- добавлены тесты контент-пайплайна, replay и восстановления сохранения.

## 0.6.3 — Expedition Simulation Rewrite

- восхождение переведено с последовательности сцен на физический пошаговый маршрут;
- каждый поход начинается на относительной отметке 0 м и требует полного возвращения;
- количество этапов масштабируется по высоте, длительности, техничности и экспозиции горы;
- добавлены движение, разведка линии, проверка поверхности, точки страховки и стационарные верёвки;
- сложные этапы требуют нескольких действий подготовки и прохождения;
- проверки навыков учитывают рельеф, погоду, усталость, груз и выполненную подготовку;
- события и приказы NPC теперь возникают поверх маршрута и не заменяют основной геймплей;
- после отказа от вершины или аварии формируется настоящий обратный маршрут;
- истощение переводит игрока в состояние выживания без мгновенного возвращения домой;
- добавлены лагерь, восстановление, еда, вода, топка снега, сброс груза и ожидание помощи;
- экспедиция завершается только возвращением к 0 м, эвакуацией или смертью;
- во время похода остальные вкладки блокируются;
- схема сохранения переведена на v13 с миграцией v12;
- добавлены проверки масштабирования этапов, критических участков, отхода и выживания.

## 0.6.2 — Playable Expedition Slice

- добавлена доска NPC-экспедиций с требованиями, ролями, руководителями и шансом принятия;
- заявка теперь получает детерминированный результат и сохраняется в карьере;
- участник начинает поход под командованием NPC и не получает общие полномочия;
- добавлен сценовый движок личных решений поверх графа маршрута;
- эталонный поход содержит не менее 25 содержательных действий;
- игрок может выполнить приказ, задать вопрос, отказаться, проявить инициативу или помочь человеку;
- решения меняют силы, состояние, доверие руководителя и группы, дисциплину, заботу и компетентность;
- характер NPC-руководителя влияет на темп и риск экспедиции;
- лагеря и акклиматизация встроены в длинный цикл подъёма и спуска;
- после возвращения руководитель выставляет оценку и начисляет очки ранга;
- отчёт экспедиции сохраняет личную оценку и историю решений;
- схема сохранения переведена на v12 с миграцией v11;
- автоматический баланс прогоняет новый участнический движок, а не старое прокликивание маршрута.

## 0.6.1 — Foundation Rewrite

- мир переведён на нормализованные реестры регионов, гор, маршрутов, организаций, NPC, снаряжения и заявок на экспедиции;
- статические определения отделены от изменяемого состояния мира;
- добавлены устойчивые ID-связи, селекторы и автоматический валидатор контента;
- маршруты получили граф фаз и целевой бюджет игрового времени;
- создано пять организаций, шестьдесят постоянных NPC и набор NPC-экспедиций на seed;
- новый герой выбирает организацию или независимую карьеру;
- новичок больше не получает готовую личную команду и не может отдавать общие приказы;
- независимый альпинист может идти соло или присоединиться к чужому походу;
- добавлены ранги от новичка до организатора и зависимые от ранга полномочия;
- старые карьеры мигрируют в schemaVersion 11 с сохранением прежних прав руководителя;
- добавлена архитектурная документация и проверки масштабируемого реестра.

## 0.5.5 — App Icon & PWA Branding

- добавлена фирменная иконка Alpine Legacy в стиле интерфейса игры;
- иконка заменила текстовый знак и номер версии в левом верхнем углу;
- добавлены PNG-иконки 16–1024 px, favicon.ico и Apple Touch Icon;
- manifest получил Android/PWA icons, включая maskable-вариант;
- добавлены мета-теги для iOS, Android и standalone web app;
- браузерная вкладка, ярлык сайта и установленное веб-приложение используют один визуальный знак.

## 0.5.4 — Playtest & Hardening

- добавлено контекстное обучение первой экспедиции с прямыми переходами к текущему шагу;
- обучение можно скрыть, а после первого завершённого выхода оно закрывается автоматически;
- Explorer показывает точные оценки и рекомендуемый темп;
- Climber округляет прогнозы и не выбирает за игрока;
- Expedition скрывает точные вероятности и состояния, не меняя физику мира;
- полевые сообщения стали конкретнее: видимость, ветер, холод, жажда, недосып и характер рельефа;
- увеличен минимальный размер служебного текста;
- второстепенные данные сильнее отделены от критических;
- отчёт экспедиции сохраняет seed, режим, действия, остатки ресурсов и причины исхода;
- отдельный playtest-отчёт и детерминированный balance sample можно скачать из журнала;
- сохранения переведены на schemaVersion 9.

## 0.5.3 — Vertical Slice

- первая доступная вершина каждого мира стала эталонной горой вертикального среза;
- три маршрута на ней получили собственные решения внутри линии;
- выбор линии меняет длительность, расход сил и вероятность инцидента;
- безопасные варианты могут требовать свободную верёвку;
- добавлено ручное закрепление технических участков;
- стационарная верёвка снижает риск на обратном пути;
- добавлены полевые закладки еды, воды и топлива;
- закладки автоматически возвращаются группе на спуске;
- спуск переведён на отдельный набор участков и отдельный профиль;
- на маршруте показываются время до темноты и ближайший лагерь;
- итоговый отчёт сохраняет выбор линии, закреплённые участки и найденные закладки;
- журнал получил экспорт полного сейва, replay-файла и seed;
- сохранения переведены на schemaVersion 8;
- добавлены тесты выбора линии, отдельного спуска, закладок и миграции v7.

### Validation

- 28 deterministic unit, migration and balance tests;
- TypeScript strict build;
- Vite production build;
- public npm registry lockfile.

## 0.5.2 — Playability & Feedback

- добавлен пошаговый проводник первой экспедиции;
- увеличен системный текст и упрощена визуальная иерархия;
- горы получили пять разных игровых характеров;
- характер горы влияет на время, энергию, погоду и риск спуска;
- подготовка объясняет реальные последствия веса, еды, топлива, верёвки и акклиматизации;
- перед каждым движением показываются время, расход сил, расход запасов и шанс инцидента;
- добавлены предупреждения перед тяжёлым отходом;
- полный журнал экспедиции свёрнут по умолчанию;
- итоговый экран разбирает сильные решения и ошибки;
- сохранения переведены на schemaVersion 7.

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
