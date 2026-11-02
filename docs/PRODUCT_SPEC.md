# kahoru.lol — Especificación del producto

**Estado:** desarrollo de Fase 2 · **Versión del documento:** 0.3 · **Última revisión:** 2026-11-01
**Repositorio:** https://github.com/frackk/kahoru.lol  
**Autor:** frack.one  
**Plataforma inicial:** Windows 10/11, escritorio  
**Idioma inicial:** español; localización ampliable

> Documento de referencia para el desarrollo. Describe el producto que se quiere construir, no funciones que ya estén implementadas. Ante una discrepancia entre este documento y el código, registrar la diferencia y decidir explícitamente cuál debe actualizarse.

**Primera entrega:** aplicación base, simulador manual y catálogo de campeones. La conexión con LoL y los motores de recomendación siguen pendientes. Los contratos concretos y la separación entre fase y conectividad están documentados en `ARCHITECTURE.md` y `decisions/0001-desktop-foundation.md`.

## 1. Visión

kahoru.lol es un asistente de escritorio para League of Legends enfocado en preparar mejor cada partida. Detecta el estado del cliente, interpreta el draft, compara alternativas de selección, prepara runas y rutas de compra específicas para la composición y presenta un plan breve de juego. Durante la partida se convierte en una vista liviana de consulta, sin interferir con LoL.

La propuesta no es repetir una build popular: es explicar por qué una opción encaja en **esta partida**, con los campeones conocidos, el rol asignado, las amenazas previstas, el estilo de composición, el parche y la calidad de los datos disponibles.

**Identidad:** `kahoru.lol` · `made by frack.one`.

**Público inicial:** uso personal. La arquitectura debe admitir una posible distribución gratuita en el futuro, sujeto al registro y la revisión correspondientes de Riot Games. No se planifica monetización.

### 1.1 Objetivos

- Cubrir top, jungle, mid, bot/ADC y support sin favorecer ningún rol o campeón por defecto.
- Funcionar automáticamente cuando el cliente y las fuentes de datos lo permitan, con un modo manual útil cuando no estén disponibles.
- Sugerir varias decisiones razonables, no reemplazar la decisión del jugador.
- Mantener separados los datos comprobables, las inferencias del modelo y la explicación estratégica.
- Actualizar los datos del juego por parche y los datos estadísticos con una cadencia verificable.
- Ser rápido, liviano, fácil de mantener y tolerante a cambios del cliente.
- Permitir agregar fuentes, estrategias y módulos sin reescribir el programa.
- Mantener una interfaz sobria, informativa y sin funciones decorativas que consuman recursos.

### 1.2 Fuera de alcance

- Jugar, moverse, comprar, seleccionar campeones o lanzar habilidades por el usuario.
- Leer o escribir memoria de League of Legends, inyectar código, alterar procesos protegidos o intentar eludir Vanguard.
- Revelar datos de jugadores ocultos, información no disponible legítimamente o información que aporte ventajas indebidas.
- Dar órdenes operativas en vivo basadas en información de sesión que Riot no autorice.
- Prometer predicciones exactas del rol enemigo, del resultado de una partida o de la mejor build universal.
- Publicar resultados estadísticos inventados, desactualizados o sin muestra identificable.
- Imitar la interfaz del cliente oficial o presentar la aplicación como afiliada a Riot.

## 2. Principios del producto

1. **Contexto antes que popularidad.** El meta influye en las recomendaciones, pero no sustituye sinergias, matchup, composición, condiciones de victoria o preferencias del usuario.
2. **Alternativas antes que imposición.** Mostrar varias propuestas con ventajas y limitaciones; nunca una única decisión presentada como obligatoria.
3. **Incertidumbre visible.** Un rol inferido, un matchup con poca muestra y una build calculada sin estadísticas suficientes deben identificarse como tales.
4. **Rendimiento primero.** La actividad en segundo plano, especialmente durante la partida, debe ser mínima.
5. **Sin dependencia innecesaria de IA generativa.** Las recomendaciones numéricas salen de reglas y datos auditables. La redacción de explicaciones debe funcionar sin un servicio externo de IA.
6. **Módulos aislados.** La integración con LoL, el motor estadístico, los modelos estratégicos y la interfaz no deben depender de las implementaciones internas de los demás.
7. **Comportamiento seguro por defecto.** Cuando una integración es dudosa o deja de funcionar, se deshabilita y se utiliza un modo manual o de solo lectura.

## 3. Estados y recorrido de una partida

La aplicación seguirá una máquina de estados explícita. Los cambios del cliente no deben provocar ventanas duplicadas, información de partidas anteriores ni múltiples solicitudes simultáneas.

| Estado | Vista principal | Comportamiento |
| --- | --- | --- |
| `DISCONNECTED` | Inicio | Detectar cliente o permitir simulación manual. Mostrar estado de conexión y datos locales. |
| `IDLE` | Inicio | Esperar cola o sala. Ajustes y consulta de parches disponibles. |
| `QUEUE` | Espera | Mantener recursos mínimos; no realizar cálculos costosos. |
| `CHAMP_SELECT` | Draft | Actualizar picks, bans, asignación de roles y ranking de opciones. |
| `DRAFT_FINALIZING` | Preparación | Consolidar los diez campeones conocidos y calcular planes completos. |
| `LOADING` | Plan de partida | Mostrar ruta de compra y estrategia; corregir inferencias solo con datos fiables nuevos. |
| `IN_GAME` | Vista compacta | Mantener disponibles los planes preparados sin distraer ni provocar carga significativa. |
| `POST_GAME` | Resumen | Cerrar la sesión actual, limpiar el estado temporal y volver a inicio. |
| `RECOVERY` | Estado degradado | Explicar pérdida de conexión, conservar datos útiles y permitir recuperación o uso manual. |

