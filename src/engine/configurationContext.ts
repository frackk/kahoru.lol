import type { GameData } from "../gameData";
import type { DraftContext } from "./recommendations";
import type { Configuration } from "./configurationSearch";
import { kitById } from "./profiles";
import spellData from "../../data/knowledge/spells.json";
import { draftSignals, fightContext, laneOpponent } from "./draftSignals";

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
  const lane = laneOpponent(ctx);
  return JSON.stringify({
    kind: "configuration",
    scenarios: fightContext(ctx),
    lane: lane
      ? { champion: name(lane.championId), confidence: lane.confidence }
      : null,
    threats: draftSignals(ctx).enemies.map((e) => ({
      champion: name(e.championId),
      damageWeight: e.damageWeight,
      control: e.tools.control.map((a) => a.name),
      tenacityAppliesTo: e.tools.tenacity.map((a) => a.name),
    })),
    matchups: candidates[0]?.matchups ?? [],
    spells: spellData.spells.filter((s) =>
      candidates.some((p) => p.spells.includes(s.id)),
    ),
    patch: data.catalog.version,
    side: ctx.playerSide ?? null,
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
      "Comparar configuraciones completas y su orden. evaluation y scenarios son índices heurísticos, no daño calculado ni probabilidades. mechanics contiene modificadores legibles en el paquete; onHit cuenta efectos sin inventar sus daños omitidos. El valor del daño depende de acceso, duración y supervivencia. No sobreponderar el daño de un soporte ni sumar tenacidad sin verificar acumulación. Las tasas son por campeón/rol, no de este draft. El lado cambia la orientación del mapa, no justifica por sí solo otra runa. Roles inciertos son hipótesis. Elegir entre candidatos validados; no inventar mecánicas.",
  });
}
