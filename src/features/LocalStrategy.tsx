import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GameData } from "../gameData";
import type { DraftContext, Plan } from "../engine/recommendations";
import { strategy } from "../engine/strategy";
import { strategyContext } from "../engine/strategyContext";

export interface ModelStatus {
  directory: string;
  installed: boolean;
  model: string;
}
const saved = new Map<string, { context: string; text: string }>();
export const savedStrategy = (sessionId: string, context: string) => {
  const entry = saved.get(sessionId);
  return entry?.context === context ? entry.text : undefined;
};
export function LocalStrategy({
  data,
  context,
  plan,
  editable,
}: {
  data: GameData;
  context: DraftContext;
  plan?: Plan;
  editable: boolean;
}) {
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [, render] = useState(0);
  const active = useRef<string | null>(null);
  const payload = strategyContext(data, context, plan);
  useEffect(() => {
    void invoke<ModelStatus>("get_local_model")
      .then(setModel)
      .catch(() => setModel(null));
  }, []);
  useEffect(
    () => () => {
      if (active.current) {
        void invoke("cancel_strategy", { requestId: active.current });
        active.current = null;
      }
    },
    [payload, editable],
  );
  const previous = saved.get(context.sessionId);
  const text = previous?.context === payload ? previous.text : null;
  async function generate() {
    if (
      pending ||
      !editable ||
      !context.playerChampionId ||
      !context.playerRole
    )
      return;
    const id = crypto.randomUUID();
    active.current = id;
    setPending(true);
    setError("");
    try {
      const text = await invoke<string>("generate_strategy", {
        requestId: id,
        sessionId: context.sessionId,
        championId: context.playerChampionId,
        context: payload,
      });
      if (active.current === id) {
        saved.set(context.sessionId, { context: payload, text });
        while (saved.size > 8) saved.delete(saved.keys().next().value!);
        render((n) => n + 1);
      }
    } catch (e) {
      if (active.current === id)
        setError(
          typeof e === "string" ? e : "No se pudo preparar el texto local.",
        );
    } finally {
      if (active.current === id) active.current = null;
      setPending(false);
    }
  }
  if (!context.playerChampionId) return null;
  return (
    <section className="panel strategy" aria-label="Planteamiento previo">
      <div className="section-row">
        <h2>Planteamiento previo</h2>
        {editable && (
          <button
            disabled={pending || !model?.installed || !context.playerRole}
            onClick={() => void generate()}
          >
            {pending
              ? "Preparando en este equipo…"
              : text
                ? "Rehacer con IA local"
                : "Preparar con IA local"}
          </button>
        )}
      </div>
      {text
        ? text
            .split(/\n+/)
            .filter(Boolean)
            .map((p, i) => <p key={i}>{p}</p>)
        : (plan?.strategy ?? strategy(data, context)).map((p) => (
            <p key={p}>{p}</p>
          ))}
      <p className="small-note">
        {text
          ? `${model?.model ?? "Modelo local"} · Prioridades elegidas entre hechos del motor. No cambia las compras ni las runas y no utiliza datos de la partida en curso.`
          : "Lectura por reglas del draft. La selección de prioridades con IA es opcional y necesita el modelo configurado en Ajustes."}
      </p>
      {error && <p role="status">{error}</p>}
    </section>
  );
}

export function LocalModelSettings() {
  const [status, setStatus] = useState<ModelStatus | null>(null),
    [directory, setDirectory] = useState("");
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void invoke<ModelStatus>("get_local_model")
      .then((s) => {
        setStatus(s);
        setDirectory(s.directory);
      })
      .catch(() => setMessage("No se pudo consultar el modelo."));
  }, []);
  async function configure() {
    setPending(true);
    setMessage("");
    try {
      setStatus(
        await invoke<ModelStatus>("configure_local_model", { directory }),
      );
      setMessage(
        "Archivos verificados. Modelo listo para la preparación previa.",
      );
    } catch (e) {
      setMessage(
        typeof e === "string" ? e : "No se pudo configurar el modelo.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel settings">
      <h2>Estrategia con IA local</h2>
      <p>
        {status?.model ?? "Qwen3 4B Instruct 2507"} ·{" "}
        {status?.installed ? "Configurado" : "Sin configurar"}
      </p>
      <p>
        Descarga opcional de unos 2,5 GB, separada del instalador. Se ejecuta a
        pedido antes de la partida y se libera al terminar. El draft se procesa
        en este equipo.
      </p>
      <label>
        Carpeta del modelo
        <input
          aria-label="Carpeta del modelo"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          spellCheck={false}
          placeholder="Carpeta preparada con el modelo y su runtime"
        />
      </label>
      <button disabled={pending || !directory} onClick={() => void configure()}>
        {pending ? "Verificando archivos…" : "Verificar y usar modelo"}
      </button>
      <p className="small-note">
        Preparación de los archivos: instrucciones en docs/LOCAL_MODEL.md. El
        análisis por reglas sigue disponible sin descargar el modelo.
      </p>
      <p role="status">{message}</p>
    </section>
  );
}
