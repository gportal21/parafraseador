// Genera tesauro-completo.js a partir de OpenThesaurus-es (LibreOffice, LGPL 2.1).
// Uso: node herramientas/generar_tesauro_completo.js ruta/a/th_es_v2.dat
// La página lo carga solo cuando el usuario pide sinónimos de una palabra.
const fs = require('fs');
const path = require('path');
const lines = new TextDecoder('latin1').decode(fs.readFileSync(process.argv[2])).split('\n');
const mapa = new Map();
for (let i = 1; i < lines.length; i++) {
  const [w, n] = lines[i].split('|');
  if (!w || isNaN(+n)) continue;
  const lema = w.trim();
  const sentidos = [];
  for (let k = 1; k <= +n; k++) {
    const syn = lines[i + k].split('|').slice(1)
      .map((x) => x.replace(/\s*\(.*?\)\s*/g, ' ').trim())
      .filter((x) => x && x.toLowerCase() !== lema.toLowerCase() && !/[|;\t\n,]/.test(x) && x === x.toLowerCase());
    if (syn.length) sentidos.push(Array.from(new Set(syn)).join(','));
  }
  i += +n;
  // se omiten nombres propios y entradas sin sinónimos útiles
  if (!sentidos.length || lema !== lema.toLowerCase()) continue;
  mapa.set(lema, (mapa.has(lema) ? mapa.get(lema) + ';' : '') + sentidos.join(';'));
}
const texto = [...mapa].map(([k, v]) => k + '\t' + v).join('\n');
const out = `/*
 * Tesauro completo para elegir sinónimos a mano.
 * Fuente: OpenThesaurus - Tesauro Español, versión para LibreOffice (Marcelo Garrone),
 *         https://github.com/LibreOffice/dictionaries/tree/master/es (th_es_v2.dat).
 * Licencia de estos datos: GNU LGPL 2.1 (ver LICENCIA-TESAURO.txt).
 * Formato: una entrada por línea, "lema<TAB>sentido1;sentido2", cada sentido con sinónimos separados por comas.
 * Archivo generado automáticamente con herramientas/generar_tesauro_completo.js. No editar a mano.
 */
self.PP_TESAURO_TEXTO = ${JSON.stringify(texto)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'tesauro-completo.js'), out);
console.log('entradas:', mapa.size, '· tamaño:', (Buffer.byteLength(out) / 1e6).toFixed(2), 'MB');
