# Cliente local

Verificado el 2 de noviembre de 2026 con el cliente 16.21.8342754. LCU es una integración experimental sin garantía de soporte. El registro del producto y la declaración de usos siguen pendientes.

## Lecturas

| Ruta GET                                                                      | Uso                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/lol-gameflow/v1/gameflow-phase`                                             | Fase.                                                         |
| `/lol-gameflow/v1/session`                                                    | Mapa y continuidad interna de partida.                        |
| `/lol-patch/v1/game-version`                                                  | Compatibilidad de parche.                                     |
| `/lol-champ-select/v1/session`                                                | Picks, hovers aliados, bans y posición propia.                |
| `/lol-perks/v1/recommended-champion-positions`                                | Posiciones recomendadas públicas.                             |
| `/lol-perks/v1/recommended-pages/champion/{id}/position/{position}/map/11`    | Páginas públicas por campeón y posición.                      |
| `/lol-game-data/assets/v1/champions/{id}.json`                                | Kit y metadatos públicos.                                     |
| `/lol-perks/v1/pages`, `/lol-perks/v1/currentpage`, `/lol-perks/v1/inventory` | Destinos de importación y ranuras.                            |
| `/lol-summoner/v1/current-summoner`                                           | Nivel para spells y separación local de respaldos por cuenta. |
| `/lol-champ-select/v1/session/my-selection`                                   | Spells propios y lectura posterior.                           |

`/lol-perks/v1/styles` y `/lol-perks/v1/perks` se consultaron para revisar fragmentos. `/help` se utilizó en investigación; la aplicación no depende de Swagger.

Las posiciones de las páginas deben ser `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM` o `UTILITY`. Una posición en minúsculas puede devolver silenciosamente una página de otra línea; se comprueba el campo devuelto.

## Escrituras explícitas

| Método y ruta                                     | Uso                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /lol-perks/v1/pages`                        | Crear página de kahoru.lol si hay ranura.                                    |
| `PUT /lol-perks/v1/pages/{id}`                    | Actualizar página propia o destino elegido con respaldo; restaurar respaldo. |
| `PATCH /lol-champ-select/v1/session/my-selection` | Aplicar únicamente los dos IDs de spells.                                    |

No se borran páginas. La importación exige selección real vigente, mapa 11, campeón propio y sesión coincidentes. Se validan árboles, filas, fragmentos, parche y spells. La fase y el campeón se comprueban otra vez antes de escribir.

Si las ranuras están llenas, el usuario elige el destino. La copia se guarda antes del PUT y se puede restaurar desde la misma sección. Una página propia se reconoce por su registro local e identidad; no se reemplaza otra página por nombre parecido.

Los spells conservan la tecla actual de Flash. La lectura posterior verifica página activa, IDs y spells; los errores parciales se informan sin afirmar éxito total. La app no refleja como cambios propios las ediciones posteriores realizadas manualmente en el cliente.

## Conexión y privacidad

Se descubren lockfiles mediante ubicaciones habituales y `RiotClientInstalls.json`. Credenciales temporales solo en memoria nativa; nunca en frontend, logs o Git. HTTPS únicamente a loopback, sin proxy ni redirecciones, con la raíz publicada por Riot. No se deshabilita la validación TLS.

Los snapshots descartan identidades e información rival no revelada. La cuenta utilizada para separar respaldos se convierte en hash local; no se envía al proveedor. Se sondea cada segundo en draft, tres fuera de partida y diez en partida, con timeouts.

La pérdida de conexión conserva la vista y la marca como desconectada. Inicio/sala limpia el draft; una partida distinta invalida la continuidad. La fase se revisa antes y después de leer la selección.

## Verificación real

En una personalizada, el usuario autorizó reutilizar la página activa con respaldo. Se aplicaron runas y spells de Viego, se conservó la tecla de Flash y la otra página del usuario, se restauró la configuración anterior y se volvió a importar. Quedó activa la página de kahoru.lol. No se inició una partida ni se eligió un campeón desde la app.

Faltan una partida completa, swaps entre diez jugadores y reinicios durante carga. Las pruebas de escritura del núcleo usan primero un adaptador de memoria. La prueba real no se repite automáticamente en CI.
