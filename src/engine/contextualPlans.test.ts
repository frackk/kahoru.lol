import { describe, expect, it } from "vitest";
import raw from "../../data/game-data.json";
import type { GameData } from "../gameData";
import { syntheticAnalysis } from "../../tests/fixtures/analysis";
import { officialPages } from "./analysis";
import { contextualLoadout } from "./loadoutContext";
import { skillOrder } from "./skillOrder";
import { matchupEvidence } from "./matchups";
import {
  recommend,
  purchaseRoute,
  validateRunes,
  type DraftContext,
} from "./recommendations";
import { profileById } from "./profiles";
import { strategy } from "./strategy";

const data = raw as GameData;
const slot = (
  championId: number,
  role: DraftContext["playerRole"] = null,
  locked = true,
) => ({ championId, role, locked });
const context = (): DraftContext => ({
  sessionId: "context",
  playerRole: "JUNGLE",
  playerChampionId: 60,
  allies: [
    slot(60, "JUNGLE"),
    slot(80, "MID"),
    slot(89, "SUPPORT"),
    slot(222, "BOT"),
  ],
  enemies: [slot(11, "JUNGLE"), slot(81, "BOT")],
  bans: [],
});

describe("configuraciones según draft", () => {
  it("Elise conserva la clave, pero cambia la secundaria entre coordinación de río y varias entradas", () => {
    const ctx = context();
    const base = officialPages(60, "JUNGLE")[0];
    const river = contextualLoadout(data, ctx, base, [4, 11]);
    const defensive = contextualLoadout(
      data,
      { ...ctx, enemies: [slot(113), slot(32), slot(54)] },
      base,
      [4, 11],
    );
    expect(river.runes.secondaryRunes).toContain(8232);
    expect(defensive.runes.secondaryRunes).toContain(9111);
    expect(river.runes.primaryRunes[0]).toBe(base.primaryRunes[0]);
    expect(validateRunes(data, river.runes)).toEqual([]);
    expect(validateRunes(data, defensive.runes)).toEqual([]);
    expect(defensive.spells).toContain(11);
  });
  it("los hovers no activan reglas que requieren aliados confirmados", () => {
    const ctx = context();
    const base = officialPages(60, "JUNGLE")[0];
    const plan = contextualLoadout(
      data,
      { ...ctx, allies: ctx.allies.map((s) => ({ ...s, locked: false })) },
      base,
      [4, 11],
    );
    expect(plan.runes.secondaryRunes).toEqual(base.secondaryRunes);
  });
  it("Limpiar se propone para bot ante control removible, no por una supresión aislada", () => {
    const ctx = {
      ...context(),
      playerRole: "BOT" as const,
      playerChampionId: 222,
    };
    const base = officialPages(222, "BOT")[0];
    expect(
      contextualLoadout(
        data,
        { ...ctx, enemies: [slot(1), slot(99)] },
        base,
        [21, 4],
      ).spells,
    ).toEqual([4, 1]);
    expect(
      contextualLoadout(data, { ...ctx, enemies: [slot(90)] }, base, [21, 4])
        .spells,
    ).toEqual([21, 4]);
  });
  it("cambia las botas con daño físico o mágico concentrado y explica la sustitución", () => {
    const ctx = { ...context(), playerChampionId: 234 };
    const physical = recommend(
      data,
      { ...ctx, enemies: [slot(11), slot(222), slot(122), slot(80)] },
      undefined,
      syntheticAnalysis(),
    ).plans[0];
    const magic = recommend(
      data,
      { ...ctx, enemies: [slot(1), slot(99), slot(134), slot(50)] },
      undefined,
      syntheticAnalysis(),
    ).plans[0];
    expect(physical.items).toContain(3047);
    expect(magic.items).toContain(3111);
    expect(magic.adjustments.join()).toContain("mágico");
    expect(magic.recommended).toBe(true);
  });
  it("descarta una compra incompatible antes de completar las alternativas", () => {
    const a = syntheticAnalysis();
    a.analysis.data.fifth_items.unshift({ ids: [3156], play: 1000, win: 500 });
    const result = recommend(
      data,
      {
        ...context(),
        playerChampionId: 234,
        enemies: [slot(1), slot(99), slot(134)],
      },
      undefined,
      a,
    );
    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans[0].recommended).toBe(true);
    expect(result.plans.every((p) => !p.items.includes(3156))).toBe(true);
  });
  it("la estrategia es breve, nombra herramientas del draft y cambia con los aliados", () => {
    const first = strategy(data, context());
    const second = strategy(data, {
      ...context(),
      allies: [slot(60, "JUNGLE"), slot(11, "TOP")],
    });
    expect(first.join()).toContain("Pantheon");
    expect(first.join()).toContain("Jinx");
    expect(first.join().length).toBeLessThan(1000);
    expect(second).not.toEqual(first);
  });
});

