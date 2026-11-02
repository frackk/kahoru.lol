# Cliente local

Verificación: 2026-11-02. La conexión se probó en el cliente instalado, versión 16.21.8342754, con certificado de Riot validado. Es una integración experimental de solo lectura; no acredita aprobación particular de Riot. Su registro y declaración de usos siguen pendientes.

## Lecturas utilizadas

| Método y ruta                         | Comprobación local                        | Uso                                                                |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `GET /lol-gameflow/v1/gameflow-phase` | HTTP 200 en inicio y selección            | Fase de la sesión.                                                 |
| `GET /lol-patch/v1/game-version`      | HTTP 200                                  | Versión del cliente, separada del catálogo.                        |
| `GET /lol-champ-select/v1/session`    | HTTP 404 sin draft y 200 en personalizada | Equipos, picks, bans y posición propia.                            |
| `GET /help`                           | HTTP 200 durante la investigación         | Inspección de la interfaz disponible; no se consulta en ejecución. |

La ruta Swagger consultada respondió 404. El adaptador no depende de ella. LCU no dispone de garantías de soporte para terceros: estas pruebas confirman disponibilidad técnica en esta versión, no estabilidad futura.

## Conexión y privacidad

La aplicación busca el lockfile en las ubicaciones habituales y en las instalaciones registradas en `RiotClientInstalls.json`. Lee puerto y contraseña temporal en memoria; no los devuelve al frontend ni los escribe en logs. Solo consulta `127.0.0.1` mediante HTTPS. El certificado raíz se obtuvo del [enlace publicado por Riot](https://static.developer.riotgames.com/docs/lol/riotgames.pem). No se deshabilitan la validación TLS o del nombre del servidor. No se siguen redirecciones ni proxies.

El lector publica únicamente fase, versión, campeones, bans y posiciones visibles. No devuelve nombres, PUUID, historial ni credenciales. Ignora intenciones y posiciones asignadas del equipo rival. Distingue picks provisionales de acciones de selección completadas.

Se consulta cada segundo durante el draft, cada tres segundos fuera de partida y cada diez durante la partida. Los requests tienen timeout de dos segundos. Se vuelve a leer el lockfile para recuperar reinicios. El sondeo reemplaza provisionalmente la suscripción de eventos; debe medirse antes de optimizarlo.

Una desconexión conserva la última vista y la marca como desconectada. Al recuperar una partida sin continuidad comprobable se descarta el draft anterior. Una fase de inicio o sala limpia la selección. La fase se verifica antes y después de leer el draft para evitar publicar una transición incompleta.

## Pruebas

`tests/fixtures/client-draft.json` conserva solo campos de selección de una personalizada real, sin identidades. Las pruebas comprueban equipos incompletos, rol desconocido, picks tentativos y credenciales inválidas. La conexión real se comprueba expresamente con:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml local_client_answers_with_valid_tls -- --ignored
npm run test:native -- --live
```

No se inició ninguna partida desde la aplicación. Falta verificar una partida completa, swaps de diez jugadores y reinicios durante carga. No se implementan selección automática de campeones en LoL, escritura de runas, recomendaciones en vivo ni seguimiento de información oculta.
