# Datos e imágenes

Paquete incluido: Data Dragon **16.21.1**, idioma `es_AR`. Contiene 173 campeones, 272 objetos de la Grieta, 62 runas, cinco árboles y 512 imágenes PNG oficiales. Los objetos de misión o transformados pueden estar catalogados sin estar disponibles en tienda; la biblioteca lo indica.

## Procedencia

La [documentación de Riot](https://developer.riotgames.com/docs/lol#data-dragon) describe Data Dragon y sus límites. Las descargas utilizadas son:

- `https://ddragon.leagueoflegends.com/api/versions.json`
- `https://ddragon.leagueoflegends.com/cdn/16.21.1/data/es_AR/champion.json`
- `https://ddragon.leagueoflegends.com/cdn/16.21.1/data/es_AR/item.json`
- `https://ddragon.leagueoflegends.com/cdn/16.21.1/data/es_AR/runesReforged.json`
- Imágenes de campeones y objetos bajo `/cdn/16.21.1/img/`; runas bajo `/cdn/img/`, con las rutas de los JSON oficiales.

`data/game-data.json` reúne el contrato normalizado y un manifiesto de imágenes con URL y SHA-256. `data/champions.json` conserva el catálogo compatible. La procedencia del catálogo incluye fecha, idioma, URL y hash de la respuesta original. Los hashes documentan la descarga y permiten detectar corrupción; no son firmas publicadas por Riot.

Los siete iconos de fragmentos también proceden del CDN oficial. Las filas válidas se contrastaron el 2 de noviembre con los metadatos públicos de `/lol-perks/v1/styles` y `/lol-perks/v1/perks` del cliente local 16.21. `data/knowledge/shards.json` registra las filas, nombres y origen. No se exportaron páginas de runas ni datos de cuenta.

## Actualizar desde la aplicación

En **Datos del juego → Comprobar datos**, Rust consulta las versiones oficiales. Busca la revisión más reciente dentro del parche mayor/menor detectado en LoL. Sin cliente conectado utiliza la familia del paquete actual, evitando saltar a un parche regional desconocido.

Si existe otra revisión, descarga los JSON e imágenes a una carpeta temporal, valida el conjunto y cambia el índice activo al terminar. Una descarga fallida conserva los datos anteriores. No cambia el paquete durante selección o partida y vuelve a comprobarlo antes de activarlo. El siguiente arranque verifica todos los recursos de la caché y recupera el paquete incluido ante corrupción.

Data Dragon puede llegar después del parche y tener varias revisiones. La versión del cliente y la del paquete se muestran por separado. Los recursos incluidos permiten consultar la biblioteca y preparar planes sin conexión.

## Preparar un paquete para distribuir

```powershell
npm run data:update -- 16.21.1
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

El script exige una versión concreta y obtiene JSON e imágenes desde Riot. Revisar el diff y las reglas estratégicas antes de distribuir otra versión. Los fragmentos tienen revisión independiente y no se regeneran con este comando.

## Estadísticas y reglas

Data Dragon no aporta win rates, matchups ni builds óptimas. Todavía no hay un proveedor estadístico conectado ni una clave Riot configurada. No se realiza scraping de sitios de builds.

Las recomendaciones usan reglas propias identificadas en [RECOMMENDATIONS.md](RECOMMENDATIONS.md). Actualizar el paquete vuelve a comprobar su validez estructural, pero no calibra el modelo ni interpreta notas de balance. Un parche distinto deshabilita las reglas anteriores hasta revisarlas.

Para incorporar meta empírico falta resolver fuente, permisos, cuotas, población, región, cola, rango, fecha y muestra. Esa decisión puede requerir un backend que mantenga las claves fuera del instalador.
