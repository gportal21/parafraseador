// Genera tesauro.js: pares de sinónimos del diccionario que figuran en OpenThesaurus-es.
// Uso: node herramientas/generar_tesauro.js ruta/a/th_es_v2.dat
//   (th_es_v2.dat se descarga de https://github.com/LibreOffice/dictionaries/tree/master/es)
const fs = require('fs');
delete require.cache[require.resolve(require('path').join(__dirname, '..', 'diccionario.js'))];
const D = require(require('path').join(__dirname, '..', 'diccionario.js'));
const lines = new TextDecoder('latin1').decode(fs.readFileSync(process.argv[2])).split('\n');
const TH = new Map();
for (let i = 1; i < lines.length; i++) {
  const [w, n] = lines[i].split('|');
  if (!w || isNaN(+n)) continue;
  const set = TH.get(w.toLowerCase()) || new Set();
  for (let k = 1; k <= +n; k++) lines[i + k].split('|').slice(1).forEach((x) => set.add(x.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim()));
  TH.set(w.toLowerCase(), set);
  i += +n;
}
const ok = (a, b) => (TH.get(a) && TH.get(a).has(b)) || (TH.get(b) && TH.get(b).has(a));
const pares = new Set();
const grupos = [];
[D.GENERAL, ...Object.values(D.DOMINIOS)].forEach((d) => {
  d.sust.forEach((x) => grupos.push(x.g.map((y) => y[0])));
  d.adj.forEach((x) => grupos.push(x));
  d.verb.forEach((x) => grupos.push(x));
  d.frases.forEach((x) => grupos.push(x.map((y) => y.replace(/^>/, ''))));
});
grupos.forEach((g) => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (ok(g[i], g[j])) pares.add([g[i], g[j]].sort().join('|')); });
const lista = [...pares].sort();
const out = `/*
 * Pares de sinónimos respaldados por OpenThesaurus-es.
 * Fuente: OpenThesaurus - Tesauro Español, versión para LibreOffice (Marcelo Garrone),
 *         https://github.com/LibreOffice/dictionaries/tree/master/es (archivo th_es_v2.dat).
 * Licencia de estos datos: GNU LGPL 2.1 (ver LICENCIA-TESAURO.txt).
 * Archivo generado automáticamente: solo contiene los pares del diccionario del parafraseador
 * que también figuran como sinónimos en el tesauro. No editar a mano.
 */
(function (root) {
  'use strict';
  const PARES = ${JSON.stringify(lista)};
  const api = { PARES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PP_TESAURO = api;
})(typeof self !== 'undefined' ? self : this);
`;
fs.writeFileSync(require('path').join(__dirname, '..', 'tesauro.js'), out);
console.log('pares respaldados:', lista.length, '· ejemplo:', lista.slice(0, 8).join(', '));
