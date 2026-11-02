# Alcance de las integraciones

Revisión documental: 2026-11-02. Versión 0.3.0. Las pruebas técnicas no acreditan aprobación particular de Riot; el registro y la declaración de usos del producto siguen pendientes.

| Capacidad                                                     | Estado                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Data Dragon e imágenes oficiales                              | Incluidos; actualización manual desde Riot.                           |
| Draft y cambios de fase                                       | Lector local experimental y simulador separado.                       |
| Ranking, runas, builds y estrategia                           | Reglas locales prepartida para 85 perfiles; sin estadísticas de meta. |
| Consulta durante partida                                      | Conserva el plan preparado; sin adaptación a la evolución del juego.  |
| Estadísticas Riot Web API                                     | Sin proveedor ni clave configurados.                                  |
| Escritura/importación de runas                                | No implementada; pendiente de revisión técnica y de uso.              |
| Overlay, atajos globales y Live Client Data API               | No implementados.                                                     |
| Memoria de LoL, inyección, hooks y automatización de gameplay | Excluidos.                                                            |

## Políticas y registro

La [política general](https://developer.riotgames.com/policies/general) admite recursos de Data Dragon y exige registrar y mantener actualizadas las funciones del producto. El [apartado LCU](https://developer.riotgames.com/docs/lol#league-client-api) explica que la interfaz no tiene soporte garantizado para terceros y pide declarar endpoints y usos.

Los [casos de uso de League of Legends](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) incluyen consulta de datos estáticos disponibles antes de jugar y rechazan información desconocida de la sesión o aplicaciones que dicten decisiones. El producto presenta alternativas previas y no observa oro, posiciones, compras, cooldowns ni decisiones durante la partida. Este diseño debe describirse ante Riot antes de afirmar conformidad del producto concreto.

No se habilita escritura por el mero hecho de que exista un endpoint. Antes de añadir importación corresponde comprobar páginas, límites, errores, reversibilidad y política aplicable. Los métodos utilizados y las pruebas actuales se documentan en [CLIENT_INTEGRATION.md](CLIENT_INTEGRATION.md).

## Privacidad y superficie de acceso

El lector usa metadatos de instalación y un lockfile local. Mantiene las credenciales temporales en Rust, valida TLS con la raíz publicada por Riot y consulta únicamente loopback. El frontend no recibe nombres, PUUID, historial ni credenciales. No hay telemetría.

La actualización de recursos contacta el CDN oficial por HTTPS. No envía datos del draft o del jugador. El acceso de imágenes a disco está limitado a la caché del producto. No se deshabilitan certificados ni se inspecciona memoria de procesos.

El aviso de no afiliación aparece en Acerca de y README. El código propio pertenece al proyecto; los recursos de League of Legends siguen siendo propiedad de Riot Games.
