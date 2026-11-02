# Verificación

Fecha: 2026-11-02. Versión 0.4.0. Equipo local: Windows 11 x64, Ryzen 7 5700X, RTX 3060 de 12 GB, Node 24.22.1, Rust 1.99.1 y WebView2. Fuente: `E:\Cosas\kahoru.lol`.

## Núcleo e interfaz

- TypeScript: 198 pruebas de contratos, catálogo, páginas, compras, hovers, pool, hipótesis y continuidad. Incluyen regresión de Viego, Calzado Mágico, objetos incompatibles y contextos estratégicos para los cinco roles.
- Rust: 25 pruebas automáticas; cuatro integraciones optativas con cliente, descargas, proveedor o modelo. Parser del proveedor sin evaluación, validación de importación, resultados parciales, respaldo/restauración y selección de hechos.
- Formato, ESLint, tipos, Rustfmt y Clippy se ejecutan con las comprobaciones del repositorio. El CI anterior de `91318f9` falló por formato del script de recomendaciones; ese archivo se corrigió en esta entrega.
- Recorrido nativo offline: diez picks, runas e imágenes decodificadas, bans, cinco roles, swaps, fases, reconexión y preferencias. Usa IPC y WebView2 reales.
- `--provider`: consulta real de OP.GG para la composición de Viego, construye planes y conserva la elección manual al entrar en partida. Las consultas de Viego y Lee Sin también pasaron en el adaptador Rust.
- `--model`: generación nativa con Qwen3 4B instalado, tres fases formadas solo con hechos validados. Comprobado en depuración y distribución. Captura y texto en `test-results/strategy-model.*`, fuera de Git. No confundir selección de prioridades con demostración de calidad estratégica.

## Cliente y actualizaciones

Conexión real con TLS validado en una personalizada, cliente 16.21.8342754. Se detectaron fase, equipo y campeón. La importación autorizada reutilizó la página activa con respaldo: runas y spells leídos después de aplicar, Flash en su tecla, otra página preservada, restauración y reimportación correctas. No se inició una partida desde la app.

El paquete incluido se valida contra catálogo, recetas e imágenes. La integración de descarga completa de Data Dragon pasó en la etapa anterior. En 0.4 se prueba además la recuperación de metadatos inválidos y la coincidencia entre rol pedido y devuelto; no se afirma haber probado un parche futuro real.

Las integraciones optativas no corren por defecto en CI. El cliente real no se modifica automáticamente durante los tests. Las muestras estadísticas de fixtures son sintéticas, no datos redistribuidos del proveedor.

## Distribución y pendientes

El instalador NSIS se genera en `src-tauri/target/release/bundle/nsis/`. No incluye los pesos ni el runtime del modelo, que son opcionales y se preparan aparte con hashes fijados. No está firmado como editor.

Faltan instalación limpia, Windows 10, equipos modestos, una partida completa con medición de FPS/CPU/memoria, swaps entre diez jugadores, reinicios durante carga y evaluación estratégica de todos los campeones. No hay una comparación estadística independiente con iTero ni evidencia de mejora de win rate.

El workflow Windows comprueba formato, lint, pruebas, ejecutables de depuración/release, recorridos nativos offline e instalador. Su resultado debe consultarse por commit; las pruebas locales no sustituyen el CI.

## Comprobación de distribución

El recorrido `--release --provider --model --update --live` pasó con LoL en sala. La actualización recuperó 173 campeones y 825 páginas del cliente. El modelo preparó tres fases en 7.811 ms, incluida la primera verificación de archivos; se conservó el resultado al entrar en partida y no quedaron procesos del modelo al terminar. Es una muestra de este equipo, no una medición p95.

