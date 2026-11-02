import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GameData } from "../gameData";
import type { DraftContext, Recommendation } from "../engine/recommendations";
import { configurationContext } from "../engine/configurationContext";
import type { ModelStatus } from "./LocalStrategy";

export function ConfigurationAnalysis({
  data,
  context,
  result,
  selectedId,
  editable,
  choice,
  onChoose,
}: {
  data: GameData;
  context: DraftContext;
  result: Recommendation;
  selectedId: string;
  editable: boolean;
  choice?: { planId: string; reasons: string[] };
  onChoose: (id: string, reasons: string[], previous: string) => boolean;
}) {
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ signature: "", text: "" });
  const setMessage = (text: string) =>
    setFeedback({ signature: result.signature, text });
  const message = feedback.signature === result.signature ? feedback.text : "";
  const [automatic, setAutomatic] = useState(() => {
    try {
      return localStorage.getItem("kahoru.configuration-auto.v1") !== "false";
    } catch {
      return false;
    }
  });
  const active = useRef<string | null>(null),
    attempted = useRef("");
  const payload = configurationContext(data, context, result.candidates ?? []);
  const generationKey = result.signature + payload;
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
    [payload, selectedId, editable, result.signature],
  );
  async function analyze() {
    if (pending || !editable || !model?.installed || !result.candidates?.length)
      return;
    const id = crypto.randomUUID();
    active.current = id;
    attempted.current = generationKey;
    setPending(true);
    setMessage("");
    try {
      const raw = await invoke<string>("analyze_configuration", {
        requestId: id,
        sessionId: context.sessionId,
        championId: context.playerChampionId,
        context: payload,
      });
      const answer: unknown = JSON.parse(raw);
      if (active.current !== id) return;
      if (
        !answer ||
        typeof answer !== "object" ||
        !("planId" in answer) ||
        typeof answer.planId !== "string" ||
        !("reasonIds" in answer) ||
        !Array.isArray(answer.reasonIds) ||
        !answer.reasonIds.every((r): r is string => typeof r === "string")
      )
        throw Error("La elección local no corresponde al contrato.");
      const accepted = onChoose(answer.planId, answer.reasonIds, selectedId);
      setMessage(
        accepted
          ? "Configuración elegida con el análisis local. Revisá los motivos antes de importar."
          : "El draft o la selección cambiaron; se descartó el resultado anterior.",
      );
    } catch (e) {
      if (active.current === id)
        setMessage(
          typeof e === "string"
            ? e
            : e instanceof Error
              ? e.message
              : "No se pudo analizar la configuración.",
        );
    } finally {
      if (active.current === id) active.current = null;
      setPending(false);
    }
  }
  const analyzeLatest = useRef(analyze);
  useEffect(() => {
    analyzeLatest.current = analyze;
  });
  const complete =
    context.allies.length === 5 &&
    context.enemies.length === 5 &&
    context.allies
      .concat(context.enemies)
      .every((s) => s.championId && s.locked);
  useEffect(() => {
    if (
      !automatic ||
      !editable ||
      !model?.installed ||
      pending ||
      attempted.current === generationKey ||
      !complete
    )
      return;
    const timer = setTimeout(() => void analyzeLatest.current(), 1500);
    return () => clearTimeout(timer);
  }, [automatic, editable, model?.installed, pending, generationKey, complete]);
  if (!result.candidates?.length) return null;
  return (
    <section
      className="panel configuration-analysis"
      aria-label="Análisis de configuración"
    >
      <div className="section-row">
        <h2>Runas y build para este draft</h2>
        {editable && (
          <button
            disabled={pending || !model?.installed}
            onClick={() => void analyze()}
          >
            {pending
              ? "Comparando configuraciones…"
              : "Analizar configuración con IA"}
          </button>
        )}
      </div>
      <p>
        El motor compara páginas completas y compras compatibles con ambos
        equipos. La IA local evalúa las alternativas junto con las habilidades,
        runas y objetos del parche.
      </p>
      {editable && (
        <label>
          <input
            type="checkbox"
            checked={automatic}
            onChange={(e) => {
              setAutomatic(e.target.checked);
              try {
                localStorage.setItem(
                  "kahoru.configuration-auto.v1",
                  String(e.target.checked),
                );
              } catch {
                setMessage("No se pudo guardar la preferencia.");
              }
            }}
          />{" "}
          Analizar con IA al completar el draft
        </label>
      )}
      {choice?.planId === selectedId && (
        <div className="notice">
          <strong>Motivos del análisis local</strong>
          {choice.reasons.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {!model?.installed && editable && (
        <p className="small-note">
          Configurá el modelo local en Ajustes para comparar con IA. El análisis
          por reglas ya está activo.
        </p>
      )}
      <small>
        {result.candidates.length} configuraciones verificadas para esta
        comparación. El análisis no importa cambios al cliente por su cuenta.
      </small>
    </section>
  );
}
