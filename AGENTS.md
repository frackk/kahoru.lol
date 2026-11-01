# Instrucciones de desarrollo — kahoru.lol

Este archivo es la guía de trabajo para cualquier agente o colaborador que modifique el repositorio.

## Contexto y prioridad

Antes de escribir código, leer `docs/PRODUCT_SPEC.md`. Es la referencia de alcance, criterios de aceptación, restricciones de Riot, estados del programa y roadmap. Cuando una tarea contradiga la especificación, señalarlo y resolver la contradicción antes de cambiar los contratos.

El proyecto es una aplicación de escritorio para Windows que asiste al jugador de League of Legends antes de la partida y ofrece una vista ligera de consulta durante ella. Su identidad es **kahoru.lol — made by frack.one**.

## Forma de trabajar

1. Revisar primero el repositorio y el estado actual. No asumir que las funcionalidades documentadas están implementadas.
2. Dividir cada pedido en cambios concretos y pequeños. Implementar solo el alcance solicitado y las correcciones imprescindibles para que funcione.
3. Priorizar módulos con interfaces tipadas, pruebas reproducibles y degradación segura.
4. Antes de integrar LoL, utilizar adaptadores simulados y casos de prueba. Los endpoints reales deben verificarse con documentación y pruebas; jamás inventarlos.
5. No reescribir código estable ni añadir frameworks, servicios o dependencias pesadas sin una razón documentada.
6. Ejecutar las comprobaciones disponibles (tests, tipos, lint, build). Describir qué se ejecutó y qué queda pendiente.
7. Al finalizar, indicar archivos modificados, comportamiento obtenido, decisiones tomadas y límites conocidos.

## Estilo

- Código sencillo, idiomático y mantenible; nombres precisos, sin ingeniería excesiva.
- Comentarios escasos y útiles: explicar el motivo, no narrar cada instrucción.
- Documentación natural, breve y profesional. Evitar frases promocionales, muletillas y texto genérico.
- No incluir referencias al uso de asistentes en comentarios, código fuente o documentación del producto.
- Nunca inventar resultados, benchmarks, estadísticas, fuentes o funcionalidades para que el proyecto parezca más avanzado.
- Mantener `made by frack.one` en la pantalla Acerca de, la documentación principal y los metadatos que correspondan; no repetirlo en cada archivo.

## Seguridad y cumplimiento

- No leer/escribir memoria de LoL, inyectar DLL, aplicar hooks gráficos al juego, eludir Vanguard ni automatizar gameplay.
- No introducir herramientas que revelen información oculta o dicten decisiones en tiempo real.
- Tratar LCU como integración sin soporte oficial garantizado. Las escrituras al cliente y el overlay requieren validación técnica y revisión de políticas antes de habilitarlas.
- No incluir credenciales, API keys, tokens ni archivos locales sensibles en Git. No escribir esos datos en logs.
- Respetar cuotas, derechos de uso de datos, privacidad y los avisos legales de Riot.
- Si una función no es confiable o no está permitida, dejarla deshabilitada y proporcionar una alternativa manual o de solo lectura.

## Reglas para recomendaciones

- Data Dragon aporta datos de juego, no métricas del meta. No presentar cálculos inventados como win rates.
- Toda estadística agregada debe indicar origen, parche, muestra, región/cola cuando corresponda y fecha.
- Los puntajes de draft son relativos, no probabilidades de victoria.
- Las asignaciones de roles enemigas se presentan como hipótesis si no están confirmadas.
- Runas y builds deben validarse con el parche y pertenecer a un plan coherente.
- El motor debe ofrecer alternativas y explicar tradeoffs, no reemplazar la decisión del jugador.

## Alcance por fases

La implementación inicial corresponde a la **Fase 1** de la especificación: app base, navegación, simulador de draft, datos estáticos validados e infraestructura de pruebas. Investigar primero lo que aún falte de la Fase 0. No construir funciones de partida real, importación de runas ni overlays antes de validar las condiciones correspondientes.

## Criterio de cierre de una tarea

Una tarea está terminada solo si el comportamiento pedido funciona, los casos relevantes están probados, no se introdujeron regresiones conocidas y la documentación refleja el estado real. Indicar expresamente cualquier verificación que no se pudo realizar.