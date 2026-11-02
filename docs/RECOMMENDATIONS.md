# Motor de recomendaciones

Versión de reglas: 16.21, revisión 1. Cobertura: 85 campeones, repartidos entre los cinco roles. La lista está en `data/knowledge/profiles.json`.

Los perfiles son reglas estratégicas del proyecto, no estadísticas de rendimiento. Describen posiciones habituales, tipo de daño esperado, funciones generales y un núcleo de compras. Son hipótesis de producto: no se presentan como una clasificación del meta ni como resultados calibrados.

## Ranking

El cálculo está aislado de React en `src/engine/`. Usa un valor base de 50 y contribuciones explícitas:

| Condición del draft conocido                                       | Aporte |
| ------------------------------------------------------------------ | -----: |
| Falta primera línea y el candidato la aporta                       |    +18 |
| Falta iniciación y el candidato la aporta                          |    +12 |
| El candidato diversifica dos o más perfiles del mismo tipo de daño |    +15 |
| Dos rivales de primera línea favorecen daño sostenido              |    +10 |
| Varias fuentes de iniciación rivales favorecen protección          |    +10 |

El máximo visible es 95. La escala no depende del conjunto de candidatos mostrado y no representa probabilidad de victoria. Se excluyen picks ocupados y bans; el pool declarado restringe las alternativas. No se conoce todavía qué campeones tiene disponibles la cuenta.

Al comparar alternativas para el jugador se excluye el aporte de su campeón actual de la composición aliada. Reemplazarlo no conserva su primera línea o perfil de daño.

La asignación rival recorre combinaciones de roles sin repetir posiciones. Muestra posibilidades cualitativas; si los perfiles no permiten una combinación consistente, conserva el rol desconocido. No hay porcentajes inferidos sin calibración.

## Planes

Cada perfil admite una opción equilibrada, otra contra ataques físicos y otra contra daño mágico. Cada opción reúne runas, objetos, componentes, condiciones y planteamiento previo. Tres o más perfiles físicos o mágicos conocidos priorizan la respuesta correspondiente; los perfiles mixtos o desconocidos no se cuentan como daño puro. La elección manual permanece estable mientras cambia el draft.

La página se valida contra los árboles de Data Dragon: una runa por fila principal y dos filas secundarias diferentes. Los fragmentos se contrastaron con `/lol-perks/v1/styles` y `/lol-perks/v1/perks` del cliente 16.21. Solo se guardaron reglas e iconos públicos; `data/knowledge/shards.json` identifica la fuente.

Las compras usan las recetas y costes del paquete. La ruta comprueba componentes repetidos, ciclos, disponibilidad y seis ranuras. Una compra tardía puede hacerse directamente cuando no hay espacio para todos los componentes; la biblioteca conserva su receta. Consumir pociones, completar la mascota o vender un objeto inicial son condiciones del plan, no acciones observadas ni automatizadas. No se estima el oro real.

Support conserva Mapamundi y su ranura de misión. La mejora propuesta se muestra por separado de las cinco compras; requiere completar la evolución hasta Recompensa Mundial. No se trata como un séptimo objeto ni se vende para hacer espacio.

Al entrar a partida se conserva la última preparación. Cambiar de pestaña o perder brevemente la conexión no recalcula consejos en vivo. Un identificador de partida distinto invalida la continuidad anterior. Si la app se abre durante una partida sin haber preparado el draft, no inventa un plan previo.

La lectura y la preparación no dependen de tener Inicio abierto. Durante el draft se siguen los picks aunque el usuario consulte otra sección.

## Actualizaciones y límites

Actualizar Data Dragon vuelve a validar las configuraciones. Si cambia el parche mayor/menor respecto de la revisión de reglas, el motor se desactiva hasta revisar los perfiles y fragmentos. Actualizar el catálogo no certifica que una estrategia siga siendo buena después de un balance.

No hay proveedor estadístico conectado, tasas de matchup ni historial personal incorporado. Los campeones sin perfil siguen disponibles con sus imágenes en el catálogo, pero no reciben planes genéricos de relleno. La importación de runas y la aprobación del uso concreto ante Riot continúan pendientes.

Las pruebas cubren todos los perfiles y 50 drafts sintéticos —diez por rol—. Comprueban invariantes y cambios de contexto; no demuestran una mejora de win rate. Antes de ampliar la confianza del modelo falta revisión estratégica con partidas de prueba.
