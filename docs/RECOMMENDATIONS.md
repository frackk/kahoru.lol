# Recomendaciones

Versión 0.7.0, parche incluido 16.21. Las referencias estadísticas son por campeón y rol; no se asignan builds genéricas por clase.

La decisión actual se describe en «Constructor de 0.7». Las etapas anteriores se conservan como antecedente de la generación de referencias.

## Draft y posiciones

El catálogo contiene 173 campeones con posiciones y datos del kit obtenidos del cliente. Los 85 perfiles cualitativos anteriores aportan rasgos de composición; los demás tienen información más limitada. Cubrir el catálogo no significa haber evaluado estratégicamente todos los matchups.

El ranking usa reglas explícitas de composición, daño, iniciación, protección y rol. Parte de 50 y limita el resultado a 95. No incorpora todavía tasas de matchup ni un ranking estadístico del meta. Las selecciones confirmadas pesan 1 y los hovers aliados 0,35; son pesos de producto. Se excluyen bans y picks ocupados; un hover aliado reserva provisionalmente la opción con una penalización explicada. Al comparar reemplazos se retira el aporte del campeón propio actual.

Las hipótesis de rol rival se calculan conjuntamente, sin repetir posiciones. No son probabilidades calibradas. La posición asignada propia y la corrección manual tienen prioridad. No se consulta el inventario de campeones de la cuenta.

## Runas y compras

Hay dos fuentes distintas:

- Riot: 825 páginas por campeón y posición, sin muestras publicadas ni ajuste contra los cinco rivales. Se comprueba la posición devuelta por el endpoint; una respuesta de mid no se acepta como support.
- OP.GG: análisis agregado por campeón y rol mediante su interfaz MCP pública. Aporta núcleo, botas, inicio, opciones tardías, runas, fragmentos y spells con partidas y victorias observadas.

El proveedor no expone un selector de región o parche en el contrato utilizado. Se informa la versión de tendencias que devuelve, todos los rangos y región no informada. No se afirma una ventana temporal completa que la fuente no identifica. La página de Riot permite contrastar runas; no constituye una segunda muestra estadística independiente.

Se exige parche compatible, campos válidos y al menos 100 partidas por compra utilizada. Este umbral es conservador y no está calibrado. Si falta evidencia, no se fabrica una build. Los candidatos conservan el núcleo observado y comparan opciones tardías publicadas según los perfiles de daño y resistencias. Las botas defensivas pueden sustituirse por reglas ante tres fuentes de daño físico o mágico; el cambio se identifica sin atribuirle la muestra de las botas originales. Se muestran hasta tres rutas válidas; sus muestras separadas no equivalen a una tasa conjunta de victoria.

Las rutas comprueban recetas, ciclos, seis ranuras, restricciones por campeón e incompatibilidades conocidas. Calzado Mágico recibe las botas como condición de la runa, sin comprarlas antes; las mascotas y la misión de support conservan sus condiciones propias. Los costes son de referencia: no se observa oro real ni se compran objetos automáticamente.

La elección manual se conserva mediante IDs de objetos estables. Al entrar a partida se congela el último plan. Si el draft no se observó, no se inventa una preparación anterior.

## Ajustes contextuales de 0.5

La runa clave del proveedor se conserva. Se comparan páginas del cliente con esa misma clave: Triunfo ante varias entradas rivales o resets propios, Caminar sobre Agua para coordinación de río con al menos dos aliados confirmados con control, y opciones de curación o resistencia al control cuando están publicadas. El cambio se explica como regla, sin inventar muestras de esas páginas. Segundo Aire puede reemplazar Coraza Ósea ante un rival de línea confirmado con perfil de poke; la página se valida de nuevo antes de mostrarse.

Para bot, Limpiar puede sustituir el hechizo defensivo ante dos campeones confirmados con control removible identificado en sus kits. No se propone por supresiones o derribos aislados. Jungla conserva la combinación publicada, incluido Castigo. La importación permite conservar teclas, fijar Flash en D/F o elegir el orden exacto de los dos hechizos. Elegir el orden no escribe en el cliente: hace falta pulsar importar.

