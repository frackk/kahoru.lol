# Preparación contextual

Fecha: 02/11/2026. Entrega: 0.5.0.

El usuario confirmó el alcance: el análisis se prepara antes de la partida y queda disponible para consulta. Pidió runas, spells, compras, estrategia breve y habilidades 1–18 dependientes del draft, con explicaciones y actualización de fuentes. La versión 0.4 no resolvía esa adaptación: sus runas y hechizos eran agregados por campeón/rol.

Se separan tres niveles:

- Evidencia: catálogo y kits de Riot, páginas de su cliente, filas agregadas de OP.GG con fuente, parche y muestra.
- Decisiones por reglas: selección entre páginas compatibles, ajustes puntuales de runas, hechizos, botas, componentes y variantes de habilidades.
- Prioridad de lectura: modelo local que elige entre hechos ya construidos y validados.

La entrega conserva el núcleo estadístico y la runa clave para no combinar a ciegas estilos incompatibles. Cada excepción se identifica como regla, sin adjudicarle una tasa observada. No se fuerzan cambios cuando el motor no tiene fundamento para elegir otra configuración. Las posiciones desconocidas no se convierten en matchups confirmados.

El modelo local sigue sin proponer configuraciones libres. La generación anterior produjo errores de mecánicas; ampliar su responsabilidad requiere un conjunto de evaluación y verificadores de juego más completos. Esto limita la adaptación disponible: todavía no es el agente experto solicitado para todo el catálogo.

Las búsquedas web no se incorporan automáticamente al conocimiento. Agregar proveedores requiere contratos, población, parche, muestras y condiciones de acceso comprobados. La interfaz pública de un servicio no equivale a una licencia general de redistribución.

La siguiente etapa debe ampliar interacciones y candidatos coherentes por campeón, contrastar drafts del mismo campeón y revisar sus resultados con evidencia de juego. Antes de recomendar un buff inicial hace falta incorporar el lado del mapa y conocimiento de aperturas validado; no se deduce una ruta segura solo de los nombres del draft.