La ejecución [41429361411](https://github.com/frackk/kahoru.lol/actions/runs/41429361411) pasó para `f83e511`, con instalador y recorridos nativos de depuración y distribución. El refuerzo posterior del adaptador estadístico añade rechazo de estructuras malformadas en red/caché; tiene prueba propia y se contrasta con consultas reales.

En una muestra de reposo de 30,19 segundos, con ventana oculta y LoL en sala, la app y sus procesos WebView2 sumaron 188,72 MB de memoria privada y 387,72 MB de working set. La suma de working sets incluye páginas compartidas entre procesos y no equivale a memoria privada física exclusiva. No se detectó incremento de CPU con la precisión del contador usado. No es una prueba de FPS ni demuestra el presupuesto de memoria durante partida. Registro local: `test-results/idle-performance.json`.

El recorrido `--release --provider --roles-model --update --live` también pasó para top, jungle, mid, bot y support con el modelo real. La regresión cambia de campeón/rol y entra a partida sin volver a preparar IA: una estrategia de Bardo support no reaparece para Viego jungle. En ese caso se conserva el planteamiento por reglas del plan vigente. La generación válida para el mismo contexto continúa conservándose, como comprueba `--model`.

## Entrega 0.5.0

212 pruebas TypeScript y 26 Rust; cuatro integraciones Rust optativas siguen excluidas por defecto. Se añaden drafts contrastantes de Elise, efectos de hovers, Limpiar frente a control removible y supresión, botas por daño, secuencias legales de habilidades, falta de muestra, matchups confirmados y compra intermedia de Orbe del Olvido sin duplicación. La preferencia Flash D/F pasa por aplicación y lectura posterior en el adaptador simulado.

El recorrido nativo de distribución pasó con proveedor, modelo, actualización y cliente en sala. Comprueba 18 puntos de habilidad, tabla de niveles, preferencia de hechizos y conservación del orden en partida. No escribe páginas del usuario. El recorrido adicional comprueba el modelo en cinco roles y recopila cobertura de los campos publicados para Malphite top, Elise jungle, Ahri mid, Jinx bot y Leona support. Todos devolvieron secuencias de 15 niveles y seis filas de matchup; esto verifica el contrato, no la calidad de cada recomendación.

Comandos: `node scripts/test-native.mjs --release --provider --model --update --live` y `node scripts/test-native.mjs --release --provider --roles-model --sources --update --live`. Registros locales en test-results/source-coverage.json, strategy-*.txt y capturas. La primera generación de esta sesión tardó 44.522 ms mientras también compilaba Rust; no es un benchmark comparable ni una garantía de tiempo dentro del draft.

No se repitió la importación real ni se validó una partida competitiva completa en esta entrega. Siguen pendientes la segunda fuente estadística, las reglas especiales no cubiertas de habilidades y la revisión estratégica del catálogo completo. Los cambios no demuestran superioridad frente a otras aplicaciones.

Se actualizó la instalación existente a 0.5.0 en E:. El ejecutable instalado pasó el recorrido nativo con proveedor y cliente abierto. La comparación binaria coincide con el contenido de distribución, salvo los tres bytes de la marca de empaquetado NSIS. En una muestra de reposo de 30,13 s, con ventana oculta y LoL en sala, se midieron 195,69 MB privados y 384,00 MB de working set sumado en siete procesos; no se detectó incremento de CPU con la precisión del contador. No es una medición durante partida ni un presupuesto garantizado. Registro: test-results/idle-performance-0.5.json.

La revisión final descarta incompatibilidades antes de completar candidatos y continúa buscando hasta obtener tres rutas válidas. Una compra descartada no deja al primer plan válido sin marca de recomendado. Se añade regresión con Fauces de Malmortius frente a un núcleo con Arcoescudo.

## Entrega 0.6.0

388 pruebas TypeScript por defecto y seis casos optativos con caché real. La búsqueda se ejecuta con fixtures sintéticos para los 173 campeones, comprobando runas, objetos únicos, costes, referencias, tamaño de candidatos y contexto menor de 64 KB. Esto no comprueba que cada build tenga calidad estratégica. Se contrastan drafts del mismo campeón y se incluyen el caso anónimo aportado por el usuario, firmas obsoletas, selección manual y congelación de resultados.

28 pruebas Rust por defecto y cuatro integraciones optativas. El nuevo contrato rechaza planes ajenos, motivos de otra configuración y duplicados. Formato, ESLint, tipos y Clippy se ejecutan antes de la entrega.

Las seis evaluaciones optativas usan datos reales de OP.GG en caché para Malphite top, Elise jungle, Ahri mid, Jinx bot, Leona support y Viego jungle. Recorren dos composiciones contrastantes y el draft aportado para Viego. Registro: test-results/configuration-evaluation.json, sin dataset redistribuido. Para reproducir: definir KAHORU_STATISTICS_DIRECTORY con la carpeta de caché y ejecutar npm test -- src/engine/configurationEvaluation.test.ts.

La prueba nativa inicial de configuración con IA pasó sobre el draft aportado. Los flags --configuration-model, --configuration-auto, --roles-configuration-model y --past-draft amplían el recorrido de distribución. Las pruebas no escriben en el cliente real. La comparación con iTero se limita a reconocer una opción distinta; no se cuenta coincidencia de runas como un acierto.

La ampliación a cinco roles detectó una mezcla de motivos entre candidatos: Rust rechazó la respuesta y conservó el plan por reglas. El esquema se cambió a una unión de objetos cerrados que vincula cada planId con sus propios reasonIds, además de conservar la validación posterior. Se repite el recorrido nativo con esta restricción antes de actualizar la instalación.

La prueba sobre Vel’Koz support detectó que OP.GG normaliza el nombre devuelto como VELKOZ aunque acepta VEL_KOZ en la consulta. La identidad ahora se comprueba con data.summary.id y el ID del catálogo; se exige también al leer caché. El esquema de caché 3 invalida respuestas antiguas sin ese ID. La integración Rust pasó con Viego, Lee Sin y Vel’Koz, manteniendo el rechazo de IDs incorrectos.

Cierre de QA del código 468d5f4: pasó el recorrido completo --release --provider --past-draft --roles-configuration-model --configuration-auto --model --sources --update --live. La IA eligió configuraciones válidas en top, jungle, mid, bot y support del draft anónimo; después pasó el disparo automático, el planteamiento y la conservación al entrar a partida. El instalador 0.6.0 se aplicó a la instalación existente en E:, se comprobó su contenido frente al ejecutable de distribución y pasó además --provider --past-draft --configuration-auto --live desde la ruta instalada. No se escribieron páginas del cliente. Hashes y versiones: test-results/release-verification.json.