Ante varias fuentes de curación, una ruta que ya incluye un objeto de heridas graves puede adelantar su componente tras las dos primeras compras. Vesta exige un objetivo curativo que utilice ataques; no se confunde reflejar ataques con aplicar heridas a cualquier rival. El componente se consume al completar su objeto, sin comprarlo dos veces. La ruta detallada sigue disponible en un desplegable.

## Habilidades y matchups

Se solicitan secuencias y alternativas observadas de OP.GG. Se exige muestra de 100, claves Q/W/E/R y rangos legales. Cuando la fuente publica 15 niveles, se completan los restantes priorizando R al estar disponible y solo si queda una única habilidad básica legal; la interfaz distingue ese tramo inferido. Jayce y Udyr tienen límites propios; Aphelios se excluye hasta implementar sus mejoras de atributos. Datos incompletos o secuencias incompatibles muestran ausencia de evidencia, sin relleno.

En líneas, ante varias iniciaciones, el motor puede preferir una alternativa observada con las tres básicas disponibles a nivel 3. No se inventa una secuencia ni se afirma que su muestra corresponda a ese draft. El orden queda guardado con el plan y visible durante partida.

Los matchups de OP.GG se consultan para el campeón elegido. Solo se muestran contra un rival confirmado en la misma posición, con 300 partidas como mínimo. El intervalo Wilson orientativo de 95 % no corrige sesgos, redondeo de la fuente ni diferencias de habilidad; la población sigue siendo la del proveedor. No se convierte la tasa en una garantía de línea ni se aplica al ranking de todos los candidatos.

## Estrategia

En 0.5 el resumen usa tres bloques breves: apertura, recursos y peleas. Nombra aliados con control y sus habilidades, una fuente aliada de daño y herramientas rivales a respetar. Las referencias son posibilidades de coordinación, no predicciones de prioridad o de un gank exitoso. El modelo elige un hecho para apertura, uno para objetivos y hasta dos para peleas.

La lectura por reglas separa apertura, objetivos y peleas, con campeón, rol, aliados y amenazas conocidos. Los rasgos cualitativos necesitan evaluación con partidas; no demuestran ventaja de línea.

El modelo local opcional puede elegir una configuración completa entre candidatos validados y priorizar hechos para la estrategia. Recibe draft, kits y datos del plan; devuelve IDs, nunca texto libre para mostrar ni acciones del cliente. Rust rechaza IDs desconocidos, repetidos o ajenos a la operación. El formato cerrado se eligió después de observar mecánicas falsas en pruebas de redacción libre. Ver [LOCAL_MODEL.md](LOCAL_MODEL.md).

## Pendientes

Matchups para roles inferidos, uso estadístico en el ranking, comparación entre proveedores independientes, calibración por población y revisión estratégica de todos los campeones. Las referencias de compras proceden de agregados por campeón/rol. No hay un agente experto que optimice conjuntamente todo el espacio de configuraciones. Las pruebas de estructura no demuestran que una recomendación sea competitivamente mejor.

## Búsqueda conjunta de 0.6 (antecedente)

El motor anterior sirve para obtener referencias observadas, no para decidir por sí solo la configuración final. La búsqueda nueva compara todas las páginas compatibles del campeón y rol, incluidas otras runas clave. Puede proponer ajustes de filas individuales cuando las reglas y descripciones del parche lo permiten. No usa una excepción por campeón para elegir Viego o Elise.

Se generan compras alternativas según la identidad de los objetos de referencia: daño físico, AP, crítico, tanque o protección aliada. Cada candidato puede sustituir un objeto después de las dos primeras compras. Se comprueban condiciones de efectos en sus descripciones, recetas, ranuras e incompatibilidades. Se conserva una referencia sin sustituciones. Las heridas graves pueden adelantarse como componente cuando su aplicación es viable.

Las combinaciones de runas y compras se evalúan conjuntamente por contacto sostenido, intercambio corto, control, daño rival, curaciones y herramientas aliadas. Son pesos cualitativos de producto, no estimaciones de victoria. Se conservan hasta doce configuraciones con diversidad de claves; cada una tiene motivos, referencias de datos y cambios identificados. La elección explícita mantiene su configuración si sigue siendo válida al avanzar el draft.

