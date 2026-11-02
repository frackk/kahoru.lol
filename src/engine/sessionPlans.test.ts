import { expect, it } from "vitest";
import raw from "../../data/game-data.json";
import { SessionPlans } from "./sessionPlans";
import type { GameData } from "../gameData";
import type { DraftContext } from "./recommendations";

it("conserva el plan elegido y congela el cálculo al entrar a partida", () => {
  const store = new SessionPlans();
  const data = raw as GameData;
  const ctx: DraftContext = {
    sessionId: "one",
    playerRole: "MID",
    playerChampionId: 103,
    allies: [],
    enemies: [],
    bans: [],
  };
  const original = store.prepare(data, ctx, true)!;
  store.select("one", "magic");
  const frozen = store.prepare(
    data,
    { ...ctx, enemies: [{ championId: 32, locked: true, role: null }] },
    false,
  )!;
  expect(frozen).toBe(original);
  expect(frozen.selected).toBe("magic");
  expect(
    store.prepare(data, { ...ctx, sessionId: "other" }, false),
  ).toBeUndefined();
  expect(
    store.prepare(data, { ...ctx, playerChampionId: 99 }, true)!.selected,
  ).toBe("principal");
});
