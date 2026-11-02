# Continuidad del desarrollo

Punto de trabajo: 2 de noviembre de 2026, entrega 0.6.0.

## Repositorio y decisiones

- Fuente activa: `E:\Cosas\kahoru.lol`. Trabajar en `main`, como pidió el usuario.
- El PR #2 se integró en main mediante `e191579`; el núcleo de importación y proveedor se publicó en `91318f9`. La entrega siguiente reúne la interfaz y las comprobaciones descritas aquí.
- Producto: preparación real de draft, runas, spells, builds y estrategia. Nada de memoria, inyección, automatización de gameplay o indicaciones adaptadas durante partida.
- Firma `made by frack.one`. Textos concisos, sin referencias a asistentes en nombres de ramas o archivos propios.
- No hay Developer Portal configurado. El usuario pidió continuar con importación experimental para uso personal. Mantener documentado que el registro está pendiente; no afirmar aprobación particular de Riot.

## Implementado

- Lectura del cliente y continuidad entre selección/carga/partida; simulador separado.
- 173 campeones y 825 páginas oficiales por posición. Se corrigió el uso de posiciones en mayúsculas y se verifica el campo devuelto: minúsculas podían devolver mid para otro rol.
- OP.GG MCP público: compras, runas, fragmentos y spells por campeón/rol. Caché 12 h; actualización explícita con mínimo de 60 s. Sin identidades ni datasets del proveedor en Git.
- Sin builds genéricas de relleno. Candidatos con parche/muestra, rutas construibles, incompatibilidades, misión de support y Calzado Mágico.
- Hovers aliados provisionales, pool, hipótesis conjuntas de rol y plan elegido estable. Ranking cualitativo; todavía sin matchups estadísticos.
- Importación real comprobada de Viego: runas, spells, tecla de Flash, otra página del usuario, respaldo, restauración y reimportación. Quedó activa la página de kahoru.lol. No repetir escrituras como prueba automática.
- Actualización oficial con comprobación de metadatos del cliente; no activar durante draft o partida.
- Modelo local opcional Qwen3 4B con runtime llama.cpp. Pesos/runtime fuera de Git e instalador, en `.local/ai`; configuración privada del equipo. Redacción libre descartada por errores de mecánicas: el modelo solo elige hechos del motor y Rust valida sus IDs/fases.

## Validación y trabajo siguiente

Consultar `VALIDATION.md` para resultados concretos y límites. Los tests sintéticos no demuestran calidad competitiva. Pendientes de producto: evaluación estratégica de todo el catálogo, matchups, otra fuente estadística independiente, sesgos de población, medición de consumo/FPS, instalación limpia, registro de Riot y actualización segura del ejecutable.

El modelo se prepara con `npm run model:prepare -- --activate`; no subir pesos o credenciales. El instalador se genera con `npm run tauri -- build`. `--provider` y `--model` son recorridos nativos optativos; CI debe funcionar sin LoL, OP.GG ni modelo instalado.

Leer `AGENTS.md` y `PRODUCT_SPEC.md` antes de modificar código. No confundir las funciones implementadas con el roadmap completo.

## Última entrega verificada

`f83e511` pasó GitHub Actions completo. El ejecutable 0.4.0 pasó proveedor real, modelo y actualización oficial desde sala; metadatos comprobados: 173 campeones y 825 páginas. Se preparó y activó el modelo opcional en este equipo. El instalador queda en `src-tauri/target/release/bundle/nsis/kahoru.lol_0.4.0_x64-setup.exe`.

La revisión final refuerza la validación de estructuras del proveedor y la caché para rechazar datos incompatibles sin romper la interfaz. Los registros de rendimiento, capturas y pruebas locales quedan en `test-results/`, excluidos de Git. Los resultados y sus condiciones están en `VALIDATION.md`.