La IA local recibe los diez kits conocidos, roles con su incertidumbre, descripciones actuales de runas y objetos, candidatos y muestras independientes. Puede elegir otra configuración, incluida otra clave y una sustitución de objeto. Devuelve un ID y hasta tres motivos de esa misma configuración; Rust rechaza selecciones ajenas y la interfaz comprueba la revisión del draft antes de aplicarlas. No importa nada al cliente por su cuenta.

El análisis local automático se ofrece al completar el draft, con un breve debounce y cancelación ante cambios. Sin modelo o si no termina a tiempo, la búsqueda por reglas mantiene planes disponibles. Durante partida se conserva la elección; un resultado tardío no puede reemplazarla.

Límite de 0.6: no se explora todo el espacio de builds, ni se calcula DPS exacto, prioridad de línea o una ruta óptima de jungla. La primera compra seguía anclada en la referencia estadística y se ensayaba una sustitución por candidato. Validez y diversidad no demuestran criterio de nivel profesional para cada matchup. El caso aportado por el usuario se usa como draft de regresión anónimo; su resultado, compras finales y runa usada no entran como respuesta esperada.

## Constructor de 0.7

`buildSearch.ts` sustituye la enumeración de una sola sustitución. Mantiene cinco estados por objetivo —equilibrio, presión y supervivencia— y revisa tantas compras como posiciones tenga la ruta. Puede cambiar varios objetos, botas, primera compra y orden. El ancho acota el coste; no es una exploración exhaustiva ni garantiza el óptimo. Conserva la referencia y la elección manual mientras sigan siendo compatibles.

Las alternativas salen de compras observadas y familias de objetos con mecánicas reconocidas en las descripciones del parche. La identidad parte de la referencia del campeón/rol: AP, ataques, luchador, asesino, tanque o protección. Se preservan mínimos de inversión ofensiva, velocidad de ataque cuando corresponde, crítico en ADC y acceso temprano a maná cuando la referencia lo usa. Un ID conocido con una descripción de efecto incompatible no habilita esa nueva alternativa.

La evaluación suma atributos fijos oficiales de los objetos: DA, PH, vida, armadura, RM, velocidad de ataque y crítico. Compara pérdida ofensiva, defensa con rendimientos decrecientes, aplicación de heridas, penetración, daño por vida, protección aliada, coste y orden. Penaliza cambios sin una compensación contextual y ciertas compras tardías adelantadas. Estos índices son heurísticos; no calculan DPS, vida efectiva exacta ni probabilidad de victoria. Data Dragon omite algunos atributos numéricos y las pasivas condicionales no se suman como atributos fijos. Las comprobaciones de exclusión de objetos son conservadoras, no un catálogo completo de restricciones oficiales.

Se cruza cada ruta retenida con páginas completas del campeón y rol y ajustes compatibles de filas. Se comparan también relaciones entre la página y la inversión en ataques/crítico. Se reservan hasta doce candidatos con distintas claves y compras. Se muestran hasta tres enfoques por runa, perfil de inversión y botas; se omiten variantes menores del mismo enfoque, aunque sigan disponibles para el evaluador. Los nombres dependen de la configuración, sin numeración que cambie al recalcular. La IA recibe atributos, índices, orden, kits y compromisos; su contrato de elección y cancelación se mantiene.

Heridas graves tiene una posición de compra propia: ante un rival de línea confirmado con curación, el componente puede preceder al primer objeto; en el caso general, va después del primer objeto. Se completa según la ruta y se consume una sola vez. No se deduce quién comprará heridas ni qué objetos comprarán los rivales.

La cobertura estructural se verifica en las 282 combinaciones de campeón y rol declaradas por el paquete del cliente, con estadísticas sintéticas identificadas. Hay regresiones de adaptación por tipo de daño, curación y frontline, además de una evaluación optativa con cachés reales de seis campeones en cinco roles. Esto amplía lo que el motor puede considerar; todavía faltan evaluación experta, calibración de pesos y mecánicas más completas para sostener una calidad estratégica general.
