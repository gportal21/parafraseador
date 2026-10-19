/*
 * Motor de parafraseo por reglas (sin IA, sin LLM).
 * Todo es determinista: reglas de estructura, tablas de expresiones,
 * diccionario de sinónimos, conjugación regular y concordancia de género.
 */
(function (root) {
  'use strict';

  const D = (typeof module !== 'undefined' && module.exports)
    ? require('./diccionario.js')
    : root.PP_DICCIONARIO;

  // ---------------------------------------------------------------
  // Morfología
  // ---------------------------------------------------------------
  const sinTilde = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
  const VOCAL_TILDE = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

  function plural(w) {
    if (/[^\p{L}]/u.test(w)) return w;
    if (/is$/.test(w)) return w;
    if (/z$/.test(w)) return w.slice(0, -1) + 'ces';
    if (/[aeiouáéó]$/.test(w)) return w + 's';
    if (/[íú]$/.test(w)) return w + 'es';
    const m = w.match(/([áéíóú])([^aeiouáéíóú]*)$/);
    if (m && /[ns]$/.test(w)) return w.slice(0, m.index) + VOCAL_TILDE[m[1]] + m[2] + 'es';
    if (/^[^aeiouáéíóú]*[aeiou][^aeiouáéíóú]*en$/.test(w)) return w + 'es';
    return w + 'es';
  }

  function formasAdj(a) {
    if (/o$/.test(a)) {
      const b = a.slice(0, -1);
      return { variable: true, ms: a, fs: b + 'a', mp: b + 'os', fp: b + 'as' };
    }
    if (/or$/.test(a)) return { variable: true, ms: a, fs: a + 'a', mp: a + 'es', fp: a + 'as' };
    const p = plural(a);
    return { variable: false, ms: a, fs: a, mp: p, fp: p };
  }

  function conjugar(inf) {
    const t = inf.slice(-2), raiz = inf.slice(0, -2);
    const irr = D.IRREGULARES[inf] || {};
    const ar = t === 'ar';
    const f = {};
    f.inf = inf;
    f.ger = irr.ger || raiz + (ar ? 'ando' : 'iendo');
    const part = irr.part || raiz + (ar ? 'ado' : 'ido');
    const pb = part.slice(0, -1);
    f.part_ms = part; f.part_fs = pb + 'a'; f.part_mp = pb + 'os'; f.part_fp = pb + 'as';
    f.pres3s = irr.pres3s || raiz + (ar ? 'a' : 'e');
    f.pres3p = irr.pres3p || raiz + (ar ? 'an' : 'en');
    f.pres1p = raiz + (ar ? 'amos' : t === 'er' ? 'emos' : 'imos');
    f.pret3s = irr.pret3s || raiz + (ar ? 'ó' : 'ió');
    f.pret3p = irr.pret3p || raiz + (ar ? 'aron' : 'ieron');
    f.imp3s = raiz + (ar ? 'aba' : 'ía');
    f.imp3p = raiz + (ar ? 'aban' : 'ían');
    f.fut3s = irr.fut3s || inf + 'á'; f.fut3p = irr.fut3p || inf + 'án';
    f.cond3s = irr.cond3s || inf + 'ía'; f.cond3p = irr.cond3p || inf + 'ían';
    let rs = raiz;
    const vs = ar ? 'e' : 'a';
    if (ar) {
      if (/c$/.test(raiz)) rs = raiz.slice(0, -1) + 'qu';
      else if (/g$/.test(raiz)) rs = raiz + 'u';
      else if (/z$/.test(raiz)) rs = raiz.slice(0, -1) + 'c';
    } else if (/cer$/.test(inf)) rs = raiz.slice(0, -1) + 'zc';
    f.subj3s = irr.subj3s || rs + vs;
    f.subj3p = irr.subj3p || rs + vs + 'n';
    f.inf_se = inf + 'se';
    return f;
  }

  // ---------------------------------------------------------------
  // Determinantes y concordancia
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
  const GENERO_DE = {};
  PARES_GENERO.forEach(([m, f]) => { GENERO_DE[m] = { m, f }; GENERO_DE[f] = { m, f }; });
  const DETERMINANTES = new Set(Object.keys(GENERO_DE).concat(['del', 'al', 'mi', 'mis', 'tu', 'tus', 'gran', 'mayor', 'menor', 'principal']));

  function cambiarGeneroAdj(w, g) {
    if (g === 'f') return w.replace(/os$/, 'as').replace(/o$/, 'a');
    return w.replace(/as$/, 'os').replace(/a$/, 'o');
  }

  // ---------------------------------------------------------------
  // Índices por área (se construyen una vez y se guardan)
  // ---------------------------------------------------------------
  const CACHE = new Map();
  function indices(dominio) {
    const clave = dominio || 'general';
    if (CACHE.has(clave)) return CACHE.get(clave);
    const dom = D.DOMINIOS[clave] || D.DOMINIOS.general;
    // el área va primero: sus grupos tienen prioridad
    const SUST = dom.sust.concat(D.GENERAL.sust);
    const ADJ = dom.adj.concat(D.GENERAL.adj);
    const VERB = dom.verb.concat(D.GENERAL.verb);
    const FRASES = dom.frases.concat(D.GENERAL.frases);

    const INDICE = new Map();
    const add = (forma, cand) => {
      const k = forma.toLowerCase();
      if (!INDICE.has(k)) INDICE.set(k, []);
      INDICE.get(k).push(cand);
    };
    SUST.forEach((grupo, gi) => grupo.g.forEach(([lema], li) => {
      add(lema, { pos: 'n', gi, li, num: 's' });
      add(plural(lema), { pos: 'n', gi, li, num: 'p' });
    }));
    ADJ.forEach((grupo, gi) => grupo.forEach((lema, li) => {
      const f = formasAdj(lema);
      const vistos = new Set();
      ['ms', 'fs', 'mp', 'fp'].forEach((slot) => {
        if (vistos.has(f[slot])) return; vistos.add(f[slot]);
        add(f[slot], { pos: 'a', gi, li, slot });
      });
    }));
    const CONJ = VERB.map((g) => g.map(conjugar));
    CONJ.forEach((grupo, gi) => grupo.forEach((formas, li) => {
      Object.entries(formas).forEach(([slot, forma]) => add(forma, { pos: 'v', gi, li, slot }));
    }));

    const ADJ_VAR = new Set();
    ADJ.forEach((g) => g.forEach((a) => {
      const f = formasAdj(a);
      if (f.variable) [f.ms, f.fs, f.mp, f.fp].forEach((x) => ADJ_VAR.add(x));
    }));

    const r = { dom, SUST, ADJ, VERB, FRASES, INDICE, CONJ, ADJ_VAR };
    CACHE.set(clave, r);
    return r;
  }

  // Formas verbales para la voz pasiva: pretérito -> verbo, participio -> verbo
  const PASIVA = (function () {
    const verbos = new Set(D.VERBOS_PASIVA);
    D.GENERAL.verb.forEach((g) => g.forEach((v) => verbos.add(v)));
    Object.values(D.DOMINIOS).forEach((d) => d.verb.forEach((g) => g.forEach((v) => verbos.add(v))));
    const pret = new Map(), part = new Map();
    verbos.forEach((inf) => {
      const f = conjugar(inf);
      pret.set(f.pret3s, { inf, n: 's', f });
      pret.set(f.pret3p, { inf, n: 'p', f });
      part.set(f.part_ms, { inf, g: 'm', n: 's', f });
      part.set(f.part_fs, { inf, g: 'f', n: 's', f });
      part.set(f.part_mp, { inf, g: 'm', n: 'p', f });
      part.set(f.part_fp, { inf, g: 'f', n: 'p', f });
    });
    return { pret, part };
  })();

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  function azar(seed, n) {
    let h = 2166136261 ^ seed;
    const s = String(n) + ':' + seed;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const esMayus = (c) => c && c !== c.toLowerCase() && c === c.toUpperCase();
  function capitalizarComo(orig, nuevo) {
    if (!orig || !nuevo) return nuevo;
    return esMayus(orig[0]) ? nuevo[0].toUpperCase() + nuevo.slice(1) : nuevo;
  }
  const mayusInicial = (s) => s.replace(/^(\s*[¿¡"“«(]*)(\p{L})/u, (_, a, b) => a + b.toUpperCase());
  const nPalabras = (s) => (s.match(/[\p{L}\d]+/gu) || []).length;

  function tokenizar(texto) {
    const re = /([\p{L}\p{M}]+)|(\d+(?:[.,]\d+)*)|(\s+)|([\s\S])/gu;
    const toks = [];
    let m;
    while ((m = re.exec(texto))) {
      const kind = m[1] ? 'w' : m[2] ? 'n' : m[3] ? 's' : 'p';
      toks.push({ t: m[0], kind, start: m.index, out: m[0], prot: false, cid: null, cls: null, sid: null });
    }
    return toks;
  }

  const PROB = {
    leve: { sin: 0.35, estr: 0.3 },
    medio: { sin: 0.75, estr: 0.75 },
    fuerte: { sin: 1, estr: 1 },
  };

  // ---------------------------------------------------------------
  // V2: reglas de estructura
  // ---------------------------------------------------------------
  const ABREV = new Set(['al', 'etc', 'ej', 'sr', 'sra', 'srta', 'dr', 'dra', 'ing', 'lic', 'pág', 'págs', 'pp', 'p', 'vol', 'núm', 'art', 'cap', 'fig', 'aprox', 'op', 'cit', 'ed', 'eds', 'av', 'jr', 'mg', 'mag', 'tab', 'n']);

  function dividirOraciones(texto) {
    const partes = []; // {tipo:'o'|'g', text, start}
    let ini = 0, i = 0;
    const n = texto.length;
    // separar espacios iniciales
    while (i < n) {
      const c = texto[i];
      let fin = -1;
      if (c === '\n' && texto[i + 1] === '\n') fin = i; // párrafo sin punto final
      if (/[.!?…]/.test(c)) {
        let j = i;
        while (j + 1 < n && /[.!?…]/.test(texto[j + 1])) j++;
        if (c === '.') {
          const antes = texto.slice(ini, i).match(/(\p{L}+)$/u);
          if (antes && ABREV.has(antes[1].toLowerCase()) && j === i) { i++; continue; }
          if (/\d/.test(texto[j + 1] || '')) { i++; continue; }
        }
        while (j + 1 < n && /["”»)']/.test(texto[j + 1])) j++;
        if (j + 1 >= n) fin = j + 1;
        else if (/\s/.test(texto[j + 1])) {
          // la siguiente oración debe empezar con mayúscula, número o signo de apertura
          let k = j + 1;
          while (k < n && /[ \t]/.test(texto[k])) k++;
          if (k >= n || texto[k] === '\n' || /[\p{Lu}\d¿¡"“«(]/u.test(texto[k])) fin = j + 1;
        }
      }
      if (fin >= 0) {
        if (fin > ini) partes.push({ tipo: 'o', text: texto.slice(ini, fin), start: ini });
        let k = fin;
        while (k < n && /\s/.test(texto[k])) k++;
        if (k > fin) partes.push({ tipo: 'g', text: texto.slice(fin, k), start: fin });
        ini = i = k;
        continue;
      }
      i++;
    }
    if (ini < n) partes.push({ tipo: 'o', text: texto.slice(ini), start: ini });
    // espacios al inicio de una oración pasan a ser separador
    const res = [];
    partes.forEach((p) => {
      if (p.tipo === 'o') {
        const m = p.text.match(/^\s+/);
        if (m) { res.push({ tipo: 'g', text: m[0], start: p.start }); p = { tipo: 'o', text: p.text.slice(m[0].length), start: p.start + m[0].length }; }
        if (!p.text) return;
      }
      res.push(p);
    });
    return res;
  }

  const CONJ_CAUSA = ['dado que', 'debido a que', 'puesto que', 'ya que'];
  const CONJ_CONCESION = ['aunque', 'si bien', 'pese a que', 'a pesar de que'];
  const INF = /^[\p{L}]+(?:ar|er|ir)(?:se|lo|la|los|las|le|les)?$/u;
  const STOP_SN = new Set(['mediante', 'con', 'para', 'en', 'durante', 'a', 'por', 'según', 'desde', 'hasta', 'que', 'y', 'o', 'sobre', 'entre', 'debido', 'mientras', 'cuando', 'donde', 'utilizando', 'usando', 'aplicando', 'se', 'fue', 'fueron', 'es', 'son', 'como', 'sin', 'tras', 'hacia', 'ante']);
  const DET_GN = { el: ['m', 's'], la: ['f', 's'], los: ['m', 'p'], las: ['f', 'p'], un: ['m', 's'], una: ['f', 's'], unos: ['m', 'p'], unas: ['f', 'p'] };

  function elegirDistinto(lista, actual, h) {
    const op = lista.filter((x) => x !== (actual || '').toLowerCase());
    return op[Math.floor(h * op.length)];
  }

  function crearMinuscula(textoCompleto) {
    return function minusculaInicial(s) {
      const m = s.match(/^(\p{L}+)/u);
      if (!m) return s;
      const w = m[1];
      if (w.length >= 2 && w === w.toUpperCase()) return s; // sigla
      if (!esMayus(w[0])) return s;
      // si la palabra aparece con mayúscula en medio de una oración, es nombre propio
      const re = new RegExp('[\\p{Ll},;:]\\s+' + w + '(?![\\p{L}])', 'u');
      if (re.test(textoCompleto)) return s;
      return w[0].toLowerCase() + s.slice(1);
    };
  }

  // Cada regla recibe el núcleo de la oración (sin punto final ni cita final)
  // y devuelve {texto, regla} o null.
  function reglasEstructura(core, ctx) {
    const { low, h } = ctx;
    const out = [];
    let m;

    // 1. Causa al final -> causa al inicio
    m = core.match(/^([^,]+?)(?:,\s*|\s+)(porque|ya que|puesto que|dado que|debido a que)\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[3]) >= 3) {
      const c = elegirDistinto(CONJ_CAUSA, m[2], h);
      out.push({ texto: mayusInicial(c) + ' ' + m[3] + ', ' + low(m[1]), regla: 'La causa pasa al inicio' });
    }
    // 2. Causa al inicio -> causa al final
    m = core.match(/^(Porque|Ya que|Puesto que|Dado que|Debido a que)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 3 && nPalabras(m[3]) >= 3) {
      const c = elegirDistinto(['ya que', 'puesto que', 'dado que'], m[1], h);
      out.push({ texto: mayusInicial(m[3]) + ', ' + c + ' ' + m[2], regla: 'La causa pasa al final' });
    }
    // 3. Finalidad al inicio -> al final
    m = core.match(/^(Para|Con el fin de|Con el propósito de|Con el objetivo de|A fin de)\s+([^,]+),\s+(.+)$/u);
    if (m && INF.test(m[2].split(/\s+/)[0]) && nPalabras(m[3]) >= 3) {
      out.push({ texto: mayusInicial(m[3]) + ' ' + m[1].toLowerCase() + ' ' + m[2], regla: 'La finalidad pasa al final' });
    }
    // 4. Finalidad al final -> al inicio
    m = core.match(/^([^,]+?)\s+(para|con el fin de|a fin de|con el objetivo de)\s+(\p{L}+)(\s+[^,]*)?$/u);
    if (m && INF.test(m[3]) && nPalabras(m[1]) >= 4) {
      out.push({ texto: mayusInicial(m[2]) + ' ' + m[3] + (m[4] || '') + ', ' + low(m[1]), regla: 'La finalidad pasa al inicio' });
    }
    // 5. Concesión al inicio <-> al final
    m = core.match(/^(Aunque|Si bien|A pesar de que|Pese a que)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 3 && nPalabras(m[3]) >= 3) {
      const c = elegirDistinto(CONJ_CONCESION, m[1], h);
      out.push({ texto: mayusInicial(m[3]) + ', ' + c + ' ' + m[2], regla: 'La concesión pasa al final' });
    }
    m = core.match(/^([^,]+),\s+(aunque|si bien|a pesar de que|pese a que)\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[3]) >= 3) {
      const c = elegirDistinto(CONJ_CONCESION, m[2], h);
      out.push({ texto: mayusInicial(c) + ' ' + m[3] + ', ' + low(m[1]), regla: 'La concesión pasa al inicio' });
    }
    // 6. Condición al inicio -> al final
    m = core.match(/^Si\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[2]) >= 3 && !/\bsi\b/i.test(m[2])) {
      out.push({ texto: mayusInicial(m[2]) + ' si ' + m[1], regla: 'La condición pasa al final' });
    }
    // 7. ", lo que ..." -> dos oraciones
    m = core.match(/^(.+?),\s+(lo que|lo cual)\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 5 && nPalabras(m[3]) >= 4) {
      const c = ['Esto', 'Ello', 'Esta situación'][Math.floor(h * 3)];
      out.push({ texto: m[1] + '. ' + c + ' ' + m[3], regla: 'Se divide en dos oraciones' });
    }
    // 8. Pasiva refleja -> pasiva perifrástica ("se analizaron los datos" -> "los datos fueron analizados")
    m = core.match(/(^|,\s+)([Ss]e)\s+(\p{L}+)\s+((el|la|los|las|un|una|unos|unas)\s+(?:[\p{L}\d]+\s*?)+?)(?=(\s+(?:mediante|con|para|en|durante|a través|por|según|desde|hasta|que|y|sobre|entre|debido|mientras|cuando|donde|utilizando|usando|aplicando|a)(?:\s|$))|,|$)/u);
    if (m) {
      const v = PASIVA.pret.get(m[3].toLowerCase());
      const gn = DET_GN[m[5]];
      const sn = m[4].trim();
      const palabrasSN = sn.split(/\s+/);
      if (v && gn && gn[1] === v.n && palabrasSN.length <= 8 && !palabrasSN.slice(1).some((w) => STOP_SN.has(w.toLowerCase()))) {
        const ser = v.n === 's' ? 'fue' : 'fueron';
        const part = v.f['part_' + gn[0] + gn[1]];
        const antes = core.slice(0, m.index) + m[1];
        const despues = core.slice(m.index + m[0].length);
        const nuevoSN = m[1] ? sn : mayusInicial(sn);
        out.push({ texto: antes + nuevoSN + ' ' + ser + ' ' + part + despues, regla: 'Voz pasiva con «fue/fueron»' });
      }
    }
    // 9. Pasiva perifrástica -> pasiva refleja ("los datos fueron analizados" -> "se analizaron los datos")
    m = core.match(/(^|,\s+)((?:el|la|los|las|un|una|unos|unas)\s+(?:[\p{L}\d]+\s+){1,6}?)(fue|fueron)\s+(\p{L}+)((?:\s+(?!por\s)[^,]*)?)(?=,|$)/iu);
    if (m) {
      const p = PASIVA.part.get(m[4].toLowerCase());
      const det = m[2].split(/\s+/)[0].toLowerCase();
      const gn = DET_GN[det];
      const palabrasSN = m[2].trim().split(/\s+/);
      const nSer = m[3].toLowerCase() === 'fue' ? 's' : 'p';
      if (p && gn && p.g === gn[0] && p.n === gn[1] && nSer === gn[1] && !palabrasSN.slice(1).some((w) => STOP_SN.has(w.toLowerCase()))) {
        const verbo = nSer === 's' ? p.f.pret3s : p.f.pret3p;
        const sn = m[2].trim();
        const snMin = sn[0].toLowerCase() + sn.slice(1);
        const se = m[1] ? 'se' : 'Se';
        const antes = core.slice(0, m.index) + m[1];
        const despues = core.slice(m.index + m[0].length);
        out.push({ texto: antes + se + ' ' + verbo + ' ' + snMin + m[5] + despues, regla: 'Voz pasiva con «se»' });
      }
    }
    return out;
  }

  function reestructurar(texto, opts) {
    const p = PROB[opts.intensidad || 'medio'].estr;
    const apagadas = new Set(opts.estructuraOff || []);
    const low = crearMinuscula(texto);
    const partes = dividirOraciones(texto);
    let texto2 = '';
    const rangos = []; // {sid, start, end, regla, original}
    let oi = 0;
    partes.forEach((pt) => {
      if (pt.tipo === 'g') { texto2 += pt.text; return; }
      const sid = oi++;
      let nueva = null;
      if (opts.estructura !== false) nueva = transformarOracion(pt.text, sid);
      if (nueva) {
        const ini = texto2.length;
        texto2 += nueva.texto;
        rangos.push({ sid, start: ini, end: texto2.length, regla: nueva.regla, original: pt.text, activa: true });
      } else {
        if (nueva === null && candidatoGuardado) rangos.push({ sid, start: texto2.length, end: texto2.length + pt.text.length, regla: candidatoGuardado.regla, original: pt.text, activa: false });
        texto2 += pt.text;
      }
      candidatoGuardado = null;
    });
    return { texto2, rangos };

    var candidatoGuardado = null;
    function transformarOracion(s, sid) {
      candidatoGuardado = null;
      if (/["“”«»]/.test(s) || /^[¿¡]/.test(s)) return null;
      const m = s.match(/^([\s\S]*?)(\s*\([^()]*\d{4}[^()]*\))?([.!?…]*)$/u);
      if (!m || !m[1].trim()) return null;
      const core = m[1], cita = m[2] || '', fin = m[3] || '';
      if (/[;:\n]/.test(core)) return null;
      const h = azar(opts.seed + 29, sid);
      const cands = reglasEstructura(core, { low, h });
      if (!cands.length) return null;
      const c = cands[Math.floor(azar(opts.seed + 17, sid) * cands.length)];
      // ¿se aplica? (intensidad o el usuario la desactivó)
      if (apagadas.has(sid)) { candidatoGuardado = c; return null; }
      if (azar(opts.seed + 11, sid) >= p) return null;
      const texto3 = (mayusInicial(c.texto) + cita + fin).replace(/([^.])\.\.$/, '$1.');
      return { texto: texto3, regla: c.regla };
    }
  }

  // ---------------------------------------------------------------
  // Parafrasear
  // ---------------------------------------------------------------
  function parafrasear(texto, opts) {
    opts = Object.assign({ seed: 1, intensidad: 'medio', overrides: {}, protegidos: [], personales: [], dominio: 'general', estructura: true, estructuraOff: [] }, opts || {});
    const seed = opts.seed;
    const pSin = PROB[opts.intensidad].sin;
    const overrides = opts.overrides;
    const IX = indices(opts.dominio);

    // --- V2: estructura ---
    const { texto2, rangos } = reestructurar(texto, opts);

    // lo que el usuario define en su diccionario prevalece sobre los términos protegidos del área
    const fuentesPersonales = new Set((opts.personales || []).map((g) => g[0].toLowerCase()));
    const protegidos = opts.protegidos.map((s) => s.trim().toLowerCase())
      .concat(IX.dom.protegidos.filter((t) => !fuentesPersonales.has(t)))
      .filter(Boolean);

    const toks = tokenizar(texto2);
    rangos.forEach((r) => {
      toks.forEach((t) => { if (t.start >= r.start && t.start < r.end) t.sid = r.sid; });
    });
    const W = [];
    toks.forEach((t, i) => { if (t.kind === 'w') W.push(i); });
    const posEnW = new Map(W.map((ti, k) => [ti, k]));

    // --- Protección ---
    let dentro = false;
    toks.forEach((t) => {
      if (t.t === '"') { dentro = !dentro; return; }
      if (t.t === '“' || t.t === '«') { dentro = true; return; }
      if (t.t === '”' || t.t === '»') { dentro = false; return; }
      if (dentro) t.prot = true;
    });
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].t !== '(') continue;
      let j = i + 1, conAnio = false;
      while (j < toks.length && toks[j].t !== ')' && j - i < 60) {
        if (toks[j].kind === 'n' && /^\d{4}$/.test(toks[j].t)) conAnio = true;
        j++;
      }
      if (conAnio && j < toks.length) for (let k = i; k <= j; k++) toks[k].prot = true;
    }
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
      else if (esMayus(w[0]) && !inicioOracion(ti)) toks[ti].prot = true;
    });
    protegidos.forEach((frase) => {
      const partes = frase.split(/\s+/);
      for (let k = 0; k + partes.length <= W.length; k++) {
        let ok = true;
        for (let q = 0; q < partes.length; q++) if (toks[W[k + q]].t.toLowerCase() !== partes[q]) { ok = false; break; }
        if (ok) for (let ti = W[k]; ti <= W[k + partes.length - 1]; ti++) toks[ti].prot = true;
      }
    });

    const cambios = [];
    const usado = new Set();

    // --- Expresiones: diccionario personal primero, luego área y generales ---
    const grupos = [];
    (opts.personales || []).forEach((g) => grupos.push({ items: g.map((x) => x.toLowerCase()), tipo: 'personal' }));
    IX.FRASES.forEach((g) => grupos.push({ items: g, tipo: 'conector' }));
    const FR_IDX = new Map();
    let FR_MAX = 1;
    grupos.forEach((g, gi) => g.items.forEach((c, li) => {
      // en el diccionario personal solo se reemplaza el término de la izquierda
      if (g.tipo === 'personal' && li > 0) return;
      if (!FR_IDX.has(c)) FR_IDX.set(c, { gi, li });
      FR_MAX = Math.max(FR_MAX, c.split(/\s+/).length);
    }));

    for (let k = 0; k < W.length; k++) {
      if (usado.has(W[k])) continue;
      for (let L = Math.min(FR_MAX, W.length - k); L >= 1; L--) {
        let contiguo = true;
        for (let q = 0; q < L - 1; q++) {
          if (W[k + q + 1] - W[k + q] !== 2 || toks[W[k + q] + 1].t !== ' ') { contiguo = false; break; }
        }
        if (!contiguo) continue;
        const pal = [];
        for (let q = 0; q < L; q++) pal.push(toks[W[k + q]]);
        if (pal.some((t) => t.prot)) continue;
        const clave = pal.map((t) => t.t.toLowerCase()).join(' ');
        const hit = FR_IDX.get(clave);
        if (!hit) continue;
        const grupo = grupos[hit.gi];
        const ini = W[k], fin = W[k + L - 1];
        const opciones = grupo.items.filter((_, i) => i !== hit.li);
        let elegido;
        if (ini in overrides) elegido = overrides[ini];
        else if (grupo.tipo === 'personal' || azar(seed + 5, ini) < Math.max(pSin, 0.85)) elegido = opciones[Math.floor(azar(seed, ini) * opciones.length)];
        else elegido = '__orig__';
        const id = cambios.length;
        const orig = toks.slice(ini, fin + 1).map((t) => t.t).join('');
        cambios.push({ id, tipo: grupo.tipo, ini, fin, original: orig, opciones: grupo.items.map((c) => capitalizarComo(orig, c)), elegido: null });
        if (elegido !== '__orig__' && elegido.toLowerCase() !== orig.toLowerCase()) {
          const nuevo = capitalizarComo(orig, elegido);
          cambios[id].elegido = nuevo;
          toks[ini].out = nuevo;
          for (let ti = ini + 1; ti <= fin; ti++) toks[ti].out = '';
          for (let ti = ini; ti <= fin; ti++) { toks[ti].cid = id; toks[ti].cls = grupo.tipo; usado.add(ti); }
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
    const esAdjVariable = (w) => IX.ADJ_VAR.has(w) || (/(ad|id|iv|ic|os|ari)[oa]s?$/.test(w) && w.length > 5);
    const concordancias = [];

    W.forEach((ti) => {
      const tok = toks[ti];
      if (tok.prot || usado.has(ti)) return;
      const cands = IX.INDICE.get(tok.t.toLowerCase());
      if (!cands) return;
      const prev = prevPalabra(ti);
      const prevEsDet = prev && DETERMINANTES.has(prev.out.toLowerCase());
      const sust = cands.find((x) => x.pos === 'n');
      const verb = cands.find((x) => x.pos === 'v');
      const adj = cands.find((x) => x.pos === 'a');
      let c = null;
      if (sust && (prevEsDet || (!IX.SUST[sust.gi].needsDet && !verb))) c = sust;
      else if (verb && !prevEsDet) c = verb;
      else if (adj) c = adj;
      if (!c) return;
      const sig = sigContiguo(ti);
      if (c.pos === 'n' && sig != null && /^(parte|cuenta)$/i.test(toks[sig].t)) return;

      const forzado = ti in overrides;
      if (!forzado && azar(seed + 7, ti) >= pSin) return;

      let opciones;
      if (c.pos === 'n') {
        opciones = IX.SUST[c.gi].g.map(([lema, gen]) => ({ lema, gen, forma: c.num === 'p' ? plural(lema) : lema }));
      } else if (c.pos === 'a') {
        const fOrig = formasAdj(IX.ADJ[c.gi][c.li]);
        opciones = IX.ADJ[c.gi].map((lema) => {
          const f = formasAdj(lema);
          if (!fOrig.variable && f.variable) return null;
          return { lema, forma: f[c.slot] };
        });
      } else {
        opciones = IX.CONJ[c.gi].map((formas, li) => ({ lema: IX.VERB[c.gi][li], forma: formas[c.slot] }));
      }
      const validas = opciones.map((o, i) => (o && i !== c.li ? i : -1)).filter((i) => i >= 0);
      if (!validas.length) return;
      let idx;
      if (forzado) {
        idx = overrides[ti] === '__orig__' ? c.li : opciones.findIndex((o) => o && o.forma.toLowerCase() === String(overrides[ti]).toLowerCase());
        if (idx < 0) idx = c.li;
      } else idx = validas[Math.floor(azar(seed + 3, ti) * validas.length)];

      const id = cambios.length;
      cambios.push({ id, tipo: 'sinonimo', ini: ti, fin: ti, original: tok.t, opciones: opciones.filter(Boolean).map((o) => capitalizarComo(tok.t, o.forma)), elegido: null });
      usado.add(ti);
      tok.cid = id;
      if (idx === c.li) { tok.cls = 'original'; return; }
      const op = opciones[idx];
      tok.out = capitalizarComo(tok.t, op.forma);
      tok.cls = 'sinonimo';
      cambios[id].elegido = tok.out;
      if (c.pos === 'n') {
        const genOrig = IX.SUST[c.gi].g[c.li][1];
        if (op.gen !== genOrig) concordancias.push({ ti, gen: op.gen });
      }
    });

    // --- Concordancia de género ---
    concordancias.forEach(({ ti, gen }) => {
      let cur = ti;
      for (let paso = 0; paso < 2; paso++) {
        const pidx = prevContiguo(cur);
        if (pidx == null) break;
        const tk = toks[pidx];
        if (tk.prot) break;
        const lw = tk.out.toLowerCase();
        if (GENERO_DE[lw]) {
          const nuevo = GENERO_DE[lw][gen];
          if (nuevo !== lw) { tk.out = capitalizarComo(tk.out, nuevo); if (!tk.cls) tk.cls = 'concordancia'; }
          if (lw === 'la' && gen === 'm') {
            const pp = prevContiguo(pidx);
            if (pp != null && /^(de|a)$/i.test(toks[pp].out)) {
              toks[pp].out = toks[pp].out + 'l'; if (!toks[pp].cls) toks[pp].cls = 'concordancia';
              tk.out = ''; toks[pidx - 1].out = '';
            }
          }
          break;
        }
        if (lw === 'del' && gen === 'f') { tk.out = capitalizarComo(tk.out, 'de la'); if (!tk.cls) tk.cls = 'concordancia'; break; }
        if (lw === 'al' && gen === 'f') { tk.out = capitalizarComo(tk.out, 'a la'); if (!tk.cls) tk.cls = 'concordancia'; break; }
        if (esAdjVariable(lw)) { tk.out = cambiarGeneroAdj(tk.out, gen); if (!tk.cls) tk.cls = 'concordancia'; cur = pidx; continue; }
        break;
      }
      const s = sigContiguo(ti);
      if (s != null) {
        const tk = toks[s];
        if (!tk.prot && esAdjVariable(tk.out.toLowerCase())) {
          tk.out = cambiarGeneroAdj(tk.out, gen);
          if (!tk.cls) tk.cls = 'concordancia';
        }
      }
      // sujeto de una pasiva: "la limpieza del área fue realizada" -> "el aseo del área fue realizado"
      let k = posEnW.get(ti);
      for (let paso = 0; paso < 6 && k < W.length - 1; paso++) {
        const entre = toks.slice(W[k] + 1, W[k + 1]).map((t) => t.t).join('');
        if (!/^\s+$/.test(entre)) break;
        k++;
        const w = toks[W[k]].out.toLowerCase();
        if (w === 'que' || w === 'y' || w === 'o') break;
        if (/^(fue|fueron|es|son|era|eran|será|serán|ha sido|está|están|estaba|estaban|resultó|resultaron)$/.test(w)) {
          const sigP = sigContiguo(W[k]);
          if (sigP != null) {
            const tp = toks[sigP];
            if (!tp.prot && /(ad|id|ich|it|ert|uest|ech)[oa]s?$/.test(tp.out.toLowerCase())) {
              tp.out = cambiarGeneroAdj(tp.out, gen);
              if (!tp.cls) tp.cls = 'concordancia';
            }
          }
          break;
        }
      }
    });

    // --- Segmentos de salida ---
    const segmentos = [];
    toks.forEach((t) => {
      const last = segmentos[segmentos.length - 1];
      if (t.cid != null) {
        if (last && last.cid === t.cid && last.sid === t.sid) { last.text += t.out; return; }
        segmentos.push({ text: t.out, cid: t.cid, cls: t.cls, sid: t.sid });
      } else if (t.cls === 'concordancia') {
        segmentos.push({ text: t.out, cid: null, cls: 'concordancia', sid: t.sid });
      } else {
        if (last && last.cid == null && !last.cls && last.sid === t.sid) { last.text += t.out; return; }
        segmentos.push({ text: t.out, cid: null, cls: null, sid: t.sid });
      }
    });
    const resultado = segmentos.map((s) => s.text).join('');

    const estructuras = rangos.map((r) => ({ sid: r.sid, regla: r.regla, original: r.original, activa: r.activa }));
    const stats = {
      palabras: W.length,
      conectores: cambios.filter((c) => c.tipo === 'conector' && c.elegido).length,
      personales: cambios.filter((c) => c.tipo === 'personal' && c.elegido).length,
      sinonimos: cambios.filter((c) => c.tipo === 'sinonimo' && c.elegido).length,
      concordancia: toks.filter((t) => t.cls === 'concordancia' && t.cid == null).length,
      estructuras: estructuras.filter((e) => e.activa).length,
    };
    return { resultado, segmentos, cambios, estructuras, stats };
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
    const setA = new Set(ta), setB = new Set(tb);
    const marcadas = new Set();
    tb.forEach((t, i) => { if (setA.has(t)) { marcadas.add(i); marcadas.add(i + 1); marcadas.add(i + 2); } });
    let comp = 0;
    setA.forEach((t) => { if (setB.has(t)) comp++; });
    return { porcentaje: Math.round((comp / setA.size) * 100), marcadas };
  }

  // Lee "palabra = alt1, alt2" (una línea por grupo)
  function leerPersonales(texto) {
    const grupos = [];
    (texto || '').split('\n').forEach((linea) => {
      const partes = linea.split(/[=,]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
      if (partes.length >= 2) grupos.push(Array.from(new Set(partes.map((p) => p.toLowerCase()))));
    });
    return grupos.filter((g) => g.length >= 2);
  }

  const DOMINIOS = Object.entries(D.DOMINIOS).map(([id, d]) => ({ id, nombre: d.nombre }));

  const api = { parafrasear, similitud, palabrasNorm, leerPersonales, DOMINIOS, _plural: plural, _conjugar: conjugar, _dividir: dividirOraciones };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parafraseador = api;
})(typeof self !== 'undefined' ? self : this);
