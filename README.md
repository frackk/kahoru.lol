# kahoru.lol

Aplicación de escritorio para preparar partidas de League of Legends. **made by [frack.one](https://frack.one)**.

Carpeta de trabajo en este equipo: `E:\Cosas\kahoru.lol`.

## Código fuente

| Carpeta          | Contenido                                                          |
| ---------------- | ------------------------------------------------------------------ |
| `src/`           | Interfaz React, motor de recomendaciones y contratos TypeScript.   |
| `src-tauri/src/` | Sesión, validaciones y comandos nativos en Rust.                   |
| `scripts/`       | Preparación del paquete oficial y prueba de la aplicación Windows. |
| `data/`          | Campeones, objetos, runas y reglas estratégicas versionadas.       |
| `public/`        | Imágenes oficiales incluidas para uso sin conexión.                |
| `docs/`          | Especificación, arquitectura y resultados de pruebas.              |

`AGENTS.md` contiene las pautas de desarrollo del repositorio. No se incluye en la aplicación.

## Estado

La versión 0.5.0 lee el cliente local, detecta fases y completa picks, hovers aliados y bans. Incluye imágenes de campeones, runas, fragmentos, objetos y spells. El ranking por composición y el champion pool siguen disponibles.

Los 173 campeones tienen metadatos del kit y páginas recomendadas por Riot. Las builds usan análisis de OP.GG por campeón y posición, con parche y muestras; si faltan datos compatibles no se inventa una ruta. Se comparan hasta tres variantes construibles. El ranking todavía usa reglas cualitativas, con cobertura desigual de rasgos y sin matchups empíricos; no predice victoria. El simulador se identifica como entrada manual.

La importación experimental aplica runas y spells mediante una acción explícita, permite conservar las teclas del cliente o elegir Flash en D/F, y permite reutilizar una página elegida con respaldo y restauración. El orden de habilidades muestra niveles 1–18 cuando hay una secuencia verificable. Los ajustes de runas, spells y botas explican el motivo y distinguen reglas de muestras estadísticas. La estrategia previa usa reglas y, opcionalmente, un modelo local para elegir prioridades entre hechos del motor. Durante partida se conserva lo preparado, sin adaptación en vivo ni automatización de gameplay. El registro del producto ante Riot sigue pendiente; no se afirma aprobación particular.

## Actualización de datos

En **Datos del juego → Comprobar datos**, la aplicación consulta Data Dragon y descarga otra revisión del parche del cliente si está disponible. Valida el paquete antes de activarlo y conserva los datos anteriores ante fallos. No cambia datos durante selección o partida.

El paquete incluido funciona sin conexión. Con LoL abierto, el botón comprueba también kits, posiciones y páginas del cliente. OP.GG se consulta por campeón y rol, con caché de doce horas y botón de actualización propio. Las reglas de fragmentos y spells requieren revisión al cambiar. Las actualizaciones del ejecutable siguen siendo mediante instalador.

## Ejecutar desde el código

Requisitos: Windows 10/11 x64, Node.js 24 o posterior, Rust (versión fijada en `rust-toolchain.toml`), Visual Studio Build Tools con C++/Windows SDK y WebView2. Visual Studio Code es opcional y no reemplaza las herramientas de compilación.

```powershell
npm ci
npm run tauri -- dev
```

`npm run dev` sirve la interfaz para desarrollo web; las operaciones de sesión requieren el proceso nativo. El navegador muestra esta limitación y no sustituye el núcleo por datos simulados adicionales.

## Compilar

```powershell
npm run tauri -- build
```

El ejecutable queda en `src-tauri/target/release/kahoru-lol.exe` y el instalador en `src-tauri/target/release/bundle/nsis/`. El instalador inicial no lleva firma de editor. La instalación de WebView2 puede requerir conexión si el equipo no lo tiene.

## Verificar

```powershell
npm run format:check
npm run lint
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --debug --no-bundle
npm run test:native
```

La prueba nativa abre una ventana temporal, selecciona diez campeones, comprueba planes, imágenes, transiciones, desconexión y preferencias. `npm run test:native -- --update` también consulta el manifiesto real de Riot; `--release` prueba el ejecutable de distribución. Usa un puerto de depuración WebView2 solo en ese proceso de prueba. Guarda capturas y logs en `test-results/`, fuera de Git.

El workflow Windows repite las verificaciones y prepara el instalador como artefacto de compilación. Los resultados locales y límites están en [VALIDATION.md](docs/VALIDATION.md).

`--provider` añade la consulta estadística real y el caso de Viego; `--model` prueba el modelo instalado; `--roles-model`, sus cinco posiciones y el descarte de estrategias obsoletas. Ambos son optativos y no sustituyen la prueba offline. El modelo se descarga separado del instalador; preparación y límites en [LOCAL_MODEL.md](docs/LOCAL_MODEL.md).

## Documentación

- [Especificación y roadmap](docs/PRODUCT_SPEC.md).
- [Arquitectura y contratos](docs/ARCHITECTURE.md).
- [Integración con el cliente: endpoints y pruebas](docs/CLIENT_INTEGRATION.md).
- [Fuentes y actualización del catálogo](docs/DATA_SOURCES.md).
- [Reglas, planes y cobertura del motor](docs/RECOMMENDATIONS.md).
- [Integraciones y revisión de políticas](docs/COMPLIANCE.md).
- [Punto de continuidad del desarrollo](docs/DEVELOPMENT_STATE.md).
- [Decisión de la primera entrega](docs/decisions/0001-desktop-foundation.md).
- [Paquetes oficiales y motor local](docs/decisions/0002-data-and-rules.md).

Antes de colaborar, leer [AGENTS.md](AGENTS.md) y la especificación. Las integraciones con Riot requieren verificación técnica y revisión de su uso antes de habilitarse.

kahoru.lol isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