Se comprobó además el modelo real en los cinco roles y se corrigió la reaparición de estrategias obsoletas al salir del draft. La vigencia exige que coincidan draft y plan; si cambiaron, se consulta la estrategia por reglas conservada. Recorrido reproducible: `npm run test:native -- --release --provider --roles-model --update --live`.

## Entrega 0.5.0: preparación contextual

- Requisitos confirmados: todo el razonamiento es previo. Consulta fija en partida. Configuración conjunta según ambos equipos, estrategia corta y habilidades 1–18. El usuario espera a futuro un agente con conocimiento de juego, no un generador de texto genérico.
- Nuevos módulos: draftSignals, loadoutContext, skillOrder y matchups. Reglas acotadas comparan páginas con la misma clave, ajustan una runa defensiva cuando hay evidencia de poke, proponen Limpiar en bot y botas ante daño concentrado. El núcleo de objetos sigue siendo el agregado observado. No presentar esto como optimización completa.
- Compra intermedia de heridas graves solo si la ruta ya tiene un objeto que la consume y hay varias fuentes de curación. Corrección de recetas: reutilizar componentes comprados y descontarlos al completar, respetando ranuras.
- Orden de habilidades desde la fuente y alternativas observadas; validación de rangos y distinción del tramo completado por reglas. Aphelios pendiente por mejoras de atributos; las secuencias que no pueden completarse sin ambigüedad no se ofrecen.
- Preferencia persistente: conservar teclas, Flash D/F o disposición exacta. Verificación con cliente simulado; las pruebas de esta entrega no escriben en LoL. La importación real de 0.4 sigue siendo la referencia manual.
- OP.GG: esquema de caché 2, habilidades y matchups añadidos a campos comprobados de tools/list. Consultas reales para Malphite top, Elise jungle, Ahri mid, Jinx bot y Leona support. No se incluye el dataset del proveedor en Git.
- Matchups visibles solo para un rival de la misma posición confirmada y muestra de 300. No aplicados al ranking ni a posiciones inciertas.
- Resumen de apertura, recursos y peleas, colocado antes de las alternativas. El selector local elige un hecho para las dos primeras fases y hasta dos para peleas. No es un modelo experto en configuraciones.
- Comprobar datos revisa también hasta cinco análisis de la sesión. La memoria de la interfaz respeta las 12 horas de caché. No incorpora consejos de búsquedas de Google automáticamente.
- Validación: 212 pruebas TypeScript y 26 Rust, formato/lint/tipos/Clippy; recorridos nativos con proveedor, modelo, actualización y cliente abierto. Fuente y modelo comprobados en cinco roles. Ver VALIDATION.md para alcance y registros locales.

## Próxima etapa concreta

Ampliar candidatos e interacciones de campeón/runas/objetos con evidencia revisada. Evaluar pares de drafts del mismo campeón en los cinco roles y revisar los resultados estratégicos, además de invariantes. Integrar otra fuente estadística solo con acceso y contrato comprobados. Agregar conocimiento de aperturas y lado del mapa antes de fijar buff inicial. Ampliar validación de campeones con reglas especiales de habilidades. Todavía faltan la optimización conjunta profunda, el meta de varios proveedores, un agente experto y la evaluación competitiva de todo el catálogo.

La instalación existente en E: se actualizó a 0.5.0 y pasó el recorrido nativo con proveedor y detección real. Los hashes y condiciones quedan en test-results/release-verification.json. La última revisión corrige candidatos incompatibles que desplazaban rutas válidas o dejaban al primer plan sin marca de recomendado.

## Entrega 0.6.0: elección conjunta

El usuario aclaró que quiere el mismo proceso para cualquier campeón y rol: usar fuentes como evidencia y analizar la configuración, sin copiar una página ni reproducir iTero como respuesta esperada. El draft aportado quedó anónimo en tests/fixtures/contrasting-drafts.ts; no se usan resultado, oro, compras finales ni identidades como entradas.

