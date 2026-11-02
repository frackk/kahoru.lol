import type { Analysis } from "./analysis";
import type { DraftContext } from "./recommendations";

export interface MatchupEvidence {
  championId: number;
  play: number;
  winRate: number;
  lower: number;
  upper: number;
}
export function matchupEvidence(
  ctx: DraftContext,
  analysis?: Analysis,
): MatchupEvidence[] {
  const a = analysis?.analysis.data;
  if (!a || !ctx.playerRole) return [];
  const opponent = ctx.enemies.find(
    (s) => s.locked && s.championId && s.role === ctx.playerRole,
  );
  if (!opponent) return [];
  const rows = [...(a.weak_counters ?? []), ...(a.strong_counters ?? [])];
  const row = rows.find(
    (r) =>
      r.champion_id === opponent.championId &&
      Number.isInteger(r.play) &&
      r.play >= 300 &&
      Number.isFinite(r.my_win_rate) &&
      r.my_win_rate >= 0 &&
      r.my_win_rate <= 1,
  );
  if (!row) return [];
  const p = row.my_win_rate,
    n = row.play,
    z = 1.96;
  const middle = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) /
    (1 + (z * z) / n);
  return [
    {
      championId: row.champion_id,
      play: n,
      winRate: p,
      lower: middle - margin,
      upper: middle + margin,
    },
  ];
}
