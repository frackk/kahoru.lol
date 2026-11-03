import type { GameData } from "../gameData";
import type { DraftContext } from "./recommendations";
import type { Configuration } from "./configurationSearch";
import { kitById } from "./profiles";
import spellData from "../../data/knowledge/spells.json";

export function configurationContext(
  data: GameData,
  ctx: DraftContext,
  candidates: Configuration[],
) {
  const name = (id: number) =>
    data.catalog.champions.find((c) => c.id === id)?.name ?? String(id);
  const kit = (id: number, limit: number) =>
    kitById.get(id)?.map((a) => ({
      name: a.name,
      description: a.description.slice(0, limit),
    }));
  const items = new Set(candidates.flatMap((p) => p.items));
  const runes = new Set(
    candidates.flatMap((p) => [
      ...p.runes.primaryRunes,
      ...p.runes.secondaryRunes,
    ]),
  );
  return JSON.stringify({
    kind: "configuration",
    matchups: candidates[0]?.matchups ?? [],
    spells: spellData.spells.filter((s) =>
      candidates.some((p) => p.spells.includes(s.id)),
    ),
    patch: data.catalog.version,
    player: {
      champion: name(ctx.playerChampionId!),
      role: ctx.playerRole,
      kit: kit(ctx.playerChampionId!, 1000),
    },
    allies: ctx.allies.map((s) => ({
      champion: s.championId ? name(s.championId) : null,
      role: s.role,
      confirmed: s.locked,
      kit: s.championId ? kit(s.championId, 160) : [],
    })),
    enemies: ctx.enemies.map((s) => ({
      champion: s.championId ? name(s.championId) : null,
      role: s.role,
      confirmed: s.locked,
      kit: s.championId ? kit(s.championId, 200) : [],
    })),
    items: data.items
      .filter((i) => items.has(i.id))
      .map((i) => ({
        id: i.id,
        name: i.name,
        tags: i.tags,
        cost: i.cost,
        stats: i.stats,
        description: i.description.slice(0, 700),
      })),
    runes: data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .filter((r) => runes.has(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description.slice(0, 800),
      })),
    candidates: candidates.map((p) => ({
      id: p.id,
      items: p.items,
      runes: p.runes,
      spells: p.spells,
      observations: p.samples,
      changes: p.decision.changes,
      evaluation: p.decision.evaluation,
      reasons: p.decision.reasons
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map((r) => ({ id: r.id, text: r.text, references: r.references })),
    })),
    limits:
      "Comparar configuraciones completas y el orden de compra. evaluation contiene índices heurísticos relativos al plan de referencia, no daño calculado ni probabilidades. stats suma atributos fijos de Data Dragon, sin habilidades ni pasivas condicionales. Las tasas de la fuente son por campeón/rol, no de este draft. Las herramientas del kit no demuestran prioridad de línea ni garantizan acceso a un objetivo. Los roles no confirmados siguen siendo hipótesis. Elegir entre candidatos validados; no inventar una configuración ni mecánicas.",
  });
}
