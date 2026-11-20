import { EXERCISES } from '../data/exercises.js';
import { GOALS } from '../data/options.js';
import { defaultTypeFor, getWorkoutType, MINIMO_MINUTES } from '../data/workout-types.js';
import { seededRandom } from './random.js';

const MAX_DISTINCT_EXERCISES = { full: 5, minimo: 2 };
const GOAL_BONUS = 0.6;

/**
 * Genera el entrenamiento del día.
 * Determinista por fecha + perfil + tipo + modo (estable aunque recargues).
 *
 * @param {{ profile: object, date: string, type?: string, mode?: 'full'|'minimo', catalog?: object[] }} input
 */
export function generateWorkout({ profile, date, type, mode = 'full', catalog = EXERCISES }) {
  const workoutType = getWorkoutType(type ?? defaultTypeFor(profile.goal));
  const level = profile.level;
  const timing =
    mode === 'minimo'
      ? { minutes: MINIMO_MINUTES, ...workoutType.minimo }
      : { minutes: profile.minutes, ...workoutType.intervals[level] };

  // +rest porque el último bloque no lleva descanso.
  const blocks = Math.max(1, Math.floor((timing.minutes * 60 + timing.rest) / (timing.work + timing.rest)));

  const pool = catalog.filter((exercise) => exercise.types.includes(workoutType.id) && exercise.level <= level);
  const ranked = workoutType.ordered ? pool : rankByGoal(pool, profile.goal, `${date}:${profile.goal}:${level}:${workoutType.id}:${mode}`);
  const picks = ranked.slice(0, Math.min(blocks, MAX_DISTINCT_EXERCISES[mode]));

  const steps = [];
  for (let i = 0; i < blocks; i += 1) {
    steps.push({ kind: 'work', seconds: timing.work, exercise: picks[i % picks.length] });
    if (timing.rest > 0 && i < blocks - 1) {
      steps.push({ kind: 'rest', seconds: timing.rest, next: picks[(i + 1) % picks.length] });
    }
  }

  return {
    date,
    type: workoutType.id,
    mode,
    minutes: timing.minutes,
    work: timing.work,
    rest: timing.rest,
    exercises: picks,
    steps,
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0),
  };
}

function rankByGoal(pool, goal, seed) {
  const rand = seededRandom(seed);
  const goalTag = GOALS.find((g) => g.id === goal)?.tag;
  return pool
    .map((exercise) => ({ exercise, score: rand() + (exercise.tags.includes(goalTag) ? GOAL_BONUS : 0) }))
    .sort((a, b) => b.score - a.score)
    .map(({ exercise }) => exercise);
}
