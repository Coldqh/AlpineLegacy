import type { GearDefinition } from './types';

export const GEAR_CATALOG: GearDefinition[] = [
  { id: 'rope', name: 'Бухта верёвки', category: 'PROTECTION', description: 'Одна бухта — 50 метров рабочей линии. Каждый закреплённый участок расходует 20 метров.', weightKg: 3.4, unitCost: 72, maxQuantity: 4 },
  { id: 'rock-kit', name: 'Скальный комплект', category: 'PROTECTION', description: 'Закладки, крючья, карабины и станционные петли. Изнашивается только на камне и гребнях.', weightKg: 2.6, unitCost: 58, maxQuantity: 2 },
  { id: 'ice-kit', name: 'Ледовый комплект', category: 'PROTECTION', description: 'Ледобуры, инструменты и кошки. Изнашивается отдельно на леднике, фирне и крутом снегу.', weightKg: 3.1, unitCost: 64, maxQuantity: 2 },
  { id: 'tent', name: 'Высотная палатка', category: 'SHELTER', description: 'Один полноценный высотный лагерь. Даёт сон и остаётся на установленной площадке.', weightKg: 3.8, unitCost: 90, maxQuantity: 4 },
  { id: 'stove', name: 'Горелка', category: 'SURVIVAL', description: 'Топит снег, даёт воду и не позволяет группе остаться без тепла.', weightKg: 1.1, unitCost: 36, maxQuantity: 2 },
  { id: 'medkit', name: 'Горная аптечка', category: 'SURVIVAL', description: 'Перевязка, иммобилизация и первые действия при переохлаждении.', weightKg: 1.3, unitCost: 42, maxQuantity: 2 },
  { id: 'radio', name: 'Полевая связь', category: 'COMMUNICATION', description: 'Связь с клубом и нижней группой. Надёжность зависит от эпохи.', weightKg: 1.9, unitCost: 76, maxQuantity: 1 },
  { id: 'bivy', name: 'Бивачные мешки', category: 'SHELTER', description: 'Аварийное укрытие для всей связки.', weightKg: 0.8, unitCost: 28, maxQuantity: 3 },
];
