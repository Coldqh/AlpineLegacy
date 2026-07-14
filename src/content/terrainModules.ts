import type { TerrainModuleDefinition, TerrainModuleId } from '../core/types';

export const TERRAIN_MODULES: Record<TerrainModuleId, TerrainModuleDefinition> = {
  APPROACH_TRAIL: {
    id: 'APPROACH_TRAIL', label: 'Подход', terrainKeywords: ['тропа', 'подход'], primarySkill: 'ENDURANCE', baseDifficulty: 18, baseExposure: 5, progressMultiplier: 1.18,
    preparationOptions: [[]], recommendedActions: ['MOVE_STEADY', 'MOVE_FAST', 'REST_SHORT'], campCompatible: true, descentDifficultyModifier: 1,
    description: 'Длинная работа с грузом. Главные угрозы — неверный темп и ранняя потеря сил.',
  },
  MORAINE: {
    id: 'MORAINE', label: 'Морена', terrainKeywords: ['морен', 'осып', 'камень'], primarySkill: 'ENDURANCE', baseDifficulty: 27, baseExposure: 18, progressMultiplier: 1,
    preparationOptions: [['ROUTE_SCOUTED'], ['TEAM_STABILIZED']], recommendedActions: ['SCOUT_LINE', 'HELP_TEAM', 'MOVE_CAUTIOUS'], campCompatible: true, descentDifficultyModifier: 5,
    description: 'Неустойчивые камни, тяжёлый груз и растянутая колонна.',
  },
  GLACIER: {
    id: 'GLACIER', label: 'Ледник', terrainKeywords: ['ледник', 'фирн'], primarySkill: 'NAVIGATION', baseDifficulty: 36, baseExposure: 28, progressMultiplier: .93,
    preparationOptions: [['SURFACE_CHECKED'], ['ROUTE_SCOUTED', 'ANCHOR_PLACED']], recommendedActions: ['CHECK_SURFACE', 'SCOUT_LINE', 'PLACE_ANCHOR', 'MOVE_CAUTIOUS'], campCompatible: true, descentDifficultyModifier: 6,
    description: 'Связка, дистанция, чтение поверхности и контроль скрытых провалов.',
  },
  CREVASSE_FIELD: {
    id: 'CREVASSE_FIELD', label: 'Поле трещин', terrainKeywords: ['трещин', 'лабиринт'], primarySkill: 'NAVIGATION', baseDifficulty: 48, baseExposure: 44, progressMultiplier: .78,
    preparationOptions: [['SURFACE_CHECKED', 'ANCHOR_PLACED'], ['ROUTE_SCOUTED', 'ROPE_FIXED']], recommendedActions: ['CHECK_SURFACE', 'SCOUT_LINE', 'PLACE_ANCHOR', 'FIX_ROPE'], campCompatible: false, descentDifficultyModifier: 8,
    description: 'Нельзя пройти одним нажатием: требуется чтение мостов и готовая система удержания.',
  },
  ICEFALL: {
    id: 'ICEFALL', label: 'Ледопад', terrainKeywords: ['серач', 'ледопад', 'обломки'], primarySkill: 'ICE', baseDifficulty: 56, baseExposure: 58, progressMultiplier: .72,
    preparationOptions: [['SURFACE_CHECKED', 'ROPE_FIXED'], ['ROUTE_SCOUTED', 'ANCHOR_PLACED']], recommendedActions: ['CHECK_SURFACE', 'FIX_ROPE', 'PLACE_ANCHOR', 'MOVE_FAST'], campCompatible: false, descentDifficultyModifier: 10,
    description: 'Опасная зона с ограниченным временем. Подготовка и скорость должны быть сбалансированы.',
  },
  ROCK_WALL: {
    id: 'ROCK_WALL', label: 'Скальная стена', terrainKeywords: ['стена', 'скал', 'рёбр'], primarySkill: 'ROCK', baseDifficulty: 54, baseExposure: 55, progressMultiplier: .76,
    preparationOptions: [['ROUTE_SCOUTED', 'ANCHOR_PLACED'], ['ROPE_FIXED']], recommendedActions: ['SCOUT_LINE', 'PLACE_ANCHOR', 'FIX_ROPE', 'MOVE_CAUTIOUS'], campCompatible: false, descentDifficultyModifier: 9,
    description: 'Линия, точки, работа первого и сохранение системы для обратного пути.',
  },
  MIXED_FACE: {
    id: 'MIXED_FACE', label: 'Микст', terrainKeywords: ['микст', 'смешан'], primarySkill: 'ROCK', baseDifficulty: 62, baseExposure: 62, progressMultiplier: .68,
    preparationOptions: [['ROUTE_SCOUTED', 'ANCHOR_PLACED', 'SURFACE_CHECKED'], ['ROPE_FIXED', 'SURFACE_CHECKED']], recommendedActions: ['SCOUT_LINE', 'CHECK_SURFACE', 'PLACE_ANCHOR', 'FIX_ROPE'], campCompatible: false, descentDifficultyModifier: 11,
    description: 'Смена льда и камня требует нескольких разных проверок до движения.',
  },
  SNOW_SLOPE: {
    id: 'SNOW_SLOPE', label: 'Снежный склон', terrainKeywords: ['снег', 'кулуар', 'склон'], primarySkill: 'ICE', baseDifficulty: 42, baseExposure: 48, progressMultiplier: .84,
    preparationOptions: [['SURFACE_CHECKED'], ['ROUTE_SCOUTED', 'TEAM_STABILIZED']], recommendedActions: ['CHECK_SURFACE', 'SCOUT_LINE', 'HELP_TEAM', 'MOVE_CAUTIOUS'], campCompatible: false, descentDifficultyModifier: 7,
    description: 'Состояние слоя и нагрузка группы важнее очевидного направления вверх.',
  },
  RIDGE: {
    id: 'RIDGE', label: 'Гребень', terrainKeywords: ['гребень', 'кромка', 'купол'], primarySkill: 'ROCK', baseDifficulty: 46, baseExposure: 60, progressMultiplier: .82,
    preparationOptions: [['ROUTE_SCOUTED'], ['ANCHOR_PLACED'], ['TEAM_STABILIZED']], recommendedActions: ['SCOUT_LINE', 'PLACE_ANCHOR', 'HELP_TEAM', 'MOVE_CAUTIOUS'], campCompatible: false, descentDifficultyModifier: 10,
    description: 'Ветер, карнизы и ограниченное место для ошибок.',
  },
  ALTITUDE_PLATEAU: {
    id: 'ALTITUDE_PLATEAU', label: 'Высотное плато', terrainKeywords: ['плато', 'плечо', 'чаша'], primarySkill: 'ENDURANCE', baseDifficulty: 38, baseExposure: 30, progressMultiplier: .88,
    preparationOptions: [['TEAM_STABILIZED'], ['ROUTE_SCOUTED']], recommendedActions: ['HELP_TEAM', 'REST_SHORT', 'SCOUT_LINE', 'MOVE_STEADY'], campCompatible: true, descentDifficultyModifier: 6,
    description: 'Монотонный набор, высота и медленное накопление усталости.',
  },
  CAMP_ZONE: {
    id: 'CAMP_ZONE', label: 'Лагерь', terrainKeywords: ['лагерь'], primarySkill: 'ENDURANCE', baseDifficulty: 12, baseExposure: 8, progressMultiplier: 1,
    preparationOptions: [[]], recommendedActions: ['MAKE_CAMP', 'EAT_DRINK', 'MELT_SNOW'], campCompatible: true, descentDifficultyModifier: 0,
    description: 'Площадка для восстановления, перераспределения груза и оценки состояния.',
  },
  EXIT_TRAIL: {
    id: 'EXIT_TRAIL', label: 'Выход', terrainKeywords: ['выход', 'возвращение'], primarySkill: 'ENDURANCE', baseDifficulty: 22, baseExposure: 8, progressMultiplier: 1.1,
    preparationOptions: [[]], recommendedActions: ['MOVE_STEADY', 'REST_SHORT', 'HELP_TEAM'], campCompatible: true, descentDifficultyModifier: 2,
    description: 'Простой рельеф остаётся опасным при полном истощении.',
  },
};

export function terrainModuleById(id: TerrainModuleId) {
  return TERRAIN_MODULES[id];
}

export function detectTerrainModule(terrain: string, phase?: string): TerrainModuleDefinition {
  const normalized = terrain.toLowerCase();
  if (phase === 'APPROACH') return TERRAIN_MODULES.APPROACH_TRAIL;
  if (phase === 'EXIT') return TERRAIN_MODULES.EXIT_TRAIL;
  if (phase === 'CAMP' || phase === 'BASE_CAMP') return TERRAIN_MODULES.CAMP_ZONE;
  const ordered: TerrainModuleId[] = ['CREVASSE_FIELD', 'ICEFALL', 'MIXED_FACE', 'ROCK_WALL', 'RIDGE', 'SNOW_SLOPE', 'ALTITUDE_PLATEAU', 'GLACIER', 'MORAINE'];
  for (const id of ordered) {
    const module = TERRAIN_MODULES[id];
    if (module.terrainKeywords.some(keyword => normalized.includes(keyword))) return module;
  }
  return TERRAIN_MODULES.MORAINE;
}
