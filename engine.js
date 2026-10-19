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
  const T = (typeof module !== 'undefined' && module.exports)
    ? require('./tesauro.js')
    : root.PP_TESAURO;
  // Solo se usan sinónimos respaldados por OpenThesaurus-es
  const VALIDOS = new Set(T.PARES);
  const valido = (a, b) => a === b || VALIDOS.has([a.toLowerCase(), b.toLowerCase()].sort().join('|'));

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
    const pret = new Map(), part = new Map(), formas = new Map();
    verbos.forEach((inf) => {
      const f = conjugar(inf);
      pret.set(f.pret3s, { inf, n: 's', f });
      pret.set(f.pret3p, { inf, n: 'p', f });
      part.set(f.part_ms, { inf, g: 'm', n: 's', f });
      part.set(f.part_fs, { inf, g: 'f', n: 's', f });
      part.set(f.part_mp, { inf, g: 'm', n: 'p', f });
      part.set(f.part_fp, { inf, g: 'f', n: 'p', f });
      [['pret3s', 'pret', 's'], ['pret3p', 'pret', 'p'], ['pres3s', 'pres', 's'], ['pres3p', 'pres', 'p'], ['fut3s', 'fut', 's'], ['fut3p', 'fut', 'p']]
        .forEach(([slot, tiempo, n]) => { if (!formas.has(f[slot])) formas.set(f[slot], { inf, n, tiempo, f }); });
    });
    return { pret, part, formas };
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

  const REGIMEN_INF = new Set(['lograr', 'alcanzar', 'pretender', 'buscar']);

  const PROB = {
    leve: { sin: 0.4, estr: 0.5 },
    medio: { sin: 0.75, estr: 1 },
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

  const CONJ_CAUSA = ['debido a que', 'puesto que', 'ya que']; // U. del Rosario, conectores causales
  const CONJ_CONCESION = ['aunque', 'si bien']; // U. del Rosario
  const INF = /^[\p{L}]+(?:ar|er|ir)(?:se|lo|la|los|las|le|les)?$/u;
  const STOP_SN = new Set(['mediante', 'con', 'para', 'en', 'durante', 'a', 'por', 'según', 'desde', 'hasta', 'que', 'y', 'o', 'sobre', 'entre', 'debido', 'mientras', 'cuando', 'donde', 'utilizando', 'usando', 'aplicando', 'se', 'fue', 'fueron', 'es', 'son', 'como', 'sin', 'tras', 'hacia', 'ante', 'no', 'cual', 'quien']);
  const DET_GN = {
    el: ['m', 's'], la: ['f', 's'], los: ['m', 'p'], las: ['f', 'p'], un: ['m', 's'], una: ['f', 's'], unos: ['m', 'p'], unas: ['f', 'p'],
    este: ['m', 's'], esta: ['f', 's'], estos: ['m', 'p'], estas: ['f', 'p'], dicho: ['m', 's'], dicha: ['f', 's'], dichos: ['m', 'p'], dichas: ['f', 'p'],
  };
  const PRONOMBRE = { ms: 'Este', fs: 'Esta', mp: 'Estos', fp: 'Estas' };
  // conectores que abren la oración: se separan y las reglas se aplican al resto
  const CONECTORES_INI = new Set([
    'sin embargo', 'no obstante', 'aun así', 'con todo', 'por lo tanto', 'por tanto', 'por consiguiente', 'en consecuencia', 'por ende',
    'además', 'asimismo', 'adicionalmente', 'a su vez', 'del mismo modo', 'de igual manera', 'de igual forma', 'de la misma manera', 'igualmente',
    'por ejemplo', 'a modo de ejemplo', 'es decir', 'esto es', 'o sea', 'en otras palabras', 'en primer lugar', 'en segundo lugar', 'en tercer lugar',
    'primeramente', 'para empezar', 'finalmente', 'por último', 'para finalizar', 'en conclusión', 'en síntesis', 'en resumen', 'para concluir',
    'en cambio', 'por el contrario', 'en este sentido', 'en esta línea', 'desde esta perspectiva', 'por otro lado', 'por otra parte', 'de otro lado',
    'de esta manera', 'de este modo', 'de esta forma', 'así', 'así pues', 'por ello', 'por esta razón', 'por este motivo', 'por eso', 'en este contexto',
    'en ese sentido', 'en tal sentido', 'al respecto', 'de hecho', 'en efecto', 'luego', 'seguidamente', 'a continuación', 'en general',
    'por lo general', 'en definitiva', 'ante ello', 'ante esto', 'frente a ello', 'en particular', 'concretamente', 'sobre todo', 'principalmente',
  ]);
  // verbos cuya pasiva con «por» suena forzada
  const NO_PASIVA_ACTIVA = new Set(['tener', 'presentar', 'contar', 'mostrar', 'indicar', 'señalar', 'evidenciar', 'revelar', 'reflejar', 'demostrar',
    'afirmar', 'mencionar', 'buscar', 'permitir', 'posibilitar', 'requerir', 'necesitar', 'citar', 'implicar', 'involucrar', 'considerar', 'estimar', 'mantener']);
  const PREP_CORTE = new Set(['en', 'durante', 'mediante', 'para', 'desde', 'según', 'con', 'tras']);
  const MARC_FIN = /\s(durante|desde|mediante|a través del?|por medio del?|a lo largo del?|a partir del?|en el año|en los años|en el periodo|en el período|en los últimos|en las últimas|en el mes|en el área|en la empresa|en el sector|en el distrito|en la ciudad|en el taller|en el almacén|en la región|en el país|en la actualidad|actualmente|hoy en día|en esta investigación|en el presente estudio|según|de acuerdo con|conforme a|gracias al?|debido al?|a causa del?|como resultado del?|como consecuencia del?|con el apoyo del?|frente al?|en comparación con|en contraste con)(?=\s|$)/giu;
  const MARC_INI = /^((?:En|Durante|Desde|Tras|Luego de|Después de|Mediante|A través de|Por medio de|A lo largo de|A partir de|Según|De acuerdo con|Conforme a|Con base en|Con|Sobre|Bajo|Ante|Entre|Frente a|Para (?:el|la|los|las|este|esta|estos|estas|un|una|su|sus|nuestro|nuestra)|Gracias a|Debido a|A causa de|Como resultado de|Como consecuencia de|Actualmente|Hoy en día|Inicialmente|Posteriormente|Recientemente|Anteriormente|Históricamente)(?=[\s,])[^,]*),\s+(.+)$/u;
  const COMA_FIN = /^(según|de acuerdo con|conforme a)/i;

  function elegirDistinto(lista, actual, h) {
    const op = lista.filter((x) => x !== (actual || '').toLowerCase());
    return op[Math.floor(h * op.length)];
  }

  const PALABRAS_FUNCION = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'se', 'no', 'su', 'sus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esto', 'eso', 'ello', 'ellos', 'ellas', 'nadie', 'nada', 'todo', 'toda', 'todos', 'todas', 'cada', 'dicho', 'dicha', 'dichos', 'dichas', 'es', 'son', 'fue', 'fueron', 'hay', 'había', 'muchos', 'muchas', 'varios', 'varias', 'algunos', 'algunas', 'otro', 'otra', 'otros', 'otras', 'tal', 'tales', 'cuando', 'si', 'como', 'aunque', 'porque', 'ya', 'así', 'también', 'además', 'entonces', 'luego', 'solo', 'sólo']);
  function crearMinuscula(textoCompleto, indice) {
    const enMinuscula = new Set((textoCompleto.match(/(?<![\p{L}])\p{Ll}[\p{L}]*/gu) || []));
    return function minusculaInicial(s) {
      const m = s.match(/^(\p{L}+)/u);
      if (!m) return s;
      const w = m[1];
      if (w.length >= 2 && w === w.toUpperCase()) return s; // sigla
      if (/^[-'’]\p{L}/u.test(s.slice(w.length))) return s; // nombre compuesto ("El-Hajj")
      if (!esMayus(w[0])) return s;
      const lw = w.toLowerCase();
      const comun = PALABRAS_FUNCION.has(lw) || enMinuscula.has(lw) || PASIVA.formas.has(lw) || (indice && indice.has(lw)) || /(aron|ieron|aban|ían|ó)$/.test(lw);
      if (!comun) return s; // probable nombre propio ("Kurian")
      // si la palabra aparece con mayúscula en medio de una oración, es nombre propio
      const re = new RegExp('[\\p{Ll},;:]\\s+' + w + '(?![\\p{L}])', 'u');
      if (re.test(textoCompleto)) return s;
      return w[0].toLowerCase() + s.slice(1);
    };
  }

  const RELATIVO_INI = /^,\s+(que|el cual|la cual|los cuales|las cuales|lo que|lo cual|quien|quienes|donde)(\s|$)/i;
  const tieneSubordinada = (s) => /(^|\s)(que|qué|cuando|cuándo|donde|dónde|mientras|porque|cual|cuales|cuál|quien|quienes|cómo|cuánto|cuánta|cuántos|cuántas)(\s|$)/i.test(s);
  // "y" seguido de algo que no parece sustantivo (probable verbo coordinado)
  function coordinaVerbo(palabras) {
    for (let k = 0; k < palabras.length - 1; k++) {
      if (/^(y|e|o|u)$/i.test(palabras[k])) {
        const nx = palabras[k + 1].toLowerCase();
        if (!DET_GN[nx] && !GENERO_DE[nx] && !/s$/.test(nx) && !/^⟦/.test(nx)) return true;
      }
    }
    return false;
  }
  function separarCola(obj) {
    // separa un complemento final ("en el almacén") que no depende de un participio ("basado en")
    for (let k = 2; k < obj.length; k++) {
      if (PREP_CORTE.has(obj[k].toLowerCase()) && !/(ad|id)[oa]s?$/i.test(obj[k - 1])) return [obj.slice(0, k), obj.slice(k)];
    }
    return [obj, []];
  }

  // Cada regla recibe la oración sin punto final, con citas y comillas reemplazadas
  // por marcadores, y devuelve candidatos {texto, regla, grupo, divide}.
  function reglasEstructura(core, ctx) {
    const { low, h } = ctx;
    const out = [];
    const push = (texto, regla, grupo, divide) => out.push({ texto, regla, grupo, divide: !!divide, alFinal: /al final/.test(regla), tecnica: TECNICA_DE[grupo] || 'orden' });
    let m;

    // Causa al final -> al inicio
    m = core.match(/^([^,]+?)(?:,\s*|\s+)(porque|ya que|puesto que|dado que|debido a que)\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[3]) >= 3) {
      push(mayusInicial(elegirDistinto(CONJ_CAUSA, m[2], h)) + ' ' + m[3] + ', ' + low(m[1]), 'la causa pasa al inicio', 'causa');
    }
    // Causa al inicio -> al final
    m = core.match(/^(Porque|Ya que|Puesto que|Dado que|Debido a que)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 3 && nPalabras(m[3]) >= 3) {
      push(mayusInicial(m[3]) + ', ' + elegirDistinto(CONJ_CAUSA, m[1], h) + ' ' + m[2], 'la causa pasa al final', 'causa');
    }
    // Finalidad al inicio -> al final
    m = core.match(/^(Para|Con el fin de|Con el propósito de|Con el objetivo de|A fin de)\s+([^,]+),\s+(.+)$/u);
    if (m && INF.test(m[2].split(/\s+/)[0]) && nPalabras(m[3]) >= 3 && !m[3].includes(',') && !tieneSubordinada(m[3])) {
      push(mayusInicial(m[3]) + ' ' + m[1].toLowerCase() + ' ' + m[2], 'la finalidad pasa al final', 'finalidad');
    }
    // Finalidad al final -> al inicio
    m = core.match(/^([^,]+?)\s+(para|con el fin de|a fin de|con el objetivo de|con el propósito de)\s+(\p{L}+)(\s+[^,]*)?$/u);
    if (m && INF.test(m[3]) && nPalabras(m[1]) >= 4 && !tieneSubordinada(m[4] || '') && !coordinaVerbo((m[4] || '').trim().split(/\s+/))) {
      push(mayusInicial(m[2]) + ' ' + m[3] + (m[4] || '') + ', ' + low(m[1]), 'la finalidad pasa al inicio', 'finalidad');
    }
    // Concesión
    m = core.match(/^(Aunque|Si bien|A pesar de que|Pese a que)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 3 && nPalabras(m[3]) >= 3) {
      push(mayusInicial(m[3]) + ', ' + elegirDistinto(CONJ_CONCESION, m[1], h) + ' ' + m[2], 'la concesión pasa al final', 'concesion');
    }
    m = core.match(/^([^,]+),\s+(aunque|si bien|a pesar de que|pese a que)\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[3]) >= 3) {
      push(mayusInicial(elegirDistinto(CONJ_CONCESION, m[2], h)) + ' ' + m[3] + ', ' + low(m[1]), 'la concesión pasa al inicio', 'concesion');
    }
    // Condición
    m = core.match(/^Si\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[2]) >= 3 && !/\bsi\b/i.test(m[2])) {
      push(mayusInicial(m[2]) + ' si ' + m[1], 'la condición pasa al final', 'condicion');
    }
    m = core.match(/^([^,]+?)\s+si\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[2]) >= 3) {
      push('Si ' + m[2] + ', ' + low(m[1]), 'la condición pasa al inicio', 'condicion');
    }
    // Tiempo: "cuando / mientras / a medida que"
    m = core.match(/^([^,]+?)\s+(cuando|mientras|a medida que|siempre que)\s+([^,]+)$/u);
    if (m && nPalabras(m[1]) >= 3 && nPalabras(m[3]) >= 3 && !/\s(y|e)\s/.test(m[1])) {
      push(mayusInicial(m[2]) + ' ' + m[3] + ', ' + low(m[1]), 'la subordinada de tiempo pasa al inicio', 'cuando');
    }
    m = core.match(/^(Cuando|Mientras|A medida que|Siempre que)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 3 && nPalabras(m[3]) >= 3) {
      push(mayusInicial(m[3]) + ' ' + m[1].toLowerCase() + ' ' + m[2], 'la subordinada de tiempo pasa al final', 'cuando');
    }
    // Complemento inicial (tiempo, lugar, fuente) -> al final
    m = core.match(MARC_INI);
    if (m && nPalabras(m[1]) <= 12 && nPalabras(m[2]) >= 4 && !/^(En|Para)\s+(consecuencia|conclusión|resumen|síntesis|cambio|general|efecto|definitiva|primer|segundo|tercer)/u.test(m[1])) {
      const frase = m[1][0].toLowerCase() + m[1].slice(1);
      if (COMA_FIN.test(frase) || (!m[2].includes(',') && !tieneSubordinada(m[2]))) push(mayusInicial(m[2]) + (COMA_FIN.test(frase) ? ', ' : ' ') + frase, 'el complemento pasa al final', 'complemento');
    }
    // Complemento final -> al inicio
    if (!core.includes(',')) {
      let ultimo = null, mm;
      MARC_FIN.lastIndex = 0;
      while ((mm = MARC_FIN.exec(core))) ultimo = mm;
      if (ultimo) {
        const cabeza = core.slice(0, ultimo.index);
        const cola = core.slice(ultimo.index + 1);
        const nc = nPalabras(cola);
        const esAdverbio = /^(actualmente|hoy en día|en la actualidad)$/i.test(cola.trim());
        if (nPalabras(cabeza) >= 4 && (esAdverbio || (nc >= 2 && nc <= 14)) && !tieneSubordinada(cola) && !coordinaVerbo(cola.split(/\s+/))) {
          push(mayusInicial(cola) + ', ' + low(cabeza), 'el complemento pasa al inicio', 'complemento');
        }
      }
    }
    // Voz activa -> pasiva con «por» ("La empresa aplicó la metodología" -> "La metodología fue aplicada por la empresa")
    (function () {
      const ci = core.indexOf(',');
      const clausula = ci >= 0 ? core.slice(0, ci) : core;
      const resto = ci >= 0 ? core.slice(ci) : '';
      const w = clausula.split(/\s+/);
      const gnSuj = DET_GN[w[0].toLowerCase()];
      if (!gnSuj || w.length < 5 || RELATIVO_INI.test(resto)) return;
      if (resto && !/^,\s+(pero|aunque|ya que|porque|puesto que|dado que|mientras|sin|según|lo que|lo cual|y (?:el|la|los|las|su|sus|este|esta)\s)/i.test(resto)) return;
      for (let i = 2; i <= Math.min(8, w.length - 3); i++) {
        const lw = w[i].toLowerCase();
        const v = PASIVA.formas.get(lw);
        if (!v) { if (STOP_SN.has(lw)) return; continue; }
        if (NO_PASIVA_ACTIVA.has(v.inf) || v.n !== gnSuj[1]) return;
        const gn = DET_GN[w[i + 1].toLowerCase()];
        if (!gn) return;
        const [obj, cola] = separarCola(w.slice(i + 1));
        const objTxt = obj.join(' ');
        if (obj.length > 14 || /^(y|e|o|u|ni)$/i.test(obj[obj.length - 1]) || tieneSubordinada(objTxt) || coordinaVerbo(obj) || tieneSubordinada(cola.join(' '))) return;
        const ser = { pret: ['fue', 'fueron'], pres: ['es', 'son'], fut: ['será', 'serán'] }[v.tiempo][gn[1] === 's' ? 0 : 1];
        const part = v.f['part_' + gn[0] + gn[1]];
        const suj = w.slice(0, i).join(' ');
        push(mayusInicial(objTxt) + ' ' + ser + ' ' + part + ' por ' + low(suj) + (cola.length ? ' ' + cola.join(' ') : '') + resto, 'voz activa a pasiva', 'voz');
        return;
      }
    })();
    // Pasiva con «por» -> voz activa ("Los datos fueron analizados por el equipo" -> "El equipo analizó los datos")
    (function () {
      const ci = core.indexOf(',');
      const clausula = ci >= 0 ? core.slice(0, ci) : core;
      const resto = ci >= 0 ? core.slice(ci) : '';
      const w = clausula.split(/\s+/);
      const gnSuj = DET_GN[w[0].toLowerCase()];
      if (!gnSuj) return;
      for (let i = 2; i <= Math.min(9, w.length - 4); i++) {
        const lw = w[i].toLowerCase();
        if (!/^(fue|fueron|es|son|será|serán)$/.test(lw)) { if (STOP_SN.has(lw)) return; continue; }
        const p = PASIVA.part.get(w[i + 1].toLowerCase());
        if (!p || p.g !== gnSuj[0] || p.n !== gnSuj[1] || w[i + 2].toLowerCase() !== 'por') return;
        const gnAg = DET_GN[w[i + 3].toLowerCase()];
        if (!gnAg) return;
        const [agente, cola] = separarCola(w.slice(i + 3));
        if (agente.length > 8 || tieneSubordinada(agente.join(' '))) return;
        const tiempo = /^(fue|fueron)$/.test(lw) ? 'pret' : /^(es|son)$/.test(lw) ? 'pres' : 'fut';
        const verbo = p.f[tiempo + '3' + gnAg[1]];
        push(mayusInicial(agente.join(' ')) + ' ' + verbo + ' ' + low(w.slice(0, i).join(' ')) + (cola.length ? ' ' + cola.join(' ') : '') + resto, 'pasiva a voz activa', 'voz');
        return;
      }
    })();
    // Pasiva refleja -> pasiva con «ser» ("se analizaron los datos" -> "los datos fueron analizados")
    m = core.match(/(^|,\s+)([Ss]e)\s+(\p{L}+)\s+((el|la|los|las|un|una|unos|unas)\s+(?:[\p{L}\d⟦⟧%]+\s*?)+?)(?=(\s+(?:mediante|con|para|en|durante|a través|por|según|desde|hasta|que|y|sobre|entre|debido|mientras|cuando|donde|utilizando|usando|aplicando|a)(?:\s|$))|,|$)/u);
    if (m) {
      const v = PASIVA.formas.get(m[3].toLowerCase());
      const gn = DET_GN[m[5]];
      const sn = m[4].trim();
      const palabrasSN = sn.split(/\s+/);
      const despuesSN = core.slice(m.index + m[0].length);
      if (v && gn && gn[1] === v.n && palabrasSN.length <= 8 && !RELATIVO_INI.test(despuesSN) && !/^\s+(y|e|o|u)\s/.test(despuesSN) && !/^(antes|después|luego|ahora|también|además|así)$/i.test(palabrasSN[palabrasSN.length - 1]) && !palabrasSN.slice(1).some((x) => STOP_SN.has(x.toLowerCase()))) {
        const ser = { pret: ['fue', 'fueron'], pres: ['es', 'son'], fut: ['será', 'serán'] }[v.tiempo][v.n === 's' ? 0 : 1];
        const part = v.f['part_' + gn[0] + gn[1]];
        const antes = core.slice(0, m.index) + m[1];
        const despues = core.slice(m.index + m[0].length);
        push(antes + (m[1] ? sn : mayusInicial(sn)) + ' ' + ser + ' ' + part + despues, 'pasiva con «' + ser + '»', 'voz');
      }
    }
    // Pasiva con «ser» sin agente -> pasiva refleja ("los datos fueron analizados" -> "se analizaron los datos")
    m = core.match(/(^|,\s+)((?:el|la|los|las|un|una|unos|unas)\s+(?:[\p{L}\d⟦⟧%]+\s+){1,6}?)(fue|fueron|es|son)\s+(\p{L}+)((?:\s+(?!por\s)[^,]*)?)(?=,|$)/iu);
    if (m) {
      const p = PASIVA.part.get(m[4].toLowerCase());
      const gn = DET_GN[m[2].split(/\s+/)[0].toLowerCase()];
      const palabrasSN = m[2].trim().split(/\s+/);
      const ser = m[3].toLowerCase();
      const nSer = /^(fue|es)$/.test(ser) ? 's' : 'p';
      if (p && gn && p.g === gn[0] && p.n === gn[1] && nSer === gn[1] && !palabrasSN.slice(1).some((x) => STOP_SN.has(x.toLowerCase()))) {
        const verbo = p.f[(/^fue/.test(ser) ? 'pret' : 'pres') + '3' + nSer];
        const sn = m[2].trim();
        const antes = core.slice(0, m.index) + m[1];
        const despues = core.slice(m.index + m[0].length);
        push(antes + (m[1] ? 'se' : 'Se') + ' ' + verbo + ' ' + sn[0].toLowerCase() + sn.slice(1) + m[5] + despues, 'pasiva con «se»', 'voz');
      }
    }
    // Inciso tras el sujeto: "Reda et al. (2025), en «Título», trabajaron..." -> "En «Título», Reda et al. (2025) trabajaron..."
    m = core.match(/^([^,]{2,70}),\s+((?:en|según|mediante|a través de|durante|con|desde)\s[^,]{2,90}),\s+(\p{Ll}[^,]*(?:,.*)?)$/u);
    const ini3 = m ? m[3].split(/\s+/)[0].toLowerCase() : '';
    if (m && nPalabras(m[1]) <= 8 && nPalabras(m[3]) >= 3 && !CONECTORES_INI.has(m[1].toLowerCase()) && !/^(en|según|mediante|durante|con|desde|para|si|cuando|aunque)\s/i.test(m[1]) && !DET_GN[ini3] && !STOP_SN.has(ini3) && !/^(de|del|al|sobre|bajo|entre)$/.test(ini3)) {
      push(mayusInicial(m[2]) + ', ' + low(m[1]) + ' ' + m[3], 'el inciso pasa al inicio', 'complemento');
    }
    // Consecuencia -> causa al inicio: "A, así que B" -> "Dado que a, B"
    m = core.match(/^([^,]+),\s+(así que|por lo que|de modo que|de manera que|por eso|por ello|por lo cual|por consiguiente|por lo tanto)\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[3]) >= 4) {
      push(mayusInicial(CONJ_CAUSA[Math.floor(h * 3)]) + ' ' + low(m[1]) + ', ' + m[3], 'la consecuencia se expresa como causa', 'causa');
    }
    // "A y, cuando B, C" -> "A y C cuando B"
    m = core.match(/^(.+?)\s+(y|pero|e)\s*,\s+(cuando|si|al)\s+([^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[4]) >= 1 && nPalabras(m[5]) >= 2) {
      push(m[1] + ' ' + m[2] + ' ' + m[5] + ' ' + m[3] + ' ' + m[4], 'el inciso de tiempo pasa al final', 'inciso');
    }
    // "A, sin + infinitivo" <-> "Sin + infinitivo, A"
    m = core.match(/^([^,]+),\s+sin\s+(\p{L}+(?:ar|er|ir)(?:se|lo|la|los|las)?\s[^,]+)$/u);
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[2]) <= 10 && !tieneSubordinada(m[2])) {
      push('Sin ' + m[2] + ', ' + low(m[1]), 'el complemento pasa al inicio', 'sin');
    }
    m = core.match(/^Sin\s+(\p{L}+(?:ar|er|ir)(?:se|lo|la|los|las)?\s[^,]+),\s+(.+)$/u);
    if (m && nPalabras(m[2]) >= 4) {
      push(mayusInicial(m[2]) + ', sin ' + m[1], 'el complemento pasa al final', 'sin');
    }
    // Aposición: "A, un caso en el que B" -> "A. Es un caso en el que B"
    m = core.match(/^(.+?),\s+(un|una|unos|unas)\s+(\p{L}+(?:\s+\p{L}+)?)\s+(en el que|en la que|en el cual|en la cual|donde|que|cuyo|cuya)\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[5]) >= 3) {
      push(m[1] + '. Es ' + m[2] + ' ' + m[3] + ' ' + m[4] + ' ' + m[5], 'se divide en dos oraciones', 'division', true);
    }
    // relativo sin coma: "utiliza sensores que envían datos" -> "utiliza sensores. Estos envían datos"
    m = core.match(/^([^,]+?)\s+que\s+(\p{L}+)(\s+[^,]+)$/u);
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[3]) >= 2) {
      const ant = m[1].split(/\s+/);
      const previa = ant[ant.length - 1].toLowerCase();
      const verbo = m[2].toLowerCase();
      const noSirve = /(ó|aron|ieron|ar|er|ir)$/.test(previa) || PASIVA.formas.has(previa) || STOP_SN.has(previa) || GENERO_DE[previa] || DET_GN[previa] ||
        /^(de|del|al|lo|así|ya|tal|más|menos|mayor|menor|mejor|peor|hace|dado|puesto|siempre|hasta|demuestran?|muestran?|indican?|señalan?|revelan?|evidencian?|reflejan?|considera|consideran|establece|establecen|plantea|plantean|sostiene|sostienen|afirma|afirman|propone|proponen|sabe|cree|creen|dice|dicen|implica|implican|significa|requiere|requieren|permite|permiten|busca|buscan|logra|logran)$/.test(previa) ||
        DET_GN[verbo] || GENERO_DE[verbo] || /^(se|no|lo|la|le|les|los|las|ya|también|además)$/.test(verbo) === false && !/(a|e|an|en|ó|aron|ieron|aba|aban|ía|ían|rá|rán)$/.test(verbo);
      if (!noSirve) {
        const plural = /n$/.test(verbo) || (/^(se|no|lo|la|le|ya)$/.test(verbo) && /n(\s|$)/.test(m[3].trim().split(/\s+/)[0] + ' '));
        let gen = 'm';
        for (let k = ant.length - 1; k >= 0; k--) {
          const x = ant[k].toLowerCase();
          if (STOP_SN.has(x) || x === 'de' || x === 'del') continue;
          if (plural !== /s$/.test(x)) continue;
          const d = k > 0 ? DET_GN[ant[k - 1].toLowerCase()] : null;
          gen = d ? d[0] : (/(a|as|ión|iones|dad|dades|tud|tudes)$/.test(x) ? 'f' : 'm');
          break;
        }
        push(m[1] + '. ' + PRONOMBRE[gen + (plural ? 'p' : 's')] + ' ' + m[2] + m[3], 'se divide en dos oraciones', 'division', true);
      }
    }
    // ", lo que ..." -> dos oraciones
    m = core.match(/^(.+?),\s+(lo que|lo cual)\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 5 && nPalabras(m[3]) >= 4) {
      push(m[1] + '. Esto ' + m[3], 'se divide en dos oraciones', 'division', true);
    }
    // ", que ..." / ", el cual ..." -> dos oraciones
    m = core.match(/^(.+?),\s+(que|el cual|la cual|los cuales|las cuales)\s+(.+)$/u);
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[3]) >= 3) {
      let gn = null;
      const rel = m[2].toLowerCase();
      if (rel === 'el cual') gn = 'ms'; else if (rel === 'la cual') gn = 'fs'; else if (rel === 'los cuales') gn = 'mp'; else if (rel === 'las cuales') gn = 'fp';
      else {
        const dets = m[1].toLowerCase().match(/(?:^|\s)(el|la|los|las|un|una|unos|unas|este|esta|estos|estas)\s/g);
        if (dets) { const d = DET_GN[dets[dets.length - 1].trim()]; gn = d[0] + d[1]; }
      }
      if (gn) push(m[1] + '. ' + PRONOMBRE[gn] + ' ' + m[3], 'se divide en dos oraciones', 'division', true);
    }
    // ", y ..." -> dos oraciones
    m = core.match(/^([^,]+),\s+y\s+([^,]+)$/u);
    const iniDer = m ? m[2].split(/\s+/)[0].toLowerCase() : '';
    if (m && nPalabras(m[1]) >= 4 && nPalabras(m[2]) >= 4 &&
        (DET_GN[iniDer] || GENERO_DE[iniDer] || PASIVA.formas.has(iniDer) || /^(lo|la|los|las|le|les|se|no|nadie|nada|ello|esto|eso|ellos|ellas|su|sus)$/.test(iniDer))) {
      push(m[1] + '. ' + mayusInicial(m[2]), 'se divide en dos oraciones', 'division', true);
    }
    return out;
  }

  const PASOS = { leve: 1, medio: 1, fuerte: 2 };
  // técnica (y guía) que respalda cada grupo de reglas: ver D.TECNICAS
  const TECNICA_DE = { complemento: 'orden', causa: 'orden', finalidad: 'orden', concesion: 'orden', condicion: 'orden', cuando: 'orden', inciso: 'orden', sin: 'orden', voz: 'voz', division: 'dividir', atributo: 'reordenar', inicio: 'reordenar' };

  function reestructurar(texto, opts) {
    const prob = PROB[opts.intensidad || 'medio'].estr;
    const pasos = PASOS[opts.intensidad || 'medio'];
    const apagadas = new Set(opts.estructuraOff || []);
    const forzadas = new Set(opts.estructuraOn || []);
    const low = crearMinuscula(opts.contexto || texto, opts._indice);
    const partes = dividirOraciones(texto);
    let texto2 = '';
    const rangos = [];
    let oi = 0;

    partes.forEach((pt) => {
      if (pt.tipo === 'g') { texto2 += pt.text; return; }
      const sid = oi++;
      const r = opts.estructura !== false ? transformarOracion(pt.text, sid) : null;
      const ini = texto2.length;
      if (r && r.aplicada) {
        texto2 += r.texto;
        rangos.push({ sid, start: ini, end: texto2.length, regla: r.regla, tecnicas: r.tecnicas, original: pt.text, activa: true });
      } else {
        texto2 += pt.text;
        if (r) rangos.push({ sid, start: ini, end: texto2.length, regla: r.regla, tecnicas: r.tecnicas, original: pt.text, activa: false });
      }
    });
    return { texto2, rangos };

    function transformarOracion(s, sid) {
      if (/^[¿¡]/.test(s)) return null;
      const m = s.match(/^([\s\S]*?)(\s*\([^()]*\d{4}[^()]*\))?([.!?…]*)$/u);
      if (!m || !m[1].trim()) return null;
      let core = m[1];
      const cita = m[2] || '', fin = m[3] || '';
      if (/\n/.test(core)) return null;

      // proteger enlaces, URL, citas, comillas y decimales para que sus signos no confundan a las reglas
      const guard = [];
      core = core.replace(/\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|\([^()]*\)|"[^"]*"|“[^”]*”|«[^»]*»|\d+[.,]\d+/g, (x) => { guard.push(x); return '⟦' + (guard.length - 1) + '⟧'; });

      // cada tramo separado por ":" o ";" se trata como una cláusula independiente
      const piezas = core.split(/(\s*[;:]\s*)/);
      const reglas = [];
      const tecnicas = new Set();
      const salida = piezas.map((pz, i) => {
        if (i % 2 === 1 || nPalabras(pz) < 5) return pz;
        const r = transformarClausula(pz, sid * 10 + i);
        if (!r) return pz;
        reglas.push(...r.reglas);
        r.tecnicas.forEach((t) => tecnicas.add(t));
        // tras ":" o ";" la cláusula conserva la minúscula inicial
        return i > 0 && !esMayus(pz.trim()[0]) ? low(r.texto) : r.texto;
      });
      if (!reglas.length) return null;

      const regla = Array.from(new Set(reglas)).join('; ');
      const aplicada = forzadas.has(sid) || (!apagadas.has(sid) && azar(opts.seed + 11, sid) < prob);
      let texto3 = salida.join('');
      texto3 = (mayusInicial(texto3) + cita + fin).replace(/([^.])\.\.$/, '$1.');
      texto3 = texto3.replace(/⟦(\d+)⟧/g, (_, i) => guard[+i]);
      return { texto: texto3, regla: regla[0].toUpperCase() + regla.slice(1), aplicada, tecnicas: [...tecnicas] };
    }

    function transformarClausula(core, clave) {
      core = core.trim();
      const minuscula = !esMayus(core[0]);
      core = mayusInicial(core);
      // separar un conector inicial ("Por ello, ...")
      let conector = '';
      const mc = core.match(/^([^,]{2,40}),\s+(.+)$/u);
      if (mc && CONECTORES_INI.has(mc[1].toLowerCase())) { conector = mc[1]; core = mayusInicial(mc[2]); }

      let cur = core;
      const aplicadas = [];
      for (let paso = 0; paso < pasos; paso++) {
        const cands = reglasEstructura(cur, { low, h: azar(opts.seed + 29 + paso, clave) })
          .filter((c) => !aplicadas.some((a) => a.grupo === c.grupo) && !(c.divide && aplicadas.some((a) => a.alFinal)));
        if (!cands.length) break;
        const c = cands[Math.floor(azar(opts.seed + 17 + paso, clave) * cands.length)];
        aplicadas.push(c);
        cur = c.texto;
        if (c.divide) break;
      }
      if (!aplicadas.length) return null;
      let texto = conector ? conector + ', ' + low(cur) : cur;
      if (minuscula && !conector) texto = low(texto);
      return { texto, reglas: aplicadas.map((a) => a.regla), tecnicas: aplicadas.map((a) => a.tecnica) };
    }
  }

  // ---------------------------------------------------------------
  // Parafrasear
  // ---------------------------------------------------------------
  function parafrasear(texto, opts) {
    opts = Object.assign({ seed: 1, intensidad: 'medio', overrides: {}, protegidos: [], personales: [], dominio: 'general', estructura: true, estructuraOff: [], estructuraOn: [] }, opts || {});
    texto = String(texto).replace(/\r\n?/g, '\n');
    const seed = opts.seed;
    const pSin = PROB[opts.intensidad].sin;
    const overrides = opts.overrides;
    const IX = indices(opts.dominio);

    // --- V2: estructura ---
    const { texto2, rangos } = reestructurar(texto, Object.assign({}, opts, { _indice: IX.INDICE }));

    // lo que el usuario define en su diccionario prevalece sobre los términos protegidos del área
    const fuentesPersonales = new Set((opts.personales || []).map((g) => g[0].toLowerCase()));
    const protegidos = opts.protegidos.map((s) => s.trim().toLowerCase())
      .concat(IX.dom.protegidos.concat(D.GENERAL.protegidos).filter((t) => !fuentesPersonales.has(t)))
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
    (opts.personales || []).forEach((g) => grupos.push({ items: g.map((x) => x.toLowerCase()), tipo: 'personal', libre: true, tecnica: 'personal' }));
    D.CONECTORES_GUIAS.forEach((c) => grupos.push({ items: c.g, tipo: 'conector', libre: true, tecnica: 'conectores' }));
    IX.FRASES.forEach((g) => grupos.push({ items: g, tipo: 'conector', libre: false, tecnica: 'sinonimos' }));
    const FR_IDX = new Map();
    let FR_MAX = 1;
    grupos.forEach((g, gi) => g.items.forEach((c, li) => {
      // en el diccionario personal solo se reemplaza el término de la izquierda
      if (g.tipo === 'personal' && li > 0) return;
      // las opciones marcadas con '>' solo sirven de destino
      if (c[0] === '>') return;
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
        const fuenteFr = grupo.items[hit.li].replace(/^>/, '');
        const opciones = grupo.items.filter((_, i) => i !== hit.li).map((x) => x.replace(/^>/, '')).filter((x) => grupo.libre || valido(fuenteFr, x));
        if (!opciones.length) continue;
        let elegido;
        if (ini in overrides) elegido = overrides[ini];
        else if (grupo.tipo === 'personal' || azar(seed + 5, ini) < Math.max(pSin, 0.85)) elegido = opciones[Math.floor(azar(seed, ini) * opciones.length)];
        else elegido = '__orig__';
        const id = cambios.length;
        const orig = toks.slice(ini, fin + 1).map((t) => t.t).join('');
        cambios.push({ id, tipo: grupo.tipo, tecnica: grupo.tecnica, ini, fin, original: orig, opciones: [fuenteFr].concat(opciones).map((c) => capitalizarComo(orig, c)), elegido: null });
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
      else if (verb && !prevEsDet && !(prev && /^(es|son|era|eran|fue|fueron|ser|sea|una|un|otra|otro|como)$/i.test(prev.out))) c = verb;
      else if (adj) c = adj;
      if (!c) return;
      const sig = sigContiguo(ti);
      if (c.pos === 'n' && sig != null && /^(parte|cuenta)$/i.test(toks[sig].t)) return;
      // verbos que cambian de régimen ante un infinitivo ("lograr adaptarse" ≠ "alcanzar adaptarse")
      if (c.pos === 'v' && sig != null && IX.VERB[c.gi].some((v) => REGIMEN_INF.has(v)) && /(ar|er|ir)(se|lo|la|los|las|le|les)?$/i.test(toks[sig].t)) return;
      // un adjetivo usado como adverbio ("muy rápido") no se cambia
      if (c.pos === 'a' && prev && /^(muy|tan|más|menos|bastante)$/i.test(prev.out) && (sig == null || !/^[\p{L}]/u.test(toks[sig].t) || toks[sig].t.toLowerCase() === 'por')) return;

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
      // se descartan los sinónimos que el tesauro no respalda
      const lemaOrig = opciones[c.li] && opciones[c.li].lema;
      opciones = opciones.map((o, i) => (o && (i === c.li || valido(lemaOrig, o.lema)) ? o : null));
      const validas = opciones.map((o, i) => (o && i !== c.li ? i : -1)).filter((i) => i >= 0);
      if (!validas.length) return;
      let idx;
      if (forzado) {
        idx = overrides[ti] === '__orig__' ? c.li : opciones.findIndex((o) => o && o.forma.toLowerCase() === String(overrides[ti]).toLowerCase());
        if (idx < 0) idx = c.li;
      } else idx = validas[Math.floor(azar(seed + 3, ti) * validas.length)];

      const id = cambios.length;
      cambios.push({ id, tipo: 'sinonimo', tecnica: 'sinonimos', ini: ti, fin: ti, original: tok.t, opciones: opciones.filter(Boolean).map((o) => capitalizarComo(tok.t, o.forma)), elegido: null });
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
      for (let paso = 0; paso < 3; paso++) {
        const pidx = prevContiguo(cur);
        if (pidx == null) break;
        const tk = toks[pidx];
        if (tk.prot) break;
        const lw = tk.out.toLowerCase();
        if (GENERO_DE[lw]) {
          const nuevo = GENERO_DE[lw][gen];
          if (nuevo !== lw) { tk.out = capitalizarComo(tk.out, nuevo); if (!tk.cls) tk.cls = 'concordancia'; }
          // "esta misma idea", "la nueva herramienta": se sigue hasta el artículo
          if (/^(mism[oa]s?|nuev[oa]s?|primer[oa]?|ciert[oa]s?|otr[oa]s?|much[oa]s?|poc[oa]s?)$/.test(lw)) { cur = pidx; continue; }
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
        // adjetivo invariable antepuesto ("la presente investigación"): se salta y se sigue buscando el artículo
        if (/(ente|ante|al|ar|ble|il|ior)$/.test(lw) && !STOP_SN.has(lw)) { cur = pidx; continue; }
        break;
      }
      let sx = sigContiguo(ti);
      for (let paso = 0; paso < 3 && sx != null; paso++) {
        const tk = toks[sx];
        if (tk.prot || !esAdjVariable(tk.out.toLowerCase())) break;
        tk.out = cambiarGeneroAdj(tk.out, gen);
        if (!tk.cls) tk.cls = 'concordancia';
        const conj = sigContiguo(sx);
        if (conj == null || !/^(y|e|o|u|pero|aunque)$/i.test(toks[conj].out)) break;
        sx = sigContiguo(conj);
      }
      // sujeto de una pasiva o atributo: "la limpieza del área fue realizada" -> "el aseo del área fue realizado"
      // (solo si el sustantivo es el núcleo, no un complemento como "de las herramientas")
      const p1 = prevContiguo(ti), p2 = p1 != null ? prevContiguo(p1) : null;
      const esComplemento = p2 != null && /^(de|del|en|con|a|al|por|para|sobre|entre)$/i.test(toks[p2].out);
      let k = esComplemento ? W.length : posEnW.get(ti);
      for (let paso = 0; paso < 10 && k < W.length - 1; paso++) {
        const entre = toks.slice(W[k] + 1, W[k + 1]).map((t) => t.t).join('');
        if (!/^\s+$/.test(entre)) break;
        k++;
        const w = toks[W[k]].out.toLowerCase();
        if (w === 'que' || w === 'y' || w === 'o') break;
        if (/^(fue|fueron|es|son|era|eran|será|serán|sido|está|están|estaba|estaban|estuvo|estuvieron|resulta|resultan|resultó|resultaron|encuentra|encuentran|encontraba|encontraban|queda|quedan|quedó|quedaron|permanece|permanecen|mantiene|mantienen)$/.test(w)) {
          const sigP = sigContiguo(W[k]);
          if (sigP != null) {
            const tp = toks[sigP];
            if (!tp.prot && (/(ad|id|ich|it|ert|uest|ech)[oa]s?$/.test(tp.out.toLowerCase()) || IX.ADJ_VAR.has(tp.out.toLowerCase()))) {
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

    const estructuras = rangos.map((r) => ({ sid: r.sid, regla: r.regla, tecnicas: r.tecnicas, original: r.original, activa: r.activa }));
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
    original = String(original).replace(/\r\n?/g, '\n');
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

  const api = { parafrasear, similitud, palabrasNorm, leerPersonales, DOMINIOS, FUENTES: D.FUENTES, TECNICAS: D.TECNICAS, _plural: plural, _conjugar: conjugar, _dividir: dividirOraciones };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parafraseador = api;
})(typeof self !== 'undefined' ? self : this);
