# kahoru.lol

Aplicación de escritorio para preparar partidas de League of Legends. **made by [frack.one](https://frack.one)**.

Carpeta de trabajo en este equipo: `E:\Cosas\kahoru.lol`.

## Código fuente

| Carpeta          | Contenido                                                     |
| ---------------- | ------------------------------------------------------------- |
| `src/`           | Interfaz React, estilos y contratos TypeScript.               |
| `src-tauri/src/` | Sesión, validaciones y comandos nativos en Rust.              |
| `scripts/`       | Actualización del catálogo y prueba de la aplicación Windows. |
| `data/`          | Catálogo de campeones incluido.                               |
| `docs/`          | Especificación, arquitectura y resultados de pruebas.         |

`AGENTS.md` contiene las pautas de desarrollo del repositorio. No se incluye en la aplicación.

## Estado

La versión 0.2.0 incorpora conexión local de solo lectura a League of Legends, detección de fase y carga automática de equipos, picks y bans. La pantalla Inicio muestra los datos del cliente y conserva el simulador como herramienta de prueba. Permite editar ambos equipos, confirmar picks, bloquear campeones, intercambiar posiciones y recorrer estados de sesión. El catálogo oficial de 173 campeones está incluido y funciona sin conexión.

El simulador se identifica siempre como entrada manual. El ranking contextual, los planes, la inferencia de roles y la importación de runas siguen pendientes. No se ofrecen estadísticas ni recomendaciones ficticias.

Durante una partida, el alcance previsto es consultar planes preparados antes de jugar. Se excluyen recomendaciones adaptadas en tiempo real y automatización de gameplay.

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

La prueba nativa abre una ventana temporal, selecciona diez campeones a través de la interfaz, comprueba transiciones, desconexión, limpieza y preferencias. Usa un puerto de depuración WebView2 solo en ese proceso de prueba. No lo habilita en el producto distribuido. Guarda una captura en `test-results/`, fuera de Git.

El workflow Windows repite las verificaciones y prepara el instalador como artefacto de compilación. Los resultados locales y límites están en [VALIDATION.md](docs/VALIDATION.md).

## Documentación

- [Especificación y roadmap](docs/PRODUCT_SPEC.md).
- [Arquitectura y contratos](docs/ARCHITECTURE.md).
- [Integración con el cliente: endpoints y pruebas](docs/CLIENT_INTEGRATION.md).
- [Fuentes y actualización del catálogo](docs/DATA_SOURCES.md).
- [Integraciones y revisión de políticas](docs/COMPLIANCE.md).
- [Decisión de la primera entrega](docs/decisions/0001-desktop-foundation.md).

Antes de colaborar, leer [AGENTS.md](AGENTS.md) y la especificación. Las integraciones con Riot requieren verificación técnica y revisión de su uso antes de habilitarse.

kahoru.lol isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
