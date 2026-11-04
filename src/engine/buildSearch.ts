import type { GameData, Item } from "../gameData";
import type { DraftContext, Plan } from "./recommendations";
import { draftSignals, fightContext } from "./draftSignals";
import { getClientKnowledge, profileById } from "./profiles";
import { championTools } from "./championTools";
import { itemMechanics, combineMechanics } from "./itemMechanics";

export const itemGroups = [
  [3053, 3156, 6673, 2525],
  [3033, 3036, 6694, 3302],
  [3135, 3137, 3302, 8010],
  [3074, 3748, 6698, 6631],
  [3078, 3100, 6662, 3508, 2510],
  [3003, 3004, 3119, 2526],
];
export const compatibleItems = (ids: number[]) =>
  new Set(ids).size === ids.length &&
  itemGroups.every((g) => ids.filter((id) => g.includes(id)).length <= 1);

export interface BuildStats {
  ad: number;
  ap: number;
  health: number;
  armor: number;
  mr: number;
  speed: number;
  crit: number;
}
export interface BuildEvaluation {
  offense: number;
  defense: number;
  utility: number;
  tempo: number;
  cost: number;
  changes: number;
  stats: BuildStats;
  mechanics: ReturnType<typeof combineMechanics>;
  score: number;
}
export interface BuildOption {
  ids: number[];
  seed: Plan;
  changes: string[];
  evaluation: BuildEvaluation;
}
type Objective = "balanced" | "pressure" | "survival";
const objectives: Objective[] = ["balanced", "pressure", "survival"];
const statKeys: Record<keyof BuildStats, string> = {
  ad: "FlatPhysicalDamageMod",
  ap: "FlatMagicDamageMod",
  health: "FlatHPPoolMod",
  armor: "FlatArmorMod",
  mr: "FlatSpellBlockMod",
  speed: "PercentAttackSpeedMod",
  crit: "FlatCritChanceMod",
};
export function buildStats(items: Item[]): BuildStats {
  return Object.fromEntries(
    Object.entries(statKeys).map(([key, source]) => [
      key,
      items.reduce((sum, i) => sum + (i.stats[source] ?? 0), 0),
    ]),
  ) as unknown as BuildStats;
}

// Solo se ofrecen mecánicas reconocidas en el paquete activo, no por el ID aislado.
const effects: Record<number, RegExp> = {
  3157: /estasis/iu,
  3102: /escudo antihechizos/iu,
  3165: /heridas/iu,
  3033: /heridas/iu,
  6609: /heridas/iu,
  3075: /heridas/iu,
  3135: /penetración de magia/iu,
  3036: /penetración de armadura/iu,
  3071: /reduces la armadura/iu,
  3153: /vida actual del enemigo/iu,
  6653: /vida máxima/iu,
  3156: /escudo contra daño mágico/iu,
  4401: /resistencia mágica/iu,
  3190: /aliados.{0,120}escudo/iu,
  3504: /curar o escudar a un aliado/iu,
  6616: /curar o escudar a un aliado/iu,
  6695: /escudos/iu,
};
const catalog = {
  ap: [6655, 6653, 4645, 4646, 3135, 3137, 3157, 3102, 3165, 3089, 4629],
  attacks: [3153, 6672, 6676, 3031, 3036, 3033, 3046, 3091, 3071, 3156, 6333],
  fighter: [3071, 3161, 3053, 3156, 6333, 6609, 6610, 6692, 3814],
  assassin: [3142, 6697, 6694, 6695, 3814, 3156, 6609],
  tank: [3075, 4401, 2504, 3143, 3065, 3068, 6664, 6665, 2502, 3190],
  protection: [3190, 3107, 3504, 6616, 6617, 3222, 3109],
};
const cap = (value: number) => Math.max(0, Math.min(1, value));
const ratio = (value: number, reference: number, fallback: number) =>
  Math.min(1.8, value / Math.max(reference, fallback));

