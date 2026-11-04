import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DraftSlot, Role, MapSide } from "./contracts";
import type { GameData } from "./gameData";
import { sessionPlans } from "./engine/sessionPlans";
import { requestStatistics } from "./statistics";

export interface LiveSnapshot {
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
  playerSide: MapSide | null;
  message: string;
}

export function useLiveSession(data: GameData | null) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri() || !data) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      let delay = 3000;
      try {
        const next = await invoke<LiveSnapshot>("get_live_session");
        if (!active) return;
        if (next.sessionId && next.mapId === 11) {
          const role = sessionPlans.role(next.sessionId) ?? next.playerRole;
          if (
            next.connected &&
            next.phase === "ChampSelect" &&
            next.playerChampionId &&
            role
          )
            void requestStatistics(
              next.playerChampionId,
              role,
              false,
              data.catalog.version,
            );
          sessionPlans.prepare(
            data,
            {
              sessionId: next.sessionId,
              playerRole: next.playerRole,
              playerChampionId: next.playerChampionId,
              allies: next.allies,
              enemies: next.enemies,
              bans: next.bans,
              gameVersion: next.version,
              playerSide: next.playerSide,
            },
            next.connected && next.phase === "ChampSelect",
          );
        }
        setSnapshot(next);
        setError("");
        delay =
          next.phase === "ChampSelect"
            ? 1500
            : next.phase === "InProgress"
              ? 10000
              : 3000;
      } catch {
        if (active) setError("No se pudo consultar la conexión con LoL.");
      }
      if (active) timer = setTimeout(() => void refresh(), delay);
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data]);
  return { snapshot, error };
}
