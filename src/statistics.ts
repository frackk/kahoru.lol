import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Analysis } from "./engine/analysis";
import type { Role } from "./contracts";
const entries = new Map<
  string,
  { data?: Analysis; error?: string; pending: boolean }
>();
const listeners = new Set<() => void>();
let revision = 0;
function publish() {
  revision++;
  for (const l of listeners) l();
}
export function statisticsKey(championId: number, role: Role) {
  return `${championId}:${role}`;
}
export const subscribeStatistics = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const statisticsRevision = () => revision;
export function readStatistics(championId: number | null, role: Role | null) {
  return championId && role
    ? entries.get(statisticsKey(championId, role))
    : undefined;
}
export async function requestStatistics(
  championId: number,
  role: Role,
  refresh = false,
) {
  if (!isTauri()) return;
  const key = statisticsKey(championId, role);
  const cached = entries.get(key);
  if (
    !refresh &&
    cached?.data &&
    Date.now() / 1000 - cached.data.retrievedAt < 43200
  )
    return;
  if (entries.get(key)?.pending) return;
  const previous = entries.get(key)?.data;
  entries.set(key, { data: previous, pending: true });
  publish();
  try {
    const data = await invoke<Analysis>("get_champion_analysis", {
      championId,
      role,
      refresh,
    });
    entries.set(key, { data, pending: false });
  } catch (e) {
    entries.set(key, {
      data: previous,
      pending: false,
      error: typeof e === "string" ? e : "No se pudo consultar el análisis.",
    });
  }
  publish();
}

export async function refreshRecentStatistics() {
  const recent = [...entries.keys()].reverse().slice(0, 5);
  let completed = 0;
  for (const key of recent) {
    const [champion, role] = key.split(":");
    await requestStatistics(Number(champion), role as Role, true);
    if (!entries.get(key)?.error) completed++;
  }
  return { completed, total: recent.length };
}
