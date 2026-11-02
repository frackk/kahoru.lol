import type { GameData } from "../gameData";
import { kitById, profileById } from "./profiles";
import { possibleRoles, type DraftContext, type Plan } from "./recommendations";
import { roleNames } from "../contracts";
import { strategyFacts } from "./strategyFacts";

export function strategyContext(
  data: GameData,
  ctx: DraftContext,
  plan?: Plan,
) {
  const name = (id: number) =>
    data.catalog.champions.find((c) => c.id === id)?.name ?? String(id);
  const kit = (id: number, limit: number) =>
    kitById.get(id)?.map((a) => ({
      name: a.name,
      description: a.description.slice(0, limit),
    })) ?? [];
  const hypotheses = possibleRoles(ctx.enemies);
  const team = (allied: boolean) =>
    (allied ? ctx.allies : ctx.enemies).map((s, i) =>
      s.championId
        ? {
            champion: name(s.championId),
            confirmed: s.locked,
            role: s.role ?? null,
            roleHypotheses: allied || s.role ? [] : hypotheses[i],
            traits: profileById.get(s.championId)?.traits ?? [],
            abilities: kit(
              s.championId,
              s.championId === ctx.playerChampionId ? 850 : 200,
            ),
          }
        : { champion: "Sin revelar" },
    );
  const rune = (id: number) =>
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .find((r) => r.id === id)?.name;
  return JSON.stringify({
    patch: data.catalog.version,
    player: {
      champion: ctx.playerChampionId ? name(ctx.playerChampionId) : null,
      role: ctx.playerRole ? roleNames[ctx.playerRole] : null,
    },
    allies: team(true),
    enemies: team(false),
    facts: strategyFacts(data, ctx, plan),
    plan: plan
      ? {
          items: plan.items.map(
            (id) => data.items.find((i) => i.id === id)?.name,
          ),
          runes: [...plan.runes.primaryRunes, ...plan.runes.secondaryRunes].map(
            rune,
          ),
          reason: plan.reason,
        }
      : null,
    limits:
      "Posiciones no confirmadas son hipótesis. Sin datos de la partida en curso ni estadísticas de matchup. Las descripciones son hechos del kit, no prueba de ventaja en línea.",
  });
}