El paso entre `DRAFT_FINALIZING`, `LOADING` e `IN_GAME` debe admitir reconexiones y eventos recibidos fuera de orden.

### 3.1 Eventos y casos particulares

- Picks bloqueados, picks tentativos, bans, intercambios de campeones, cambios de rol, selecciones anuladas y última selección en el reloj.
- Dodge, remake, partidas personalizadas, modos no compatibles, cliente abierto sin partida y cliente reiniciado.
- Menos de diez campeones revelados, campeones flexibles y selecciones que parecen extrañas por su rol.
- El rol asignado del jugador tiene prioridad sobre el rol que se estime para su campeón.
- Si faltan datos no se rellena con suposiciones silenciosas: se indica información incompleta y se conserva el mejor plan provisional.
- Un nuevo draft nunca reutiliza sin verificar los diez picks de la sesión anterior.

## 4. Asistente de draft

### 4.1 Objetivo

Mientras avanza la selección, ofrecer los campeones más adecuados para el rol del jugador, considerando la información disponible hasta ese momento y actualizando el análisis cada vez que cambie el draft.

### 4.2 Entradas

- Parche activo y modo de juego compatible.
- Rol asignado al jugador: top, jungle, mid, bot o support.
- Campeones aliados y enemigos confirmados; picks provisionales si se pueden consultar de forma fiable.
- Picks prohibidos y campeones no disponibles.
- Asignación de posiciones conocida y probabilidades de rol para los jugadores no identificados.
- Meta por parche, región, rango y rol, **solo si existe una fuente válida**.
- Preferencias del jugador: campeones favoritos, campeones excluidos, estilo y amplitud del champion pool.
- Estadísticas del propio usuario, únicamente si se autoriza su uso y hay datos suficientes.

### 4.3 Inferencia de roles

Distinguir tres niveles de información:

1. **Confirmado:** la fuente informa un rol asignado de forma fiable.
2. **Inferido:** distribución de probabilidad sobre roles posibles a partir de campeón, composiciones, posiciones ya cubiertas y datos históricos válidos.
3. **Desconocido:** evidencia insuficiente; no inventar una línea.

Para rivales con picks flexibles, mostrar probabilidades, por ejemplo `mid 65 % · top 35 %`, **solo como probabilidades calibradas**. Cuando el sistema no pueda calibrarlas, usar categorías cualitativas de confianza. Las probabilidades por campeón deben ser coherentes entre sí y considerar la restricción de cinco posiciones de equipo.

Las asignaciones pueden modificarse en el draft y al comenzar la partida. La pantalla de carga no garantiza por sí sola una fuente fiable de roles; solo se corregirá automáticamente cuando se disponga de nueva evidencia legítima. Siempre permitir corrección manual.

### 4.4 Ranking de campeones

Para cada opción viable, calcular un **puntaje de adecuación relativo de 0 a 100**. Este número **no representa la probabilidad de ganar la partida**.

Factores iniciales, con pesos configurables y sujetos a validación:

| Factor | Peso inicial orientativo | Qué considera |
| --- | ---: | --- |
| Sinergia aliada | 25 % | Iniciación, seguimiento, protección, daño combinado y compatibilidad. |
| Equilibrio de composición | 25 % | Perfil de daño, engage, disengage, frontline, alcance, escalado y condiciones de victoria. |
| Enfrentamientos previstos | 20 % | Matchup de línea y amenazas individuales ponderadas por confianza de rol. |
| Meta y rendimiento | 20 % | Rendimiento contextualizado por parche, rol y muestra. |
| Familiaridad del jugador | 10 % | Champion pool declarado o historial propio, cuando esté disponible. |

Estos pesos son **hipótesis de producto**, no valores demostrados. Se deberán calibrar mediante evaluación sobre drafts reales y pruebas de consistencia. Si no hay datos personales, redistribuir el peso de familiaridad de forma explícita; si faltan estadísticas, indicar menor confianza y utilizar reglas documentadas, no completar con números falsos.

Mostrar como mínimo:

- Ranking de opciones para el rol actual, sin campeones baneados ni ya ocupados.
- Puntaje de adecuación, confianza y los motivos principales a favor y en contra.
- Etiquetas breves: `teamfight`, `early`, `escalado`, `anti-tank`, `peel`, `side lane`, etc.
- Cómo cambiaría la recomendación si una asignación enemiga ambigua fuera distinta.
- Un modo de mostrar solo el champion pool preferido y otro abierto a todos los campeones válidos.
- Actualización automática sin saltos visuales innecesarios cuando se bloquea un pick.

**Criterio de aceptación:** ante un cambio de pick o un intercambio, el ranking se recalcula sin reiniciar la app, no contiene campeones ilegales y explica los factores que cambiaron.

## 5. Runas, builds y planes completos

### 5.1 Momento de cálculo

