# 0001 — Base de escritorio y simulación

Fecha: 2026-11-01. Estado: adoptada para la primera entrega.

Se mantiene Tauri 2 con Rust para la sesión y React/TypeScript para presentación. El alcance sigue la Fase 1 de AGENTS.md: ejecutable, navegación, simulador y catálogo oficial validado. No se adelanta la integración con LoL.

La fase de sesión y la salud de conexión se representan por separado. Los estados `DISCONNECTED` y `RECOVERY` de la especificación describen condiciones de presentación; no borran una fase o un draft existente. El simulador permite reproducir esa pérdida sin conectarse a Riot.

Se conserva la estructura de `DraftSnapshot`; se concreta `DraftSlot` y se añade un contenedor `Session`. La doble representación Rust/TypeScript se comprueba mediante el recorrido nativo que deserializa respuestas reales del núcleo. Si el contrato crece, se evaluará generación de bindings.

La aplicación durante una partida real se limitará a consultar información preparada previamente. Se excluyen recomendaciones adaptadas en tiempo real, aun si una API pudiera entregar los datos.

El catálogo se fija por versión y se incluye para funcionar sin conexión. No se añade SQLite, un servidor o un proveedor estadístico antes de tener un caso concreto. El registro Riot y la fuente estadística siguen pendientes para las siguientes etapas; no se presentan como resueltos.
