# Verificación

Fecha: 2026-11-02. Versión 0.3.0. Entorno local: Windows 11 Home x64, compilación 26300; Node 24.22.1; Rust 1.99.1; WebView2 instalado. Carpeta de trabajo: `E:\Cosas\kahoru.lol`.

## Pruebas locales

| Comprobación                               | Resultado                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| TypeScript, build Vite y ESLint            | Correctos.                                                                             |
| Pruebas TypeScript                         | 150 correctas.                                                                         |
| Pruebas Rust                               | 13 correctas; dos integraciones con red/cliente se ejecutan expresamente.              |
| Rustfmt y Clippy con warnings como errores | Correctos.                                                                             |
| Catálogo e imágenes                        | Paquete validado: 173 campeones, 272 objetos, 62 runas y 512 PNG.                      |
| Planes                                     | Todos los perfiles y 50 drafts sintéticos, diez por rol.                               |
| Caché                                      | Activación, carga íntegra y recuperación del paquete incluido al corromper una imagen. |

Las pruebas de planes comprueban exclusión de picks/bans, cambios de composición, roles conjuntos, páginas completas, recetas, seis ranuras y mejora de misión de support. También verifican la conservación de la elección manual y la congelación del plan al entrar a partida. Son comprobaciones de consistencia; no demuestran una mejora de rendimiento competitivo.

## Recorrido nativo

`npm run test:native` controla el ejecutable real mediante WebView2, sin reemplazar IPC por mocks. Selecciona diez campeones, prueba roles, bans, swaps, fases, reconexión y preferencias. Comprueba runas, planes conservados e imágenes decodificadas en la biblioteca. `--update` añade una consulta real del manifiesto oficial; `--release` utiliza el ejecutable de distribución. Las capturas y logs quedan en `test-results/`, fuera de Git.

La conexión LCU se verificó en una personalizada con el cliente 16.21.8342754: fase, versión, equipo y campeón seleccionado. La prueba TLS real se ejecutó expresamente y pasó. No se realizaron acciones de juego desde kahoru.lol. Ver [CLIENT_INTEGRATION.md](CLIENT_INTEGRATION.md).

La integración de descarga completa también pasó: obtuvo JSON y las 512 imágenes oficiales, activó el paquete y lo recuperó con verificación de hashes desde una caché temporal. Se ejecuta aparte para evitar descargas en cada comprobación:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml downloaded_pack_can_be_activated_and_reloaded -- --ignored
```

## Límites

Quedan pendientes una partida completa, swaps entre diez jugadores, reinicios durante carga y evaluación estratégica con partidas de prueba. No se probaron importación de runas, proveedor estadístico u overlay, porque no están implementados. Tampoco se midieron FPS, CPU o memoria con LoL en partida.

El instalador debe probarse en una máquina limpia, Windows 10 y un equipo de menor capacidad. El resultado de GitHub Actions es independiente de las pruebas locales; los primeros recorridos remotos fallaron al iniciar el puerto de WebView2. El workflow usa ahora Windows Server 2022 y un perfil temporal aislado. La ejecución 41397457173 pasó el 2 de noviembre, incluido el recorrido de interfaz y el instalador. Repetirla para cambios posteriores.
