# Recomendaciones

Versión 0.4.0, parche incluido 16.21. Se retiraron los núcleos y páginas genéricas de la versión anterior. El caso de Viego mostró que agruparlo con otros luchadores producía una build sin fundamento suficiente.

## Draft y posiciones

El catálogo contiene 173 campeones con posiciones y datos del kit obtenidos del cliente. Los 85 perfiles cualitativos anteriores aportan rasgos de composición; los demás tienen información más limitada. Cubrir el catálogo no significa haber evaluado estratégicamente todos los matchups.

El ranking usa reglas explícitas de composición, daño, iniciación, protección y rol. Parte de 50 y limita el resultado a 95. No incorpora todavía tasas de matchup ni un ranking estadístico del meta. Las selecciones confirmadas pesan 1 y los hovers aliados 0,35; son pesos de producto. Se excluyen bans y picks ocupados; un hover aliado reserva provisionalmente la opción con una penalización explicada. Al comparar reemplazos se retira el aporte del campeón propio actual.

Las hipótesis de rol rival se calculan conjuntamente, sin repetir posiciones. No son probabilidades calibradas. La posición asignada propia y la corrección manual tienen prioridad. No se consulta el inventario de campeones de la cuenta.

## Runas y compras

Hay dos fuentes distintas:

- Riot: 825 páginas por campeón y posición, sin muestras publicadas ni ajuste contra los cinco rivales. Se comprueba la posición devuelta por el endpoint; una respuesta de mid no se acepta como support.
- OP.GG: análisis agregado por campeón y rol mediante su interfaz MCP pública. Aporta núcleo, botas, inicio, opciones tardías, runas, fragmentos y spells con partidas y victorias observadas.

El proveedor no expone un selector de región o parche en el contrato utilizado. Se informa la versión de tendencias que devuelve, todos los rangos y región no informada. No se afirma una ventana temporal completa que la fuente no identifica. La página de Riot permite contrastar runas; no constituye una segunda muestra estadística independiente.

Se exige parche compatible, campos válidos y al menos 100 partidas por compra utilizada. Este umbral es conservador y no está calibrado. Si falta evidencia, no se fabrica una build. Los candidatos conservan el núcleo observado y comparan opciones tardías publicadas según los perfiles de daño y resistencias. Se muestran hasta tres rutas válidas; sus muestras separadas no equivalen a una tasa conjunta de victoria.

Las rutas comprueban recetas, ciclos, seis ranuras, restricciones por campeón e incompatibilidades conocidas. Calzado Mágico recibe las botas como condición de la runa, sin comprarlas antes; las mascotas y la misión de support conservan sus condiciones propias. Los costes son de referencia: no se observa oro real ni se compran objetos automáticamente.

La elección manual se conserva mediante IDs de objetos estables. Al entrar a partida se congela el último plan. Si el draft no se observó, no se inventa una preparación anterior.

## Estrategia

La lectura por reglas separa apertura, objetivos y peleas, con campeón, rol, aliados y amenazas conocidos. Los rasgos cualitativos necesitan evaluación con partidas; no demuestran ventaja de línea.

El modelo local opcional selecciona prioridades entre hechos preparados por el motor. Recibe el draft, kits y plan validado; devuelve IDs de hechos, nunca texto libre para mostrar. Rust rechaza IDs desconocidos, repetidos o de otra fase. No puede cambiar runas, objetos ni acciones del cliente. Esta restricción se eligió después de observar mecánicas falsas en pruebas de redacción libre. Ver [LOCAL_MODEL.md](LOCAL_MODEL.md).

## Pendientes

Matchups empíricos, comparación entre proveedores estadísticos independientes, calibración por población y revisión estratégica de todos los campeones. Las pruebas de estructura no demuestran que una recomendación sea competitivamente mejor.