describe("habilidades y evidencia", () => {
  const analysis = () => {
    const a = syntheticAnalysis();
    a.analysis.data.skills = {
      order: [
        "Q",
        "W",
        "E",
        "Q",
        "Q",
        "R",
        "Q",
        "W",
        "Q",
        "W",
        "R",
        "W",
        "W",
        "E",
        "E",
      ],
      play: 1000,
      win: 500,
    };
    return a;
  };
  it("completa 16–18 por reglas y rechaza una secuencia ilegal", () => {
    const a = analysis();
    expect(skillOrder(context(), a)?.order).toEqual([
      ...a.analysis.data.skills!.order,
      "R",
      "E",
      "E",
    ]);
    expect(skillOrder(context(), a)?.observedLevels).toBe(15);
    a.analysis.data.skills!.order[0] = "R";
    expect(skillOrder(context(), a)).toBeUndefined();
  });
  it("no inventa habilidades sin fuente, con poca muestra o para los atributos de Aphelios", () => {
    expect(skillOrder(context(), syntheticAnalysis())).toBeUndefined();
    const a = analysis();
    a.analysis.data.skills!.play = 5;
    expect(skillOrder(context(), a)).toBeUndefined();
    expect(
      skillOrder({ ...context(), playerChampionId: 523 }, analysis()),
    ).toBeUndefined();
  });
  it("ofrece una variante observada con utilidades tempranas ante varias entradas en línea", () => {
    const a = analysis();
    a.analysis.data.skills!.order = [
      "Q",
      "W",
      "Q",
      "E",
      "Q",
      "R",
      "Q",
      "W",
      "Q",
      "W",
      "R",
      "W",
      "W",
      "E",
      "E",
    ];
    a.analysis.data.skill_masteries = {
      builds: [{ ...analysis().analysis.data.skills!, play: 500 }],
    };
    const ctx = {
      ...context(),
      playerRole: "MID" as const,
      enemies: [slot(32), slot(113)],
    };
    expect(skillOrder(ctx, a)?.order[2]).toBe("E");
  });
  it("solo publica matchups para una posición confirmada y muestra suficiente", () => {
    const a = analysis();
    a.analysis.data.weak_counters = [
      { champion_id: 113, play: 681, win: 306, my_win_rate: 0.45 },
    ];
    const ctx = { ...context(), enemies: [slot(113, "JUNGLE")] };
    const result = matchupEvidence(ctx, a)[0];
    expect(result.lower).toBeLessThan(0.45);
    expect(result.upper).toBeGreaterThan(0.45);
    expect(matchupEvidence({ ...ctx, enemies: [slot(113)] }, a)).toEqual([]);
    a.analysis.data.weak_counters[0].play = 20;
    expect(matchupEvidence(ctx, a)).toEqual([]);
  });
});

it("adelanta Orbe del Olvido, lo consume una sola vez y conserva las seis ranuras", () => {
  const route = purchaseRoute(
    data,
    { ...profileById.get(60)!, roles: ["JUNGLE"] },
    [1102, 2003],
    [6655, 3020, 3089, 3165, 3135, 3157],
    undefined,
    [3916],
  );
  expect(
    route.filter((s) => s.itemId === 3916 && s.kind === "combine"),
  ).toHaveLength(1);
  expect(route.findIndex((s) => s.itemId === 3916)).toBeLessThan(
    route.findIndex((s) => s.itemId === 3089),
  );
  expect(route.find((s) => s.itemId === 3165)?.consumes).toContain(3916);
  const inventory: number[] = [];
  for (const step of route) {
    if (["quest", "consume", "sell"].includes(step.kind))
      inventory.splice(inventory.indexOf(step.itemId), 1);
    else {
      for (const id of step.consumes) {
        const index = inventory.indexOf(id);
        expect(index).toBeGreaterThanOrEqual(0);
        inventory.splice(index, 1);
      }
      inventory.push(step.itemId);
      expect(inventory.length).toBeLessThanOrEqual(6);
    }
  }
  expect(inventory).toHaveLength(6);
});
