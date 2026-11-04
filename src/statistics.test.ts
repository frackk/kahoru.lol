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

it("separa el caché por parche y una respuesta tardía no pisa el parche nuevo", async () => {
  const stats = await import("./statistics");
  const old = { ...syntheticAnalysis(), retrievedAt: Date.now() / 1000 };
  const next = structuredClone(old);
  next.analysis.data.trends.win.version = "16.22";
  let finish!: (value: typeof old) => void;
  invoke.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = stats.requestStatistics(234, "JUNGLE", false, "16.21.1");
  invoke.mockResolvedValueOnce(next);
  await stats.requestStatistics(234, "JUNGLE", false, "16.22.1");
  finish(old);
  await pending;
  expect(stats.readStatistics(234, "JUNGLE", "16.22.1")?.data).toEqual(next);
  expect(stats.readStatistics(234, "JUNGLE", "16.21.1")?.data).toEqual(old);
});

it("los errores y respaldos tienen espera entre consultas automáticas", async () => {
  const stats = await import("./statistics");
  invoke.mockRejectedValueOnce("Sin red");
  await stats.requestStatistics(234, "JUNGLE", false, "16.21.1");
  await stats.requestStatistics(234, "JUNGLE", false, "16.21.1");
  expect(invoke).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(60_000);
  invoke.mockResolvedValue({
    ...syntheticAnalysis(),
    retrievedAt: Date.now() / 1000 - 43201,
    warning: "Referencia conservada",
  });
  await stats.requestStatistics(234, "JUNGLE", false, "16.21.1");
  await stats.requestStatistics(234, "JUNGLE", false, "16.21.1");
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(await stats.refreshRecentStatistics("16.21.1")).toEqual({
    completed: 0,
    total: 1,
  });
});

it("un error no mantiene evidencia vencida en una aplicación que lleva días abierta", async () => {
  const stats = await import("./statistics");
  invoke.mockResolvedValueOnce({
    ...syntheticAnalysis(),
    retrievedAt: Date.now() / 1000,
  });
  await stats.requestStatistics(234, "JUNGLE");
  vi.advanceTimersByTime((7 * 86400 + 1) * 1000);
  expect(stats.readStatistics(234, "JUNGLE")?.data).toBeUndefined();
  invoke.mockRejectedValueOnce("Sin red");
  await stats.requestStatistics(234, "JUNGLE");
  expect(stats.readStatistics(234, "JUNGLE")).toEqual({
    data: undefined,
    error: "Sin red",
    pending: false,
  });
});
