# Alcance y revisión de integraciones

Revisión documental: 1 de noviembre de 2026. Este registro describe el alcance técnico; no afirma aprobación particular de Riot.

| Capacidad                                                               | Estado en 0.1.0                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Catálogo Data Dragon                                                    | Implementado; incluido y consultado localmente.                               |
| Draft, cambios de fase y pérdida de conexión                            | Simulados y controlados manualmente.                                          |
| Lectura LCU                                                             | Pendiente de validación y declaración de endpoints/usos.                      |
| Estadísticas Riot Web API                                               | Sin configurar; pendiente de fuente, acceso y muestreo.                       |
| Escritura de runas                                                      | No implementada. Requiere revisión técnica y de uso.                          |
| Overlay y atajos globales                                               | No implementados.                                                             |
| Recomendaciones durante la partida                                      | Fuera de alcance. Solo se prevé consulta de planes preparados antes de jugar. |
| Memoria de LoL, inyección, hooks del juego y automatización de gameplay | Excluidos.                                                                    |

## Condiciones para integrar el cliente

Registrar el producto y mantener descripción y funciones actualizadas ante Riot. Documentar para cada capacidad el endpoint, método, finalidad, campos utilizados, pruebas y fecha de revisión. Una respuesta válida de un endpoint no acredita que el uso esté permitido.

LCU carece de soporte garantizado para terceros. La aplicación debe conservar un modo manual cuando cambie o deje de estar disponible. Las funciones sin validación permanecen ausentes del producto; no existe un ajuste que permita habilitarlas.

No se recopilan identidades, historial, credenciales ni telemetría. No se leen procesos o archivos de Riot. La interfaz no recibe permisos de archivos, shell ni red remota. El ejecutable incluye datos y recursos locales. El aviso de no afiliación está en Acerca de y README.

## Fuentes oficiales

- [Política general: registro, integridad y claves](https://developer.riotgames.com/policies/general).
- [LCU y Game Client API](https://developer.riotgames.com/docs/lol).
- [Casos admitidos y no admitidos para League of Legends](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends).
- [Claves y cuotas](https://developer.riotgames.com/docs/portal).
- [Retirada de acceso directo a memoria](https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps).

La consulta estática prepartida aparece entre los casos admitidos; eso no habilita coaching basado en la evolución de una partida. La integración real y la distribución requieren completar las condiciones aplicables al producto. El registro ante Riot todavía no se realizó desde este repositorio.

## Desarrollo 0.2.0

El lector LCU se probó localmente el 2 de noviembre de 2026: fase, versión y sesión de una personalizada. Está en evaluación técnica, con registro y declaración de usos ante Riot todavía pendientes. Se utiliza exclusivamente lectura; no se afirma aprobación particular del producto. Ver `CLIENT_INTEGRATION.md` para rutas, campos y límites de las pruebas.
