// Genera la voz de la clase (narradora chilena, voz neural es-CL) frase por frase en public/narracion/<clave>.mp3
// Uso:  node scripts/gen_narracion.mjs      (usa msedge-tts del hook de voz de SESE; solo manda al servicio de voz los textos públicos de la clase)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { splitSentences, hashText } from '../src/narrador.js';
import { VIAJE_STOPS, FRASES, COMIDA } from '../src/viaje_data.js';

const require = createRequire('C:/Users/PC/.claude/hooks/voz/');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const VOZ = 'es-CL-CatalinaNeural';
const out = path.resolve('public/narracion'); fs.mkdirSync(out, { recursive: true });

const frases = new Set();
VIAJE_STOPS.forEach((s) => { splitSentences(s.texto).forEach((x) => frases.add(x)); (s.qa || []).forEach(([, a]) => splitSentences(a).forEach((x) => frases.add(x))); });
Object.values(COMIDA).forEach((x) => splitSentences(x).forEach((y) => frases.add(y)));
Object.values(FRASES).forEach((x) => splitSentences(x).forEach((y) => frases.add(y)));
console.log(frases.size, 'frases');

let tts = null;
async function nuevo() { try { tts && tts.close(); } catch {} tts = new MsEdgeTTS(); await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3); }
await nuevo();
let n = 0;
for (const f of frases) {
  const dest = path.join(out, hashText(f) + '.mp3'); if (fs.existsSync(dest)) continue;
  const esc = f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'narr-'));
  let ok = false;
  for (let k = 0; k < 4 && !ok; k++) { try { const { audioFilePath } = await tts.toFile(dir, esc, { rate: '-2%', pitch: '+0Hz' }); fs.copyFileSync(audioFilePath, dest); ok = true; } catch (e) { console.log('reintento', k + 1, e.message.slice(0, 60)); await nuevo(); } }
  if (!ok) { console.log('FALLO', f.slice(0, 50)); continue; }
   fs.rmSync(dir, { recursive: true, force: true }); n++;
  if (n % 10 === 0) console.log(n, 'listas');
}
tts.close();
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ voz: VOZ, frases: frases.size, nota: 'Voz sintética (Microsoft Edge TTS, es-CL). Una frase por archivo; el nombre es el hash del texto.' }));
console.log('LISTO', n, 'nuevas');
