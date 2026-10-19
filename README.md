# Parafraseador por reglas

Página web que parafrasea textos en español aplicando reglas lingüísticas fijas, sin inteligencia artificial ni modelos de lenguaje. Todo se ejecuta en el navegador: el texto no se envía a ningún servidor.

Página publicada: https://gportal21.github.io/parafraseador/

## Qué hace

**Estructura de las oraciones**
- Voz activa ↔ pasiva: "La empresa aplicó la metodología" → "La metodología fue aplicada por la empresa", y al revés.
- Pasiva refleja ↔ pasiva con «ser»: "Se analizaron los datos" ↔ "Los datos fueron analizados".
- Complementos de tiempo, lugar o fuente al inicio o al final ("… desde el año 2022" → "Desde el año 2022, …"; "Según X, …" → "…, según X").
- Causa, finalidad, concesión, condición y subordinadas con «cuando» al inicio o al final.
- Verbo de reporte: "Los resultados demuestran que X" → "Según los resultados, X".
- Incisos ("Autor (año), en \"Título\", …"), participios iniciales, consecuencias («…, así que…»), «sin + infinitivo» y atributos.
- División de oraciones largas en ", lo que", ", que", ", y", aposiciones y relativos sin coma.
- Las oraciones con dos puntos o punto y coma se reestructuran tramo por tramo.
- Si la oración empieza con un conector ("Por ello, …"), las reglas se aplican al resto.
- En intensidad fuerte se combinan hasta dos reglas por oración.
- Cada oración reordenada se marca con un círculo morado: se puede deshacer una por una o forzar las que quedaron sin cambio.

**Vocabulario**
- Conectores y expresiones ("sin embargo" → "no obstante").
- Sinónimos de sustantivos, adjetivos y verbos, conservando número, tiempo verbal y mayúsculas.
- Concordancia de género: artículos, determinantes, adjetivos y participios ("la limpieza del área fue realizada" → "el aseo del área fue realizado").
- Áreas: General, Ingeniería y procesos, Sistemas y datos, Gestión y administración. Cada área agrega sinónimos propios y protege sus términos técnicos (5S, kaizen, data drift, kardex…).
- Diccionario personal: líneas `término = opción1, opción2`.

**Textos largos**
- Se procesan párrafo por párrafo, con progreso y sin congelar la página (probado con más de 70 000 palabras).
- Al elegir un sinónimo o deshacer una oración solo se vuelve a procesar ese párrafo.
- Se conservan los párrafos y saltos de línea del original.
- Se pueden abrir archivos .txt y .docx (el .docx se lee en el navegador con JSZip).

**Protección automática**: citas entre comillas, referencias con año, enlaces de Zotero/URL, siglas, nombres propios, términos técnicos en inglés y la lista de términos del usuario.

**Indicador de similitud**: compara trigramas de palabras con el original y resalta los fragmentos que siguen iguales.

**Referencias APA 7**: cita parentética, cita narrativa y referencia para libro, artículo, tesis o página web. Al copiar la referencia se conservan las cursivas.

## Archivos

- `index.html`: interfaz.
- `engine.js`: motor (reglas de estructura, expresiones, sinónimos, conjugación y concordancia).
- `diccionario.js`: vocabulario general y por área. Para ampliarlo, agrega grupos a `frases`, `sust`, `adj` o `verb`.

## Límites

Las reglas no entienden el contexto como una persona: un sinónimo puede no encajar en todos los casos. Revisa siempre el resultado. Parafrasear no reemplaza la cita: el contenido sigue perteneciendo a su autor.
