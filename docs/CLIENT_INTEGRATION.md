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

Por defecto se conservan las teclas actuales. El usuario puede fijar Flash en D/F, independientemente del orden recibido de la fuente, o elegir el orden exacto de los dos spells. La preferencia se guarda localmente y se envía al núcleo con cada importación; no modifica el cliente hasta pulsar el botón. La lectura posterior verifica página activa, IDs y spells; los errores parciales se informan sin afirmar éxito total. La app no refleja como cambios propios las ediciones posteriores realizadas manualmente en el cliente.

## Conexión y privacidad

Se descubren lockfiles mediante ubicaciones habituales y `RiotClientInstalls.json`. Credenciales temporales solo en memoria nativa; nunca en frontend, logs o Git. HTTPS únicamente a loopback, sin proxy ni redirecciones, con la raíz publicada por Riot. No se deshabilita la validación TLS.

Los snapshots descartan identidades e información rival no revelada. La cuenta utilizada para separar respaldos se convierte en hash local; no se envía al proveedor. Se sondea cada segundo en draft, tres fuera de partida y diez en partida, con timeouts.

La pérdida de conexión conserva la vista y la marca como desconectada. Inicio/sala limpia el draft; una partida distinta invalida la continuidad. La fase se revisa antes y después de leer la selección.

## Verificación real

En una personalizada, el usuario autorizó reutilizar la página activa con respaldo. Se aplicaron runas y spells de Viego, se conservó la tecla de Flash y la otra página del usuario, se restauró la configuración anterior y se volvió a importar. Quedó activa la página de kahoru.lol. No se inició una partida ni se eligió un campeón desde la app.

Faltan una partida completa, swaps entre diez jugadores y reinicios durante carga. Las pruebas de escritura del núcleo usan primero un adaptador de memoria. La prueba real no se repite automáticamente en CI.

## Lado del mapa (0.8)

El 3 de noviembre se verificó en una selección real que myTeam incluye team y que el jugador local tenía team=2. Se localiza por localPlayerCellId y se interpreta team=1 como azul y team=2 como rojo; no se usa el índice del array, el primer pick ni la posición visual. Valores ausentes o no admitidos quedan sin confirmar. El lado se conserva al pasar a carga/partida y se limpia al volver a sala. La lectura real de ambos lados en distintas colas todavía requiere ampliar la comprobación; los dos valores y datos inválidos tienen pruebas unitarias.

La interfaz permite corregirlo por sesión, también en el simulador. El contexto del modelo y la firma de preparación incluyen el lado. Cambiar únicamente el lado no fuerza runas u objetos distintos: orienta las alternativas de apertura cuando hay información suficiente. No se agregan endpoints ni escrituras para esta función.
