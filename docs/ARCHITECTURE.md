# Arquitectura

Versión 0.6.0. Tauri 2, Rust y WebView2 alojan React/TypeScript. No hay backend remoto propio ni claves de Riot empaquetadas.

| Módulo                                 | Responsabilidad                                                           |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `client.rs`                            | Descubrimiento de LCU, TLS y snapshots públicos sin identidades.          |
| `session.rs`                           | Simulador, revisiones y transiciones.                                     |
| `game_data.rs`                         | Paquete oficial, imágenes y activación con recuperación.                  |
| `knowledge.rs`                         | Kits, posiciones y páginas recomendadas; validación de caché.             |
| `statistics.rs` / `provider_format.rs` | OP.GG, caché y decodificación sin ejecutar texto del proveedor.           |
| `loadout.rs`                           | Importación explícita, respaldo, lectura posterior y restauración.        |
| `local_model.rs`                       | Modelo separado, prioridades y elección de configuración con cancelación. |
| `src/engine/`                          | Ranking, hipótesis de roles, candidatos, compras y estrategia.            |
| `src/liveSession.ts`                   | Continuidad del cliente y preparación independiente de la pestaña.        |

El cálculo puro recibe datos tipados. Los efectos de red, disco y escritura al cliente pertenecen a adaptadores nativos. React presenta resultados y solicita acciones; no tiene acceso general a archivos, shell ni credenciales.

## Estado y persistencia

El simulador nunca escribe en LoL. La importación exige una selección real vigente de la Grieta y verifica sesión, campeón, página y fase antes de escribir. La lectura posterior confirma lo aplicado y devuelve resultados parciales cuando corresponde.

Se conservan como máximo ocho preparaciones y estrategias en memoria. El plan elegido y la corrección manual pertenecen a la sesión. Durante partida no se vuelve a pedir análisis ni se ejecuta el modelo; se consulta el resultado previo. Un ID de partida diferente invalida la continuidad.

La caché de Tauri contiene `game/`, `knowledge.json`, `statistics/`, `imports/` y la configuración del modelo. WebView2 guarda espaciado y champion pool. Los respaldos de runas se separan por un hash local de la cuenta; no se publica el identificador usado para obtenerlo.

Data Dragon se descarga por HTTPS a staging, se valida y se activa mediante índice atómico. Los metadatos LCU se aceptan solo si cubren el catálogo y coinciden con el parche. La caché inválida recupera el paquete incluido. La actualización se bloquea durante draft y partida. Los recursos de spells y fragmentos incluidos tienen revisión independiente; un cambio de sus reglas exige revisión antes de distribuir otro parche.

## Dependencias

`sha2` verifica integridad, `tempfile` prepara escrituras y `time` registra fechas. `windows-sys` se usa para el Job Object que evita dejar el modelo ejecutándose tras cerrar la app. No se agrega un servicio persistente para IA.

Los pesos y el runtime se descargan aparte, con revisión y hashes fijados. Playwright Core solo se usa en pruebas nativas; el puerto de depuración se habilita únicamente en ese proceso temporal. SQLite sigue sin incorporarse: las cachés actuales no requieren consultas relacionales.

## Configuración conjunta

configurationSearch genera y puntúa pares de página y ruta. configurationContext construye un paquete acotado de evidencia para el modelo. configuration_model.rs valida el contrato de elección; local_model.rs conserva el proceso y la cancelación compartidos. SessionPlans acepta el resultado solo si coinciden firma, elección previa y sesión editable. La comprobación de firma antes de recalcular evita repetir la búsqueda en cada snapshot idéntico del cliente.

buildSearch mantiene un haz acotado por objetivo sobre compras y orden; evalúa atributos oficiales, respuestas al draft y pérdidas respecto de una referencia común. configurationSearch lo cruza con páginas completas y valida las rutas de compra antes de exponerlas. Una elección manual se reconstruye y reevalúa con los datos nuevos; no se conserva una evaluación anterior si cambió el draft. Cambiar de campeón o rol libera esa preferencia.
