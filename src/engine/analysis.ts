import { getClientKnowledge } from "./profiles";
export { rulesPatch as clientPatch } from "./profiles";
export interface Sample {
  ids: number[];
  play: number;
  win: number;
  pick_rate?: number;
}
export interface SkillSample {
  order: string[];
  play: number;
  win: number;
}
export interface MatchupSample {
  champion_id: number;
  play: number;
  win: number;
  my_win_rate: number;
}
export interface Analysis {
  warning?: string;
  source: string;
  retrievedAt: number;
  region: string | null;
  tier: string;
  analysis: {
    champion: string;
    position: string;
    data: {
      summary?: {
        average_stats: { play: number; win_rate: number; pick_rate: number };
      };
      core_items: Sample;
      boots: Sample;
      starter_items: Sample;
      fourth_items: Sample[];
      fifth_items: Sample[];
      sixth_items: Sample[];
      summoner_spells: Sample;
      runes: {
        primary_page_id: number;
        secondary_page_id: number;
        primary_rune_ids: number[];
        secondary_rune_ids: number[];
        stat_mod_ids: number[];
        play: number;
        win: number;
      };
      trends: { win: { version: string; created_at: string } };
      damage_type: string;
      skills?: SkillSample;
      skill_masteries?: { builds: SkillSample[] };
      weak_counters?: MatchupSample[];
      strong_counters?: MatchupSample[];
    };
  };
}
export function officialPages(championId: number, role: string) {
  return (
    getClientKnowledge()
      .champions.find((c) => c.id === championId)
      ?.pages.filter((p) => p.role === role) ?? []
  );
}
export function hasSample(row: Sample | undefined): row is Sample {
  return (
    !!row &&
    Number.isInteger(row.play) &&
    row.play >= 100 &&
    Number.isInteger(row.win) &&
    row.win >= 0 &&
    row.win <= row.play &&
    Array.isArray(row.ids) &&
    row.ids.length > 0 &&
    row.ids.every((id) => Number.isInteger(id) && id > 0)
  );
}
