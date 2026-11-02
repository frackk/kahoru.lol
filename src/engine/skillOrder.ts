import type { Analysis, SkillSample } from "./analysis";
import type { DraftContext } from "./recommendations";
import { draftSignals } from "./draftSignals";

export type SkillKey = "Q" | "W" | "E" | "R";
export interface SkillOrder {
  order: SkillKey[];
  observedLevels: number;
  play: number;
  reason: string;
}

function complete(sample: SkillSample, championId: number): SkillKey[] | null {
  if (
    !Number.isInteger(sample.play) ||
    sample.play < 100 ||
    !Number.isInteger(sample.win) ||
    sample.win < 0 ||
    sample.win > sample.play ||
    !Array.isArray(sample.order) ||
    sample.order.length < 15 ||
    sample.order.length > 18
  )
    return null;
  // Aphelios mejora atributos: no se presenta una secuencia Q/W/E como habilidades.
  if (championId === 523) return null;
  const sixRanks = championId === 126 || championId === 77;
  const order: SkillKey[] = [];
  const ranks = { Q: 0, W: 0, E: 0, R: 0 };
  const legal = (key: SkillKey, level: number) => {
    if (championId === 126 && key === "R") return false;
    if (key === "R" && !sixRanks)
      return ranks.R < 3 && level >= [6, 11, 16][ranks.R];
    return ranks[key] < (sixRanks ? 6 : 5) && level >= ranks[key] * 2 + 1;
  };
  for (const value of sample.order) {
    if (
      !["Q", "W", "E", "R"].includes(value) ||
      !legal(value as SkillKey, order.length + 1)
    )
      return null;
    const key = value as SkillKey;
    order.push(key);
    ranks[key]++;
  }
  while (order.length < 18) {
    const options = (["Q", "W", "E", "R"] as SkillKey[]).filter((key) =>
      legal(key, order.length + 1),
    );
    // Priorizar R; completar básicas solo cuando queda una única elección legal.
    const next =
      !sixRanks && options.includes("R")
        ? "R"
        : options.length === 1
          ? options[0]
          : null;
    if (!next) return null;
    order.push(next);
    ranks[next]++;
  }
  return order;
}
export function skillOrder(
  ctx: DraftContext,
  analysis?: Analysis,
): SkillOrder | undefined {
  if (!ctx.playerChampionId || !analysis) return;
  const a = analysis.analysis.data;
  const signals = draftSignals(ctx);
  const options = [a.skills, ...(a.skill_masteries?.builds ?? [])].flatMap(
    (sample) => {
      if (!sample) return [];
      const order = complete(sample, ctx.playerChampionId!);
      return order ? [{ sample, order }] : [];
    },
  );
  const needsEarlyUtility = ctx.playerRole !== "JUNGLE" && signals.engage >= 2;
  options.sort((a, b) => {
    const utility = (o: typeof a) =>
      needsEarlyUtility && new Set(o.order.slice(0, 3)).size === 3 ? 1 : 0;
    return utility(b) - utility(a) || b.sample.play - a.sample.play;
  });
  const chosen = options[0];
  if (!chosen) return;
  return {
    order: chosen.order,
    observedLevels: chosen.sample.order.length,
    play: chosen.sample.play,
    reason:
      needsEarlyUtility && new Set(chosen.order.slice(0, 3)).size === 3
        ? "Variante observada con las tres habilidades básicas a nivel 3 ante varias fuentes de iniciación. No es una tasa de matchup."
        : "Secuencia observada para este campeón y posición; sin evidencia suficiente para cambiarla por el draft.",
  };
}
