import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Analysis } from "./engine/analysis";
import type { Role } from "./contracts";
const entries = new Map<
  string,
  { data?: Analysis; error?: string; pending: boolean }
>();
const listeners = new Set<() => void>();
const attempts = new Map<string, number>();
let revision = 0;
function publish() {
  revision++;
  for (const l of listeners) l();
}
export function statisticsKey(championId: number, role: Role, version = "") {
  return `${championId}:${role}:${version.split(".").slice(0, 2).join(".")}`;
}
export const subscribeStatistics = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const statisticsRevision = () => revision;
export function readStatistics(
  championId: number | null,
  role: Role | null,
  version = "",
) {
  const entry =
    championId && role
      ? entries.get(statisticsKey(championId, role, version))
      : undefined;
  if (entry?.data && Date.now() / 1000 - entry.data.retrievedAt > 7 * 86400)
    return {
      ...entry,
      data: undefined,
      error:
        entry.error ??
        "La referencia tiene más de siete días. Actualizá el análisis.",
    };
  return entry;
}
export async function requestStatistics(
  championId: number,
  role: Role,
  refresh = false,
  version = "",
) {
  if (!isTauri()) return;
  const key = statisticsKey(championId, role, version);
  const cached = entries.get(key);
  if (
    !refresh &&
    cached?.data &&
    !cached.data.warning &&
    (!version ||
      cached.data.analysis.data.trends.win.version ===
        version.split(".").slice(0, 2).join(".")) &&
    Date.now() / 1000 - cached.data.retrievedAt < 43200
  )
    return;
  if (entries.get(key)?.pending) return;
  if (!refresh && Date.now() - (attempts.get(key) ?? 0) < 60_000) return;
  attempts.set(key, Date.now());
  const previous = readStatistics(championId, role, version)?.data;
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

export async function refreshRecentStatistics(version?: string) {
  const recent = [
    ...new Set(
      [...entries.keys()]
        .reverse()
        .map((key) => key.split(":").slice(0, 2).join(":")),
    ),
  ].slice(0, 5);
  let completed = 0;
  for (const key of recent) {
    const [champion, role] = key.split(":");
    const targetVersion =
      version ??
      [...entries.keys()]
        .reverse()
        .find((k) => k.startsWith(`${key}:`))
        ?.split(":")[2] ??
      "";
    await requestStatistics(
      Number(champion),
      role as Role,
      true,
      targetVersion,
    );
    const entry = entries.get(
      statisticsKey(Number(champion), role as Role, targetVersion),
    );
    if (
      entry?.data &&
      !entry.error &&
      !entry.data.warning &&
      (!targetVersion ||
        entry.data.analysis.data.trends.win.version ===
          targetVersion.split(".").slice(0, 2).join("."))
    )
      completed++;
  }
  return { completed, total: recent.length };
}