El sistema empieza a preparar candidatos desde que se conoce el campeón del usuario, y recalcula al incorporarse nueva información. Al confirmarse los diez picks, produce los planes definitivos **antes de que finalice la edición de runas**, cuando el tiempo disponible y el cliente lo permitan.

No debe esperar hasta el último instante para empezar a trabajar. Aplicar caché, cálculos incrementales y un límite de tiempo. Si el draft termina demasiado rápido o se pierde la conexión, dejar la mejor recomendación calculada hasta ese momento y marcarla como provisional.

### 5.2 Tres propuestas relacionadas

Mostrar **al menos tres opciones diferenciadas**, siempre que existan tres alternativas razonables. Cada opción es un plan integral: runas + build + secuencia de compra + explicación. No mezclar sin justificación las runas de un plan con los objetos de otro.

Tipos orientativos, no categorías obligatorias para todos los campeones:

- **Plan principal:** mejor ajuste general a la composición conocida.
- **Plan alternativo:** responde a un problema concreto: burst, tanques, poke, CC, falta de frontline, etc.
- **Plan situacional:** cambia la forma de jugar hacia escalado, supervivencia, presión temprana o peleas grupales.

Si tres planes no son defendibles, mostrar menos y explicar por qué. Está prohibido inventar diferencias superficiales para completar la cantidad.

Cada tarjeta incluirá:

- Nombre corto del enfoque.
- Runas completas: árbol principal, secundaria, fragmentos y orden cuando corresponda.
- Hechizos de invocador opcionales con justificación, sin modificarlos automáticamente.
- Objetos de inicio, botas, orden de compra, componentes intermedios y objetos finales.
- Ramas condicionales y condiciones que disparan alternativas, no una única secuencia rígida.
- Texto de una línea, por ejemplo: `Más resistencia ante burst; prioriza sobrevivir al engage.`
- Factores de selección y nivel de confianza de los datos.

### 5.3 Reglas para las builds

- Validar que todos los objetos existen y están habilitados en el parche y el modo actuales.
- No incluir objetos incompatibles, eliminados, imposibles de comprar o recetas que no se puedan completar.
- Generar una **ruta de compra ordenada**, no solo seis objetos terminados.
- Representar componentes, costes de referencia, rutas de mejora y alternativas cuando el oro disponible varíe; no fingir conocer el oro real si no se utiliza una fuente autorizada.
- Considerar tipo de daño enemigo, resistencia necesaria, escalado, sinergias del kit, composición de ambos equipos y escenario previsto.
- Distinguir una elección sugerida antes de la partida de una decisión que dependerá de cómo se desarrolle el juego.
- Conservar una ruta base visible sin necesidad de hacer consultas constantes durante la partida.
- Respetar cambios futuros de recetas, restricciones, botas y sistemas de objetos.

### 5.4 Importación de runas

El usuario quiere importar una página con un clic y, opcionalmente, activarlo automáticamente. Esta funcionalidad queda **condicionada a comprobar el endpoint disponible, el comportamiento real del cliente, su estabilidad y la política de Riot**.

Diseño previsto:

1. El usuario elige un plan o habilita previamente una preferencia de importación.
2. Se valida la composición completa de runas contra el parche vigente.
3. Se muestra claramente si la conexión con el cliente permite escribir la página.
4. Si el método está autorizado y probado, se crea/actualiza una página identificable de kahoru.lol sin sobrescribir silenciosamente páginas del usuario.
5. Si falla, se mantiene la selección manual con instrucciones breves y registro de error no sensible.

La integración de escritura debe vivir en un módulo independiente, detrás de una opción de activación, deshabilitada por defecto hasta completar su revisión. No confundir que una API local técnicamente permita una operación con que Riot la apruebe para este producto.

**Criterio de aceptación:** los planes reflejan los diez picks cuando están disponibles, contienen runas válidas y rutas de compra construibles. La interfaz responde aun cuando el proveedor estadístico no está disponible.

## 6. Estrategia previa: cómo plantear la partida

Preparar un informe breve a partir del draft, no un guion que pretenda anticipar todos los acontecimientos de la partida.

### 6.1 Contenido

- **Condición de victoria propia:** qué tipo de ventaja busca la composición (escalado, peleas agrupadas, pick-offs, split push, objetivos, etc.).
- **Condición de victoria rival:** qué evitar o qué amenaza reducir.
- **Ritmo:** fortalezas probables de early, mid y late sin convertirlas en certezas.
- **Líneas:** posible fortaleza, vulnerabilidad o volatilidad; señalar incertidumbre de matchups y roles inferidos.
- **Priorización de recursos:** líneas o campeones que pueden aprovechar una ventaja, sin instrucciones operativas en vivo.
- **Objetivos:** orientación general y posibles intercambios, no avisos automatizados en tiempo real basados en información oculta.
- **Teamfights:** engage, peel, daño prioritario, posicionamiento y condiciones para luchar.
- **Amenazas y errores a evitar:** máximo tres ideas relevantes, específicas del draft.

La aplicación debe **informar y ofrecer opciones**, no dictar decisiones. Redacciones como `Nuestra composición escala mejor; evitar peleas forzadas sin visión` son preferibles a `Gankeá top al minuto 3:20`.

### 6.2 Adaptación por rol

