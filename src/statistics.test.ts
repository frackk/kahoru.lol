import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { syntheticAnalysis } from "../tests/fixtures/analysis";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }));
beforeEach(() => {
  vi.resetModules();
  invoke.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

it("reutiliza datos vigentes y vuelve a consultar después de doce horas", async () => {
  const stats = await import("./statistics");
  invoke.mockImplementation(async () => ({
    ...syntheticAnalysis(),
    retrievedAt: Date.now() / 1000,
  }));
  await stats.requestStatistics(234, "JUNGLE");
  await stats.requestStatistics(234, "JUNGLE");
  expect(invoke).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(12 * 60 * 60 * 1000);
  await stats.requestStatistics(234, "JUNGLE");
  expect(invoke).toHaveBeenCalledTimes(2);
});

it("un fallo de actualización conserva la evidencia anterior y publica el error", async () => {
  const stats = await import("./statistics");
  const original = { ...syntheticAnalysis(), retrievedAt: Date.now() / 1000 };
  invoke.mockResolvedValueOnce(original);
  await stats.requestStatistics(234, "JUNGLE");
  invoke.mockRejectedValueOnce("Proveedor no disponible");
  await stats.requestStatistics(234, "JUNGLE", true);
  expect(stats.readStatistics(234, "JUNGLE")).toEqual({
    data: original,
    pending: false,
    error: "Proveedor no disponible",
  });
});

it("la comprobación conjunta limita consultas y cuenta fallos por separado", async () => {
  const stats = await import("./statistics");
  invoke.mockResolvedValue({
    ...syntheticAnalysis(),
    retrievedAt: Date.now() / 1000,
  });
  for (const id of [1, 2, 3, 4, 5, 6]) await stats.requestStatistics(id, "MID");
  invoke.mockClear();
  invoke.mockRejectedValueOnce("Sin muestra");
  expect(await stats.refreshRecentStatistics()).toEqual({
    completed: 4,
    total: 5,
  });
  expect(invoke).toHaveBeenCalledTimes(5);
});
