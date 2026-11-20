/** Catálogos de opciones del pacto. Contenido separado de la lógica. */

export const GOALS = [
  { id: 'habito', title: 'Crear el hábito', description: 'Moverme todos los días, sin excusas.', tag: 'core' },
  { id: 'energia', title: 'Tener más energía', description: 'Menos cansancio, más ganas.', tag: 'cardio' },
  { id: 'fuerza', title: 'Ganar fuerza', description: 'Ser más fuerte en mi día a día.', tag: 'fuerza' },
  { id: 'grasa', title: 'Perder grasa', description: 'Quemar más y sentirme más ligero.', tag: 'cardio' },
];

export const LEVELS = [
  { id: 1, title: 'Empiezo de cero', description: 'Hace mucho no entreno (o nunca lo he hecho).' },
  { id: 2, title: 'Me muevo a veces', description: 'Entreno de vez en cuando.' },
  { id: 3, title: 'Entreno seguido', description: 'Quiero un reto de verdad.' },
];

export const MINUTE_OPTIONS = [5, 10, 15, 20, 30];

export const WHY_SUGGESTIONS = [
  'Quiero demostrarme que sí puedo cumplirme.',
  'Quiero jugar con mis hijos sin cansarme.',
  'Quiero sentirme bien en mi cuerpo.',
  'Mi salud no puede esperar más.',
];

export const FEELINGS = [
  { id: 'duro', label: 'Duro' },
  { id: 'bien', label: 'Bien' },
  { id: 'energia', label: 'Con energía' },
];