- **Top:** matchup, presión lateral, ventanas generales de impacto y función en peleas.
- **Jungle:** prioridades estratégicas previas, líneas con buena coordinación de gank, riesgo de perder tempo y planes de objetivos. No rutas GPS, seguimiento de jungla enemigo ni órdenes en vivo.
- **Mid:** prioridad de oleada probable, coordinación con jungle, presión lateral y acceso a objetivos.
- **Bot:** presión de línea, escalado, protección, sincronización con support y peleas alrededor de objetivos.
- **Support:** iniciativa en línea, roaming potencial, protección, control de zonas y función de engage/disengage.

**Criterio de aceptación:** dado un draft de prueba, el plan menciona amenazas y condiciones reales del escenario; evita generalidades vacías y no confunde inferencias con certezas.

## 7. Pantalla de carga y partida

Al salir del draft, la aplicación pasa a una vista compacta dedicada a la consulta. Debe conservar lo ya calculado y evitar recalcular continuamente información sin utilidad.

### 7.1 Contenido visible

- Campeón y rol propios.
- Plan elegido y dos alternativas accesibles sin ocupar pantalla permanentemente.
- Ruta de compra ordenada, incluidos componentes.
- Resumen estratégico de tres a cinco líneas, disponible bajo demanda.
- Parche y aviso discreto si los datos no corresponden al parche actual.

### 7.2 Comportamiento

- Preferencia inicial: **ventana de escritorio compacta** o segundo monitor. Overlay opcional solo tras pruebas de compatibilidad y cumplimiento.
- No dibujar sobre información crítica del juego ni imitar elementos oficiales.
- No utilizar hooks gráficos, inyección, lectura de memoria ni métodos para esquivar sistemas antitrampas.
- No mostrar notificaciones o animaciones invasivas durante la partida.
- No realizar análisis de IA pesado en segundo plano mientras se juega.
- No actualizar recomendaciones de gameplay en vivo. Durante la partida se consulta información preparada previamente.
- Permitir ocultar/mostrar con un atajo configurable, si el método de atajos es compatible.
- Si no puede confirmar que el juego se inició, mantener un modo manual y no asumir el estado.

### 7.3 Corrección de posiciones

Si aparece evidencia legítima y suficientemente sólida de que un rival ocupa una posición distinta de la inferida, corregir la presentación y conservar trazabilidad de la corrección. No prometer que la pantalla de carga revela los roles definitivos: es una hipótesis por validar en la integración real. La corrección manual siempre debe estar disponible.

## 8. Actualizaciones y datos

### 8.1 Datos estáticos oficiales

**Data Dragon:** identificadores de campeones, objetos, runas, recursos gráficos y versiones, con comprobación de disponibilidad por parche. Riot advierte que puede publicarse después del parche del cliente y que la versión del cliente puede no coincidir exactamente con Data Dragon. No suponer que `latest` equivale siempre al parche en uso.

- Consultar un manifiesto de versiones y la versión regional pertinente.
- Descargar datos en segundo plano, comprobar integridad y activar paquetes de forma atómica.
- Mantener la última versión válida disponible para recuperación.
- Mostrar `parche del juego`, `versión de datos` y `última actualización` por separado.
- Bloquear configuraciones de runas/ítems incompatibles hasta validarlas.
- Notificar de manera discreta si hay un parche nuevo con datos todavía incompletos.

### 8.2 Estadísticas y meta

**Data Dragon no proporciona, por sí solo, el meta estadístico de cada matchup.** El motor necesitará estadísticas agregadas obtenidas con permisos válidos, respetando cuotas, privacidad y términos de uso. Fuentes posibles: elaboración propia mediante Riot API cuando los permisos y el volumen lo permitan, o un proveedor autorizado con condiciones de uso compatibles. No asumir disponibilidad gratuita de datos de terceros.

Guardar con cada agregado:

- Parche o rango de parches explícito, región, cola, posición y segmento de rango.
- Tamaño de muestra y ventana temporal.
- Frecuencia de aparición, tasas observadas y margen/medida de incertidumbre si es calculable.
- Fuente, método de cálculo y fecha de generación.
- Versionado del modelo estadístico y criterios de filtrado.

Preferir datos del parche actual. En parches recién publicados, utilizar un respaldo señalado como histórico y aplicar ponderaciones conservadoras. Evitar pequeñas muestras con puntuaciones extremas; aplicar suavizado, filtros y validación de sesgos de selección. Cuando no hay datos, declarar `sin muestra suficiente`.

### 8.3 Cadencia

- Comprobar versiones al abrir y con una periodicidad moderada; respetar fallos y backoff.
- Actualizar meta según disponibilidad real de la fuente y sus límites de uso; no anunciar `en tiempo real` si el dataset se recalcula cada varias horas.
- Detectar cambios relevantes en recetas, runas o IDs y ejecutar tests de compatibilidad antes de activar el paquete.
- Permitir actualización manual y ver historial de cambios resumido.
- No bloquear el inicio del programa por no poder conectarse a Internet.

### 8.4 Evaluación del motor

Mantener una batería de drafts y casos de prueba con resultados esperados razonados. Medir estabilidad del ranking, tasa de recomendaciones inválidas, tiempos, calidad de explicación, corrección de roles y calibración de confianza. No usar un porcentaje de victoria individual como demostración de que el modelo es superior.

## 9. Funciones adicionales propuestas

Estas funciones mejoran utilidad o mantenimiento. No deben desplazar las prioridades del producto.

