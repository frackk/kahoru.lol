# Continuidad del desarrollo

Punto de trabajo: 2 de noviembre de 2026, entrega 0.5.0.

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
