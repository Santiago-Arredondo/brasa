/**
 * Catálogo de ejercicios.
 *
 * - level: nivel mínimo (1-3) · types: tipos de entrenamiento donde aparece
 * - tags: afinidad con la meta ('fuerza' | 'cardio' | 'core')
 * - poses: 1 o 2 posiciones clave de la figura de referencia (se anima entre ellas)
 * - tempo: segundos de un ciclo de la animación
 * - prop: objeto de apoyo dibujado ({ kind: 'box', x, y, w, h } | { kind: 'wall', x })
 * - image (opcional): ruta a una foto/GIF propio; si existe, reemplaza la figura.
 *
 * Sistema de coordenadas de las poses: lienzo 100x100, suelo en y≈90.
 * Articulaciones: h cabeza · n cuello · s columna (opcional) · p cadera
 *                 le/lh codo/mano lejanos · re/rh codo/mano cercanos
 *                 lk/lf rodilla/pie lejanos · rk/rf rodilla/pie cercanos
 */

/* ---------- Poses base ---------- */

const SIDE = {
  h: [50, 12], n: [50, 22], p: [50, 50],
  le: [48, 36], lh: [50, 49], re: [52, 36], rh: [54, 49],
  lk: [49, 70], lf: [48, 90], rk: [51, 70], rf: [52, 90],
};

const FRONT = {
  h: [50, 12], n: [50, 22], p: [50, 50],
  le: [42, 35], lh: [40, 49], re: [58, 35], rh: [60, 49],
  lk: [46, 70], lf: [45, 90], rk: [54, 70], rf: [55, 90],
};

const PLANK_HIGH = {
  h: [80, 57], n: [72, 61], p: [40, 77],
  le: [73, 75], lh: [72, 90], re: [72, 75], rh: [71, 90],
  lk: [27, 84], lf: [14, 90], rk: [26, 83], rf: [12, 90],
};

const SQUAT_LOW = {
  h: [57, 32], n: [53, 41], p: [40, 64],
  le: [66, 40], lh: [79, 39], re: [67, 41], rh: [80, 40],
  lk: [57, 69], lf: [50, 90], rk: [59, 70], rf: [52, 90],
};

/** Intercambia extremidades lejanas y cercanas (paso alterno). */
const swapSides = (pose) => ({
  ...pose,
  le: pose.re, lh: pose.rh, re: pose.le, rh: pose.lh,
  lk: pose.rk, lf: pose.rf, rk: pose.lk, rf: pose.lf,
});

/** Refleja horizontalmente (vista frontal hacia el otro lado). */
const mirror = (pose) =>
  Object.fromEntries(
    Object.entries(pose).map(([joint, [x, y]]) => {
      const swapped = joint.length === 2 ? { l: 'r', r: 'l' }[joint[0]] + joint[1] : joint;
      return [swapped, [100 - x, y]];
    }),
  );

const SKATER = {
  h: [46, 15], n: [44, 25], p: [40, 52],
  le: [34, 36], lh: [28, 46], re: [52, 36], rh: [44, 48],
  lk: [36, 70], lf: [34, 90], rk: [44, 72], rf: [30, 86],
};

const WALK = {
  ...SIDE,
  le: [52, 36], lh: [57, 48], re: [47, 36], rh: [43, 48],
  lk: [47, 70], lf: [42, 90], rk: [54, 70], rf: [58, 90],
};

const BRISK_WALK = {
  ...SIDE,
  h: [52, 12], n: [51, 22],
  le: [56, 34], lh: [64, 28], re: [43, 35], rh: [47, 45],
  lk: [45, 70], lf: [38, 90], rk: [56, 69], rf: [62, 90],
};

const JOG = {
  h: [53, 13], n: [52, 23], p: [49, 50],
  le: [58, 33], lh: [65, 27], re: [42, 34], rh: [46, 44],
  lk: [44, 70], lf: [34, 84], rk: [62, 62], rf: [58, 80],
};

const HIGH_KNEES = {
  ...SIDE,
  le: [58, 30], lh: [64, 20], re: [42, 34], rh: [38, 44],
  lk: [49, 70], lf: [48, 90], rk: [69, 52], rf: [67, 72],
};

const CLIMBER = {
  ...PLANK_HIGH,
  p: [44, 72],
  lk: [28, 80], lf: [14, 90], rk: [60, 80], rf: [52, 88],
};

const BICYCLE = {
  h: [18, 74], n: [26, 80], p: [50, 88],
  le: [22, 68], lh: [16, 72], re: [23, 69], rh: [17, 73],
  lk: [68, 84], lf: [88, 86], rk: [44, 70], rf: [58, 72],
};

