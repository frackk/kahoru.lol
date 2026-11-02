# Arquitectura

La primera entrega usa Tauri 2, Rust, React y TypeScript. Es una aplicación de una sola ventana. No ejecuta servicios auxiliares ni consultas periódicas.

## Responsabilidades

- `src-tauri/src/session.rs`: sesión, validaciones y transiciones del simulador.
- `src-tauri/src/catalog.rs`: lectura y validación del catálogo incluido.
- `src-tauri/src/lib.rs`: cuatro comandos IPC y estado compartido.
- `src/contracts.ts`: contrato de presentación y filtro de campeones disponibles.
- `src/App.tsx`: navegación y coordinación de comandos.
- `src/features/draft/Draft.tsx`: edición de draft y controles de simulación.
- `src/preferences.ts`: recuperación de preferencias locales.

Rust es la autoridad de la sesión. La interfaz solicita una acción con la revisión que conoce; el núcleo rechaza revisiones antiguas. Cada modificación se aplica sobre una copia y solo se publica cuando termina sin errores. Las acciones de la interfaz se serializan.

## Contratos

`DraftSnapshot` conserva los campos previstos en PRODUCT_SPEC. En esta entrega `DraftSlot` contiene `championId`, `locked` y `role`. Las posiciones aliadas son posiciones manuales del simulador; las rivales permanecen desconocidas. No hay inferencia automática.

El contenedor `Session` añade `source`, `phase` y `connection`. La conexión es independiente de la fase: una interrupción conserva los picks incluso durante `IN_GAME`. `source` siempre vale `simulator`; no se presenta como una conexión LCU.

`updatedAt` contiene milisegundos Unix como texto; `revision` determina el orden local. `sessionId` identifica sesiones dentro de la ejecución actual, no es un identificador global ni se persiste. Un draft nuevo limpia picks y bans. Las preferencias no contienen información del draft.

Los diez picks confirmados producen `DRAFT_FINALIZING`. Desconfirmar o cambiar un pick vuelve a `CHAMP_SELECT`. Los intercambios mueven campeones y confirmaciones, conservando las posiciones. Las fases posteriores son recorridos de prueba y no generan recomendaciones.

## Persistencia y dependencias

Solo se guarda la preferencia de espaciado en almacenamiento local de WebView2. SQLite se incorpora cuando exista una necesidad de consultas o migraciones; no hace falta para un booleano. Catálogo y recursos se incluyen en el ejecutable. No se descargan fuentes tipográficas ni imágenes en ejecución.

Los motores de ranking, inferencia, runas y estrategia se incorporarán por etapas. El adaptador LCU producirá contratos de dominio y no expondrá credenciales al frontend.

Las dependencias quedan fijadas en `package-lock.json` y `Cargo.lock`. Se fuerza `minimatch` 11 por correcciones de seguridad en las dependencias de lint; cualquier cambio del override requiere repetir lint y pruebas. Playwright Core solo interviene en pruebas y usa WebView2 instalado, sin descargar navegadores.

## Integración local, 0.2.0

`client.rs` mantiene una instantánea independiente del simulador. La pantalla Inicio consulta `get_live_session`; `DraftSlot` se comparte con el contrato existente. Los comandos de simulación solo modifican su sesión manual y nunca escriben en LoL. No hay identidades de jugadores en el contrato de lectura. El estado de conexión se actualiza desde un único lector nativo. Los detalles y límites están en `CLIENT_INTEGRATION.md`.