export function buildSearch(
  data: GameData,
  ctx: DraftContext,
  seeds: Plan[],
  preferredItems?: number[],
): BuildOption[] {
  const own = profileById.get(ctx.playerChampionId!);
  const kit = getClientKnowledge().champions.find(
    (c) => c.id === ctx.playerChampionId,
  );
  if (!own || !kit || !seeds.length) return [];
  const signals = draftSignals(ctx);
  const fight = fightContext(ctx);
  const tools = championTools(ctx.playerChampionId!);
  const removable = signals.tenacity.length;
  const items = new Map(data.items.map((i) => [i.id, i]));
  const mechanicsById = new Map(
    data.items.map((i) => [i.id, itemMechanics(i)]),
  );
  const mechanics = (ids: number[]) =>
    combineMechanics(ids.map((id) => mechanicsById.get(id)!));
  const get = (ids: number[]) => ids.map((id) => items.get(id)!);
  const protection = kit.abilities.some((a) =>
    /(?:cura|curar|escudo|escudar).{0,100}aliad|aliad.{0,100}(?:cura|escudo)/iu.test(
      a.description,
    ),
  );
  const ranged =
    (data.catalog.champions.find((c) => c.id === ctx.playerChampionId)?.range ??
      0) > 350;
  const lane = signals.enemies.find(
    (e) => e.locked && e.role === ctx.playerRole,
  );
  const result = new Map<string, BuildOption>();
  const reference = seeds[0].items.map((id) => items.get(id)!);
  if (reference.some((i) => !i)) return [];
  const referenceStats = buildStats(reference);
  const referenceMechanics = mechanics(seeds[0].items);
  for (const seed of seeds) {
    const base = get(seed.items);
    if (base.some((i) => !i)) continue;
    const baseline = referenceStats;
    const ap = baseline.ap > baseline.ad && baseline.ap >= 100;
    const ad = !ap && baseline.ad >= 80;
    const attacks = (ad || ap) && (tools.attacks || baseline.speed >= 0.4);
    const tank = !ap && !ad;
    const mana = base.slice(0, 3).some((i) => i.tags.includes("Mana"));
    const boots = base.filter((i) => i.tags.includes("Boots")).length;
    const pool = new Set([
      ...seeds.flatMap((s) => s.items),
      ...data.items
        .filter((i) => {
          if (
            !i.purchasable ||
            i.cost < 1800 ||
            !i.from.length ||
            i.tags.includes("Boots")
          )
            return false;
          const stats = i.stats;
          return ap
            ? (stats.FlatMagicDamageMod ?? 0) >= 40
            : ad
              ? (stats.FlatPhysicalDamageMod ?? 0) >= 25 ||
                (attacks && (stats.PercentAttackSpeedMod ?? 0) >= 0.25)
              : (stats.FlatArmorMod ?? 0) >= 25 ||
                (stats.FlatSpellBlockMod ?? 0) >= 25 ||
                (stats.FlatHPPoolMod ?? 0) >= 350;
        })
        .map((i) => i.id),
      ...(ap ? catalog.ap : []),
      ...(attacks && ad ? catalog.attacks : []),
      ...(attacks && ap ? [3115, 2510, 3124] : []),
      ...(ad && kit.classes.includes("fighter") ? catalog.fighter : []),
      ...(ad && kit.classes.includes("assassin") ? catalog.assassin : []),
      ...(tank ? catalog.tank : []),
      ...(ctx.playerRole === "SUPPORT" && protection ? catalog.protection : []),
      ...(boots ? [3006, 3009, 3020, 3047, 3111, 3158] : []),
    ]);
    const eligible = [...pool].filter((id) => {
      const i = items.get(id);
      if (
        !i?.purchasable ||
        (i.requiredChampion && i.requiredChampion !== own.slug)
      )
        return false;
      if (effects[id] && !effects[id].test(i.description)) return false;
      if (seed.items.includes(id)) return true;
      if ([3165, 3033, 6609, 3075].includes(id) && signals.healing.length < 2)
        return false;
      if (i.tags.includes("Boots")) return true;
      if (i.cost < 1800 || !i.from.length) return false;
      if (i.tags.includes("Mana") && !mana) return false;
      if ([3504, 6616, 6617, 3222].includes(id) && !protection) return false;
      if (
        id === 3075 &&
        !signals.healing.some((e) => e.profile.traits.includes("attacks"))
      )
        return false;
      if (
        id === 6695 &&
        !signals.enemies.some((e) =>
          /escudo/iu.test(
            getClientKnowledge()
              .champions.find((c) => c.id === e.championId)
              ?.abilities.map((a) => a.description)
              .join(" ") ?? "",
          ),
        )
      )
        return false;
      // No convertir una configuración observada en otro arquetipo de daño.
      if (
        ap &&
        !i.tags.includes("SpellDamage") &&
        !(ctx.playerRole === "SUPPORT" && i.cost <= 2400)
      )
        return false;
      if (
        ad &&
        !i.tags.includes("Damage") &&
        !(attacks && i.tags.includes("AttackSpeed"))
      )
        return false;
      if (tank && (i.stats.FlatMagicDamageMod ?? 0) > 60) return false;
      if (tank && (i.stats.FlatPhysicalDamageMod ?? 0) > 25) return false;
      if (!ranged && id === 3085) return false;
      return true;
    });
    const evaluate = (ids: number[]): BuildEvaluation => {
      const list = get(ids);
      const stats = buildStats(list);
      const m = mechanics(ids);
      const changes = ids.filter((id) => !seed.items.includes(id)).length;
      const spellPower = (s: BuildStats, effects: typeof m) =>
        s.ap *
        (1 + effects.apMultiplier) *
        (1 + effects.haste / 200) *
        (1 +
          effects.magicPen * (0.4 + fight.extended) +
          effects.flatMagicPen / 150);
      const attackPower = (s: BuildStats, effects: typeof m) =>
        (90 + s.ad) *
        (1 + cap(s.crit) * (1 + effects.critDamage)) *
        (1 + s.speed * fight.access) *
        (1 +
          effects.lethality / 150 +
          effects.armorPen * (0.4 + fight.extended));
      // Índices de inversión, no simulación de DPS: no incluyen rotaciones ni estadísticas base de cada campeón.
      const offense = ap
        ? ratio(
            spellPower(stats, m),
            spellPower(baseline, referenceMechanics),
            200,
          ) *
            (attacks ? 0.85 : 1) +
          (attacks
            ? ratio(stats.speed, baseline.speed, 0.65) * 0.15 * fight.access
            : 0)
        : ad
          ? attacks
            ? ratio(
                attackPower(stats, m),
                attackPower(baseline, referenceMechanics),
                140,
              )
            : ratio(
                stats.ad * (1 + m.haste / 200) * (1 + m.lethality / 150),
                baseline.ad *
                  (1 + referenceMechanics.haste / 200) *
                  (1 + referenceMechanics.lethality / 150),
                140,
              )
          : ratio(stats.health, baseline.health, 1200) * 0.4 +
            ratio(stats.armor + stats.mr, baseline.armor + baseline.mr, 160) *
              0.6;
      const phys = signals.exposure.physical;
      const magic = signals.exposure.magic;
      // Rendimientos decrecientes; sumar otra defensa no recibe el mismo premio.
      const defense =
        (1 - Math.exp(-stats.armor / 80)) * phys +
        (1 - Math.exp(-stats.mr / 80)) * magic +
        Math.min(0.35, stats.health / 6000);
      let utility = 0;
      const has = (id: number) =>
        ids.includes(id) &&
        (!effects[id] || effects[id].test(items.get(id)!.description));
      const indexWeight = (id: number) => 1 - ids.indexOf(id) * 0.06;
      if (signals.healing.length >= 2) {
        const wound = ids.find(
          (id) => [3165, 3033, 6609, 3075].includes(id) && has(id),
        );
        if (wound) utility += 0.45;
      }
      if (signals.frontline >= 2) {
        if (attacks && has(3153)) utility += 0.65 * indexWeight(3153);
        if (ap && has(6653)) utility += 0.6 * indexWeight(6653);
        if (ap && (has(3135) || has(3137))) utility += 0.45;
        if (ad && (has(3036) || has(3033) || has(6694) || has(3071)))
          utility += 0.45;
      }
      if (signals.engage >= 2 && ap && has(3157)) utility += 0.45;
      if (ap && signals.frontline < 2 && (has(4645) || has(4646)))
        utility += 0.3;
      if (signals.control.length >= 2 && has(3102)) utility += 0.3;
      if (removable) utility += m.tenacity * Math.min(3, removable) * 0.65;
      if (m.lifeline) utility += fight.pressure * 0.25;
      if (m.stasis && ap) utility += fight.pressure * 0.25;
      if (m.onHit && attacks)
        utility += Math.min(2, m.onHit) * fight.access * fight.extended * 0.18;
      if (protection && signals.carries.length)
        utility += Math.min(0.4, m.healPower * 2);
      if (protection && signals.carries.length && has(3504)) utility += 0.4;
      if (ctx.playerRole === "SUPPORT" && signals.engage >= 2 && has(3190))
        utility += 0.5;
      if (has(3031) && stats.crit < 0.5) utility -= 0.55;
      if (ids.includes(3084) && !tools.frontline) utility -= 0.8;
      if (ids.includes(3083) && stats.health < 1500) utility -= 0.6;
      if (m.onHit && !attacks) utility -= m.onHit * 0.25;
      if (tools.specialAttacks) {
        utility -= Math.abs(stats.crit - baseline.crit) * 1.5;
        utility -= Math.abs(stats.speed - baseline.speed) * 1.5;
      }
      // Compras de penetración porcentual tempranas desplazan el primer pico de daño.
      if (
        ids
          .slice(0, 2)
          .some((id) => [3135, 3137, 3036, 3033, 6694].includes(id))
      )
        utility -= 0.45;
      if (attacks && stats.speed < 0.2 && fight.extended > 0.5) utility -= 0.45;
      if ([3089, 3031].includes(ids[0])) utility -= 0.7;
      if (
        [3102, 3157, 3026, 3053, 3156, 6673].includes(ids[0]) &&
        ids[0] !== seed.items[0]
      )
        utility -= 0.6;
      if (
        [3165, 3033, 6609, 3075].includes(ids[0]) &&
        !seed.items.slice(0, 1).includes(ids[0])
      )
        utility -= 0.55;
      if (list[0].tags.includes("Boots")) utility -= 0.35;
      const first = list.find((i) => !i.tags.includes("Boots"))!;
      const firstStats = buildStats([first]);
      const firstBase = reference.find((i) => !i.tags.includes("Boots"))!;
      const firstPower = ap
        ? firstStats.ap / Math.max(50, firstBase.stats.FlatMagicDamageMod ?? 0)
        : ad
          ? attacks
            ? attackPower(firstStats, mechanics([first.id])) /
              Math.max(
                1,
                attackPower(buildStats([firstBase]), mechanics([firstBase.id])),
              )
            : firstStats.ad /
              Math.max(35, firstBase.stats.FlatPhysicalDamageMod ?? 0)
          : firstStats.health / 500;
      const tempo =
        Math.min(1.2, firstPower) * 0.5 +
        Math.min(1, firstBase.cost / Math.max(1, first.cost)) * 0.5;
      // Una línea confirmada puede justificar adelantar defensa. El resto sigue incierto.
      if (lane && ids.indexOf(3047) === 0 && lane.profile.damage === "physical")
        utility += 0.2;
      const cost = list.reduce((sum, i) => sum + i.cost, 0);
      const extraCost = Math.max(
        0,
        cost - reference.reduce((sum, i) => sum + i.cost, 0),
      );
      const score =
        offense * 12 +
        defense * 6 +
        utility * 5 +
        tempo * 2 -
        changes * 1.1 -
        extraCost / (ctx.playerRole === "SUPPORT" ? 500 : 2000) -
        ids.reduce((sum, id, index) => {
          const before = seed.items.indexOf(id);
          return (
            sum +
            (before >= 0
              ? Math.abs(before - index) * 0.07
              : index === 0
                ? 0.3
                : 0)
          );
        }, 0);
      return {
        offense,
        defense,
        utility,
        tempo,
        cost,
        changes,
        stats,
        mechanics: m,
        score,
      };
    };
    const valid = (ids: number[]) => {
      if (!compatibleItems(ids)) return false;
      const list = get(ids);
      if (
        list.some((i) => !i) ||
        list.filter((i) => i.tags.includes("Boots")).length !== boots
      )
        return false;
      const stats = buildStats(list);
      if (
        tools.specialAttacks &&
        ids.filter((id) => !seed.items.includes(id)).length > 2
      )
        return false;
      if (list.filter((i) => mechanicsById.get(i.id)!.lifeline).length > 1)
        return false;
      if (ap && stats.ap < baseline.ap * 0.75) return false;
      if (ad && stats.ad < baseline.ad * 0.7) return false;
      if (mana && !list.slice(0, 3).some((i) => i.tags.includes("Mana")))
        return false;
      if (ctx.playerRole === "BOT" && baseline.crit >= 0.5 && stats.crit < 0.5)
        return false;
      // Compras que necesitan acumularse no se introducen al final de la ruta.
      if (
        ids.some(
          (id, index) =>
            [3003, 3004, 3119, 2526, 6657, 3084, 3032].includes(id) &&
            index > 2 &&
            !seed.items.includes(id),
        )
      )
        return false;
      return true;
    };
    const objectiveScore = (e: BuildEvaluation, objective: Objective) =>
      e.score +
      (objective === "pressure"
        ? e.offense * 6 - e.defense * 3
        : objective === "survival"
          ? e.defense * 8 - e.offense * 2
          : 0);
    const remember = (ids: number[], evaluation: BuildEvaluation) => {
      const key = ids.join("-");
      if (result.has(key)) return;
      const removed = seed.items.filter((id) => !ids.includes(id));
      const added = ids.filter((id) => !seed.items.includes(id));
      const changes = added.map(
        (id, i) =>
          `${items.get(removed[i])?.name ?? "Compra"} → ${items.get(id)!.name}.`,
      );
      if (
        ids.filter((id) => seed.items.includes(id)).join() !==
        seed.items.filter((id) => ids.includes(id)).join()
      )
        changes.push(
          "Reordenar las compras: comparar el primer pico de poder con la respuesta al draft.",
        );
      result.set(key, { ids, seed, changes, evaluation });
    };
    const baselineEvaluation = evaluate(seed.items);
    remember(seed.items, baselineEvaluation);
    if (
      preferredItems?.length === seed.items.length &&
      preferredItems.every((id) => {
        const i = items.get(id);
        return (
          i?.purchasable &&
          (!i.requiredChampion || i.requiredChampion === own.slug)
        );
      }) &&
      valid(preferredItems)
    )
      remember(preferredItems, evaluate(preferredItems));
    // Cada profundidad permite revisar una compra; el ancho acota el trabajo en el draft.
    for (const objective of objectives) {
      let beam = [{ ids: seed.items, evaluation: baselineEvaluation }];
      const visited = new Set([seed.items.join()]);
      for (let depth = 0; depth < seed.items.length; depth++) {
        const next: typeof beam = [...beam];
        const offer = (ids: number[]) => {
          const key = ids.join();
          if (visited.has(key)) return;
          visited.add(key);
          if (!valid(ids)) return;
          next.push({ ids, evaluation: evaluate(ids) });
        };
        for (const state of beam) {
          for (let slot = 0; slot < state.ids.length; slot++) {
            const isBoot = items.get(state.ids[slot])!.tags.includes("Boots");
            for (const replacement of eligible) {
              if (items.get(replacement)!.tags.includes("Boots") !== isBoot)
                continue;
              const ids = [...state.ids];
              ids[slot] = replacement;
              offer(ids);
            }
          }
          for (let slot = 1; slot < state.ids.length; slot++) {
            const ids = [...state.ids];
            const [id] = ids.splice(slot, 1);
            ids.splice(0, 0, id);
            offer(ids);
          }
        }
        next.sort(
          (a, b) =>
            objectiveScore(b.evaluation, objective) -
              objectiveScore(a.evaluation, objective) ||
            a.ids.join().localeCompare(b.ids.join()),
        );
        beam = next.slice(0, 5);
      }
      for (const state of beam) remember(state.ids, state.evaluation);
    }
  }
  return [...result.values()];
}
