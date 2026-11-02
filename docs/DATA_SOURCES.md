# Datos e imágenes

Paquete incluido: Data Dragon 16.21.1, español de Argentina. Contiene 173 campeones, 272 objetos de la Grieta, 62 runas, cinco árboles y 512 imágenes PNG. Los objetos transformados o de misión pueden estar catalogados sin venderse en tienda.

## Riot

La [documentación de Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) describe versiones y recursos. Se utilizan `api/versions.json` y, bajo `cdn/16.21.1/data/es_AR/`, `champion.json`, `item.json`, `runesReforged.json` y `summoner.json`. Las rutas de imágenes salen de esos documentos oficiales.

`data/game-data.json` guarda estructura normalizada y manifiesto de 512 imágenes con URL y SHA-256; `data/champions.json` conserva el catálogo compatible. Los hashes detectan corrupción, no son firmas publicadas por Riot.

Los fragmentos y nueve spells tienen metadatos e iconos incluidos por separado en `data/knowledge/` y `public/knowledge/`. Sus filas se contrastaron con el cliente 16.21. Los cambios futuros de fragmentos o spells necesitan revisión propia; no se interpreta que actualizar imágenes confirme esas reglas.

`data/client-recommendations.json` contiene metadatos públicos del kit, posiciones y 825 páginas de los 173 campeones, obtenidos del cliente local. No contiene páginas personales ni identidades. Cada página conserva la posición devuelta y su ID de recomendación. La ruta exige posiciones en mayúsculas; respuestas para otra posición se descartan.

## Actualización oficial

**Datos del juego → Comprobar datos** busca la revisión más reciente del parche detectado en LoL. Sin cliente utiliza la familia del paquete actual. Descarga JSON e imágenes a staging, valida y activa al terminar; ante fallos conserva la versión anterior. La caché se comprueba al arrancar. La activación se bloquea durante draft y partida. Después se revisan hasta cinco análisis recientes de la sesión; cada error se conserva sin sustituir datos por plantillas.

Si LoL está abierto y en inicio o sala, también comprueba sus kits, posiciones y páginas. El catálogo y el cliente deben compartir parche. Si falla esta parte se informa por separado. Si queda un paquete de recomendaciones de otro parche, el motor bloquea los planes incompatibles.

## OP.GG

Se utiliza la [interfaz MCP pública documentada por OP.GG](https://github.com/opgginc/opgg-mcp), en `https://mcp-api.op.gg/mcp`, mediante JSON-RPC `tools/call`:

- `lol_list_champions`: claves y nombres canónicos; permite resolver aliases como Lee Sin.
- `lol_get_champion_analysis`: campeón, posición y modo ranked; selección acotada de campos de compras, runas, spells, habilidades, matchups y tendencias. Los campos se comprobaron mediante `tools/list` y consultas reales el 02/11/2026.

No se extraen páginas HTML ni endpoints internos de sitios. El transporte puede devolver JSON o eventos SSE; el contenido se decodifica con un parser acotado, sin evaluar código o constructores. La respuesta debe corresponder al campeón y rol pedidos.

La caché local dura doce horas. El esquema 2 invalida las respuestas anteriores que no pedían habilidades y matchups. La memoria de la interfaz respeta también ese vencimiento. El botón **Actualizar análisis** permite refrescar, con un mínimo de sesenta segundos entre consultas. Solo se envían campeón y posición; no cuentas ni draft completo. Los datos de respuesta no se incluyen en Git; los tests usan muestras sintéticas identificadas.

Límites: el contrato utilizado no admite región o parche explícitos. Se muestra versión de tendencias, fecha de consulta, todos los rangos y región no informada. No se conoce una ventana estadística exacta para cada fila. Una muestra observada de compras no prueba causalidad. Esta interfaz pública no concede por sí sola derechos generales de redistribución.

Riot aporta una recomendación independiente de runas, pero no una segunda muestra estadística de builds. La comparación de proveedores estadísticos sigue pendiente. Los matchups publicados se muestran solo con posición rival confirmada y al menos 300 partidas; no se usan como prueba causal ni se extrapolan a roles desconocidos.

## Preparación del repositorio

```powershell
npm run data:update -- 16.21.1
node scripts/prepare-spells.mjs
node scripts/prepare-client-recommendations.mjs
```

El último comando requiere LoL abierto y descubre el lockfile; `LEAGUE_LOCKFILE` permite indicar otra ubicación sin guardar credenciales. Revisar el diff y ejecutar los controles antes de distribuir un paquete.

## Otras fuentes revisadas

Revisión del 02/11/2026: [LoLalytics identifica su API como privada y excluye uso por terceros](https://a3.lolalytics.com/); no se integra. [Mobalytics documenta un widget para sitios web](https://mobalytics.gg/builds-widget-documentation/), no un contrato general de extracción para este motor. El acceso de desarrollo del widget no se trata como permiso para reutilizarlo en una aplicación distribuida.

[OP.GG pide atribución y evitar solicitudes excesivas](https://help.op.gg/hc/en-us/articles/31091405109401-Can-I-use-OP-GG-data). La aplicación utiliza su MCP público con caché y cita la fuente; no se redistribuyen respuestas como dataset. Estas revisiones no sustituyen las condiciones que correspondan a una distribución futura.

Desde 0.6 se solicita también data.summary.id. La caché estadística usa esquema 3 y valida el ID oficial del campeón, además de posición y estructura: diferencias de espacios o apóstrofos del nombre no deben rechazar una respuesta legítima. Se comprobó el caso VEL_KOZ → VELKOZ sin relajar el control de identidad.
