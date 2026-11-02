# 0002 — Paquetes oficiales y reglas locales

Fecha: 2026-11-02. Estado: adoptada para 0.3.0.

La aplicación incluye un paquete completo de Data Dragon con campeones, objetos, runas e imágenes. Rust gestiona descarga, validación, caché y activación. El frontend recibe un contrato tipado y solo puede leer imágenes dentro de la caché dedicada del producto.

Se incorpora un motor puro en TypeScript, separado de los componentes visuales. Las entradas son snapshots y paquetes; las salidas contienen puntajes explicados y planes. Esto permite comprobar los perfiles con el mismo entorno de pruebas del contrato frontend. No contiene llamadas de red, acceso a disco ni estado de LoL. Su traslado a Rust se evaluará si la medición de rendimiento o el crecimiento de contratos lo justifica.

El paquete oficial se actualiza con un botón. El parche del cliente determina qué versión buscar; con el cliente cerrado se conserva la familia de parche incluida. Se descargan recursos a una carpeta temporal y se cambia el índice activo de forma atómica después de validarlos. Se conserva el paquete anterior.

Las reglas estratégicas tienen revisión propia. Un parche nuevo puede actualizar imágenes y datos sin habilitar automáticamente recomendaciones antiguas. No se añade un supuesto proveedor de meta ni se extraen datos de sitios de terceros sin condiciones de uso compatibles.