| Función | Valor | Prioridad |
| --- | --- | --- |
| Simulador de draft sin abrir LoL | Probar y depurar el motor desde el primer día. | Alta |
| Champion pool y favoritos por rol | Personalizar sin quedar encerrado en el meta. | Alta |
| Modo manual cuando falla el cliente | Continuar usando la app aun con cambios de API. | Alta |
| Historial de decisiones con explicación | Comparar por qué cambió una recomendación, sin recolectar información sensible. | Media |
| Diferencias entre parches | Mostrar cambios de campeones, runas y objetos que afecten el plan. | Media |
| Preferencias de estilo de juego | Priorizar daño, seguridad, iniciación o escalado dentro de opciones viables. | Media |
| Exportar plan en formato legible | Consultarlo sin tener el programa abierto. | Media |
| Estadísticas propias pospartida, con consentimiento | Aprender de partidas anteriores y revisar recomendaciones. | Futura |
| Idiomas y accesibilidad | Texto escalable, navegación por teclado y mayor contraste. | Media |
| Overlay opcional | Consulta discreta si resulta compatible y aceptable para Riot. | Condicionada |

Evitar añadir por ahora publicidad, cuentas internas, servicios de telemetría, chat público, actualizadores de terceros o pantallas sociales.

## 10. Interfaz y experiencia de uso

### 10.1 Dirección visual

- Diseño oscuro, sobrio y compacto, con jerarquía clara entre campeón, score, confianza y motivo.
- Identidad propia; no copiar directamente pantallas, marcas ni componentes de Porofessor, Blitz, iTero u otros productos.
- Animaciones discretas, sin exceso de blur, partículas o procesos de render continuos.
- Mostrar inicialmente lo importante y relegar detalles técnicos a desplegables.
- Textos breves, naturales y precisos. No usar frases genéricas de asistente ni explicaciones largas en mitad del draft.
- Interfaz inicialmente en español con estructura preparada para traducciones.

### 10.2 Pantallas

1. **Inicio:** cliente detectado, estado de datos y parche, elección de modo automático o simulador.
2. **Draft:** equipos, roles confirmados/probables, bans, ranking y razones.
3. **Planes:** tres tarjetas de runas y builds, selección e importación disponible si ha sido autorizada.
4. **Plan de juego:** resumen de win conditions, amenazas y fortalezas por fase.
5. **Partida:** vista mínima de ruta de compra con componentes y estrategia plegable.
6. **Ajustes:** región, idioma, rendimiento, champion pool, privacidad, importación, atajos y actualizaciones.
7. **Acerca de:** versión, fuente de datos, avisos legales y firma `made by frack.one`.

## 11. Arquitectura de referencia

**Decisión inicial propuesta, pendiente de un prototipo de rendimiento:** Tauri 2 + Rust para el proceso de escritorio y las integraciones locales; React + TypeScript para la interfaz; SQLite local para configuración, caché y metadatos. Priorizar pruebas y simplicidad antes de sumar servicios.

```
Interfaz React/TypeScript
       │
       ├── Estado de sesión y presentación
       │
       ├── Draft / Planes / Estrategia / Partida
       │
       └── Comunicación tipada
                 │
          Aplicación Tauri/Rust
                 │
      ┌──────────┼────────────┐
      │          │            │
  Adaptador   Motor de     Persistencia
  de cliente  decisiones   y caché local
      │          │            │
  Estado LoL   Datasets    SQLite/archivos
      │          │
   Fuentes     Cálculo por parche,
  permitidas   composición y rol
```

### 11.1 Módulos

- `client-adapter`: conexión, detección de estados y eventos normalizados; sustituible por simulador.
- `game-data`: Data Dragon, validaciones, IDs canónicos y versiones.
- `statistics`: agregados, metadatos de fuente, confianza y filtros.
- `role-inference`: hipótesis de posiciones y actualización ante nueva evidencia.
- `draft-engine`: puntuaciones de campeones, explicaciones y alternativas.
- `recommendation-engine`: runas, planes de compra y variantes coherentes.
- `strategy-engine`: análisis previo de composiciones y condiciones de victoria.
- `session`: máquina de estados, sincronización, cancelación de cálculos obsoletos.
- `storage`: preferencias, caches y contratos de migración.
- `ui`: vistas y componentes, sin lógica estadística oculta.
- `compliance`: interruptores de funciones restringidas, referencias de política y registro de decisiones.

Cada módulo tendrá interfaces tipadas, datos de prueba y un contrato público documentado. Evitar acoplar componentes visuales a endpoints concretos del cliente.

### 11.2 Contratos de datos mínimos (orientativos)

```ts
type Role = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

type RoleAssignment = {
  confirmedRole?: Role;
  probabilities?: Partial<Record<Role, number>>;
  confidence: "high" | "medium" | "low" | "unknown";
  source: "client" | "model" | "manual";
};

type DraftSnapshot = {
  sessionId: string;
  patch: string;
  mode: string;
  playerRole?: Role;
  allies: DraftSlot[];
  enemies: DraftSlot[];
  bans: number[];
  revision: number;
  updatedAt: string;
};

type PurchaseStep = {
  itemId: number;
  kind: "starter" | "component" | "completed" | "situational";
  after?: number[];
  condition?: string;
};

type GamePlan = {
  id: string;
  championId: number;
  rationale: string;
  runes: RunePage;
  purchaseOrder: PurchaseStep[];
  strategySummary: string[];
  dataPatch: string;
  confidence: "high" | "medium" | "low" | "unknown";
};
```

