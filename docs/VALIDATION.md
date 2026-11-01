# Verificación de la primera entrega

Fecha: 2026-11-01. Entorno local: Windows 11 Home x64, compilación 26300; Node 24.22.1; Rust fijado en 1.99.1; WebView2 del equipo.

## Comprobaciones ejecutadas

| Comprobación                                        | Resultado                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| TypeScript y build Vite                             | Correctos.                                                                                   |
| ESLint y Prettier                                   | Correctos.                                                                                   |
| Pruebas TypeScript                                  | 4 correctas: selección disponible y recuperación de preferencias.                            |
| Pruebas Rust                                        | 6 correctas: catálogo, ciclo completo, roles/bans, swaps, acciones inválidas y recuperación. |
| Rustfmt y Clippy con warnings como errores          | Correctos.                                                                                   |
| Auditoría npm, incluidas herramientas de desarrollo | Sin vulnerabilidades reportadas.                                                             |
| Recorrido nativo Windows, debug y release           | Correcto: bans, cinco roles, diez picks, swaps, fases, reconexión, limpieza y preferencias.  |
| Compilación release e instalador NSIS x64           | Generados localmente.                                                                        |

La prueba nativa usa comandos reales del ejecutable mediante la interfaz de WebView2; no sustituye las respuestas IPC por mocks. La captura se guarda en `test-results/native-draft.png`. El núcleo no acepta picks duplicados, baneados o ajenos al catálogo. Los cambios rechazados no alteran el snapshot y las revisiones antiguas no se aplican.

## Límites de esta verificación

No se probaron conexión LCU, importación de runas, estadísticas, partidas reales, overlay ni compatibilidad con Vanguard: esas integraciones no forman parte de esta entrega. Tampoco se midieron FPS, CPU o memoria con LoL abierto. No se afirma haber cumplido los presupuestos de rendimiento del producto completo.

El instalador se generó en Windows; queda pendiente probar instalación y desinstalación en una máquina limpia, además de Windows 10 y equipos de menor capacidad. La compilación CI debe evaluarse por separado del resultado local.
