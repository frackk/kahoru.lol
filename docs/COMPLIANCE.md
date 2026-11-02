# Integraciones y políticas

Revisión: 2026-11-02, versión 0.4.0. El registro del producto ante Riot sigue pendiente. Las verificaciones técnicas y la existencia de aplicaciones parecidas no acreditan aprobación particular de kahoru.lol.

| Capacidad                                              | Estado                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Data Dragon e imágenes oficiales                       | Incluidos, actualización manual.                                            |
| Draft y fases                                          | Lectura local experimental.                                                 |
| Runas de Riot                                          | Páginas públicas recomendadas por campeón y posición.                       |
| Compras estadísticas                                   | OP.GG MCP, consulta pública documentada y caché local.                      |
| Importación de runas y spells                          | Experimental, por acción explícita; probada con respaldo y restauración.    |
| Estrategia                                             | Preparación previa por reglas; modelo local opcional para priorizar hechos. |
| Partida                                                | Consulta del plan conservado, sin adaptación en vivo.                       |
| Overlay y Live Client Data API                         | No implementados.                                                           |
| Memoria, inyección, hooks y automatización de gameplay | Excluidos.                                                                  |

## Riot

La [política general](https://developer.riotgames.com/policies/general) exige registrar los productos y mantener sus usos declarados. La [documentación LCU](https://developer.riotgames.com/docs/lol#league-client-api) no garantiza soporte para terceros y pide declarar endpoints y finalidades. Los [casos de uso de LoL](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) distinguen información previa de aplicaciones que dictan decisiones o revelan información desconocida.

El usuario solicitó habilitar la importación experimental para uso personal mientras queda pendiente el registro. Se verificaron validación, páginas ocupadas, respaldo, restauración, spells y lectura posterior. No se interpreta esta decisión como autorización concedida por Riot. Antes de distribuir públicamente corresponde registrar el producto y revisar sus usos concretos.

LoLDraftAI describe importación a pedido del usuario en su [presentación del producto](https://loldraftai.com/blog/loldraftai-explained). Esa referencia informa el recorrido funcional, no transfiere permisos ni demuestra conformidad para otra aplicación.

## Privacidad

LCU usa loopback HTTPS con certificado de Riot validado; no se deshabilita TLS. Las credenciales temporales quedan en Rust. El frontend no recibe nombres, PUUID, historial o tokens. El identificador de cuenta necesario para separar respaldos se convierte en hash y se utiliza únicamente en disco local.

OP.GG recibe campeón y rol consultados; no recibe identidades ni el draft completo. La app no redistribuye sus datasets en Git. La interfaz pública documentada no constituye una licencia universal para redistribución; una distribución pública debe revisar también las condiciones del proveedor.

La IA procesa el contexto en el equipo. No observa oro, posiciones, enfriamientos ni acciones durante partida. No hay telemetría. Los respaldos permanecen localmente hasta que el usuario los retire.

Se conserva el aviso de no afiliación en Acerca de y README. Los recursos de Riot y las licencias del modelo/runtime mantienen su atribución.
