import { expect, it } from "vitest";
import raw from "../../data/game-data.json";
import type { GameData } from "../gameData";
import { roles } from "../contracts";
import { syntheticAnalysis } from "../../tests/fixtures/analysis";
import {
  pastDraft,
  frontlineDraft,
  fragileDraft,
} from "../../tests/fixtures/contrasting-drafts";
import { recommend, validateRunes } from "./recommendations";
import { getClientKnowledge } from "./profiles";
import { configurationContext } from "./configurationContext";
import { SessionPlans } from "./sessionPlans";

const data = raw as GameData;
it("el draft aportado compara la alternativa de Lluvia de Espadas sin imponerla", () => {
  const result = recommend(data, pastDraft, undefined, syntheticAnalysis());
  const keys = new Set(result.candidates?.map((p) => p.runes.primaryRunes[0]));
  expect(keys.has(9923)).toBe(true);
  expect(keys.has(8010)).toBe(true);
  expect(result.candidates?.every((p) => p.decision.reasons.length > 0)).toBe(
    true,
  );
  const reasonIds = result.candidates!.flatMap((p) =>
    p.decision.reasons.map((r) => r.id),
  );
  expect(new Set(reasonIds).size).toBe(reasonIds.length);
});
it("el mismo Viego cambia la evaluación conjunta ante primera línea o rivales frágiles", () => {
  const front = recommend(data, frontlineDraft, undefined, syntheticAnalysis());
  const fragile = recommend(data, fragileDraft, undefined, syntheticAnalysis());
  expect(front.plans[0].runes.primaryRunes[0]).not.toBe(
    fragile.plans[0].runes.primaryRunes[0],
  );
  expect(front.plans[0].id).not.toBe(fragile.plans[0].id);
});
for (const c of getClientKnowledge().champions)
  it(`${c.id}: búsqueda conjunta con datos sintéticos, sin excepciones por nombre`, () => {
    const role = c.roles[0] as (typeof roles)[number];
    const page = c.pages.find((p) => p.role === role)!;
    const analysis = syntheticAnalysis();
    analysis.analysis.position = {
      TOP: "TOP",
      JUNGLE: "JUNGLE",
      MID: "MID",
      BOT: "ADC",
      SUPPORT: "SUPPORT",
    }[role];
    const a = analysis.analysis.data;
    const sample = (ids: number[]) => ({ ids, play: 1000, win: 500 });
    a.runes = {
      primary_page_id: page.primary,
      secondary_page_id: page.secondary,
      primary_rune_ids: page.primaryRunes,
      secondary_rune_ids: page.secondaryRunes,
      stat_mod_ids: page.shards,
      play: 1000,
      win: 500,
    };
    a.summoner_spells = sample(page.spells);
    if (c.damage === "kMagic") {
      a.core_items = sample([6655, 3089, 3135]);
      a.boots = sample([3020]);
      a.fourth_items = [sample([3157]), sample([3102])];
      a.fifth_items = [sample([3165]), sample([3116])];
      a.sixth_items = [sample([3116])];
    }
    a.starter_items = sample([role === "JUNGLE" ? 1102 : 1056, 2003]);
    const ctx = {
      ...frontlineDraft,
      sessionId: `catalog-${c.id}`,
      playerChampionId: c.id,
      playerRole: role,
      allies: [{ championId: c.id, role, locked: true }],
    };
    const result = recommend(data, ctx, undefined, analysis);
    expect(result.candidates?.length).toBeGreaterThan(0);
    expect(result.candidates!.length).toBeLessThanOrEqual(12);
    for (const p of result.candidates!) {
      expect(validateRunes(data, p.runes)).toEqual([]);
      expect(p.items).toHaveLength(6);
      expect(new Set(p.items).size).toBe(6);
      expect(p.steps.every((step) => step.cost >= 0)).toBe(true);
      expect(p.decision.reasons.every((r) => r.references.length > 0)).toBe(
        true,
      );
    }
    const payload = configurationContext(data, ctx, result.candidates!);
    expect(new TextEncoder().encode(payload).length).toBeLessThan(64000);
    expect(payload).not.toMatch(/puuid|summonerId|playerName/);
  });
it("descarta una elección local si cambió el draft, el plan manual o los motivos", () => {
  const store = new SessionPlans(() => ({
    data: syntheticAnalysis(),
    pending: false,
  }));
  const entry = store.prepare(data, pastDraft, true)!;
  const candidate = entry.result.candidates!.at(-1)!;
  const reasons = [candidate.decision.reasons[0].id];
  expect(
    store.applyModelChoice(
      pastDraft.sessionId,
      "obsolete",
      candidate.id,
      reasons,
    ),
  ).toBe(false);
  expect(
    store.applyModelChoice(
      pastDraft.sessionId,
      entry.result.signature,
      candidate.id,
      ["inventado"],
    ),
  ).toBe(false);
  expect(
    store.applyModelChoice(
      pastDraft.sessionId,
      entry.result.signature,
      candidate.id,
      reasons,
      "otra selección",
    ),
  ).toBe(false);
  expect(
    store.applyModelChoice(
      pastDraft.sessionId,
      entry.result.signature,
      candidate.id,
      reasons,
      entry.selected,
    ),
  ).toBe(true);
  expect(entry.selected).toBe(candidate.id);
  store.prepare(data, pastDraft, false);
  expect(
    store.applyModelChoice(
      pastDraft.sessionId,
      entry.result.signature,
      candidate.id,
      reasons,
    ),
  ).toBe(false);
  expect(store.prepare(data, fragileDraft, false)).toBeUndefined();
});
