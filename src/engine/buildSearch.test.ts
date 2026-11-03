import { expect, it } from "vitest";
import raw from "../../data/game-data.json";
import type { GameData } from "../gameData";
import {
  frontlineDraft,
  fragileDraft,
} from "../../tests/fixtures/contrasting-drafts";
import { officialPages } from "./analysis";
import { buildSearch, buildStats, compatibleItems } from "./buildSearch";
import { purchaseRoute, type DraftContext, type Plan } from "./recommendations";
import { profileById } from "./profiles";
import { searchConfigurations } from "./configurationSearch";

const data = raw as GameData;
function seed(ctx: DraftContext, items: number[]): Plan {
  return {
    id: "reference",
    title: "Referencia de prueba",
    reason: "",
    tradeoff: "",
    starter: [1102, 2003],
    items,
    questUpgrade: null,
    spells: [4, 11],
    source: "Caso sintético, sin estadísticas de victoria",
    samples: [],
    runes: officialPages(ctx.playerChampionId!, ctx.playerRole!)[0],
    adjustments: [],
    matchups: [],
    checkpoints: [],
    steps: [],
    branches: [],
    strategy: [],
    recommended: false,
  };
}
const elise = {
  ...frontlineDraft,
  playerChampionId: 60,
  playerRole: "JUNGLE" as const,
};
const apItems = [3100, 3020, 4645, 3089, 3135, 3157];
const best = (options: ReturnType<typeof buildSearch>) =>
  options.sort((a, b) => b.evaluation.score - a.evaluation.score)[0];

it("Elise puede cambiar varias compras y el primer objeto ante un frente resistente con curación", () => {
  const observed = seed(elise, apItems);
  const options = buildSearch(data, elise, [observed]);
  expect(
    options.some(
      (p) => p.evaluation.changes >= 2 && p.ids[0] !== observed.items[0],
    ),
  ).toBe(true);
  const selected = best(options);
  expect(selected.ids).toContain(6653);
  expect(selected.ids).toContain(3165);
  expect(selected.ids[0]).not.toBe(3165);
  expect(selected.evaluation.stats.ap).toBeGreaterThanOrEqual(
    buildStats(data.items.filter((i) => apItems.includes(i.id))).ap * 0.75,
  );
  expect(compatibleItems(selected.ids)).toBe(true);
});
it("el mismo campeón no conserva la respuesta anti-curación al enfrentar rivales sin esa señal suficiente", () => {
  const ctx = {
    ...fragileDraft,
    playerChampionId: 60,
    playerRole: "JUNGLE" as const,
  };
  const selected = best(buildSearch(data, ctx, [seed(ctx, apItems)]));
  expect(selected.ids).not.toContain(3165);
  expect(selected.ids).not.toContain(6653);
});
it("el daño mágico y el físico alteran la defensa sin cambiar el arquetipo AP", () => {
  const ctx = (enemies: number[]) => ({
    ...elise,
    enemies: enemies.map((championId) => ({
      championId,
      role: null,
      locked: true,
    })),
  });
  const items = [3100, 3020, 4645, 3089, 3135, 4629];
  const physical = ctx([122, 238, 91, 222, 555]);
  const magic = ctx([13, 30, 45, 63, 99]);
  const p = best(buildSearch(data, physical, [seed(physical, items)]));
  const m = best(buildSearch(data, magic, [seed(magic, items)]));
  expect(p.evaluation.stats.armor).toBeGreaterThan(m.evaluation.stats.armor);
  expect(m.evaluation.stats.mr).toBeGreaterThan(p.evaluation.stats.mr);
  expect(p.evaluation.stats.ap).toBeGreaterThan(300);
  expect(m.evaluation.stats.ap).toBeGreaterThan(300);
});
it("una mecánica que cambió deja de habilitar el objeto por su ID", () => {
  const current = structuredClone(data);
  current.items.find((i) => i.id === 3157)!.description = "Efecto desconocido";
  const items = [3100, 3020, 4645, 3089, 3135, 4629];
  expect(
    buildSearch(current, elise, [seed(elise, items)]).every(
      (p) => !p.ids.includes(3157),
    ),
  ).toBe(true);
});
it("un componente de heridas puede comprarse antes del núcleo y se consume una sola vez", () => {
  const targets = [3100, 3020, 6653, 3089, 3165, 3135];
  const steps = purchaseRoute(
    data,
    profileById.get(60)!,
    [1102, 2003],
    targets,
    undefined,
    [{ itemId: 3916, afterItems: 0 }],
  );
  const orb = steps.findIndex((s) => s.itemId === 3916);
  const first = steps.findIndex((s) => s.itemId === 3100);
  expect(orb).toBeLessThan(first);
  expect(steps.filter((s) => s.itemId === 3916)).toHaveLength(1);
  expect(steps.find((s) => s.itemId === 3165)!.consumes).toContain(3916);
});
it("rechaza posiciones de compra imposibles", () => {
  expect(() =>
    purchaseRoute(data, profileById.get(60)!, [], apItems, undefined, [
      { itemId: 3916, afterItems: -1 },
    ]),
  ).toThrow();
});
it("un jungla curativo rival no adelanta heridas por delante del primer objeto de jungla", () => {
  const ctx = {
    ...elise,
    enemies: [19, 16, 54, 202, 45].map((championId, index) => ({
      championId,
      role: index === 0 ? ("JUNGLE" as const) : null,
      locked: true,
    })),
  };
  const options = searchConfigurations(data, ctx, [
    seed(ctx, [3100, 3020, 3165, 3089, 3135, 3157]),
  ]);
  const checkpoints = options.flatMap((p) => p.checkpoints);
  expect(checkpoints.length).toBeGreaterThan(0);
  expect(
    checkpoints.every((p) => p.afterItems !== undefined && p.afterItems >= 1),
  ).toBe(true);
});