`DraftSlot` y `RunePage` se definirán en el primer hito técnico con validación de datos reales. Son contratos de dominio; no deben tratarse como una implementación terminada ni introducir dependencias circulares.

### 11.3 Dependencias externas

- **Necesarias:** cliente local cuando esté disponible; recursos oficiales de datos estáticos.
- **Opcionales:** API oficial para estadísticas; proveedor adicional autorizado; backend para agregados si existe necesidad real.
- **No previstas:** servicios pagos de IA por consulta, OCR permanente de la pantalla, lectura de memoria o plugins que requieran privilegios elevados.

Una API key de Riot que deba permanecer secreta no puede estar empaquetada en una aplicación distribuida: en ese caso corresponde un backend o una estrategia que no exponga credenciales. Para uso personal, respetar igualmente los términos y guardar secretos fuera del repositorio.

## 12. Rendimiento y fiabilidad

Objetivos iniciales **a medir**, no garantías:

- CPU casi inactiva mientras se espera partida; sin sondeo intensivo.
- Durante `IN_GAME`, objetivo de uso sostenido de CPU inferior a 1 % en un equipo de referencia y sin pérdida perceptible de FPS. Registrar equipo, resolución, configuración y metodología en benchmarks.
- Memoria de la aplicación contenida; objetivo inicial de menos de 200 MB en uso normal, revisable al medir WebView2 y cachés.
- Recalcular rankings en menos de 1 segundo p95 sobre un equipo de referencia una vez que están cargados los datos.
- Generar los planes finales dentro de un presupuesto de 2 segundos p95 con datos locales. El reloj del draft tiene prioridad: nunca bloquear la interfaz esperando red o modelo.
- Descargas con caché, deduplicación, límites, reintentos prudentes y ejecución fuera del hilo de interfaz.
- Recuperarse de reinicios del cliente, pérdida de conectividad y datos corruptos sin bloquear LoL.
- Preferir eventos a polling; cuando el polling sea inevitable, utilizar intervalos moderados y distintos por estado.
- Cerrar conexiones y cancelar tareas pendientes al terminar una sesión.
- Modo de reducción de actividad y opción de cerrar al entrar a partida.

Los presupuestos deben validarse en un PC modesto, no únicamente en el equipo del desarrollador.

## 13. Seguridad, privacidad y cumplimiento

### 13.1 Reglas innegociables

- No realizar lectura/escritura de memoria del juego, DLL injection, hooks de DirectX, manipulación de Vanguard ni accesos para eludir sus controles.
- Evitar funciones que proporcionen información desconocida al jugador o dicten decisiones en tiempo real.
- No recopilar datos de jugadores ocultos, identificar usuarios anonimizados ni hacer seguimiento invasivo de terceros.
- No automatizar acciones dentro de una partida.
- No almacenar claves, tokens, contraseñas, rutas sensibles o datos de autenticación en el repositorio ni en logs.
- Validar certificados HTTPS; nunca dejar globalmente deshabilitada la verificación TLS para solventar certificados locales.
- Mantener deshabilitadas las funciones que dependan de integraciones no verificadas.
- Registrar el producto y declarar usos y endpoints ante Riot cuando corresponda; las características publicadas deben reevaluarse ante cambios de política.

### 13.2 Estado de las integraciones (01/11/2026)

| Integración | Estado | Observación |
| --- | --- | --- |
| Data Dragon | Fuente oficial documentada | No representa por sí sola estadísticas de meta. |
| Riot Web API | Fuente oficial documentada | Permisos, cuotas y claves sujetos al tipo de aplicación. |
| League Client API (LCU) | Local, sin soporte oficial garantizado | Riot exige registrar/declarar su uso. Endpoints y estabilidad a verificar. |
| Game Client / Live Client Data API | Documentada, de disponibilidad local | Uso restringido a datos y finalidades admitidas; no habilita cualquier forma de coaching en vivo. |
| Escritura/importación de runas | Pendiente de verificación | No afirmar funcionamiento ni autorización sin prueba específica. |
| Overlay sobre LoL | Condicionado | Validar política, compatibilidad y consumo. No usar inyección. |
| Corrección de roles en loading | Pendiente de verificar fuente | No asumir roles confirmados por el mero orden de la pantalla de carga. |

Riot anunció que desde el 6 de octubre de 2026 comienza a impedir el acceso directo a memoria por aplicaciones de terceros desconocidas. Esta arquitectura debe funcionar sin ese acceso.

### 13.3 Aviso legal

Mostrar en una sección visible de la aplicación y el repositorio la declaración de no afiliación solicitada por Riot, conservando la versión oficial en inglés:

> kahoru.lol isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

**Créditos propios:** `made by frack.one` en la vista Acerca de, metadatos del instalador y documentación principal. No insertar cabeceras de autor repetitivas en cada archivo de código ni comentarios ornamentales.

### 13.4 Fuentes primarias

- Riot Developer Portal: https://developer.riotgames.com/
- Documentación de League of Legends, Data Dragon, LCU y Live Client API: https://developer.riotgames.com/docs/lol
- Política general: https://developer.riotgames.com/policies/general
- Política específica: https://developer.riotgames.com/policies/game-specific
- Condiciones de LoL y casos aprobados/no aprobados: https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends
- Nota sobre cambios de acceso a memoria (29/09/2026): https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps
- Portal, tipos de claves y cuotas: https://developer.riotgames.com/docs/portal

