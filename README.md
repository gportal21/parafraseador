# Parafraseador por reglas

Página web que parafrasea textos en español aplicando reglas lingüísticas fijas, sin inteligencia artificial ni modelos de lenguaje. Todo se ejecuta en el navegador: el texto no se envía a ningún servidor.

Página publicada: https://gportal21.github.io/parafraseador/

## Qué hace

**Estructura de las oraciones**
- Mueve la causa al inicio o al final ("X porque Y" → "Dado que Y, x").
- Mueve la finalidad ("Para mejorar el control, la empresa…" → "La empresa… para mejorar el control").
- Mueve la concesión y la condición ("Aunque…", "Si…").
- Alterna la voz pasiva: "Se analizaron los datos" ↔ "Los datos fueron analizados".
- Divide oraciones largas en ", lo que…" → ". Esto…".
- Cada oración reordenada se marca con un círculo morado y se puede deshacer una por una.

**Vocabulario**
- Conectores y expresiones ("sin embargo" → "no obstante").
- Sinónimos de sustantivos, adjetivos y verbos, conservando número, tiempo verbal y mayúsculas.
- Concordancia de género: artículos, determinantes, adjetivos y participios ("la limpieza del área fue realizada" → "el aseo del área fue realizado").
- Áreas: General, Ingeniería y procesos, Sistemas y datos, Gestión y administración. Cada área agrega sinónimos propios y protege sus términos técnicos (5S, kaizen, data drift, kardex…).
- Diccionario personal: líneas `término = opción1, opción2`.

**Protección automática**: citas entre comillas, referencias con año, siglas, nombres propios y la lista de términos del usuario.

**Indicador de similitud**: compara trigramas de palabras con el original y resalta los fragmentos que siguen iguales.

**Referencias APA 7**: cita parentética, cita narrativa y referencia para libro, artículo, tesis o página web. Al copiar la referencia se conservan las cursivas.

## Archivos

- `index.html`: interfaz.
- `engine.js`: motor (reglas de estructura, expresiones, sinónimos, conjugación y concordancia).
- `diccionario.js`: vocabulario general y por área. Para ampliarlo, agrega grupos a `frases`, `sust`, `adj` o `verb`.

## Límites

Las reglas no entienden el contexto como una persona: un sinónimo puede no encajar en todos los casos. Revisa siempre el resultado. Parafrasear no reemplaza la cita: el contenido sigue perteneciendo a su autor.
