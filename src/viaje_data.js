import { MV_STOPS } from './mv_data.js';

// Paradas de "El viaje a Monte Verde" (mundo hecho en Blender). pos = [x, altura sobre el suelo, z] en coordenadas del visor.
// La parada 0 es la máquina del tiempo (en el presente); las demás explican el pasado (cada una usa el texto de la clase de Monte Verde).
const POS = {
  bienvenida: [0.5, 1.9, 5.0], arroyo: [5.5, 1.2, 9.0], carpa: [4.5, 2.4, 3.1], fogones: [1.5, 1.0, 5.8], medicina: [-3.4, 1.9, 3.2],
  algas: [0.3, 1.1, 8.3], mastodonte: [7.0, 2.0, 1.5], herramientas: [1.9, 1.2, 7.2], tiempo: [0.5, 1.7, 2.6],
};
const AJUSTE = {
  carpa: (t) => ['Aquí ves dos de las carpas de la recreación. La real era mucho más grande: una gran carpa con doce habitaciones.', ...t.slice(0)],
  medicina: (t) => ['Esta carpa más chica representa la estructura en U, la zona apartada del campamento.', ...t.slice(1)],
};

export const MAQUINA = {
  id: 'maquina', titulo: 'La máquina del tiempo', pos: [2.4, 1.5, 4.8], texto: [
    'Esta es la máquina del tiempo. Es un invento de esta maqueta: no existió, pero nos sirve para viajar.',
    'Cuando tires la palanca, este valle va a cambiar y verás cómo pudo ser hace unos 14.800 años.',
    'Fíjate en lo que cambia: el bosque, el río y la gente que vivió aquí. Cuando quieras volver, toca el cristal que flota junto al fuego.',
    'Prepárate. Tira la palanca.',
  ],
  qa: [['¿Existe una máquina así?', 'No. Es una forma de mostrar el paso del tiempo: el mismo lugar, hoy y hace miles de años.'], ['¿Qué voy a ver?', 'Una interpretación hecha con datos de la arqueología: un campamento junto al río, con gente cocinando, trabajando pieles y moliendo plantas.']],
};

export const VIAJE_STOPS = [MAQUINA, ...MV_STOPS.map((s) => ({ ...s, texto: AJUSTE[s.id] ? AJUSTE[s.id](s.texto) : s.texto, pos: POS[s.id] }))];

/** Frases sueltas del viaje (se narran sin ser una parada). */
export const FRASES = {
  llegada: 'Llegaste. Estás en el mismo lugar, pero hace unos catorce mil ochocientos años. Acércate a las esferas luminosas y escucha.',
};

/** Qué decir al agarrar cada comida (todo sale de los restos que menciona la ficha; sin inventar). */
export const COMIDA = {
  papa: 'Papa silvestre. En Monte Verde se encontraron restos de papas silvestres: eran parte de la comida del grupo.',
  bayas: 'Bayas. Entre los restos hay frutas y bayas, que se recolectaban cerca del campamento.',
  alga: 'Alga marina. Se recolectaban en la costa del Pacífico y se llevaban al campamento: aportan yodo y sal.',
  carne: 'Carne. Hay restos de animales, incluso de grandes animales como mastodontes. No se sabe si los cazaban o los aprovechaban ya muertos.',
  nuez: 'Nueces y semillas. También se encontraron restos de semillas y nueces.',
  hongo: 'Hongos. Aparecen entre los restos de alimentos del campamento.',
};