No extraer conclusiones legales permanentes de una revisión puntual. Revalidar estas fuentes antes de implementar integración de escritura, overlay, publicación o análisis de sesión.

## 14. Repositorio y convenciones

Estructura objetivo orientativa; crear solo carpetas necesarias para el hito actual:

```
.
├── README.md
├── AGENTS.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   ├── COMPLIANCE.md
│   └── decisions/
├── src/                 # interfaz
├── src-tauri/           # proceso nativo y adaptadores
├── tests/               # fixtures y pruebas de integración
├── scripts/             # actualización/validación de datos
└── .github/workflows/   # controles CI cuando haya código
```

No crear todas estas carpetas vacías desde el inicio. Añadirlas progresivamente.

### 14.1 Calidad de código y documentación

- Código idiomático, mantenible, tipado y legible; evitar abstracciones sin uso.
- Comentarios únicamente cuando expliquen una decisión no obvia, un contrato, una limitación o una referencia de seguridad.
- Documentar hipótesis y límites; no escribir marketing vacío ni afirmaciones grandilocuentes.
- Nombres descriptivos y consistentes; no usar referencias a generadores de código en archivos y comentarios.
- No fingir tests, benchmarks, capturas, fuentes de datos o funcionalidades que todavía no existen.
- No incorporar código de otros proyectos sin licencia compatible y atribución correspondiente.
- Antes de cada PR: ejecutar formatter, lint, tests relevantes, comprobación de tipos y revisión de secretos cuando existan esas herramientas.
- Cada cambio debe conservar retrocompatibilidad de los contratos públicos o incluir migración y documentación.
- No reescribir módulos estables para completar tareas que pueden resolverse de forma localizada.

### 14.2 Git y entregas

- `main` debe contener cambios comprobados; trabajar por ramas pequeñas cuando sea posible.
- Commits breves y descriptivos de lo realmente modificado.
- PR o resumen de cambio: problema, solución, pruebas realizadas, riesgos conocidos.
- Prohibido incluir `.env` reales, keys, tokens, credenciales locales, lockfiles de autenticación, logs con datos privados o artefactos gigantes sin necesidad.
- Releases versionadas con notas de cambios, versión compatible del parche y límites conocidos.

## 15. Estrategia de pruebas

### 15.1 Unitarias

- Ranking estable y dentro de límites ante drafts incompletos.
- Exclusión correcta de picks ocupados y bans.
- Inferencia de roles coherente con asignaciones confirmadas y campeones flexibles.
- Validación de runas y objetos contra datos del parche.
- Construcción de secuencias de compra sin componentes inválidos o cíclicos.
- Evaluación consistente al variar un único pick o peso.
- Etiquetas de incertidumbre coherentes con muestra y fuente.

### 15.2 Integración

- Simulador que reproduce picks, bans, swaps, última selección, dodge, remake y reconexión.
- Adaptador local simulado que funciona sin LoL instalado.
- Cambios de parche y rollback cuando un dataset nuevo es inválido.
- Fallo de red, límite de cuota, ausencia de API key, cliente cerrado inesperadamente.
- Importación de runas: primero mocks; pruebas reales únicamente cuando la integración esté validada y habilitada.
- Transiciones rápidas entre selección, loading y partida sin datos obsoletos.

### 15.3 Aceptación manual

- Cinco roles con al menos diez drafts reproducibles por rol.
- Draft con tres, cinco, ocho y diez campeones conocidos.
- Múltiples campeones flexibles y corrección manual de una posición.
- Runas completas y al menos tres planes si existen alternativas respaldadas.
- Ruta de compra con componentes y decisiones condicionales reales.
- Uso en pantalla completa, sin pantalla completa y segundo monitor si se admite overlay/ventana.
- Prueba comparativa de FPS, CPU y memoria con y sin kahoru.lol.
- Comprobación de avisos legales, procedencia del dato, parche y privacidad.

## 16. Roadmap y puertas de salida

### Fase 0 — Investigación y viabilidad

- Registrar producto en Riot Developer Portal en el momento que corresponda; describir los usos previstos.
- Confirmar con documentación y prototipos qué información de draft y cambios de fase es realmente accesible.
- Revisar límites de importación de runas, overlays y recomendaciones según políticas vigentes.
- Definir la fuente viable de estadísticas agregadas y si necesita backend.
- Crear un registro de decisiones técnicas con alternativas descartadas.

**Salida:** matriz de capacidades confirmadas/no confirmadas, fuente de datos propuesta y arquitectura inicial aprobada. No codificar un producto entero antes de resolver estos puntos.

### Fase 1 — Base ejecutable y simulador

- Crear app Tauri + React/TypeScript con tests, lint, empaquetado básico y CI.
- Implementar máquina de estados con datos de prueba.
- Implementar simulador de draft con cinco roles, picks, bans y swaps.
- Cargar un paquete de Data Dragon validado y mostrar versión de datos.
- Crear primeras pantallas de inicio, draft y ajustes.

**Salida:** un ejecutable real en Windows que puede recorrer el draft completo sin LoL instalado.

### Fase 2 — Detección de cliente