- configurationSearch cruza páginas completas, claves alternativas y ajustes de filas con compras contextualizadas. Se reserva una referencia observada y hasta doce candidatos con motivos y referencias. Identidad de compra inferida de los objetos del campeón/rol; no hay reglas exclusivas para Viego o Elise.
- Las variantes mantienen las dos primeras compras y sustituyen un objeto posterior. Los efectos se comprueban contra descripciones del paquete. El espacio sigue acotado; esto no equivale a optimizar todos los objetos posibles ni a criterio profesional validado.
- configurationContext incluye kits conocidos, runas, objetos, spells, muestras y candidatos. La IA local ahora puede elegir una configuración completa mediante analyze_configuration, además de seleccionar frases del planteamiento.
- configuration_model.rs valida plan y motivos; SessionPlans rechaza firmas obsoletas, elecciones manuales cambiadas o sesiones congeladas. Los candidatos elegidos explícitamente conservan lugar en el conjunto cuando siguen siendo válidos.
- Preferencia de IA automática al completar el draft: activa por defecto si el modelo está configurado; puede desactivarse. Espera 1,5 s de estabilidad y cancela al cambiar contexto. Sin modelo o ante error quedan las propuestas por reglas. La importación sigue requiriendo clic.
- 388 pruebas TypeScript por defecto; seis evaluaciones optativas con caché real y 28 pruebas Rust. La cobertura sintética de los 173 campeones comprueba estructura, no calidad competitiva.
- La primera comprobación nativa con el draft aportado pasó: doce candidatos, elección con IA, motivos validados, fases y continuidad. Quedaron Conquistador y defensa mágica como alternativa seleccionada; Lluvia de Espadas también estaba disponible. No se toma esa elección como prueba de superioridad frente a iTero.

Los siguientes criterios de calidad son ampliar candidatos coherentes de primera compra, modelar interacciones y revisar decisiones con pares de drafts, no solo sumar frases o reglas aisladas. Fuente estadística adicional, evaluación experta y modelos de matchup siguen pendientes. El usuario dejó la PC y pidió continuar sin esperar preguntas; registrar las dudas para la próxima sesión.

La QA de cinco roles encontró dos problemas y añadió regresiones: motivos cruzados entre alternativas y normalización de Vel’Koz por OP.GG. La salida del modelo usa una unión cerrada por candidato; la identidad estadística se valida por data.summary.id con caché esquema 3. Los tests Rust actuales son 28 más cuatro integraciones optativas. La consulta real de Viego, Lee Sin y Vel’Koz pasó. Repetir roles de configuración y automático después de compilar estos cambios antes de instalar.

## Cierre verificado de 0.6.0

Código: 468d5f4, publicado en main. Instalación existente de E: actualizada a 0.6.0. Pasaron las configuraciones con IA en las cinco posiciones del draft aportado, automático, planteamiento, actualización y consulta del cliente; también pasó el análisis automático desde el ejecutable instalado. No quedan pruebas de esta entrega pendientes ni procesos de inferencia abiertos. Registros y hashes en test-results/release-verification.json; manifiestos y cachés personales siguen fuera de Git.

Pendientes de producto, no de empaquetado: ampliar compras iniciales y combinaciones de objetos, revisar calidad estratégica con evidencia por matchup, ampliar capacidades y aperturas, datos de varios proveedores compatibles, ranking estadístico y evaluación de reglas especiales de habilidades. La IA automática vive en la vista de preparación; la preparación por reglas sí se conserva en segundo plano al cambiar pestaña. Se necesita revisar esa experiencia antes de prometer IA independiente de la vista.

El usuario dejó la PC y pidió continuar sin preguntas. Para la próxima revisión: definir población estadística y conjunto de evaluación, revisar alternativas de la misma partida sin tomar coincidencia con iTero como verdad, y resolver acceso a otra fuente. No iniciar scraping de fuentes privadas ni presentar un selector acotado como un experto validado en todos los enfrentamientos.
