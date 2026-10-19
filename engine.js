/*
 * Motor de parafraseo por reglas (sin IA, sin LLM).
 * Todo es determinista: tablas de conectores, diccionario de sinónimos,
 * conjugación regular y reglas de concordancia de género.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------
  // 1. CONECTORES: grupos de expresiones equivalentes
  // ---------------------------------------------------------------
  const CONECTORES = [
    ['sin embargo', 'no obstante', 'aun así', 'con todo'],
    ['por lo tanto', 'por tanto', 'por consiguiente', 'en consecuencia', 'por ende'],
    ['además', 'asimismo', 'adicionalmente', 'a su vez'],
    ['del mismo modo', 'de igual manera', 'de igual forma', 'de la misma manera'],
    ['por ejemplo', 'a modo de ejemplo', 'como muestra'],
    ['es decir', 'esto es', 'o sea', 'en otras palabras'],
    ['en primer lugar', 'primeramente', 'para empezar'],
    ['finalmente', 'por último', 'para finalizar'],
    ['en conclusión', 'en síntesis', 'en resumen', 'para concluir'],
    ['debido a', 'a causa de', 'como consecuencia de', 'en virtud de'],
    ['ya que', 'puesto que', 'dado que', 'debido a que'],
    ['aunque', 'si bien', 'pese a que', 'a pesar de que'],
    ['a pesar de', 'pese a'],
    ['en cambio', 'por el contrario'],
    ['a través de', 'mediante', 'por medio de'],
    ['con el fin de', 'con el propósito de', 'con el objetivo de', 'a fin de'],
    ['con respecto a', 'respecto a', 'en relación con', 'en cuanto a'],
    ['actualmente', 'en la actualidad', 'hoy en día'],
    ['generalmente', 'por lo general', 'en general'],
    ['principalmente', 'sobre todo', 'fundamentalmente'],
    ['en este sentido', 'en esta línea', 'desde esta perspectiva'],
    ['por otro lado', 'por otra parte', 'de otro lado'],
    ['de acuerdo con', 'según', 'conforme a'],
    ['con frecuencia', 'frecuentemente', 'a menudo'],
    ['después de', 'luego de', 'tras'],
    ['posteriormente', 'más adelante', 'luego'],
    ['rápidamente', 'con rapidez'],
    ['claramente', 'con claridad'],
    ['significativamente', 'considerablemente', 'notablemente'],
    ['inicialmente', 'en un inicio', 'al principio'],
  ];

  // ---------------------------------------------------------------
  // 2. SUSTANTIVOS: [lema, género]. needsDet = solo si va tras determinante
  // ---------------------------------------------------------------
  const SUSTANTIVOS = [
    { g: [['problema', 'm'], ['dificultad', 'f'], ['inconveniente', 'm']], needsDet: true },
    { g: [['objetivo', 'm'], ['propósito', 'm'], ['finalidad', 'f'], ['meta', 'f']], needsDet: true },
    { g: [['método', 'm'], ['procedimiento', 'm']] },
    { g: [['estudio', 'm'], ['investigación', 'f']] },
    { g: [['empresa', 'f'], ['organización', 'f'], ['compañía', 'f']] },
    { g: [['aspecto', 'm'], ['elemento', 'm'], ['factor', 'm']] },
    { g: [['forma', 'f'], ['manera', 'f'], ['modo', 'm']], needsDet: true },
    { g: [['importancia', 'f'], ['relevancia', 'f'], ['trascendencia', 'f']] },
    { g: [['ventaja', 'f'], ['beneficio', 'm']] },
    { g: [['desventaja', 'f'], ['limitación', 'f']] },
    { g: [['herramienta', 'f'], ['instrumento', 'm']] },
    { g: [['cambio', 'm'], ['modificación', 'f'], ['variación', 'f']] },
    { g: [['aumento', 'm'], ['incremento', 'm'], ['crecimiento', 'm']] },
    { g: [['disminución', 'f'], ['reducción', 'f'], ['descenso', 'm']] },
    { g: [['necesidad', 'f'], ['requerimiento', 'm']] },
    { g: [['idea', 'f'], ['noción', 'f'], ['concepto', 'm']] },
    { g: [['tema', 'm'], ['asunto', 'm']] },
    { g: [['situación', 'f'], ['circunstancia', 'f']] },
    { g: [['característica', 'f'], ['rasgo', 'm'], ['propiedad', 'f']] },
    { g: [['motivo', 'm'], ['razón', 'f']] },
    { g: [['efecto', 'm'], ['consecuencia', 'f']] },
    { g: [['impacto', 'm'], ['repercusión', 'f']] },
    { g: [['enfoque', 'm'], ['perspectiva', 'f'], ['planteamiento', 'm']] },
    { g: [['desafío', 'm'], ['reto', 'm']] },
    { g: [['etapa', 'f'], ['fase', 'f']] },
    { g: [['tarea', 'f'], ['labor', 'f'], ['actividad', 'f']] },
    { g: [['requisito', 'm'], ['condición', 'f']] },
    { g: [['aporte', 'm'], ['contribución', 'f']] },
    { g: [['error', 'm'], ['falla', 'f']] },
    { g: [['uso', 'm'], ['utilización', 'f']] },
    { g: [['mejora', 'f'], ['optimización', 'f'], ['perfeccionamiento', 'm']], needsDet: true },
  ];

  // ---------------------------------------------------------------
  // 3. ADJETIVOS (forma masculina singular)
  // ---------------------------------------------------------------
  const ADJETIVOS = [
    ['importante', 'relevante', 'fundamental', 'esencial', 'primordial'],
    ['adecuado', 'apropiado', 'idóneo', 'pertinente'],
    ['necesario', 'imprescindible', 'indispensable'],
    ['diferente', 'distinto', 'diverso'],
    ['rápido', 'veloz', 'ágil'],
    ['difícil', 'complejo', 'complicado'],
    ['fácil', 'sencillo', 'simple'],
    ['actual', 'vigente', 'contemporáneo'],
    ['posible', 'factible', 'viable'],
    ['evidente', 'manifiesto', 'notorio'],
    ['pequeño', 'reducido'],
    ['considerable', 'notable', 'significativo', 'sustancial'],
    ['constante', 'continuo', 'permanente'],
    ['específico', 'concreto', 'particular'],
    ['eficiente', 'productivo'],
    ['óptimo', 'excelente'],
  ];

  // ---------------------------------------------------------------
  // 4. VERBOS (regulares en los tiempos usados). Irregularidades puntuales.
  // ---------------------------------------------------------------
  const VERBOS = [
    ['utilizar', 'usar', 'emplear'],
    ['realizar', 'efectuar', 'ejecutar'],
    ['analizar', 'examinar', 'estudiar'],
    ['evidenciar', 'reflejar', 'revelar'],
    ['permitir', 'posibilitar'],
    ['mejorar', 'optimizar', 'perfeccionar'],
    ['aumentar', 'incrementar', 'elevar'],
    ['determinar', 'establecer', 'definir'],
    ['considerar', 'estimar'],
    ['indicar', 'señalar'],
    ['identificar', 'detectar', 'reconocer'],
    ['lograr', 'alcanzar'],
    ['desarrollar', 'elaborar'],
    ['implementar', 'aplicar'],
    ['generar', 'originar'],
    ['explicar', 'aclarar'],
    ['verificar', 'constatar', 'corroborar'],
    ['garantizar', 'asegurar'],
    ['observar', 'apreciar'],
    ['ofrecer', 'brindar', 'proporcionar'],
    ['evaluar', 'valorar'],
    ['recopilar', 'recolectar'],
    ['comparar', 'contrastar'],
    ['relacionar', 'vincular', 'asociar'],
    ['destacar', 'resaltar', 'subrayar'],
    ['describir', 'detallar'],
  ];
  const VERBO_IRREG = {
    evaluar: { pres3s: 'evalúa', pres3p: 'evalúan', subj3s: 'evalúe', subj3p: 'evalúen' },
    efectuar: { pres3s: 'efectúa', pres3p: 'efectúan', subj3s: 'efectúe', subj3p: 'efectúen' },
    describir: { part: 'descrito' },
  };

  // ---------------------------------------------------------------
  // Determinantes y su forma del otro género
  // ---------------------------------------------------------------
  const PARES_GENERO = [
    ['el', 'la'], ['los', 'las'], ['un', 'una'], ['unos', 'unas'],
    ['este', 'esta'], ['estos', 'estas'], ['ese', 'esa'], ['esos', 'esas'],
    ['aquel', 'aquella'], ['aquellos', 'aquellas'],
    ['nuestro', 'nuestra'], ['nuestros', 'nuestras'], ['dicho', 'dicha'], ['dichos', 'dichas'],
    ['otro', 'otra'], ['otros', 'otras'], ['todo', 'toda'], ['todos', 'todas'],
    ['mucho', 'mucha'], ['muchos', 'muchas'], ['poco', 'poca'], ['pocos', 'pocas'],
    ['cierto', 'cierta'], ['ciertos', 'ciertas'], ['algún', 'alguna'], ['algunos', 'algunas'],
    ['ningún', 'ninguna'], ['varios', 'varias'], ['diversos', 'diversas'],
    ['mismo', 'misma'], ['mismos', 'mismas'], ['primer', 'primera'], ['nuevo', 'nueva'], ['nuevos', 'nuevas'],
    ['tal', 'tal'], ['cada', 'cada'], ['su', 'su'], ['sus', 'sus'],
  ];
  const GENERO_DE = {}; // palabra -> {m, f}
  PARES_GENERO.forEach(([m, f]) => { GENERO_DE[m] = { m, f, g: 'm' }; GENERO_DE[f] = { m, f, g: 'f' }; });
  const DETERMINANTES = new Set(Object.keys(GENERO_DE).concat(['del', 'al', 'mi', 'mis', 'tu', 'tus', 'gran', 'mayor', 'menor', 'principal']));

  // ---------------------------------------------------------------
  // Utilidades de morfología
  // ---------------------------------------------------------------
  const sinTilde = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
  const VOCAL_TILDE = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

  function plural(w) {
    if (/is$/.test(w)) return w;
    if (/z$/.test(w)) return w.slice(0, -1) + 'ces';
    if (/[aeiou]$/.test(w)) return w + 's';
    if (/[áéó]$/.test(w)) return w + 's';
    if (/[íú]$/.test(w)) return w + 'es';
    // consonante: quitar tilde de última sílaba (razón -> razones)
    const m = w.match(/([áéíóú])([^aeiouáéíóú]*)$/);
    if (m && /[ns]$/.test(w)) return w.slice(0, m.index) + VOCAL_TILDE[m[1]] + m[2] + 'es';
    return w + 'es';
  }

  // formas de adjetivo: {ms, fs, mp, fp}, variable = cambia con el género
  function formasAdj(a) {
    if (/o$/.test(a)) {
      const b = a.slice(0, -1);
      return { variable: true, ms: a, fs: b + 'a', mp: b + 'os', fp: b + 'as' };
    }
    const p = plural(a);
    return { variable: false, ms: a, fs: a, mp: p, fp: p };
  }

  function conjugar(inf) {
    const t = inf.slice(-2), raiz = inf.slice(0, -2);
    const irr = VERBO_IRREG[inf] || {};
    const f = {};
    const ar = t === 'ar';
    f.inf = inf;
    f.ger = raiz + (ar ? 'ando' : 'iendo');
    const part = irr.part || raiz + (ar ? 'ado' : 'ido');
    const pb = part.slice(0, -1);
    f.part_ms = part; f.part_fs = pb + 'a'; f.part_mp = pb + 'os'; f.part_fp = pb + 'as';
    f.pres3s = irr.pres3s || raiz + (ar ? 'a' : 'e');
    f.pres3p = irr.pres3p || raiz + (ar ? 'an' : 'en');
    f.pres1p = raiz + (ar ? 'amos' : t === 'er' ? 'emos' : 'imos');
    f.pret3s = raiz + (ar ? 'ó' : 'ió');
    f.pret3p = raiz + (ar ? 'aron' : 'ieron');
    f.imp3s = raiz + (ar ? 'aba' : 'ía');
    f.imp3p = raiz + (ar ? 'aban' : 'ían');
    f.fut3s = inf + 'á'; f.fut3p = inf + 'án';
    f.cond3s = inf + 'ía'; f.cond3p = inf + 'ían';
    // subjuntivo presente con cambios ortográficos
    let rs = raiz, vs = ar ? 'e' : 'a';
    if (ar) {
      if (/c$/.test(raiz)) rs = raiz.slice(0, -1) + 'qu';
      else if (/g$/.test(raiz)) rs = raiz + 'u';
      else if (/z$/.test(raiz)) rs = raiz.slice(0, -1) + 'c';
    } else if (/cer$/.test(inf)) {
      rs = raiz.slice(0, -1) + 'zc';
    }
    f.subj3s = irr.subj3s || rs + vs;
    f.subj3p = irr.subj3p || rs + vs + 'n';
    f.inf_se = inf + 'se';
    return f;
  }

  // ---------------------------------------------------------------
  // Índice: forma -> candidatos
  // ---------------------------------------------------------------
  const INDICE = new Map();
  const add = (forma, cand) => {
    const k = forma.toLowerCase();
    if (!INDICE.has(k)) INDICE.set(k, []);
    INDICE.get(k).push(cand);
  };

  SUSTANTIVOS.forEach((grupo, gi) => {
    grupo.g.forEach(([lema, gen], li) => {
      add(lema, { pos: 'n', gi, li, num: 's' });
      add(plural(lema), { pos: 'n', gi, li, num: 'p' });
    });
  });
  ADJETIVOS.forEach((grupo, gi) => {
    grupo.forEach((lema, li) => {
      const f = formasAdj(lema);
      const vistos = new Set();
      ['ms', 'fs', 'mp', 'fp'].forEach((slot) => {
        if (vistos.has(f[slot])) return; vistos.add(f[slot]);
        add(f[slot], { pos: 'a', gi, li, slot });
      });
    });
  });
  const CONJ = VERBOS.map((g) => g.map(conjugar));
  CONJ.forEach((grupo, gi) => {
    grupo.forEach((formas, li) => {
      Object.entries(formas).forEach(([slot, forma]) => add(forma, { pos: 'v', gi, li, slot }));
    });
  });

  // Conectores: clave normalizada -> {gi, li}
  const CON_IDX = new Map();
  let CON_MAX = 1;
  CONECTORES.forEach((g, gi) => g.forEach((c, li) => {
    CON_IDX.set(c, { gi, li });
    CON_MAX = Math.max(CON_MAX, c.split(' ').length);
  }));

  // Adjetivos variables conocidos (para concordancia)
  const ADJ_VARIABLES = new Set();
  ADJETIVOS.forEach((g) => g.forEach((a) => {
    const f = formasAdj(a);
    if (f.variable) [f.ms, f.fs, f.mp, f.fp].forEach((x) => ADJ_VARIABLES.add(x));
  }));
  const esAdjVariable = (w) => ADJ_VARIABLES.has(w) || (/(ad|id|iv|ic|os|ari)[oa]s?$/.test(w) && w.length > 5);

  function cambiarGeneroAdj(w, g) {
    if (g === 'f') return w.replace(/os$/, 'as').replace(/o$/, 'a');
    return w.replace(/as$/, 'os').replace(/a$/, 'o');
  }

  // ---------------------------------------------------------------
  // Hash determinista
  // ---------------------------------------------------------------
  function azar(seed, n) {
    let h = 2166136261 ^ seed;
    const s = String(n) + ':' + seed;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  function capitalizarComo(orig, nuevo) {
    if (!orig || !nuevo) return nuevo;
    if (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase()) {
      return nuevo[0].toUpperCase() + nuevo.slice(1);
    }
    return nuevo;
  }

  // ---------------------------------------------------------------
  // Tokenizador
  // ---------------------------------------------------------------
  function tokenizar(texto) {
    const re = /([\p{L}\p{M}]+)|(\d+(?:[.,]\d+)*)|(\s+)|([\s\S])/gu;
    const toks = [];
    let m;
    while ((m = re.exec(texto))) {
      const kind = m[1] ? 'w' : m[2] ? 'n' : m[3] ? 's' : 'p';
      toks.push({ t: m[0], kind, out: m[0], prot: false, cid: null, cls: null });
    }
    return toks;
  }

  const INTENSIDAD = { leve: 0.35, medio: 0.65, fuerte: 1 };

  // ---------------------------------------------------------------
  // Parafrasear
  // ---------------------------------------------------------------
  function parafrasear(texto, opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const pSin = INTENSIDAD[opts.intensidad || 'medio'];
    const overrides = opts.overrides || {};
    const protegidos = (opts.protegidos || []).map((s) => s.trim().toLowerCase()).filter(Boolean);

    const toks = tokenizar(texto);
    const W = []; // índices de tokens palabra
    toks.forEach((t, i) => { if (t.kind === 'w') W.push(i); });
    const posEnW = new Map(W.map((ti, k) => [ti, k]));

    // --- Protección ---
    // a) comillas
    let dentro = false;
    toks.forEach((t) => {
      if (t.t === '"') { dentro = !dentro; return; }
      if (t.t === '“' || t.t === '«') { dentro = true; return; }
      if (t.t === '”' || t.t === '»') { dentro = false; return; }
      if (dentro) t.prot = true;
    });
    // b) paréntesis con año (citas)
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].t !== '(') continue;
      let j = i + 1, conAnio = false;
      while (j < toks.length && toks[j].t !== ')' && j - i < 60) {
        if (toks[j].kind === 'n' && /^\d{4}$/.test(toks[j].t)) conAnio = true;
        j++;
      }
      if (conAnio && j < toks.length) for (let k = i; k <= j; k++) toks[k].prot = true;
    }
    // c) siglas y nombres propios
    const inicioOracion = (ti) => {
      let j = ti - 1;
      while (j >= 0) {
        const t = toks[j];
        if (t.kind === 's') { if (/\n/.test(t.t)) return true; j--; continue; }
        if (/^[(«"“¿¡'‘—-]$/.test(t.t)) { j--; continue; }
        return /^[.!?:]$/.test(t.t);
      }
      return true;
    };
    W.forEach((ti) => {
      const w = toks[ti].t;
      if (w.length >= 2 && w === w.toUpperCase() && w !== w.toLowerCase()) toks[ti].prot = true;
      else if (w[0] !== w[0].toLowerCase() && !inicioOracion(ti)) toks[ti].prot = true;
    });
    // d) términos del usuario
    protegidos.forEach((frase) => {
      const partes = frase.split(/\s+/);
      for (let k = 0; k + partes.length <= W.length; k++) {
        let ok = true;
        for (let q = 0; q < partes.length; q++) if (toks[W[k + q]].t.toLowerCase() !== partes[q]) { ok = false; break; }
        if (ok) for (let ti = W[k]; ti <= W[k + partes.length - 1]; ti++) toks[ti].prot = true;
      }
    });

    const cambios = [];
    const usado = new Set(); // tokens ya cambiados

    // --- Conectores ---
    for (let k = 0; k < W.length; k++) {
      if (usado.has(W[k])) continue;
      for (let L = Math.min(CON_MAX, W.length - k); L >= 1; L--) {
        // las palabras deben estar separadas solo por un espacio simple
        let contiguo = true;
        for (let q = 0; q < L - 1; q++) {
          if (W[k + q + 1] - W[k + q] !== 2 || toks[W[k + q] + 1].t !== ' ') { contiguo = false; break; }
        }
        if (!contiguo) continue;
        const pal = [];
        for (let q = 0; q < L; q++) pal.push(toks[W[k + q]]);
        if (pal.some((t) => t.prot)) continue;
        const clave = pal.map((t) => t.t.toLowerCase()).join(' ');
        const hit = CON_IDX.get(clave);
        if (!hit) continue;
        const grupo = CONECTORES[hit.gi];
        const ini = W[k], fin = W[k + L - 1];
        const opciones = grupo.filter((_, i) => i !== hit.li);
        let elegido;
        if (ini in overrides) elegido = overrides[ini];
        else elegido = opciones[Math.floor(azar(seed, ini) * opciones.length)];
        const id = cambios.length;
        const orig = toks.slice(ini, fin + 1).map((t) => t.t).join('');
        cambios.push({ id, tipo: 'conector', ini, fin, original: orig, opciones: grupo.map((c) => capitalizarComo(orig, c)), elegido: null });
        if (elegido !== '__orig__') {
          const nuevo = capitalizarComo(orig, elegido);
          cambios[id].elegido = nuevo;
          toks[ini].out = nuevo;
          for (let ti = ini + 1; ti <= fin; ti++) toks[ti].out = '';
          for (let ti = ini; ti <= fin; ti++) { toks[ti].cid = id; toks[ti].cls = 'conector'; usado.add(ti); }
        } else {
          for (let ti = ini; ti <= fin; ti++) { toks[ti].cid = id; toks[ti].cls = 'original'; usado.add(ti); }
        }
        k += L - 1;
        break;
      }
    }

    // --- Sinónimos ---
    const prevPalabra = (ti) => { const k = posEnW.get(ti); return k > 0 ? toks[W[k - 1]] : null; };
    const prevContiguo = (ti) => { const k = posEnW.get(ti); return k > 0 && W[k] - W[k - 1] === 2 && /^\s+$/.test(toks[W[k] - 1].t) ? W[k - 1] : null; };
    const sigContiguo = (ti) => { const k = posEnW.get(ti); return k < W.length - 1 && W[k + 1] - W[k] === 2 && /^\s+$/.test(toks[W[k] + 1].t) ? W[k + 1] : null; };
    const concordancias = []; // {ti, genero}

    W.forEach((ti) => {
      const tok = toks[ti];
      if (tok.prot || usado.has(ti)) return;
      const lower = tok.t.toLowerCase();
      const cands = INDICE.get(lower);
      if (!cands) return;
      const prev = prevPalabra(ti);
      const prevEsDet = prev && DETERMINANTES.has(prev.t.toLowerCase());
      // elegir interpretación
      let c = null;
      const sust = cands.find((x) => x.pos === 'n');
      const verb = cands.find((x) => x.pos === 'v');
      const adj = cands.find((x) => x.pos === 'a');
      if (sust && (prevEsDet || (!SUSTANTIVOS[sust.gi].needsDet && !verb))) c = sust;
      else if (verb && !prevEsDet) c = verb;
      else if (adj) c = adj;
      if (!c) return;
      // locuciones fijas: "forma parte", "toma en cuenta"...
      const sig = sigContiguo(ti);
      if (c.pos === 'n' && sig != null && /^(parte|cuenta)$/i.test(toks[sig].t)) return;

      const forzado = ti in overrides;
      if (!forzado && azar(seed + 7, ti) >= pSin) return;

      let opciones = []; // {lema, forma, genero}
      if (c.pos === 'n') {
        const g = SUSTANTIVOS[c.gi].g;
        opciones = g.map(([lema, gen]) => ({ lema, gen, forma: c.num === 'p' ? plural(lema) : lema }));
      } else if (c.pos === 'a') {
        const fOrig = formasAdj(ADJETIVOS[c.gi][c.li]);
        opciones = ADJETIVOS[c.gi].map((lema) => {
          const f = formasAdj(lema);
          // un adjetivo invariable no puede pasar a uno variable (no sabemos el género)
          if (!fOrig.variable && f.variable) return null;
          return { lema, forma: f[c.slot] };
        });
      } else {
        opciones = CONJ[c.gi].map((formas, li) => ({ lema: VERBOS[c.gi][li], forma: formas[c.slot] }));
      }
      const validas = opciones.map((o, i) => (o && i !== c.li ? i : -1)).filter((i) => i >= 0);
      if (!validas.length) return;
      let idx;
      if (forzado) {
        idx = overrides[ti] === '__orig__' ? c.li : opciones.findIndex((o) => o && o.forma.toLowerCase() === String(overrides[ti]).toLowerCase());
        if (idx < 0) idx = c.li;
      } else idx = validas[Math.floor(azar(seed + 3, ti) * validas.length)];

      const id = cambios.length;
      const tipo = 'sinonimo';
      cambios.push({
        id, tipo, ini: ti, fin: ti, original: tok.t,
        opciones: opciones.filter(Boolean).map((o) => capitalizarComo(tok.t, o.forma)),
        elegido: null,
      });
      usado.add(ti);
      tok.cid = id;
      if (idx === c.li) { tok.cls = 'original'; return; }
      const op = opciones[idx];
      tok.out = capitalizarComo(tok.t, op.forma);
      tok.cls = tipo;
      cambios[id].elegido = tok.out;
      if (c.pos === 'n') {
        const genOrig = SUSTANTIVOS[c.gi].g[c.li][1];
        if (op.gen !== genOrig) concordancias.push({ ti, gen: op.gen });
      }
    });

    // --- Concordancia de género ---
    concordancias.forEach(({ ti, gen }) => {
      // hacia atrás: determinantes y adjetivos variables (máx. 2 palabras)
      let cur = ti;
      for (let paso = 0; paso < 2; paso++) {
        const p = prevContiguo(cur);
        if (p == null) break;
        const tk = toks[p];
        const lw = tk.out.toLowerCase();
        if (GENERO_DE[lw]) {
          const nuevo = GENERO_DE[lw][gen];
          if (nuevo !== lw) { tk.out = capitalizarComo(tk.out, nuevo); if (!tk.cls) tk.cls = 'concordancia'; }
          cur = p;
          // contracciones: "de la" -> "del", "a la" -> "al"
          if (lw === 'la' && gen === 'm') {
            const pp = prevContiguo(p);
            if (pp != null && /^(de|a)$/i.test(toks[pp].out)) {
              toks[pp].out = toks[pp].out + 'l'; toks[pp].cls = toks[pp].cls || 'concordancia';
              tk.out = ''; toks[p - 1].out = '';
            }
          }
          break;
        }
        if (lw === 'del' && gen === 'f') { tk.out = capitalizarComo(tk.out, 'de la'); tk.cls = tk.cls || 'concordancia'; break; }
        if (lw === 'al' && gen === 'f') { tk.out = capitalizarComo(tk.out, 'a la'); tk.cls = tk.cls || 'concordancia'; break; }
        if (esAdjVariable(lw)) { tk.out = cambiarGeneroAdj(tk.out, gen); tk.cls = tk.cls || 'concordancia'; cur = p; continue; }
        break;
      }
      // hacia adelante: adjetivo o participio inmediato
      const s = sigContiguo(ti);
      if (s != null) {
        const tk = toks[s];
        if (!tk.prot && esAdjVariable(tk.out.toLowerCase())) {
          tk.out = cambiarGeneroAdj(tk.out, gen);
          tk.cls = tk.cls || 'concordancia';
        }
      }
    });

    // --- Segmentos de salida ---
    const segmentos = [];
    toks.forEach((t) => {
      const last = segmentos[segmentos.length - 1];
      if (t.cid != null) {
        if (last && last.cid === t.cid) { last.text += t.out; return; }
        segmentos.push({ text: t.out, cid: t.cid, cls: t.cls });
      } else if (t.cls === 'concordancia') {
        segmentos.push({ text: t.out, cid: null, cls: 'concordancia' });
      } else {
        if (last && last.cid == null && !last.cls) { last.text += t.out; return; }
        segmentos.push({ text: t.out, cid: null, cls: null });
      }
    });
    const resultado = segmentos.map((s) => s.text).join('');

    const nPal = W.length;
    const nConector = cambios.filter((c) => c.tipo === 'conector' && c.elegido).length;
    const nSin = cambios.filter((c) => c.tipo === 'sinonimo' && c.elegido).length;
    const nConc = toks.filter((t) => t.cls === 'concordancia' && t.cid == null).length;

    return { resultado, segmentos, cambios, stats: { palabras: nPal, conectores: nConector, sinonimos: nSin, concordancia: nConc } };
  }

  // ---------------------------------------------------------------
  // Similitud por trigramas de palabras
  // ---------------------------------------------------------------
  function palabrasNorm(texto) {
    return (sinTilde(texto.toLowerCase()).match(/[\p{L}\d]+/gu) || []);
  }
  function similitud(original, resultado) {
    const a = palabrasNorm(original), b = palabrasNorm(resultado);
    const tri = (arr) => { const s = []; for (let i = 0; i + 2 < arr.length; i++) s.push(arr[i] + ' ' + arr[i + 1] + ' ' + arr[i + 2]); return s; };
    const ta = tri(a), tb = tri(b);
    if (!ta.length) return { porcentaje: 0, marcadas: new Set() };
    const setA = new Set(ta);
    let comp = 0;
    const marcadas = new Set(); // índices de palabras de b dentro de trigramas compartidos
    tb.forEach((t, i) => { if (setA.has(t)) { marcadas.add(i); marcadas.add(i + 1); marcadas.add(i + 2); } });
    const setB = new Set(tb);
    setA.forEach((t) => { if (setB.has(t)) comp++; });
    return { porcentaje: Math.round((comp / setA.size) * 100), marcadas };
  }

  const api = { parafrasear, similitud, palabrasNorm, tokenizar, _plural: plural, _conjugar: conjugar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parafraseador = api;
})(typeof self !== 'undefined' ? self : this);
