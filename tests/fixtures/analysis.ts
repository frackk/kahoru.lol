import type { Analysis } from "../../src/engine/analysis";
import { officialPages } from "../../src/engine/analysis";
export function syntheticAnalysis(): Analysis {
  const p = officialPages(234, "JUNGLE")[0];
  const row = (ids: number[]) => ({
    ids,
    play: 1000,
    win: 500,
    pick_rate: 0.5,
  });
  return {
    source: "Synthetic test fixture",
    retrievedAt: 1,
    region: null,
    tier: "all",
    analysis: {
      champion: "VIEGO",
      position: "JUNGLE",
      data: {
        summary: {
          average_stats: { play: 1000, win_rate: 0.5, pick_rate: 0.1 },
        },
        core_items: row([6672, 6676, 6673]),
        boots: row([3047]),
        starter_items: row([1102, 2003]),
        fourth_items: [row([3036]), row([3031])],
        fifth_items: [row([3026]), row([6333]), row([3156])],
        sixth_items: [row([3026])],
        summoner_spells: row([4, 11]),
        runes: {
          primary_page_id: p.primary,
          secondary_page_id: p.secondary,
          primary_rune_ids: p.primaryRunes,
          secondary_rune_ids: p.secondaryRunes,
          stat_mod_ids: p.shards,
          play: 1000,
          win: 500,
        },
        trends: {
          win: { version: "16.21", created_at: "2026-11-01T00:00:00Z" },
        },
        damage_type: "AD",
      },
    },
  };
}