/* ---------- Catálogo ---------- */

export const EXERCISES = [
  /* --- Fuerza --- */
  {
    id: 'sentadillas', name: 'Sentadillas', cue: 'Cadera atrás, peso en los talones, pecho arriba.',
    level: 1, types: ['funcional'], tags: ['fuerza'], tempo: 2.4,
    poses: [{ ...SIDE, le: [63, 23], lh: [76, 23], re: [64, 24], rh: [77, 24] }, SQUAT_LOW],
  },
  {
    id: 'flexiones-inclinadas', name: 'Flexiones inclinadas', cue: 'Manos en una mesa o silla firme, cuerpo recto.',
    level: 1, types: ['funcional'], tags: ['fuerza'], tempo: 2.2,
    prop: { kind: 'box', x: 76, y: 70, w: 20, h: 24 },
    poses: [
      { h: [77, 38], n: [71, 44], p: [49, 63], le: [75, 57], lh: [79, 68], re: [76, 57], rh: [80, 68], lk: [34, 77], lf: [20, 90], rk: [33, 77], rf: [18, 90] },
      { h: [78, 53], n: [71, 57], p: [50, 70], le: [64, 64], lh: [79, 68], re: [65, 65], rh: [80, 68], lk: [35, 80], lf: [20, 90], rk: [34, 80], rf: [18, 90] },
    ],
  },
  {
    id: 'puente-gluteo', name: 'Puente de glúteo', cue: 'Empuja con los talones y aprieta glúteos arriba.',
    level: 1, types: ['funcional', 'core'], tags: ['fuerza', 'core'], tempo: 2.4,
    poses: [
      { h: [13, 84], n: [22, 87], p: [48, 88], le: [34, 89], lh: [46, 90], re: [34, 90], rh: [46, 91], lk: [63, 71], lf: [70, 90], rk: [64, 72], rf: [71, 90] },
      { h: [13, 84], n: [22, 87], p: [48, 73], le: [34, 89], lh: [46, 90], re: [34, 90], rh: [46, 91], lk: [65, 67], lf: [70, 90], rk: [66, 68], rf: [71, 90] },
    ],
  },
  {
    id: 'sentadilla-pared', name: 'Sentadilla en pared', cue: 'Espalda pegada a la pared, rodillas a 90°. Aguanta.',
    level: 1, types: ['funcional'], tags: ['fuerza'],
    prop: { kind: 'wall', x: 24 },
    poses: [{ h: [29, 30], n: [29, 40], p: [29, 64], le: [33, 52], lh: [42, 60], re: [34, 53], rh: [43, 61], lk: [48, 64], lf: [48, 90], rk: [49, 65], rf: [49, 90] }],
  },
  {
    id: 'zancadas', name: 'Zancadas alternas', cue: 'Paso largo, la rodilla de atrás casi toca el piso.',
    level: 2, types: ['funcional'], tags: ['fuerza'], tempo: 2.4,
    poses: [
      SIDE,
      { h: [48, 24], n: [48, 34], p: [48, 62], le: [47, 47], lh: [48, 58], re: [50, 47], rh: [51, 58], lk: [40, 84], lf: [26, 88], rk: [64, 68], rf: [64, 90] },
    ],
  },
  {
    id: 'flexiones', name: 'Flexiones', cue: 'Codos a 45°, cuerpo en línea recta, baja el pecho.',
    level: 2, types: ['funcional'], tags: ['fuerza'], tempo: 2,
    poses: [
      PLANK_HIGH,
      { h: [79, 80], n: [70, 82], p: [39, 86], le: [61, 76], lh: [72, 90], re: [60, 77], rh: [71, 90], lk: [26, 88], lf: [14, 90], rk: [25, 88], rf: [12, 90] },
    ],
  },
  {
    id: 'fondos-silla', name: 'Fondos en silla', cue: 'Manos en el borde de una silla, baja doblando codos.',
    level: 2, types: ['funcional'], tags: ['fuerza'], tempo: 2,
    prop: { kind: 'box', x: 12, y: 70, w: 26, h: 24 },
    poses: [
      { h: [40, 33], n: [38, 42], p: [40, 68], le: [36, 56], lh: [36, 70], re: [37, 56], rh: [37, 70], lk: [57, 66], lf: [63, 90], rk: [58, 66], rf: [64, 90] },
      { h: [42, 47], n: [40, 56], p: [42, 82], le: [27, 57], lh: [36, 70], re: [28, 58], rh: [37, 70], lk: [57, 74], lf: [63, 90], rk: [58, 74], rf: [64, 90] },
    ],
  },
  {
    id: 'sentadilla-salto', name: 'Sentadilla con salto', cue: 'Explota hacia arriba y aterriza suave.',
    level: 3, types: ['funcional', 'cardio'], tags: ['cardio', 'fuerza'], tempo: 1.4,
    poses: [
      SQUAT_LOW,
      { h: [50, 8], n: [50, 18], p: [50, 46], le: [44, 32], lh: [40, 44], re: [45, 33], rh: [41, 45], lk: [50, 66], lf: [51, 85], rk: [51, 66], rf: [52, 85] },
    ],
  },

  /* --- Cardio --- */
  {
    id: 'saltos-tijera', name: 'Saltos de tijera', cue: 'Abre piernas y brazos a la vez. Aterriza suave.',
    level: 1, types: ['cardio'], tags: ['cardio'], tempo: 0.9,
    poses: [
      { ...FRONT, le: [44, 36], lh: [43, 50], re: [56, 36], rh: [57, 50], lk: [48, 70], lf: [47, 90], rk: [52, 70], rf: [53, 90] },
      { ...FRONT, le: [41, 12], lh: [36, 2], re: [59, 12], rh: [64, 2], lk: [42, 70], lf: [36, 88], rk: [58, 70], rf: [64, 88] },
    ],
  },
  {
    id: 'rodillas-arriba', name: 'Rodillas arriba', cue: 'Trota en el sitio subiendo las rodillas a la cadera.',
    level: 1, types: ['cardio'], tags: ['cardio'], tempo: 0.8,
    poses: [HIGH_KNEES, swapSides(HIGH_KNEES)],
  },
  {
    id: 'boxeo-sombra', name: 'Boxeo de sombra', cue: 'Guardia arriba, golpes rápidos y rebota en los pies.',
    level: 1, types: ['cardio'], tags: ['cardio'], tempo: 0.8,
    poses: [
      { h: [50, 12], n: [48, 22], p: [46, 50], le: [56, 32], lh: [58, 20], re: [52, 34], rh: [56, 22], lk: [54, 70], lf: [58, 90], rk: [42, 70], rf: [38, 90] },
      { h: [52, 12], n: [50, 22], p: [46, 50], le: [56, 32], lh: [58, 20], re: [62, 24], rh: [76, 22], lk: [54, 70], lf: [58, 90], rk: [42, 70], rf: [38, 90] },
    ],
  },
  {
    id: 'escaladores', name: 'Escaladores', cue: 'Cadera baja, lleva las rodillas al pecho rápido.',
    level: 2, types: ['cardio', 'core'], tags: ['cardio', 'core'], tempo: 0.8,
    poses: [CLIMBER, swapSides(CLIMBER)],
  },
  {
    id: 'patinador', name: 'Saltos de patinador', cue: 'Salta de lado a lado cruzando la pierna atrás.',
    level: 2, types: ['cardio'], tags: ['cardio'], tempo: 1.4,
    poses: [SKATER, mirror(SKATER)],
  },
  {
    id: 'burpees', name: 'Burpees', cue: 'Pecho al piso, sube y salta con los brazos arriba.',
    level: 3, types: ['cardio'], tags: ['cardio'], tempo: 1.6,
    poses: [
      { h: [50, 16], n: [50, 26], p: [50, 54], le: [50, 13], lh: [51, 2], re: [51, 13], rh: [52, 2], lk: [49, 73], lf: [48, 90], rk: [51, 73], rf: [52, 90] },
      PLANK_HIGH,
    ],
  },

  /* --- Core --- */
  {
    id: 'plancha', name: 'Plancha', cue: 'Antebrazos al piso, abdomen firme, no hundas la cadera.',
    level: 1, types: ['core'], tags: ['core'],
    poses: [{ h: [79, 71], n: [70, 74], p: [39, 82], le: [70, 90], lh: [84, 90], re: [71, 90], rh: [85, 90], lk: [25, 86], lf: [12, 90], rk: [24, 86], rf: [11, 90] }],
  },
  {
    id: 'superman', name: 'Superman', cue: 'Boca abajo, eleva brazos y piernas. Mirada al piso.',
    level: 1, types: ['core'], tags: ['core'], tempo: 2.4,
    poses: [
      { h: [79, 88], n: [70, 90], p: [44, 90], le: [84, 89], lh: [96, 89], re: [84, 90], rh: [96, 90], lk: [28, 90], lf: [12, 90], rk: [28, 91], rf: [12, 91] },
      { h: [79, 82], n: [70, 86], p: [44, 90], le: [83, 80], lh: [95, 76], re: [83, 81], rh: [95, 77], lk: [28, 88], lf: [14, 84], rk: [28, 89], rf: [14, 85] },
    ],
  },
  {
    id: 'bicho-muerto', name: 'Bicho muerto', cue: 'Espalda pegada al piso, estira brazo y pierna contrarios.',
    level: 1, types: ['core'], tags: ['core'], tempo: 2.6,
    poses: [
      { h: [14, 84], n: [24, 88], p: [50, 88], le: [26, 74], lh: [28, 60], re: [27, 74], rh: [29, 60], lk: [52, 68], lf: [66, 68], rk: [53, 69], rf: [67, 69] },
      { h: [14, 84], n: [24, 88], p: [50, 88], le: [26, 74], lh: [28, 60], re: [12, 80], rh: [3, 76], lk: [70, 84], lf: [90, 86], rk: [53, 69], rf: [67, 69] },
    ],
  },
  {
    id: 'bicicleta', name: 'Abdominales bicicleta', cue: 'Codo hacia la rodilla contraria, sin jalar el cuello.',
    level: 2, types: ['core'], tags: ['core'], tempo: 1.6,
    poses: [BICYCLE, { ...swapSides(BICYCLE), h: BICYCLE.h, n: [27, 79], le: BICYCLE.le, lh: BICYCLE.lh, re: BICYCLE.re, rh: BICYCLE.rh }],
  },
  {
    id: 'plancha-lateral', name: 'Plancha lateral', cue: 'Cadera alta en línea. Cambia de lado a la mitad.',
    level: 2, types: ['core'], tags: ['core'], tempo: 2.6,
    poses: [
      { h: [78, 60], n: [70, 64], p: [41, 77], le: [70, 77], lh: [70, 90], re: [70, 50], rh: [70, 36], lk: [26, 84], lf: [14, 90], rk: [27, 84], rf: [15, 89] },
      { h: [78, 60], n: [70, 64], p: [41, 82], le: [70, 77], lh: [70, 90], re: [70, 50], rh: [70, 36], lk: [26, 87], lf: [14, 90], rk: [27, 87], rf: [15, 89] },
    ],
  },
  {
    id: 'elevacion-piernas', name: 'Elevación de piernas', cue: 'Piernas juntas, sube y baja lento sin arquear la espalda.',
    level: 2, types: ['core'], tags: ['core'], tempo: 2.6,
    poses: [
      { h: [14, 84], n: [24, 88], p: [50, 89], le: [36, 90], lh: [46, 90], re: [36, 91], rh: [46, 91], lk: [70, 89], lf: [90, 89], rk: [70, 90], rf: [90, 90] },
      { h: [14, 84], n: [24, 88], p: [50, 89], le: [36, 90], lh: [46, 90], re: [36, 91], rh: [46, 91], lk: [51, 69], lf: [52, 49], rk: [52, 69], rf: [53, 49] },
    ],
  },

  /* --- Yoga --- */
  {
    id: 'perro-boca-abajo', name: 'Perro boca abajo', cue: 'Cadera arriba, empuja el piso y alarga la espalda.',
    level: 1, types: ['yoga'], tags: ['core'], tempo: 4,
    poses: [
      { h: [71, 75], n: [66, 68], p: [50, 50], le: [72, 79], lh: [78, 90], re: [73, 79], rh: [79, 90], lk: [37, 70], lf: [24, 90], rk: [38, 70], rf: [25, 90] },
      { h: [71, 74], n: [66, 66], p: [50, 46], le: [72, 78], lh: [78, 90], re: [73, 78], rh: [79, 90], lk: [37, 68], lf: [24, 90], rk: [38, 68], rf: [25, 90] },
    ],
  },
  {
    id: 'gato-vaca', name: 'Gato-vaca', cue: 'Inhala y arquea (vaca); exhala y redondea (gato).',
    level: 1, types: ['yoga'], tags: ['core'], tempo: 4.5,
    poses: [
      { h: [77, 72], n: [70, 64], s: [53, 55], p: [36, 64], le: [70, 77], lh: [70, 90], re: [71, 77], rh: [71, 90], lk: [36, 90], lf: [18, 90], rk: [37, 90], rf: [19, 90] },
      { h: [79, 55], n: [70, 64], s: [53, 71], p: [36, 64], le: [70, 77], lh: [70, 90], re: [71, 77], rh: [71, 90], lk: [36, 90], lf: [18, 90], rk: [37, 90], rf: [19, 90] },
    ],
  },
  {
    id: 'postura-nino', name: 'Postura del niño', cue: 'Siéntate en los talones, brazos al frente. Respira.',
    level: 1, types: ['yoga'], tags: ['core'], tempo: 5,
    poses: [
      { h: [64, 86], n: [56, 80], s: [43, 76], p: [30, 80], le: [72, 88], lh: [86, 90], re: [72, 89], rh: [86, 91], lk: [50, 90], lf: [24, 90], rk: [51, 90], rf: [25, 90] },
      { h: [64, 85], n: [56, 78], s: [43, 73], p: [30, 80], le: [72, 88], lh: [86, 90], re: [72, 89], rh: [86, 91], lk: [50, 90], lf: [24, 90], rk: [51, 90], rf: [25, 90] },
    ],
  },
  {
    id: 'guerrero-2', name: 'Guerrero II', cue: 'Rodilla de adelante a 90°, brazos largos, mirada al frente.',
    level: 1, types: ['yoga'], tags: ['fuerza'], tempo: 4,
    poses: [
      { h: [50, 20], n: [50, 30], p: [50, 58], le: [36, 30], lh: [20, 30], re: [64, 30], rh: [80, 30], lk: [38, 74], lf: [26, 90], rk: [66, 66], rf: [70, 90] },
      { h: [50, 22], n: [50, 32], p: [50, 60], le: [36, 32], lh: [20, 31], re: [64, 32], rh: [80, 31], lk: [38, 75], lf: [26, 90], rk: [66, 68], rf: [70, 90] },
    ],
  },
  {
    id: 'cobra', name: 'Cobra', cue: 'Boca abajo, empuja con las manos y abre el pecho.',
    level: 1, types: ['yoga'], tags: ['core'], tempo: 4,
    poses: [
      { h: [79, 87], n: [70, 89], s: [58, 90], p: [46, 90], le: [62, 82], lh: [70, 90], re: [63, 83], rh: [71, 90], lk: [28, 90], lf: [12, 90], rk: [28, 91], rf: [12, 91] },
      { h: [74, 60], n: [68, 68], s: [60, 82], p: [46, 90], le: [69, 79], lh: [70, 90], re: [70, 80], rh: [71, 90], lk: [28, 90], lf: [12, 90], rk: [28, 91], rf: [12, 91] },
    ],
  },
  {
    id: 'pinza-de-pie', name: 'Pinza de pie', cue: 'Brazos arriba y baja lento hacia los pies. Rodillas suaves.',
    level: 1, types: ['yoga'], tags: ['core'], tempo: 4.5,
    poses: [
      { ...SIDE, le: [51, 11], lh: [52, 1], re: [52, 11], rh: [53, 1] },
      { h: [62, 83], n: [60, 74], s: [57, 60], p: [46, 50], le: [59, 82], lh: [56, 90], re: [60, 82], rh: [57, 90], lk: [48, 70], lf: [48, 90], rk: [49, 70], rf: [49, 90] },
    ],
  },
  {
    id: 'arbol', name: 'Postura del árbol', cue: 'Pie en la parte interna del muslo, encuentra el equilibrio.',
    level: 2, types: ['yoga'], tags: ['core'], tempo: 4,
    poses: [
      { ...FRONT, le: [42, 36], lh: [50, 34], re: [58, 36], rh: [50, 34], lk: [49, 70], lf: [49, 90], rk: [64, 62], rf: [50, 66] },
      { ...FRONT, le: [45, 11], lh: [50, 2], re: [55, 11], rh: [50, 2], lk: [49, 70], lf: [49, 90], rk: [64, 62], rf: [50, 66] },
    ],
  },

  /* --- Caminata (orden fijo: el generador alterna en este orden) --- */
  {
    id: 'paso-comodo', name: 'Paso cómodo', cue: 'Camina a un ritmo en el que puedas conversar.',
    level: 1, types: ['caminata'], tags: ['cardio'], tempo: 1.2,
    poses: [WALK, swapSides(WALK)],
  },
  {
    id: 'paso-rapido', name: 'Paso rápido', cue: 'Acelera, brazos a 90°. Te cuesta hablar, pero puedes.',
    level: 1, types: ['caminata'], tags: ['cardio'], tempo: 0.8,
    poses: [BRISK_WALK, swapSides(BRISK_WALK)],
  },
  {
    id: 'trote-suave', name: 'Trote suave', cue: 'Trota ligero, pasos cortos y respiración constante.',
    level: 2, types: ['caminata'], tags: ['cardio'], tempo: 0.7,
    poses: [JOG, swapSides(JOG)],
  },
];
