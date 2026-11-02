# Modelo local

Implementación opcional de 0.4.0. El programa funciona sin modelo; en ese caso conserva la preparación por reglas.

## Uso

En este equipo los archivos se preparan en `E:\Cosas\kahoru.lol\.local\ai`. Están excluidos de Git y del instalador. Para reproducir la instalación desde el repositorio:

```powershell
npm run model:prepare -- --activate
```

El script descarga unos 2,5 GB, verifica SHA-256, extrae el runtime dentro de su carpeta y guarda licencias. `--activate` configura esa carpeta para la instalación local de kahoru.lol; sin ese argumento solo prepara los archivos. También se puede indicar la carpeta en Ajustes y verificarla allí. No es un descargador integrado en el instalador.

En preparación, usar **Preparar con IA local**. El cálculo es a pedido, antes de entrar en partida. Se conserva su resultado en memoria para esa sesión. No se envía el draft a servicios de IA.

## Diseño y límites

Modelo: [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), Apache 2.0. Cuantización Q4_K_M de bartowski publicada por [LM Studio Community](https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF), revisión fijada en el script. Runtime: [llama.cpp b11960](https://github.com/ggml-org/llama.cpp/releases/tag/b11960), MIT, Windows x64 Vulkan.

El modelo elige uno o dos hechos de cada fase: apertura, objetivos y peleas. La respuesta usa un esquema JSON cerrado y se valida otra vez en Rust. La aplicación une los textos propios correspondientes a esos IDs. No muestra prosa libre del modelo, porque las primeras pruebas inventaron interacciones de habilidades. Seleccionar prioridades tampoco acredita calidad competitiva: hace falta evaluación humana con drafts.

El proceso escucha solo en loopback, con una clave efímera, sin herramientas ni acceso al cliente. Los archivos ejecutables y DLL esperados están fijados en `data/local-model.json`; el modelo también se verifica antes de ejecutarlo. Un Job Object de Windows libera el runtime y sus hijos al cerrarse. Se cancela si cambia el contexto, empieza la partida o vence el límite de generación. Solo una petición puede ejecutarse a la vez.

La GPU se usa durante la preparación, no durante la consulta del plan en partida. Vulkan permite usar GPU compatibles; no se garantiza el mismo tiempo en CPU o equipos modestos. El objetivo de menos de 200 MB de la app no incluye una inferencia opcional que carga varios GB temporalmente.

La cobertura estratégica depende de los hechos del motor, todavía limitados. El modelo no consulta Internet, no aprende automáticamente de notas del parche y no calibra builds ni matchups.
