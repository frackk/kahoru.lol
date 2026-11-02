import { describe, it, expect } from "vitest";
import raw from "../../data/game-data.json";
import type { GameData } from "../gameData";
import { profiles } from "./profiles";
import {
  possibleRoles,
  purchaseRoute,
  recommend,
  validateRunes,
  type DraftContext,
} from "./recommendations";

const data = raw as GameData;
function context(championId: number | null = 103): DraftContext {
  return {
    sessionId: "test",
    playerRole: "MID",
    playerChampionId: championId,
    allies: [],
    enemies: [],
    bans: [],
    gameVersion: data.catalog.version,
  };
}
describe("planes revisados", () => {
  for (const p of profiles)
    for (const role of p.roles)
      it(`${p.slug} ${role}: páginas y rutas construibles`, () => {
        const result = recommend(data, {
          ...context(p.championId),
          playerRole: role,
        });
        expect(result.errors).toEqual([]);
        expect(result.plans.length).toBe(3);
        for (const plan of result.plans) {
          expect(validateRunes(data, plan.runes)).toEqual([]);
          expect(new Set(plan.items).size).toBe(plan.items.length);
          expect(new Set(plan.steps.map((s) => s.id)).size).toBe(
            plan.steps.length,
          );
          expect(plan.steps.some((s) => s.kind === "combine")).toBe(true);
          const inventory: number[] = [];
          for (const step of plan.steps) {
            if (["sell", "consume", "quest"].includes(step.kind)) {
              const index = inventory.indexOf(step.itemId);
              expect(index).toBeGreaterThanOrEqual(0);
              inventory.splice(index, 1);
            } else {
              for (const id of step.consumes) {
                const index = inventory.indexOf(id);
                expect(index).toBeGreaterThanOrEqual(0);
                inventory.splice(index, 1);
              }
              inventory.push(step.itemId);
              expect(inventory.length).toBeLessThanOrEqual(6);
              expect(step.cost).toBeGreaterThanOrEqual(0);
            }
          }
        }
      });
  it("rechaza runas eliminadas, duplicadas y secundarias de la misma fila", () => {
    const page = recommend(data, context()).plans[0].runes;
    expect(
      validateRunes(data, { ...page, primaryRunes: [999, 1, 2, 3] }).length,
    ).toBeGreaterThan(0);
    expect(
      validateRunes(data, { ...page, secondaryRunes: [8226, 8275] }).length,
    ).toBeGreaterThan(0);
    expect(
      validateRunes(data, { ...page, shards: [5008, 5008, 5003] }).length,
    ).toBeGreaterThan(0);
  });
  it("desactiva reglas antiguas y no inventa perfiles", () => {
    expect(
      recommend(data, { ...context(), gameVersion: "99.1.0" }).plans,
    ).toEqual([]);
    expect(recommend(data, context(999999)).plans).toEqual([]);
  });
  it("rechaza ciclos de receta sin ocultarlos mediante compra directa", () => {
    const bad = structuredClone(data);
    const id = profiles[0].core[0];
    bad.items.find((i) => i.id === id)!.from = [id];
    expect(() => purchaseRoute(bad, profiles[0], [1054], [id])).toThrow(
      /ciclo/,
    );
  });
  it("excluye picks y bans y explica cambios de composición", () => {
    const base = {
      ...context(null),
      playerRole: "JUNGLE" as const,
      bans: [64],
      allies: [{ championId: 254, locked: true, role: null }],
    };
    const rank = recommend(data, base).ranking;
    expect(rank.some((r) => [64, 254].includes(r.championId))).toBe(false);
    expect(
      rank.every((r) => r.score >= 0 && r.score <= 100 && r.reasons.length > 0),
    ).toBe(true);
    const noFront = recommend(data, { ...base, allies: [] }).ranking;
    expect(noFront.find((r) => r.championId === 32)!.score).toBeGreaterThan(
      rank.find((r) => r.championId === 32)!.score,
    );
  });
  it("infiere roles conjuntamente y conserva la incertidumbre", () => {
    const result = possibleRoles([
      { championId: 103, locked: true, role: null },
      { championId: 1, locked: true, role: "SUPPORT" },
    ]);
    expect(result[0]).toEqual(["MID"]);
    expect(result[1]).toEqual(["SUPPORT"]);
    expect(
      possibleRoles([{ championId: 99999, locked: true, role: null }]),
    ).toEqual([null]);
  });
});
