# Parafraseador por reglas

Página web que parafrasea textos en español aplicando reglas lingüísticas fijas, sin inteligencia artificial ni modelos de lenguaje. Todo se ejecuta en el navegador: el texto no se envía a ningún servidor.

## Qué hace (versión 1)

- **Conectores**: sustituye conectores por equivalentes ("sin embargo" → "no obstante").
- **Sinónimos**: sustantivos, adjetivos y verbos regulares, conservando número, tiempo verbal y mayúsculas.
- **Concordancia de género**: si el sinónimo cambia de género, ajusta artículos, determinantes y adjetivos ("el problema planteado" → "la dificultad planteada").
- **Protección automática**: no modifica citas entre comillas, referencias con año, siglas, nombres propios ni los términos que agregues a la lista.
- **Indicador de similitud**: compara trigramas de palabras con el original y resalta los fragmentos que siguen iguales.
- **Cita APA 7**: genera la cita parentética y la narrativa de la fuente.

## Archivos

- `index.html`: interfaz.
- `engine.js`: motor de parafraseo (conectores, diccionario, conjugación y concordancia). Para ampliar el vocabulario, edita las listas `CONECTORES`, `SUSTANTIVOS`, `ADJETIVOS` y `VERBOS`.

## Próximas versiones

- v2: reglas de estructura (orden de cláusulas, voz activa/pasiva).
- v3: diccionario ampliado por área temática.

Parafrasear no reemplaza la cita: el contenido sigue perteneciendo a su autor.
