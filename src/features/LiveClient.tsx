import { Preparation } from "./Preparation";
import { possibleRoles } from "../engine/recommendations";
import { ChampionIcon } from "../gameData";
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  roleNames,
  type Catalog,
  type DraftSlot,
  type Role,
} from "../contracts";

interface LiveSnapshot {
  sessionId: string | null;
  playerChampionId: number | null;
  mapId: number | null;
  connected: boolean;
  phase: string;
  version: string | null;
  allies: DraftSlot[];
  enemies: DraftSlot[];
  bans: number[];
  playerRole: Role | null;
  message: string;
}

const phases: Record<string, string> = {
  None: "Cliente abierto",
  Lobby: "Sala",
  Matchmaking: "Buscando partida",
  ReadyCheck: "Partida encontrada",
  ChampSelect: "Selección de campeones",
  GameStart: "Cargando partida",
  InProgress: "Partida en curso",
  Reconnect: "Reconexión a la partida",
  WaitingForStats: "Esperando resultados",
  PreEndOfGame: "Finalizando partida",
  EndOfGame: "Resultados",
};

export function LiveClient({ catalog }: { catalog: Catalog | null }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const next = await invoke<LiveSnapshot>("get_live_session");
        if (active) {
          setSnapshot(next);
          setError("");
        }
      } catch {
        if (active) setError("No se pudo consultar la conexión con LoL.");
      }
      if (active) timer = setTimeout(() => void refresh(), 1_500);
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  const inferred = possibleRoles(snapshot?.enemies ?? []);
  const name = (id: number | null) =>
    id === null
      ? "Sin revelar"
      : (catalog?.champions.find((c) => c.id === id)?.name ??
        `Campeón ${id} · Fuera del catálogo`);
  return (
    <section className="panel" aria-label="Cliente de League of Legends">
      <div className="section-row">
        <div>
          <div className="eyebrow">CLIENTE DE LEAGUE OF LEGENDS</div>
          <h2>
            {snapshot?.connected
              ? (phases[snapshot.phase] ??
                `Fase no compatible: ${snapshot.phase}`)
              : "Esperando conexión"}
          </h2>
        </div>
        <span className="badge">
          {snapshot?.connected ? "CONECTADO" : "SIN CONEXIÓN"}
        </span>
      </div>
      <p role="status">
        {error || snapshot?.message || "Buscando el cliente local…"}
      </p>
      <dl>
        <div>
          <dt>Parche del juego</dt>
          <dd>{snapshot?.version?.split("+")[0] ?? "Sin detectar"}</dd>
        </div>
        <div>
          <dt>Tu posición</dt>
          <dd>
            {snapshot?.playerRole
              ? roleNames[snapshot.playerRole]
              : "Sin confirmar"}
          </dd>
        </div>
      </dl>
      {snapshot && snapshot.allies.length > 0 && (
        <>
          <div className="teams">
            {(["allies", "enemies"] as const).map((team) => (
              <section className={`team-panel ${team}`} key={team}>
                <div className="team-header">
                  <h2>{team === "allies" ? "Tu equipo" : "Equipo rival"}</h2>
                </div>
                {snapshot[team].map((slot, i) => (
                  <div className="slot" key={i}>
                    <div className="slot-main">
                      <ChampionIcon id={slot.championId} />
                      <span>
                        <small>
                          {slot.role
                            ? roleNames[slot.role]
                            : team === "enemies" && inferred[i]?.length
                              ? `Hipótesis: ${inferred[i]!.map((r) => roleNames[r]).join(" / ")}`
                              : "Rol sin confirmar"}{" "}
                          · {slot.locked ? "Confirmado" : "Provisional"}
                        </small>
                        <strong>{name(slot.championId)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="ban-list">
            {snapshot.bans.map((id, i) => (
              <span className="badge" key={`${id}-${i}`}>
                {name(id)}
              </span>
            ))}
          </div>
        </>
      )}
      {snapshot?.sessionId && (
        <Preparation
          key={snapshot.sessionId}
          context={{
            sessionId: snapshot.sessionId,
            playerRole: snapshot.playerRole,
            playerChampionId: snapshot.playerChampionId,
            allies: snapshot.allies,
            enemies: snapshot.enemies,
            bans: snapshot.bans,
            gameVersion: snapshot.version,
          }}
          editable={snapshot.connected && snapshot.phase === "ChampSelect"}
          disabledReason={
            snapshot.mapId !== 11
              ? "Los planes actuales solo cubren la Grieta del Invocador."
              : undefined
          }
        />
      )}
      <p className="simulation-note">
        Los campeones se completan desde el cliente. Las acciones de juego se
        realizan en LoL.
      </p>
      {snapshot?.version &&
        catalog &&
        !snapshot.version.startsWith(
          catalog.version.split(".").slice(0, 2).join(".") + ".",
        ) && (
          <div className="notice">
            El catálogo {catalog.version} corresponde a otro parche. Actualizá
            los datos antes de usar recomendaciones.
          </div>
        )}
    </section>
  );
}
