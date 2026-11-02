# Continuidad del desarrollo

Punto de trabajo: 2 de noviembre de 2026, entrega 0.4.0.

## Repositorio y decisiones

- Fuente activa: `E:\Cosas\kahoru.lol`. Trabajar en `main`, como pidió el usuario.
- El PR #2 se integró en main mediante `e191579`; el núcleo de importación y proveedor se publicó en `91318f9`. La entrega siguiente reúne la interfaz y las comprobaciones descritas aquí.
- Producto: preparación real de draft, runas, spells, builds y estrategia. Nada de memoria, inyección, automatización de gameplay o indicaciones adaptadas durante partida.
- Firma `made by frack.one`. Textos concisos, sin referencias a asistentes en nombres de ramas o archivos propios.
- No hay Developer Portal configurado. El usuario pidió continuar con importación experimental para uso personal. Mantener documentado que el registro está pendiente; no afirmar aprobación particular de Riot.

## Implementado

- Lectura del cliente y continuidad entre selección/carga/partida; simulador separado.
- 173 campeones y 825 páginas oficiales por posición. Se corrigió el uso de posiciones en mayúsculas y se verifica el campo devuelto: minúsculas podían devolver mid para otro rol.
- OP.GG MCP público: compras, runas, fragmentos y spells por campeón/rol. Caché 12 h; actualización explícita con mínimo de 60 s. Sin identidades ni datasets del proveedor en Git.
- Sin builds genéricas de relleno. Candidatos con parche/muestra, rutas construibles, incompatibilidades, misión de support y Calzado Mágico.
- Hovers aliados provisionales, pool, hipótesis conjuntas de rol y plan elegido estable. Ranking cualitativo; todavía sin matchups estadísticos.
- Importación real comprobada de Viego: runas, spells, tecla de Flash, otra página del usuario, respaldo, restauración y reimportación. Quedó activa la página de kahoru.lol. No repetir escrituras como prueba automática.
- Actualización oficial con comprobación de metadatos del cliente; no activar durante draft o partida.
- Modelo local opcional Qwen3 4B con runtime llama.cpp. Pesos/runtime fuera de Git e instalador, en `.local/ai`; configuración privada del equipo. Redacción libre descartada por errores de mecánicas: el modelo solo elige hechos del motor y Rust valida sus IDs/fases.

## Validación y trabajo siguiente

Consultar `VALIDATION.md` para resultados concretos y límites. Los tests sintéticos no demuestran calidad competitiva. Pendientes de producto: evaluación estratégica de todo el catálogo, matchups, otra fuente estadística independiente, sesgos de población, medición de consumo/FPS, instalación limpia, registro de Riot y actualización segura del ejecutable.

El modelo se prepara con `npm run model:prepare -- --activate`; no subir pesos o credenciales. El instalador se genera con `npm run tauri -- build`. `--provider` y `--model` son recorridos nativos optativos; CI debe funcionar sin LoL, OP.GG ni modelo instalado.

Leer `AGENTS.md` y `PRODUCT_SPEC.md` antes de modificar código. No confundir las funciones implementadas con el roadmap completo.
