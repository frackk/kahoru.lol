import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RunePage } from "../engine/recommendations";
import spellData from "../../data/knowledge/spells.json";
type SpellOrder = "preserve" | "recommended" | "reverse" | "flashD" | "flashF";
interface Props {
  championId: number;
  sessionId: string;
  runes: RunePage;
  spells: number[];
  enabled: boolean;
}
interface Target {
  id: number;
  name: string;
  current: boolean;
  canRestore: boolean;
}
export function ImportButtons({
  championId,
  sessionId,
  runes,
  spells,
  enabled,
}: Props) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [targets, setTargets] = useState<Target[] | null>(null),
    [target, setTarget] = useState<number | null>(null);
  const [spellOrder, setSpellOrder] = useState<SpellOrder>(() => {
    try {
      const saved = localStorage.getItem("kahoru.spell-order.v1");
      return saved === "recommended" ||
        saved === "reverse" ||
        saved === "flashD" ||
        saved === "flashF"
        ? saved
        : "preserve";
    } catch {
      return "preserve";
    }
  });
  const spellName = (id: number) =>
    spellData.spells.find((s) => s.id === id)?.name ?? String(id);
  async function loadTargets() {
    try {
      setTargets(await invoke<Target[]>("get_import_targets"));
    } catch (e) {
      setMessage(
        typeof e === "string" ? e : "No se pudieron consultar las páginas.",
      );
    }
  }
  async function apply(mode: "runes" | "both" | "spells") {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const result = await invoke<{
        runesApplied: boolean;
        spellsApplied: boolean;
        message: string;
      }>("import_loadout", {
        request: {
          championId,
          sessionId,
          runes: mode === "spells" ? null : runes,
          spells: mode === "runes" ? null : spells,
          replacementPageId: target,
          spellOrder,
        },
      });
      setMessage(
        `${mode !== "spells" ? `Runas: ${result.runesApplied ? "aplicadas" : "sin confirmar"}. ` : ""}${mode !== "runes" ? `Spells: ${result.spellsApplied ? "aplicados" : "sin confirmar"}. ` : ""}${result.message}`,
      );
      if (targets) await loadTargets();
    } catch (e) {
      setMessage(
        typeof e === "string" ? e : "No se pudo completar la importación.",
      );
    } finally {
      setPending(false);
    }
  }
  async function restore() {
    if (!target || pending) return;
    setPending(true);
    try {
      setMessage(
        await invoke<string>("restore_import", {
          pageId: target,
          championId,
          sessionId,
        }),
      );
      await loadTargets();
    } catch (e) {
      setMessage(typeof e === "string" ? e : "No se pudo restaurar.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="import-controls">
      {spells.length === 2 && (
        <label>
          Orden de hechizos
          <select
            aria-label="Orden de hechizos"
            value={spellOrder}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as SpellOrder;
              setSpellOrder(next);
              try {
                localStorage.setItem("kahoru.spell-order.v1", next);
              } catch {
                setMessage("No se pudo guardar el orden de hechizos.");
              }
            }}
          >
            <option value="preserve">Conservar las teclas del cliente</option>
            <option value="flashD">
              Flash siempre en D, cuando se recomiende
            </option>
            <option value="flashF">
              Flash siempre en F, cuando se recomiende
            </option>
            <option value="recommended">
              D: {spellName(spells[0])} · F: {spellName(spells[1])}
            </option>
            <option value="reverse">
              D: {spellName(spells[1])} · F: {spellName(spells[0])}
            </option>
          </select>
        </label>
      )}
      <div className="import-actions">
        <button
          disabled={!enabled || pending}
          onClick={() => void apply("runes")}
        >
          {pending ? "Aplicando…" : "Importar runas"}
        </button>
        <button
          disabled={!enabled || pending || spells.length !== 2}
          onClick={() => void apply("both")}
        >
          Importar runas y spells
        </button>
        <button
          disabled={!enabled || pending || spells.length !== 2}
          onClick={() => void apply("spells")}
        >
          Aplicar solo spells
        </button>
      </div>
      <p className="small-note">
        {enabled
          ? "Aplica el orden elegido. Si no hay ranuras libres para runas, elegí una página para reutilizar con respaldo."
          : "Disponible en la selección real del cliente, antes de entrar a partida."}
      </p>
      {enabled && (
        <details
          onToggle={(e) => {
            if (e.currentTarget.open && targets === null) void loadTargets();
          }}
        >
          <summary>Página de destino y restauración</summary>
          <label>
            Destino{" "}
            <select
              aria-label="Página de destino"
              value={target ?? ""}
              disabled={pending}
              onChange={(e) =>
                setTarget(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Crear o usar página propia</option>
              {targets?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.current ? " · activa" : ""}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <p className="small-note">
              Se reemplazará esta página y se guardará una copia local de su
              configuración anterior.
            </p>
          )}
          {targets?.find((t) => t.id === target)?.canRestore && (
            <button disabled={pending} onClick={() => void restore()}>
              Restaurar página anterior
            </button>
          )}
        </details>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