- Adaptador independiente para estados soportados del cliente.
- Pruebas manuales de detección, reconexión, cambios de estado y campeones.
- Modo manual como fallback permanente.
- Validación y documentación de los endpoints utilizados y su propósito.

**Salida:** el simulador y el cliente real producen el mismo contrato `DraftSnapshot`.

### Fase 3 — Ranking e inferencia

- Modelo de roles probabilísticos y correcciones explícitas.
- Sistema de ranking de campeones con factores y razones visibles.
- Preferencias por rol/champion pool.
- Agregados de estadísticas con calidad de muestra visible o modelo conservador sin ellas.

**Salida:** un draft nuevo actualiza un ranking defendible y explica los cambios.

### Fase 4 — Runas y rutas de compra

- Tres planes coherentes cuando existan alternativas viables.
- Runas completas validadas y orden de compra con componentes.
- Detección de diez picks, caché y cálculo incremental dentro del reloj.
- Importación opcional solo después de pruebas técnicas y revisión de cumplimiento.

**Salida:** planes reproducibles, válidos para el parche y listos antes del fin del draft cuando el tiempo lo permite.

### Fase 5 — Estrategia y vista compacta

- Informe prepartida adaptado al rol y a la composición.
- Transición a loading/in-game sin recalcular innecesariamente.
- Vista de compra minimalista y accesible, sin overlays invasivos por defecto.

**Salida:** experiencia completa de una partida de principio a fin sin impactar de forma perceptible el rendimiento.

### Fase 6 — Datos, optimización y fiabilidad

- Actualizaciones automáticas fiables de datos y manifiestos.
- Benchmarks reproducibles; optimizar consumo real, no métricas supuestas.
- Manejo de datos obsoletos, recuperación, logging seguro y robustez del instalador.
- Evaluación y ajuste del motor sobre fixtures y partidas de prueba.

**Salida:** candidata a versión estable para uso personal.

### Fase 7 — Distribución opcional

- Revisar registro/aprobación y permisos de Riot para el alcance concreto.
- Política de privacidad, licencias, atribuciones y avisos legales.
- Instalador firmado cuando corresponda, actualización de la app y notas de versión.
- Revisión de seguridad y dependencias; documentación de uso.

**Salida:** release distribuible si cumple los requisitos vigentes.

## 17. Decisiones pendientes

| Tema | Propuesta inicial | Qué falta validar |
| --- | --- | --- |
| Escritorio | Tauri 2 + React + TypeScript + Rust | Prototipo, WebView2, compatibilidad, consumo. |
| Persistencia | SQLite + caché de archivos | Tamaño de datasets y migraciones. |
| Fuente de meta | Datos agregados de Riot o proveedor con permiso | Acceso, cuota, licencia, coste, representatividad. |
| Importación | Voluntaria y reversible | Endpoint, política, comportamiento al sobrescribir páginas. |
| Overlay | Opcional, apagado inicialmente | Compatibilidad técnica y autorización. |
| Rol rival | Inferencia probabilística | Señales legítimas disponibles y calibración. |
| Localización | Español inicial | Terminología y estrategia de traducción. |
| Servidor | No incorporarlo de inicio | Necesidad de procesamiento estadístico y seguridad de claves. |
| IA generativa | No requerida para MVP | Beneficio medible frente a plantillas y reglas. |
| Actualización del ejecutable | Manual al inicio | Estrategia segura de distribución futura. |

Las decisiones nuevas se documentarán en `docs/decisions/` con contexto, opciones, elección y consecuencias.

## 18. Pautas de desarrollo

Los colaboradores deben leer **este documento y `AGENTS.md` antes de modificar código**.

- Trabajar por fases y tareas pequeñas. No implementar funcionalidades futuras sin una petición explícita.
- Identificar primero archivos y contratos afectados; proponer cambios concretos, no reestructuraciones automáticas masivas.
- Si una función depende de un endpoint de Riot, documentar su fuente y confirmar disponibilidad antes de implementar la integración.
- Diferenciar siempre: `implementado`, `simulado`, `experimental`, `pendiente de validar` y `no permitido`.
- No introducir dependencias por conveniencia sin explicar tamaño, mantenimiento y alternativa nativa.
- Ejecutar pruebas realmente; informar las que no pudieron ejecutarse.
- No inventar endpoints, resultados, políticas, win rates ni información de parche.
- Preservar la firma `made by frack.one` en los lugares visibles definidos, sin ensuciar el código.
- No llamar `completo` al producto hasta superar los criterios de aceptación de todas las fases relevantes.

## 19. Primer trabajo de implementación

**Primera implementación:** investigar y construir el esqueleto de la Fase 1, no el motor de recomendaciones definitivo. Entregar una aplicación Tauri ejecutable con navegación entre estados, simulador de draft, componentes de interfaz iniciales, tests, instrucciones de instalación y un README preciso. Mantener intactos los contratos públicos de la especificación o proponer cambios documentados antes de escribirlos.

**Antes de integrar datos reales:** confirmar que el proyecto arranca en Windows, soporta el simulador de los diez picks, actualiza el estado sin duplicados y pasa pruebas de tipos y tests. El siguiente trabajo será la investigación de la Fase 0 que todavía no esté resuelta y la validación del adaptador real.

---

**Mantenimiento:** actualizar este documento cuando cambie el alcance. Todo cambio de capacidad que dependa de Riot debe registrar su fecha de revisión y la fuente oficial consultada.
