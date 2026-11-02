import { expect, it } from "vitest";
import raw from "../../data/game-data.json";
import { SessionPlans } from "./sessionPlans";
import type { GameData } from "../gameData";
import type { DraftContext } from "./recommendations";
import { syntheticAnalysis } from "../../tests/fixtures/analysis";
const data = raw as GameData;
const ctx: DraftContext = {
  sessionId: "one",
  playerRole: "JUNGLE",
  playerChampionId: 234,
  allies: [],
  enemies: [],
  bans: [],
};
it("conserva la alternativa por sus objetos y congela la preparación durante partida", () => {
  const store = new SessionPlans(() => ({
    data: syntheticAnalysis(),
    pending: false,
  }));
  const original = store.prepare(data, ctx, true)!;
  const chosen = original.result.plans.at(-1)!.id;
  store.select("one", chosen);
  const updated = store.prepare(
    data,
    { ...ctx, enemies: [{ championId: 238, locked: true, role: null }] },
    true,
  )!;
  expect(updated.selected).toBe(chosen);
  expect(store.prepare(data, { ...ctx, enemies: [] }, false)).toBe(updated);
  expect(
    store.prepare(data, { ...ctx, sessionId: "new" }, false),
  ).toBeUndefined();
});
it("la corrección manual persiste con nuevas lecturas del cliente", () => {
  const store = new SessionPlans(() => ({
    data: syntheticAnalysis(),
    pending: false,
  }));
  store.setRole("one", "JUNGLE");
  expect(
    store.prepare(data, { ...ctx, playerRole: null }, true)!.result.plans
      .length,
  ).toBeGreaterThan(0);
  expect(store.role("different")).toBeNull();
});
