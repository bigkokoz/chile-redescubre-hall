// Contenido de la clase recorrida de Monte Verde.
// Fuentes consultadas (26-nov-2026): Consejo de Monumentos Nacionales (ficha de Patrimonio Mundial, lista tentativa), Memoria Chilena,
// Archaeology (revista del AIA), Discover, NBC/Science News sobre las algas (Dillehay et al., 2008). Las cifras varían entre fuentes:
// cada parada marca qué es dato y qué es interpretación. VERIFICAR con las publicaciones de Dillehay y la UACh antes de citar.

export const MV_STOPS = [
  {
    id: 'bienvenida', titulo: 'Bienvenida a Monte Verde', pos: [0, 1.5, 4.6], texto: [
      'Estás en una representación de Monte Verde, un sitio arqueológico del sur de Chile, en los bosques siempreverdes de las cordilleras bajas.',
      'Se calcula que la gente vivió aquí hace unos 14.800 años, según fechados de carbono 14 calibrados. Otras fuentes citan 14.500.',
      'Antes de Monte Verde se pensaba que los primeros habitantes de América habían llegado hace unos 10.500 años. Este sitio es al menos 1.500 años más antiguo que eso.',
      'Lo que ves es una recreación: las distancias están acortadas y los detalles son interpretaciones. Camina, acércate a cada esfera luminosa y escucha.',
    ],
    qa: [['¿Esto es real o inventado?', 'Es una interpretación artística hecha con los datos publicados. La arqueología encontró restos de madera, cuero, plantas y huesos; cómo se veía todo es una reconstrucción.'], ['¿Dónde queda Monte Verde?', 'Cerca de Puerto Montt, en el sur de Chile, junto a un pequeño arroyo. La fuente oficial no da coordenadas.']],
  },
  {
    id: 'arroyo', titulo: 'El arroyo y la turbera', pos: [4.5, 1.3, -13.6], texto: [
      'Este grupo habitó a lo largo de las playas y bancos de arena y grava de un pequeño arroyo, el arroyo Chinchihuapi.',
      'Después de la ocupación, una capa de turba formada por un pantano cubrió todo el sitio.',
      'Esa turba sin oxígeno conservó cosas que normalmente se pudren: madera, cuero, restos de plantas e incluso hojas masticadas.',
      'Por eso sabemos tanto de un lugar tan antiguo: el pantano lo guardó como una cápsula.',
    ],
    qa: [['¿Por qué se conservó la madera?', 'Porque la turba mantuvo el sitio húmedo y casi sin oxígeno, y sin oxígeno las bacterias que descomponen no trabajan bien.'], ['¿Cómo se llama el arroyo?', 'Chinchihuapi. Es un dato de la divulgación científica; la ficha oficial solo dice un pequeño arroyo.']],
  },
  {
    id: 'carpa', titulo: 'La gran carpa de doce habitaciones', pos: [0, 1.9, -6.2], texto: [
      'Esta es la gran carpa, o toldo. Dentro se excavaron doce habitaciones unidas por los lados y ordenadas en dos hileras paralelas.',
      'Cada habitación mediría entre tres y cuatro metros y medio por lado.',
      'Su base eran troncos pequeños y gruesas tablas, con palos verticales clavados cada cierto trecho. En algunos palos caídos quedaron restos de piel de animal.',
      'Por eso se piensa que las paredes y el techo eran de pieles sobre un armazón de madera. Es una interpretación, no se conserva el techo.',
      'Para la época, la ficha oficial habla de una estructura arquitectónica excepcional, jamás pensada para ese tiempo.',
    ],
    qa: [['¿Cuánta gente vivía aquí?', 'No hay una cifra oficial en la ficha. Otras fuentes estiman entre veinte y treinta personas, a partir de las habitaciones y los fogones. Es una estimación.'], ['¿De qué eran las paredes?', 'Probablemente de pieles de animal, porque hay restos de piel en palos caídos. La reconstrucción exacta es una hipótesis.']],
  },
  {
    id: 'fogones', titulo: 'Los fogones', pos: [-3.2, 1.3, -4.7], texto: [
      'Aquí se cocinaba. Los fogones eran pozos poco profundos cubiertos con arcilla, que servían como braseros.',
      'La cocina parece haber sido una actividad comunal, alrededor de dos grandes fogones.',
      'Prueba tú mismo: toma unas ramitas del suelo y échalas al fuego. Verás cómo la llama crece.',
      'El fuego daba calor, luz, cocina y protección. Era el centro de la vida diaria del grupo.',
    ],
    qa: [['¿Cómo hacían fuego?', 'Los restos exactos de cómo lo encendían no se conservan en la ficha. Lo que sí hay son los braseros con arcilla y carbón.'], ['¿Qué cocinaban?', 'Hay restos de papas silvestres, semillas, frutas, nueces, bayas, hongos, algas, tubérculos y carne.']],
  },
  {
    id: 'medicina', titulo: 'Plantas y medicina', pos: [-12.2, 1.6, -3.2], texto: [
      'Este lugar es la estructura en U, separada del resto, en el extremo oeste, con la puerta hacia el oriente.',
      'La ficha la describe como un centro de actividades especiales: procesar la caza, preparar hierbas medicinales, quizás una celebración ritual o una práctica de curación chamánica. Son posibilidades, no certezas.',
      'Se encontraron varias especies de plantas medicinales, incluso restos de hojas que fueron masticadas.',
      'Otras fuentes hablan de entre sesenta y setenta y cinco especies de plantas en total, y de unas veintitrés a veintiséis medicinales. Las cifras varían.',
    ],
    qa: [['¿Para qué servían las plantas?', 'Las fuentes dicen que había especies medicinales, pero qué enfermedad trataba cada una es una interpretación basada en usos actuales.'], ['¿Qué es una hoja masticada?', 'Restos de hojas que alguien mascó y dejó; se interpretan como uso medicinal.']],
  },
  {
    id: 'algas', titulo: 'Las algas del Pacífico', pos: [5.8, 1.4, -11.2], texto: [
      'Entre los restos hay algas marinas. Se recolectaron en la costa del Pacífico, lejos de aquí, y se llevaron al campamento.',
      'Algunas fuentes cuentan nueve especies de algas; otras, cuatro o diez. El número depende de quién cuente y cómo.',
      'Las algas dan yodo y sal, y la ficha oficial dice que la dieta del grupo era rica en ellas.',
      'Eso muestra que este grupo conocía la costa y el interior, y se movía o intercambiaba entre ambos.',
    ],
    qa: [['¿A qué distancia estaba la costa?', 'La ficha oficial no da la distancia. Otros reportes mencionan una bahía a unos seis kilómetros y la costa del Pacífico.'], ['¿Por qué importa el yodo?', 'El cuerpo lo necesita para la tiroides. Las algas y la sal marina lo aportaban.']],
  },
  {
    id: 'mastodonte', titulo: 'Los grandes animales', pos: [-9.6, 1.6, -0.4], texto: [
      'Aquí hay restos de grandes animales. La ficha oficial habla de cinco o seis mastodontes; otras fuentes los llaman gonfoterios, un pariente extinto de los elefantes.',
      'La mayoría de esos restos estaba dentro de la estructura en U. Pudieron comerse como carroña o como caza.',
      'También hay camélidos y otros animales menores, además de cuero.',
      'Se ha propuesto que huesos, colmillos y pieles se usaron en las construcciones. No hay acuerdo sobre cómo; los colmillos como mástiles que ves aquí son una idea de la recreación.',
    ],
    qa: [['¿Cazaban mastodontes?', 'Es posible, pero los restos también se interpretan como carroña. La ficha lo deja abierto.'], ['¿Mastodonte o gonfoterio?', 'Depende de la fuente: la ficha del Consejo de Monumentos dice mastodontes, otras publicaciones dicen gonfoterio.']],
  },
  {
    id: 'herramientas', titulo: 'Herramientas', pos: [6.2, 1.3, -5.2], texto: [
      'Aquí se trabajaban pieles y madera. De piedra hay rocas redondeadas del tamaño de un huevo, posibles piedras de honda, y boleadoras.',
      'También artefactos con forma de hoja, un núcleo, un chopper y dos puntas de proyectil alargadas.',
      'De madera se conservaron una punta de lanza, palos cavadores, tres mangos con raederas o raspadores y tres morteros trabajados a mano.',
      'Las raederas servían para limpiar pieles, y los morteros para moler plantas.',
    ],
    qa: [['¿Qué es una boleadora?', 'Piedras redondas atadas con cuerdas que se lanzan para enredar las patas de un animal.'], ['¿Usaban metal?', 'No. Todo es piedra, madera, hueso y cuero.']],
  },
  {
    id: 'tiempo', titulo: 'Catorce mil ochocientos años', pos: [0, 1.6, 0.8], texto: [
      'Cuando termina el recorrido, vale la pena pensar en el tiempo: unos 14.800 años.',
      'Monte Verde cambió una idea de la historia: que los primeros americanos llegaron tarde, por una ruta de hielo y en pocos siglos.',
      'La ficha lo presenta como una residencia permanente, porque hay plantas de todos los meses del año. Otras fuentes hablan de un campamento de ocho a diez meses. Es un debate abierto.',
      'El sitio fue investigado por la Universidad Austral de Chile y está protegido por la ley de Monumentos Nacionales.',
      'Gracias por recorrerlo. Puedes volver a cualquier parada o soltar el colihuacho y explorar libremente.',
    ],
    qa: [['¿Hay algo más antiguo?', 'Algunas investigaciones discuten fechas aún más antiguas en otros sitios de América. Monte Verde sigue siendo uno de los casos más estudiados.'], ['¿Quién lo estudió?', 'Equipos de la Universidad Austral de Chile y colaboradores, liderados por Tom Dillehay.']],
  },
];
