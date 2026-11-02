# Arquitectura

Versión 0.3.0. Tauri 2 aloja una ventana React/TypeScript sobre WebView2. Rust controla la conexión local, las descargas y los archivos. No hay servicios auxiliares ni backend remoto propio.

## Componentes

| Ubicación                    | Responsabilidad                                                               |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `src-tauri/src/client.rs`    | Descubrir LCU, validar TLS y publicar snapshots sin identidades.              |
| `src-tauri/src/session.rs`   | Sesión manual, revisiones, validaciones y transiciones.                       |
| `src-tauri/src/game_data.rs` | Paquete oficial, actualización, imágenes y recuperación de caché.             |
| `src-tauri/src/lib.rs`       | Estado compartido y siete comandos IPC.                                       |
| `src/liveSession.ts`         | Consultar snapshots y preparar planes con independencia de la vista activa.   |
| `src/engine/`                | Ranking, hipótesis de roles, runas, rutas de compra y conservación de planes. |
| `src/gameData.tsx`           | Contrato del paquete y acceso acotado a imágenes.                             |
| `src/features/`              | Cliente, simulador, preparación y biblioteca.                                 |
| `data/knowledge/`            | Perfiles estratégicos y fragmentos con revisión propia.                       |

El motor TypeScript es puro y no depende de React, red o disco. Recibe datos tipados y devuelve resultados explicados. La decisión está en [0002](decisions/0002-data-and-rules.md); Rust continúa siendo la autoridad de las operaciones nativas.

## Sesiones

El simulador y el lector real están separados. Una acción manual requiere la revisión actual y se aplica sobre una copia antes de publicarse. Nunca escribe en LoL.

El lector nativo produce una instantánea con fase, versión, mapa, picks, bans, posición y campeón propios. Las intenciones y posiciones rivales se descartan. El identificador interno de partida permite conservar el draft durante carga y reconexión; una partida distinta invalida esa continuidad. Los endpoints y tiempos de sondeo están en [CLIENT_INTEGRATION.md](CLIENT_INTEGRATION.md).

La preparación se actualiza durante selección, incluso fuera de Inicio. La corrección manual de rol y el plan elegido pertenecen a la sesión. Se conservan como máximo ocho preparaciones en memoria. Durante partida se consulta lo ya calculado; no se genera un plan nuevo para una partida cuyo draft no se observó.

## Datos y persistencia

El ejecutable incluye el paquete y sus imágenes. El botón de actualización descarga una versión compatible con el parche del cliente a la caché de Tauri, dentro de `game/`. Verifica estructura, recursos PNG y hashes antes de cambiar atómicamente `active.json`. No activa datos durante un draft o una partida. Si la caché está incompleta o corrupta, el arranque recupera el paquete incluido.

El frontend solo accede a imágenes del paquete incluido o de `$APPCACHE/game/**` mediante el protocolo de assets. No recibe acceso general al sistema de archivos, shell o red. Las descargas oficiales se hacen en Rust con HTTPS y sin redirecciones.

WebView2 guarda espaciado y champion pool en almacenamiento local. No se persisten drafts, identidades, historial ni credenciales. SQLite no aporta valor a estos datos y sigue sin incorporarse.

## Herramientas

`package-lock.json` y `Cargo.lock` fijan las dependencias. SHA-256 comprueba integridad local; `tempfile` evita activar descargas incompletas; `time` registra fechas de procedencia. Playwright Core se usa únicamente en pruebas y controla WebView2 instalado. El puerto de depuración se habilita solo en el proceso temporal de prueba.
