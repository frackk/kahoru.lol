# Fuentes de datos

## Catálogo incluido

Fuente: [Data Dragon de Riot Games](https://developer.riotgames.com/docs/lol#data-dragon), versión 16.21.1, idioma es_AR. El paquete contiene identificadores, nombres y títulos de 173 campeones. No contiene win rates, recomendaciones ni métricas de matchup.

`data/champions.json` registra URL exacta, versión, idioma, fecha de descarga y SHA-256 de la respuesta original. El checksum documenta la descarga: no es una firma de Riot ni una verificación contra un hash publicado por Riot.

Para preparar otra versión:

```powershell
npm run data:update -- 16.21.1
cargo test --manifest-path src-tauri/Cargo.toml
npm test
```

El script exige una versión explícita, comprueba el tipo de respuesta, versión, identificadores únicos y tamaño mínimo antes de reemplazar el archivo. El catálogo anterior permanece disponible si la descarga o validación falla. Revisar el diff antes de distribuirlo.

La aplicación muestra la versión de datos, pero no afirma conocer el parche del cliente. No consulta `latest` al abrir. Data Dragon puede publicarse después de un parche y no coincidir con la versión regional del juego.

## Fuentes pendientes

No se ha seleccionado un proveedor estadístico ni configurado una clave Riot. Antes de implementar meta o matchups se necesita una decisión sobre licencia, cuotas, población de muestra y cadencia. La alternativa es un motor basado en reglas con procedencia documentada y sin tasas observadas.

Runas, objetos y recetas requieren sus propios paquetes y validadores. El catálogo de campeones no acredita su compatibilidad.
