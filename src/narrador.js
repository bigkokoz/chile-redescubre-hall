// Narrador de la clase recorrida: lee el texto de cada parada frase por frase (voz del visor/navegador si existe)
// y permite pausar, adelantar, retroceder y cambiar la velocidad. Si el visor no tiene voz, avanza solo con un reloj para poder leer.

const splitSentences = (arr) => (Array.isArray(arr) ? arr : [arr]).flatMap((t) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)).map((s) => s.trim()).filter(Boolean);

export function createNarrator(app) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const st = { stop: null, mode: 'stop', sentences: [], idx: 0, playing: false, rate: 1, hasVoice: false, lastTitle: '', answerQ: '' };
  let token = 0, timer = null, voice = null, onChange = () => {};
  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices() || []; if (!vs.length) return null;
    const pref = ['es-CL', 'es-MX', 'es-US', 'es-419', 'es-ES'];
    for (const p of pref) { const v = vs.find((x) => x.lang && x.lang.replace('_', '-').toLowerCase() === p.toLowerCase()); if (v) return v; }
    return vs.find((x) => x.lang && x.lang.toLowerCase().startsWith('es')) || null;
  }
  const refreshVoice = () => { voice = pickVoice(); st.hasVoice = !!voice; };
  if (synth) { refreshVoice(); synth.onvoiceschanged = () => { refreshVoice(); onChange(); }; }
  const vol = () => Math.max(0, Math.min(1, (app.aud.narracion ?? 1) * (app.aud.master ?? 1)));
  const clear = () => { token++; clearTimeout(timer); if (synth) try { synth.cancel(); } catch { /* ok */ } };
  function speak() {
    clear(); const my = token; if (!st.playing) return;
    const text = st.sentences[st.idx]; if (text == null) { st.playing = false; onChange(); return; }
    const advance = () => { if (my !== token || !st.playing) return; if (st.idx < st.sentences.length - 1) { st.idx++; onChange(); speak(); } else { st.playing = false; onChange(); app.onNarrationEnd && app.onNarrationEnd(st); } };
    if (synth && voice && vol() > 0.01) {
      const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = st.rate; u.volume = vol();
      u.onend = advance; u.onerror = () => { if (my === token && st.playing) timer = setTimeout(advance, 600); };
      try { synth.speak(u); } catch { timer = setTimeout(advance, 1500); }
    } else timer = setTimeout(advance, Math.max(2200, (text.length / 13) * 1000 / st.rate));   // sin voz o en silencio: avanza como lectura
  }
  const api = {
    state: st,
    set onChange(fn) { onChange = fn; },
    /** Prepara el audio con un toque del usuario (algunos navegadores lo exigen). */
    prime() { if (!synth) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch { /* ok */ } refreshVoice(); },
    play(stop) { st.stop = stop; st.mode = 'stop'; st.sentences = splitSentences(stop.texto); st.idx = 0; st.playing = true; st.answerQ = ''; onChange(); speak(); },
    answer(q, a) { st.mode = 'answer'; st.answerQ = q; st.sentences = splitSentences(a); st.idx = 0; st.playing = true; onChange(); speak(); },
    pause() { st.playing = false; clear(); onChange(); },
    resume() { if (!st.sentences.length) return; st.playing = true; onChange(); speak(); },
    toggle() { st.playing ? api.pause() : api.resume(); },
    next() { if (!st.sentences.length) return; st.idx = Math.min(st.idx + 1, st.sentences.length - 1); onChange(); if (st.playing) speak(); },
    prev() { if (!st.sentences.length) return; st.idx = Math.max(st.idx - 1, 0); onChange(); if (st.playing) speak(); },
    restart() { st.idx = 0; st.playing = true; onChange(); speak(); },
    setRate(r) { st.rate = Math.max(0.6, Math.min(1.8, +r.toFixed(1))); onChange(); if (st.playing) speak(); },
    stopAll() { st.playing = false; clear(); onChange(); },
  };
  return api;
}
