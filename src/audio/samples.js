/* ================================================================
   SONS GRAVADOS (opcionais) — se houver arquivos em assets/sounds/, eles tocam no
   lugar dos sintetizados; sem arquivos (ou se um falhar), o sintetizado continua.
   Nome do arquivo = nome do som; variações com sufixo -1, -2… são sorteadas.
     aparar, defesa, defesa-forte, golpe-ar, corte, sacar, guardar,
     passo-grama, passo-terra, vento (laço), cigarras (laço), grilos (laço), taiko, koto
   Formatos: .ogg, .mp3, .wav, .m4a
   ================================================================ */
const FILES = import.meta.glob('../../assets/sounds/*.{ogg,mp3,wav,m4a}', { query: '?url', import: 'default', eager: true });

export const Samples = {
  bufs: {}, loaded: false,
  names() { return Object.keys(FILES).map((p) => p.split('/').pop().replace(/\.\w+$/, '')); },
  async load(ctx) {
    const entries = Object.entries(FILES);
    await Promise.all(entries.map(async ([path, url]) => {
      try {
        const name = path.split('/').pop().replace(/\.\w+$/, '').replace(/-\d+$/, '');
        const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        (this.bufs[name] = this.bufs[name] || []).push(buf);
      } catch (e) { console.warn('som não carregou', path, e); }
    }));
    this.loaded = true;
    return Object.keys(this.bufs);
  },
  has(name) { return !!this.bufs[name]; },
  // toca uma variação; devolve false se não houver (quem chama usa o sintetizado)
  play(ctx, out, name, { vol = 1, rate = 1, loop = false, when = 0 } = {}) {
    const list = this.bufs[name];
    if (!list || !ctx) return false;
    const src = ctx.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (loop ? 1 : 0.96 + Math.random() * 0.08); src.loop = loop;
    const g = ctx.createGain(); g.gain.value = vol; src.connect(g); g.connect(out);
    src.start(ctx.currentTime + when);
    return loop ? g : true;
  },
};
