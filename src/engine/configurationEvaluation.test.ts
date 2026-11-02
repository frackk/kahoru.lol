import { afterAll, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import raw from "../../data/game-data.json";
import {
  frontlineDraft,
  fragileDraft,
  pastDraft,
} from "../../tests/fixtures/contrasting-drafts";
import { recommend, validateRunes } from "./recommendations";
import { configurationContext } from "./configurationContext";
import type { Analysis } from "./analysis";
import type { GameData } from "../gameData";
import type { Role } from "../contracts";

const directory = process.env.KAHORU_STATISTICS_DIRECTORY;
const report: object[] = [];
for (const [id, role] of [
  [54, "TOP"],
  [60, "JUNGLE"],
  [103, "MID"],
  [222, "BOT"],
  [89, "SUPPORT"],
  [234, "JUNGLE"],
] as [number, Role][]) {
  it.skipIf(!directory)(
    `${id}/${role}: comparación con caché real del proveedor, optativa`,
    () => {
      const data = raw as GameData;
      const champion = data.catalog.champions.find((c) => c.id === id)!;
      const analysis = JSON.parse(
        readFileSync(
          resolve(directory!, `${champion.slug}-${role}.json`),
          "utf8",
        ),
      ) as Analysis;
      const selected = [];
      for (const draft of [
        frontlineDraft,
        fragileDraft,
        ...(id === 234 ? [pastDraft] : []),
      ]) {
        const ctx = {
          ...draft,
          playerChampionId: id,
          playerRole: role,
          allies: draft.allies.map((s) =>
            s.role === role ? { ...s, championId: id } : s,
          ),
        };
        const started = performance.now();
        const result = recommend(data, ctx, undefined, analysis);
        const ms = performance.now() - started;
        expect(result.candidates?.length).toBeGreaterThan(0);
        for (const p of result.candidates!)
          expect(validateRunes(data, p.runes)).toEqual([]);
        const bytes = new TextEncoder().encode(
          configurationContext(data, ctx, result.candidates!),
        ).length;
        expect(bytes).toBeLessThan(64000);
        selected.push({
          draft: draft.sessionId,
          keystone: result.plans[0].runes.primaryRunes[0],
          items: result.plans[0].items,
          candidates: result.candidates!.length,
          contextBytes: bytes,
          calculationMs: Math.round(ms * 100) / 100,
        });
      }
      report.push({
        championId: id,
        role,
        retrievedAt: analysis.retrievedAt,
        results: selected,
      });
    },
  );
}
afterAll(() => {
  if (!report.length) return;
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/configuration-evaluation.json",
    JSON.stringify(report, null, 2),
  );
});
