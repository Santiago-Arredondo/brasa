/**
 * Tipos de entrenamiento. Cada tipo define sus propios tiempos:
 * - intervals[nivel]: segundos de trabajo/descanso por nivel (1-3).
 * - minimo: tiempos para el modo mínimo (2 min).
 * - ordered: los ejercicios siguen el orden del catálogo (p. ej. caminata: cómodo → rápido).
 */

export const MINIMO_MINUTES = 2;

const BY_LEVEL = {
  1: { work: 30, rest: 30 },
  2: { work: 40, rest: 20 },
  3: { work: 45, rest: 15 },
};

export const WORKOUT_TYPES = [
  {
    id: 'funcional',
    name: 'Fuerza',
    icon: '💪',
    description: 'Tu cuerpo como gimnasio. Sin equipo.',
    intervals: BY_LEVEL,
    minimo: { work: 20, rest: 10 },
  },
  {
    id: 'cardio',
    name: 'Cardio',
    icon: '🔥',
    description: 'Sube pulsaciones y quema energía.',
    intervals: BY_LEVEL,
    minimo: { work: 20, rest: 10 },
  },
  {
    id: 'core',
    name: 'Core',
    icon: '🎯',
    description: 'Abdomen y espalda fuertes.',
    intervals: BY_LEVEL,
    minimo: { work: 20, rest: 10 },
  },
  {
    id: 'yoga',
    name: 'Yoga',
    icon: '🧘',
    description: 'Movilidad, respiración y calma.',
    intervals: {
      1: { work: 45, rest: 10 },
      2: { work: 50, rest: 10 },
      3: { work: 60, rest: 10 },
    },
    minimo: { work: 50, rest: 10 },
    restLabel: 'Transición',
  },
  {
    id: 'caminata',
    name: 'Caminata',
    icon: '🚶',
    description: 'Sal a moverte. Alterna ritmos.',
    intervals: {
      1: { work: 60, rest: 0 },
      2: { work: 90, rest: 0 },
      3: { work: 90, rest: 0 },
    },
    minimo: { work: 60, rest: 0 },
    ordered: true,
  },
];

const GOAL_DEFAULT_TYPE = {
  habito: 'funcional',
  energia: 'cardio',
  fuerza: 'funcional',
  grasa: 'cardio',
};

export const getWorkoutType = (id) => WORKOUT_TYPES.find((t) => t.id === id) ?? WORKOUT_TYPES[0];

export const defaultTypeFor = (goal) => GOAL_DEFAULT_TYPE[goal] ?? WORKOUT_TYPES[0].id;
