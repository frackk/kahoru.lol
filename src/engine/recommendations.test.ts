import { describe, it, expect } from "vitest";
import raw from "../../data/game-data.json";
import client from "../../data/client-recommendations.json";
import spells from "../../data/knowledge/spells.json";
import type { GameData } from "../gameData";
import { profileById, profiles } from "./profiles";
import {
  recommend,
  rankChampions,
  purchaseRoute,
  validateRunes,
  possibleRoles,
  type DraftContext,
} from "./recommendations";
import { syntheticAnalysis } from "../../tests/fixtures/analysis";
const data = raw as GameData;
const slot = (championId: number, locked = true) => ({
  championId,
  locked,
  role: null,
});
const context = (championId: number | null = 234): DraftContext => ({
  sessionId: "test",
  playerRole: "JUNGLE",
  playerChampionId: championId,
  allies: [],
  enemies: [],
  bans: [],
  gameVersion: data.catalog.version,
});
describe("recomendaciones con procedencia", () => {
  it("Jinx y Miss Fortune no se clasifican como iniciación primaria", () => {
    expect(profileById.get(222)?.traits).not.toContain("engage");
    expect(profileById.get(21)?.traits).not.toContain("engage");
  });
  for (const c of client.champions) {
    it(`${c.id}: posiciones, páginas y spells del cliente válidos`, () => {
      expect(c.pages.length).toBeGreaterThan(0);
      for (const page of c.pages) {
        expect(page.sourcePosition).toBe(
          (
            {
              TOP: "TOP",
              JUNGLE: "JUNGLE",
              MID: "MIDDLE",
              BOT: "BOTTOM",
              SUPPORT: "UTILITY",
            } as Record<string, string>
          )[page.role],
        );
        expect(validateRunes(data, page)).toEqual([]);
        expect(page.spells).toHaveLength(2);
        expect(
          page.spells.every((id) => spells.spells.some((s) => s.id === id)),
        ).toBe(true);
      }
    });
  }
  it("cubre el catálogo completo sin núcleos genéricos", () => {
    expect(profiles.map((p) => p.championId).sort()).toEqual(
      data.catalog.champions.map((c) => c.id).sort(),
    );
    expect(profiles.every((p) => p.core.length === 0)).toBe(true);
    expect(new Set(profileById.get(234)!.traits).size).toBe(
      profileById.get(234)!.traits.length,
    );
    expect(profileById.get(234)!.traits).not.toContain("frontline");
  });
  it("sin fuente conserva ranking pero no inventa una build", () => {
    const r = recommend(data, context());
    expect(r.plans).toEqual([]);
    expect(r.ranking.length).toBeGreaterThan(0);
    expect(r.errors.join()).toContain("análisis");
  });
  it("la partida de Viego produce planes trazables y un planteamiento de seguimiento", () => {
    const ctx = {
      ...context(),
      allies: [82, 234, 80, 222, 432].map((id) => slot(id)),
      enemies: [113, 141, 134, 21, 50].map((id) => slot(id)),
    };
    const r = recommend(data, ctx, undefined, syntheticAnalysis());
    expect(r.errors).toEqual([]);
    expect(r.plans.length).toBeGreaterThan(0);
    for (const p of r.plans) {
      expect(p.items).toContain(3111);
      expect(
        p.items.filter((id) => [3156, 3053, 6673].includes(id)).length,
      ).toBeLessThanOrEqual(1);
      expect(p.items).toHaveLength(6);
      expect(p.runes.shards[0]).toBe(5005);
      expect(p.spells).toEqual([4, 11]);
      expect(p.strategy.join()).toContain("primer derribo");
      expect(p.strategy.join()).toContain("Dominio del Soberano");
      expect(p.items).not.toContain(3053);
      expect(p.samples.every((s) => s.play === 1000)).toBe(true);
    }
  });
  it("respeta recetas, inventario y calzado gratuito", () => {
    const r = recommend(data, context(), undefined, syntheticAnalysis());
    for (const plan of r.plans) {
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
        }
      }
      expect([...inventory].sort()).toEqual([...plan.items].sort());
      expect(
        plan.steps.some((s) => s.itemId === 2422 && s.kind === "grant"),
      ).toBe(true);
      expect(
        plan.steps.some((s) => s.itemId === 1001 && s.kind === "buy"),
      ).toBe(false);
    }
  });
  it("rechaza datos sin muestra o de otro parche", () => {
    const a = syntheticAnalysis();
    a.analysis.data.core_items.play = 12;
    expect(recommend(data, context(), undefined, a).plans).toEqual([]);
    a.analysis.data.core_items.play = 1000;
    a.analysis.data.trends.win.version = "16.20";
    expect(recommend(data, context(), undefined, a).plans).toEqual([]);
  });
  it("rechaza runas y objetos inválidos sin rellenar el plan", () => {
    const a = syntheticAnalysis();
    a.analysis.data.runes.primary_rune_ids = [999, 1, 2, 3];
    expect(recommend(data, context(), undefined, a).plans).toEqual([]);
    const b = syntheticAnalysis();
    b.analysis.data.core_items.ids = [999999, 6676, 6673];
    expect(recommend(data, context(), undefined, b).plans).toEqual([]);
  });
  it("pondera un hover de frontline menos que una confirmación", () => {
    const score = (allies: DraftContext["allies"]) =>
      rankChampions(data, { ...context(null), allies }).find(
        (c) => c.championId === 113,
      )!.score;
    expect(score([])).toBeGreaterThan(score([slot(32, false)]));
    expect(score([slot(32, false)])).toBeGreaterThan(score([slot(32, true)]));
  });
  it("distingue una reserva provisional de un pick ocupado", () => {
    const hovered = rankChampions(data, {
      ...context(null),
      allies: [slot(32, false)],
    }).find((p) => p.championId === 32);
    expect(hovered?.reasons.join()).toContain("hover");
    expect(
      rankChampions(data, { ...context(null), allies: [slot(32, true)] }).some(
        (p) => p.championId === 32,
      ),
    ).toBe(false);
  });
  it("excluye bans y filtra el pool vacío", () => {
    expect(
      rankChampions(data, { ...context(null), bans: [32] }).some(
        (p) => p.championId === 32,
      ),
    ).toBe(false);
    expect(rankChampions(data, context(null), [])).toEqual([]);
    expect(
      rankChampions(data, context(null), [64]).map((p) => p.championId),
    ).toEqual([64]);
  });
  it("no conserva el aporte del campeón reemplazado", () => {
    const base = rankChampions(data, context(null));
    const replacement = rankChampions(data, {
      ...context(),
      playerChampionId: 32,
      allies: [slot(32)],
    });
    expect(base.find((c) => c.championId === 113)!.score).toBe(
      replacement.find((c) => c.championId === 113)!.score,
    );
  });
  it("detecta ciclos de recetas", () => {
    const bad = structuredClone(data);
    bad.items.find((i) => i.id === 6672)!.from = [6672];
    expect(() =>
      purchaseRoute(bad, { ...profiles[0], starter: 1054 }, [1054], [6672]),
    ).toThrow(/ciclo/);
  });
  it("mantiene desconocidos los roles incompatibles o sin evidencia", () => {
    expect(possibleRoles([slot(999999)])).toEqual([null]);
    expect(possibleRoles([{ ...slot(103), role: "MID" }])).toEqual([["MID"]]);
  });
});
