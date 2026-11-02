# Verificación

Fecha: 2026-11-02. Versión 0.4.0. Equipo local: Windows 11 x64, Ryzen 7 5700X, RTX 3060 de 12 GB, Node 24.22.1, Rust 1.99.1 y WebView2. Fuente: `E:\Cosas\kahoru.lol`.

## Núcleo e interfaz

- TypeScript: 198 pruebas de contratos, catálogo, páginas, compras, hovers, pool, hipótesis y continuidad. Incluyen regresión de Viego, Calzado Mágico, objetos incompatibles y contextos estratégicos para los cinco roles.
- Rust: 24 pruebas automáticas; cuatro integraciones optativas con cliente, descargas, proveedor o modelo. Parser del proveedor sin evaluación, validación de importación, resultados parciales, respaldo/restauración y selección de hechos.
- Formato, ESLint, tipos, Rustfmt y Clippy se ejecutan con las comprobaciones del repositorio. El CI anterior de `91318f9` falló por formato del script de recomendaciones; ese archivo se corrigió en esta entrega.
- Recorrido nativo offline: diez picks, runas e imágenes decodificadas, bans, cinco roles, swaps, fases, reconexión y preferencias. Usa IPC y WebView2 reales.
- `--provider`: consulta real de OP.GG para la composición de Viego, construye planes y conserva la elección manual al entrar en partida. Las consultas de Viego y Lee Sin también pasaron en el adaptador Rust.
- `--model`: generación nativa con Qwen3 4B instalado, tres fases formadas solo con hechos validados. Comprobado en depuración. Captura y texto en `test-results/strategy-model.*`, fuera de Git. No confundir selección de prioridades con demostración de calidad estratégica.

## Cliente y actualizaciones

Conexión real con TLS validado en una personalizada, cliente 16.21.8342754. Se detectaron fase, equipo y campeón. La importación autorizada reutilizó la página activa con respaldo: runas y spells leídos después de aplicar, Flash en su tecla, otra página preservada, restauración y reimportación correctas. No se inició una partida desde la app.

El paquete incluido se valida contra catálogo, recetas e imágenes. La integración de descarga completa de Data Dragon pasó en la etapa anterior. En 0.4 se prueba además la recuperación de metadatos inválidos y la coincidencia entre rol pedido y devuelto; no se afirma haber probado un parche futuro real.

Las integraciones optativas no corren por defecto en CI. El cliente real no se modifica automáticamente durante los tests. Las muestras estadísticas de fixtures son sintéticas, no datos redistribuidos del proveedor.

## Distribución y pendientes

El instalador NSIS se genera en `src-tauri/target/release/bundle/nsis/`. No incluye los pesos ni el runtime del modelo, que son opcionales y se preparan aparte con hashes fijados. No está firmado como editor.

Faltan instalación limpia, Windows 10, equipos modestos, una partida completa con medición de FPS/CPU/memoria, swaps entre diez jugadores, reinicios durante carga y evaluación estratégica de todos los campeones. No hay una comparación estadística independiente con iTero ni evidencia de mejora de win rate.

El workflow Windows comprueba formato, lint, pruebas, ejecutables de depuración/release, recorridos nativos offline e instalador. Su resultado debe consultarse por commit; las pruebas locales no sustituyen el CI.
