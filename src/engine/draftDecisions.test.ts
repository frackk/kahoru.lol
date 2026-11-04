import { expect, it } from "vitest";
import raw from "../../data/game-data.json";
import type { GameData } from "../gameData";
import { championTools } from "./championTools";
import { draftSignals, laneOpponent } from "./draftSignals";
import { compatibleItems } from "./buildSearch";
import { combineMechanics, itemMechanics } from "./itemMechanics";
import { createRuneEvaluator, expandRunePages, runeKey } from "./runeSearch";
import { officialPages } from "./analysis";
import { recommend, rankChampions, validateRunes } from "./recommendations";
import { novemberDraft } from "../../tests/fixtures/november-draft";
import {
  frontlineDraft,
  fragileDraft,
} from "../../tests/fixtures/contrasting-drafts";
import { syntheticAnalysis } from "../../tests/fixtures/analysis";
import { SessionPlans } from "./sessionPlans";
import { strategyFacts } from "./strategyFacts";

const data = raw as GameData;
it("detecta pasivas que impiden tratar velocidad de ataque y crítico como reglas universales", () => {
  for (const id of [22, 104, 157, 202, 221, 235, 777])
    expect(championTools(id).specialAttacks).toBe(true);
  expect(championTools(234).specialAttacks).toBe(false);
});
it("reconoce terror y silencio de Fiddlesticks sin tratar supresión como control reducible", () => {
  const fiddle = championTools(9);
  expect(fiddle.tenacity.map((a) => a.name)).toEqual(
    expect.arrayContaining(["Aterrorizar", "Cosechar"]),
  );
  const warwick = championTools(19);
  expect(warwick.suppression.map((a) => a.name)).toContain("Opresión Infinita");
  expect(warwick.tenacity.map((a) => a.name)).not.toContain(
    "Opresión Infinita",
  );
  expect(
    draftSignals(novemberDraft).control.map((e) => e.championId),
  ).toContain(9);
});
it("un soporte no equivale a un carry mágico y no convierte la hipótesis en rol confirmado", () => {
  const signals = draftSignals(novemberDraft);
  const naut = signals.enemies.find((e) => e.championId === 111)!;
  const ahri = signals.enemies.find((e) => e.championId === 103)!;
  expect(naut.damageWeight).toBeLessThan(ahri.damageWeight);
  expect(naut.role).toBeNull();
  expect(signals.exposure.magic).toBeLessThan(0.6);
  const farmNaut = draftSignals({
    ...novemberDraft,
    enemies: novemberDraft.enemies.map((e) =>
      e.championId === 111 ? { ...e, role: "TOP" } : e,
    ),
  });
  expect(farmNaut.exposure.magic).toBeGreaterThan(signals.exposure.magic);
});
it("los modificadores salen del paquete y no inventan el daño al impacto omitido", () => {
  const ie = data.items.find((i) => i.id === 3031)!;
  expect(itemMechanics(ie).critDamage).toBe(0.3);
  expect(
    itemMechanics({
      ...ie,
      description: ie.description.replace("30% de Daño", "20% de Daño"),
    }).critDamage,
  ).toBe(0.2);
  expect(itemMechanics({ ...ie, description: "Efecto nuevo" }).critDamage).toBe(
    0,
  );
  const both = combineMechanics(
    data.items.filter((i) => [3111, 3091].includes(i.id)).map(itemMechanics),
  );
  expect(both.tenacity).toBe(0.3);
  expect(both.onHit).toBe(1);
  expect(itemMechanics(data.items.find((i) => i.id === 2525)!).tenacity).toBe(
    0,
  );
  expect(itemMechanics(data.items.find((i) => i.id === 3161)!).haste).toBe(0);
  expect(compatibleItems([3508, 3100])).toBe(false);
  expect(compatibleItems([2525, 3053])).toBe(false);
});
it("el oponente inferido sigue marcado como hipótesis y nunca asigna un rival de línea al jungla", () => {
  const lane = laneOpponent({ ...novemberDraft, playerRole: "MID" });
  expect(lane?.championId).toBe(103);
  expect(lane?.confidence).toBe("inferred");
  expect(lane?.role).toBeNull();
  expect(laneOpponent(novemberDraft)).toBeNull();
});
it("las páginas se pueden reconstruir y cambian de valoración ante otro draft", () => {
  const seeds = officialPages(234, "JUNGLE");
  const pages = expandRunePages(data, novemberDraft, seeds);
  expect(
    pages.some((p) => !seeds.some((seed) => runeKey(seed) === runeKey(p))),
  ).toBe(true);
  for (const p of pages) expect(validateRunes(data, p)).toEqual([]);
  const score = (ctx: typeof novemberDraft, key: number) =>
    Math.max(
      ...pages
        .filter((p) => p.primaryRunes[0] === key)
        .map((p) =>
          createRuneEvaluator(data, ctx)(p).reduce((n, r) => n + r.weight, 0),
        ),
    );
  expect(
    score(frontlineDraft, 8010) - score(frontlineDraft, 9923),
  ).toBeGreaterThan(score(fragileDraft, 8010) - score(fragileDraft, 9923));
});
it("si cambia el efecto de una runa se deja de atribuirle la mecánica anterior", () => {
  const changed = structuredClone(data);
  changed.trees
    .flatMap((t) => t.slots.flatMap((s) => s.runes))
    .find((r) => r.id === 8017)!.description = "Otra mecánica";
  const seed = officialPages(234, "JUNGLE").find((p) => p.primary === 8000)!;
  const page = {
    ...seed,
    primaryRunes: [...seed.primaryRunes.slice(0, 3), 8017],
  };
  expect(
    createRuneEvaluator(
      changed,
      frontlineDraft,
    )(page).some((r) => r.rune === 8017),
  ).toBe(false);
});
it("cambiar solo el lado cambia el contexto, sin inventar otra build por el color", () => {
  const analysis = syntheticAnalysis();
  const blue = recommend(
    data,
    { ...novemberDraft, playerSide: "BLUE" },
    undefined,
    analysis,
  );
  const red = recommend(
    data,
    { ...novemberDraft, playerSide: "RED" },
    undefined,
    analysis,
  );
  expect(blue.signature).not.toBe(red.signature);
  expect(blue.plans[0].items).toEqual(red.plans[0].items);
  expect(blue.plans[0].runes).toEqual(red.plans[0].runes);
  const store = new SessionPlans(() => ({ data: analysis, pending: false }));
  store.setSide(novemberDraft.sessionId, "RED");
  const prepared = store.prepare(data, novemberDraft, true)!;
  expect(prepared.result.signature).toContain('"playerSide":"RED"');
  store.setSide(novemberDraft.sessionId, "BLUE");
  expect(store.prepare(data, novemberDraft, false)).toBe(prepared);
});
it("reservar la referencia no desplaza la mejor variante de su misma clave", () => {
  const ctx = {
    ...novemberDraft,
    enemies: [113, 141, 134, 21, 50].map((championId) => ({
      championId,
      role: null,
      locked: true,
    })),
  };
  const result = recommend(data, ctx, undefined, syntheticAnalysis());
  const conqueror = result.candidates!.filter(
    (p) => p.runes.primaryRunes[0] === 8010,
  );
  expect(conqueror.some((p) => p.decision.changes.length > 0)).toBe(true);
  expect(conqueror[0].decision.score).toBeGreaterThan(
    conqueror.at(-1)!.decision.score,
  );
});
it("el punto de partida sugerido se refleja en el cuadrante correcto para cada lado", () => {
  const ctx = {
    ...novemberDraft,
    allies: [{ championId: 89, role: "SUPPORT" as const, locked: true }],
  };
  expect(
    strategyFacts(data, { ...ctx, playerSide: "BLUE" })
      .map((f) => f.text)
      .join(),
  ).toContain("buff azul");
  expect(
    strategyFacts(data, { ...ctx, playerSide: "RED" })
      .map((f) => f.text)
      .join(),
  ).toContain("buff rojo");
  expect(
    strategyFacts(data, ctx)
      .map((f) => f.text)
      .join(),
  ).not.toContain("buff");
});
it("una composición equilibrada no recibe simultáneamente bonos de diversidad física y mágica", () => {
  const ctx = {
    ...novemberDraft,
    playerChampionId: null,
    allies: [
      { championId: 82, role: "TOP" as const, locked: true },
      { championId: 103, role: "MID" as const, locked: true },
      { championId: 202, role: "BOT" as const, locked: true },
      { championId: 555, role: "SUPPORT" as const, locked: true },
    ],
  };
  const ranked = rankChampions(data, ctx);
  expect(ranked.every((p) => !p.reasons.join().includes("Diversifica"))).toBe(
    true,
  );
});
