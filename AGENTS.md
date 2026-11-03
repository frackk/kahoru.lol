# Guía de desarrollo

kahoru.lol es una aplicación de escritorio para Windows. El alcance está definido en `docs/PRODUCT_SPEC.md`; leerlo antes de cambiar código o contratos. Si el pedido contradice la especificación, resolver la diferencia antes de implementar.

## Trabajo en el repositorio

- Revisar el estado de Git y la implementación existente antes de editar.
- Hacer cambios pequeños y limitados al pedido. Conservar el código estable.
- Mantener interfaces tipadas, módulos separados y recuperación ante fallos.
- Justificar las dependencias nuevas y los cambios de arquitectura.
- Probar las integraciones mediante adaptadores simulados antes de usar el cliente real. Verificar endpoints, respuestas y permisos; no suponer que existen o están autorizados.
- Ejecutar las comprobaciones disponibles: formato, lint, tipos, pruebas y build. Informar qué pasó, qué falló y qué no pudo verificarse.
- Al cerrar una tarea, indicar los cambios, el comportamiento obtenido y los límites pendientes. La documentación debe reflejar lo que funciona.

## Código y textos

Usar nombres precisos, código idiomático y documentación breve. Los comentarios deben explicar decisiones o limitaciones; evitar narrar instrucciones, añadir cabeceras repetidas o escribir frases promocionales.

No inventar estadísticas, fuentes, pruebas, benchmarks ni funcionalidades. Distinguir entre implementado, simulado y pendiente de validar.

Mantener `made by frack.one` en Acerca de, README y los metadatos del producto. No repetir la firma en cada archivo.

## Integración con Riot

- No acceder a memoria de LoL, inyectar código, usar hooks gráficos, eludir Vanguard ni automatizar gameplay.
- No revelar información oculta ni dar indicaciones adaptadas en tiempo real durante la partida.
- Tratar LCU como una integración sin soporte garantizado. Validar su uso, las escrituras al cliente y cualquier overlay antes de habilitarlos.
- Conservar una alternativa manual o de solo lectura si una integración falla o no puede habilitarse.
- Respetar cuotas, derechos de uso, privacidad y avisos legales de Riot. No incluir credenciales ni datos sensibles en Git o logs.

## Recomendaciones

Data Dragon aporta datos estáticos, no estadísticas del meta. Cada agregado debe identificar fuente, parche, muestra, fecha y región/cola cuando corresponda. Los puntajes de draft son relativos; los roles inferidos son hipótesis. Validar runas y builds contra el parche y mantener cada plan coherente. Explicar alternativas y sus limitaciones.

## Etapa actual

La versión 0.7.0 amplía el constructor conjunto: varias compras, primera compra, orden y evaluación de atributos oficiales. Conserva la elección opcional con IA local. La validez estructural está probada; la calidad estratégica completa sigue en evaluación. Los límites y pruebas están en `docs/VALIDATION.md` y `docs/RECOMMENDATIONS.md`. Siguen pendientes la calibración, matchups empíricos, contraste entre proveedores estadísticos y registro ante Riot. No presentar cobertura del catálogo como calidad estratégica validada para todos los campeones.
