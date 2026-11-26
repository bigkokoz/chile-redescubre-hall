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

/** Menú del arqueólogo: lo que se encontró en el sitio (todo sale del texto de la clase; lo interpretado va marcado). `kind` = qué réplica aparece en tus manos. */
export const HALLAZGOS = [
  { id: 'madera', kind: 'madera', titulo: 'Madera: tablones y estacas', texto: [
    'Los cimientos de las habitaciones eran troncos pequeños y gruesas tablas, con palos verticales clavados cada cierto trecho.',
    'Se conservaron porque la turba los mantuvo húmedos y sin oxígeno. La madera casi siempre se pudre; aquí quedó como si el tiempo se hubiera detenido.',
    'De madera también se hallaron una punta de lanza, palos cavadores y tres morteros trabajados a mano.',
  ] },
  { id: 'piel', kind: 'piel', titulo: 'Restos de piel', texto: [
    'En algunos palos caídos quedaron restos de piel de animal.',
    'Por eso se piensa que las paredes y el techo eran de pieles sobre un armazón de madera. Es una interpretación: el techo no se conserva.',
  ] },
  { id: 'huesos', kind: 'hueso', titulo: 'Huesos de mastodonte', texto: [
    'Se encontraron restos de grandes animales. La ficha oficial habla de cinco o seis mastodontes; otras fuentes los llaman gonfoterios.',
    'La mayoría de los restos estaba dentro de la estructura en U. Pudieron comerse como carroña o como caza: no hay acuerdo.',
  ] },
  { id: 'hoja', kind: 'hoja', titulo: 'Hojas masticadas', texto: [
    'Entre los restos hay hojas que alguien mascó y dejó. Se interpretan como uso medicinal.',
    'Se encontraron varias especies de plantas medicinales. Otras fuentes hablan de unas veintitrés a veintiséis. Las cifras varían.',
  ] },
  { id: 'papa', kind: 'papa', titulo: 'Papas silvestres y semillas', texto: [
    'Hay restos de papas silvestres, semillas, frutas, nueces, bayas y hongos.',
    'Muestran que el grupo recolectaba muchas plantas del bosque y del río.',
  ] },
  { id: 'alga', kind: 'alga', titulo: 'Algas del Pacífico', texto: [
    'Las algas se recolectaron en la costa del Pacífico, lejos de aquí, y se llevaron al campamento.',
    'Dan yodo y sal. Muestran que el grupo conocía la costa y el interior, y se movía o intercambiaba entre ambos.',
  ] },
  { id: 'piedra', kind: 'piedra', titulo: 'Piedras y boleadoras', texto: [
    'De piedra hay rocas redondeadas del tamaño de un huevo, posibles piedras de honda, y boleadoras.',
    'Una boleadora son piedras redondas atadas con cuerdas, que se lanzan para enredar las patas de un animal. También hay dos puntas de proyectil alargadas.',
  ] },
  { id: 'carbon', kind: 'carbon', titulo: 'Carbón del fogón', texto: [
    'Los fogones eran pozos poco profundos cubiertos con arcilla, que servían como braseros.',
    'El carbón que dejaron sirve para calcular la edad con carbono catorce. Así se estima que la gente vivió aquí hace unos 14.800 años; otras fuentes citan 14.500.',
  ] },
];

/** La historia del humo: cada capítulo trae su imagen (humo_img.js) y su texto. Teorías de cómo llegaron los primeros pueblos a América: nadie lo sabe con certeza. */
export const HUMO = [
  { img: 'humo', t: ['Mira cómo sube el humo. Esta noche te cuenta una historia muy larga: cómo pudieron llegar hasta aquí los antepasados de este grupo.', 'Es una historia con partes seguras y partes que los científicos todavía discuten.'] },
  { img: 'asia', t: ['Lo más sólido es esto: la genética y la arqueología coinciden en que los primeros pueblos de América venían de Asia, desde la región de Siberia.', 'Lo que se discute es cuándo cruzaron, y por dónde.'] },
  { img: 'beringia', t: ['Durante la última Edad de Hielo, hace más de veinte mil años, mucha agua estaba atrapada en los glaciares y el mar estaba más bajo.', 'Entre Siberia y Alaska apareció entonces una gran llanura, llamada Beringia.', 'Algunos estudios genéticos proponen que los antepasados vivieron allí aislados durante miles de años, antes de seguir hacia el sur. Se llama la pausa de Beringia.'] },
  { img: 'corredor', t: ['Durante mucho tiempo se pensó que cruzaron por un corredor libre de hielo, entre dos enormes glaciares, por el interior de Norteamérica.', 'Pero varios estudios indican que ese pasillo habría quedado transitable hace unos trece mil años. Y Monte Verde es más antiguo que eso.'] },
  { img: 'costa', t: ['Por eso hoy muchos investigadores piensan en otra ruta: la costa del Pacífico.', 'Avanzando por la orilla, a pie o en botes sencillos, había bosques de algas, aves, focas y mariscos para comer. Se le llama la autopista de algas.', 'Y un detalle de este mismo campamento encaja con esa idea: aquí aparecieron algas marinas, traídas desde una costa lejana.'] },
  { img: 'sur', t: ['Por la costa se puede avanzar rápido. Según algunos cálculos, se pudo recorrer América de norte a sur en pocos siglos.', 'Así, un grupo pudo llegar a estos bosques húmedos del sur de Chile hace unos catorce mil ochocientos años.'] },
  { img: 'huellas', t: ['Otros sitios también hablan de gente muy temprana. En White Sands, en Estados Unidos, hay huellas humanas que se han fechado entre veintiuno y veintitrés mil años. Todavía se discute.', 'Cada hallazgo nuevo mueve la fecha un poco más atrás.'] },
  { img: 'atlantico', t: ['También se ha propuesto que llegaron cruzando el Atlántico desde Europa. Esa idea no tiene respaldo en los estudios de ADN.'] },
  { img: 'cierre', t: ['Así que nadie sabe con certeza cómo llegaron los antepasados de este campamento.', 'Lo que sí sabemos es que vivieron aquí, que conocían el bosque, el río y la costa, y que se quedaron mucho tiempo.', 'El humo se va, pero la pregunta sigue abierta.'] },
];
