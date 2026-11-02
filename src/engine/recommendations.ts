import shards from "../../data/knowledge/shards.json";
import type { DraftSlot, Role } from "../contracts";
import type { GameData, Item } from "../gameData";
import {
  profiles,
  profileById,
  rulesPatch,
  rulesRevision,
  type Profile,
} from "./profiles";

export interface DraftContext {
  sessionId: string;
  playerRole: Role | null;
  playerChampionId: number | null;
  allies: DraftSlot[];
  enemies: DraftSlot[];
  bans: number[];
  gameVersion?: string | null;
}
export interface RunePage {
  primary: number;
  secondary: number;
  primaryRunes: number[];
  secondaryRunes: number[];
  shards: number[];
}
export interface PurchaseStep {
  id: string;
  itemId: number;
  kind: "buy" | "combine" | "sell" | "consume" | "quest";
  cost: number;
  consumes: number[];
  condition?: string;
}
export interface Plan {
  recommended: boolean;
  id: string;
  title: string;
  reason: string;
  tradeoff: string;
  starter: number[];
  items: number[];
  questUpgrade: number | null;
  runes: RunePage;
  steps: PurchaseStep[];
  branches: string[];
  strategy: string[];
}
export interface RankEntry {
  championId: number;
  score: number;
  reasons: string[];
  tradeoff: string;
}
export interface Recommendation {
  plans: Plan[];
  ranking: RankEntry[];
  errors: string[];
  coverage: string;
  signature: string;
}

const runeTemplates: Record<string, [number, number[], number, number[]]> = {
  fighter: [8000, [8010, 9111, 9105, 8299], 8400, [8473, 8451]],
  attacks: [8000, [8008, 8009, 9103, 8014], 8200, [8233, 8236]],
  fleet: [8000, [8021, 8009, 9103, 8014], 8200, [8233, 8236]],
  tank: [8400, [8439, 8463, 8429, 8451], 8000, [9111, 9105]],
  grasp: [8400, [8437, 8446, 8444, 8451], 8000, [9111, 9105]],
  guardian: [8400, [8465, 8463, 8444, 8453], 8000, [8009, 9105]],
  mage: [8200, [8229, 8226, 8210, 8237], 8300, [8345, 8347]],
  ahri: [8100, [8112, 8143, 8140, 8106], 8200, [8226, 8210]],
  assassin: [8100, [8112, 8143, 8140, 8106], 8000, [9111, 8014]],
  aery: [8200, [8214, 8226, 8210, 8237], 8400, [8463, 8453]],
};

export function validateRunes(data: GameData, page: RunePage): string[] {
  const errors: string[] = [];
  const primary = data.trees.find((t) => t.id === page.primary),
    secondary = data.trees.find((t) => t.id === page.secondary);
  if (!primary || !secondary || primary.id === secondary.id)
    return ["Los árboles de runas no son válidos."];
  if (
    page.primaryRunes.length !== 4 ||
    primary.slots.some(
      (s, i) => !s.runes.some((r) => r.id === page.primaryRunes[i]),
    )
  )
    errors.push("La página debe elegir una runa de cada fila principal.");
  const secondaryRows = page.secondaryRunes.map((id) =>
    secondary.slots.findIndex((s) => s.runes.some((r) => r.id === id)),
  );
  if (
    page.secondaryRunes.length !== 2 ||
    secondaryRows.some((i) => i <= 0) ||
    new Set(secondaryRows).size !== 2
  )
    errors.push(
      "La secundaria debe usar dos filas diferentes, sin runa clave.",
    );
  if (
    page.shards.length !== 3 ||
    page.shards.some((id, i) => !shards.slots[i].includes(id))
  )
    errors.push("Fragmentos incompatibles con las filas verificadas.");
  return errors;
}

function runePage(p: Profile, variant: string): RunePage {
  const [primary, main, secondary, sub] = runeTemplates[p.runes];
  let secondaryTree = secondary,
    secondaryRunes = [...sub];
  if (variant !== "principal" && primary !== 8400) {
    secondaryTree = 8400;
    secondaryRunes = variant === "armor" ? [8473, 8451] : [8444, 8451];
  }
  const attack = p.traits.includes("attacks");
  return {
    primary,
    primaryRunes: [...main],
    secondary: secondaryTree,
    secondaryRunes,
    shards: [attack ? 5005 : 5008, 5008, variant === "principal" ? 5001 : 5011],
  };
}

function availableItem(data: GameData, id: number, p: Profile): Item {
  const item = data.items.find((i) => i.id === id);
  if (
    !item ||
    !item.purchasable ||
    (item.requiredChampion && item.requiredChampion !== p.slug)
  )
    throw new Error(
      `El objeto ${item?.name ?? id} no puede comprarse con este campeón.`,
    );
  return item;
}

class InventoryFull extends Error {}
export function purchaseRoute(
  data: GameData,
  p: Profile,
  starter: number[],
  targets: number[],
): PurchaseStep[] {
  let inventory: number[] = [];
  let steps: PurchaseStep[] = [];
  const add = (
    itemId: number,
    kind: PurchaseStep["kind"],
    cost = 0,
    consumes: number[] = [],
    condition?: string,
  ) =>
    steps.push({
      id: `step-${steps.length}`,
      itemId,
      kind,
      cost,
      consumes,
      condition,
    });
  for (const id of starter) {
    const item = availableItem(data, id, p);
    inventory.push(id);
    add(id, "buy", item.cost);
  }
  while (inventory.includes(2003)) {
    inventory.splice(inventory.indexOf(2003), 1);
    add(
      2003,
      "consume",
      0,
      [],
      "Después de utilizar la poción; no se da por consumida en la partida real.",
    );
  }
  if (p.roles.includes("JUNGLE")) {
    const index = inventory.indexOf(1103);
    if (index >= 0) {
      inventory.splice(index, 1);
      add(
        1103,
        "quest",
        0,
        [],
        "Después de completar la evolución de la mascota y liberar su ranura.",
      );
    }
  }
  const build = (id: number, path: number[]) => {
    if (path.includes(id)) throw new Error("La receta contiene un ciclo.");
    const item = availableItem(data, id, p);
    for (const part of item.from) build(part, [...path, id]);
    for (const part of item.from) {
      const i = inventory.indexOf(part);
      if (i < 0) throw new Error("Falta un componente de la receta.");
      inventory.splice(i, 1);
    }
    if (inventory.length >= 6)
      throw new InventoryFull("No hay ranuras para los componentes.");
    inventory.push(id);
    add(
      id,
      item.from.length ? "combine" : "buy",
      item.from.length ? item.combineCost : item.cost,
      item.from,
    );
  };
  for (const id of targets) {
    const before = [...inventory];
    const count = steps.length;
    try {
      build(id, []);
    } catch (error) {
      if (!(error instanceof InventoryFull)) throw error;
      inventory = before;
      steps = steps.slice(0, count);
      // La compra directa evita suponer ranuras adicionales para componentes tardíos.
      const item = availableItem(data, id, p);
      if (inventory.length >= 6) {
        const index = inventory.indexOf(p.starter);
        if (index < 0 || p.starter === 3865) throw error;
        inventory.splice(index, 1);
        add(
          p.starter,
          "sell",
          0,
          [],
          "Vender el objeto inicial cuando haga falta una ranura.",
        );
      }
      if (inventory.length >= 6) throw error;
      inventory.push(id);
      add(
        id,
        "buy",
        item.cost,
        [],
        "Compra completa cuando no haya espacio para toda la receta; la biblioteca muestra sus componentes.",
      );
    }
  }
  return steps;
}

function finalItems(p: Profile, variant: string): number[] {
  const armor = variant === "armor",
    magic = variant === "magic";
  const boots = armor ? 3047 : magic ? 3111 : p.boots;
  const support = p.roles.includes("SUPPORT");
  let rest: number[];
  if (support) {
    rest =
      p.group === "pyke"
        ? [6694, armor ? 3026 : magic ? 3156 : 6696]
        : p.group === "enchanter"
          ? [3107, armor ? 3190 : magic ? 3222 : 2065]
          : [3050, armor ? 3110 : magic ? 3065 : 3107];
  } else if (p.group.includes("tank")) {
    rest = [3075, 3065, armor ? 3143 : magic ? 2504 : 3083];
  } else if (p.group === "critmelee") {
    rest = [3072, 3036, armor ? 6333 : magic ? 3156 : 3026];
  } else if (p.damage === "magic") {
    rest = [3089, 3135, armor ? 3157 : magic ? 3102 : 3157];
  } else if (["marksman", "jhin"].includes(p.group)) {
    rest = [3094, 3036, armor ? 3143 : magic ? 3156 : 3026];
  } else if (p.group === "onhit" || p.group === "jungleattacks") {
    rest = [3091, 3302, armor ? 3143 : magic ? 3156 : 3026];
  } else if (p.group === "adassassin" || p.group === "junglead") {
    rest = [6696, armor ? 3026 : magic ? 3156 : 6695, 3161];
  } else if (p.group === "ezreal") {
    rest = [6694, 3161, armor ? 3026 : magic ? 3156 : 3072];
  } else {
    rest = [3161, 6333, armor ? 3143 : 3065];
  }
  return [p.core[0], boots, p.core[1], ...rest];
}

function teamProfiles(slots: DraftSlot[]): Profile[] {
  return slots.flatMap((s) =>
    s.championId && profileById.has(s.championId)
      ? [profileById.get(s.championId)!]
      : [],
  );
}
function named(data: GameData, ps: Profile[]): string {
  return ps
    .map(
      (p) =>
        data.catalog.champions.find((c) => c.id === p.championId)?.name ??
        p.slug,
    )
    .join(", ");
}

function strategy(data: GameData, p: Profile, ctx: DraftContext): string[] {
  const allies = teamProfiles(ctx.allies),
    enemies = teamProfiles(ctx.enemies);
  const champion = named(data, [p]);
  const front = enemies.filter((e) => e.traits.includes("frontline")),
    engage = enemies.filter((e) => e.traits.includes("engage"));
  const lines: string[] = [];
  if (p.traits.includes("side"))
    lines.push(
      `${champion} ofrece presión lateral. Ese plan necesita que el equipo pueda sostener el mapa sin agruparse siempre.`,
    );
  else if (p.traits.includes("peel"))
    lines.push(
      `${champion} aporta protección. Acompañar al daño sostenido aliado es una alternativa a buscar la iniciación.`,
    );
  else if (p.traits.includes("poke"))
    lines.push(
      `${champion} puede desgastar antes de una pelea. La composición aprovecha menos ese alcance si busca contacto inmediato.`,
    );
  else if (p.traits.includes("engage"))
    lines.push(
      `${champion} puede abrir peleas; necesita seguimiento aliado para aprovechar el control inicial.`,
    );
  else if (p.traits.includes("burst"))
    lines.push(
      `${champion} concentra daño en ventanas cortas. Su plan pierde fuerza en intercambios prolongados contra primera línea.`,
    );
  else
    lines.push(
      `${champion} busca daño sostenido. La protección aliada y el espacio para atacar condicionan su aporte en peleas.`,
    );
  if (front.length)
    lines.push(
      `La primera línea de ${named(data, front)} hace razonable preparar penetración o daño sostenido, sujeto a sus compras.`,
    );
  if (engage.length)
    lines.push(
      `${named(data, engage)} aporta iniciación: el posicionamiento previo y conservar una respuesta defensiva son factores del draft.`,
    );
  const scaling = allies.filter((a) => a.traits.includes("scaling"));
  if (scaling.length >= 2)
    lines.push(
      `${named(data, scaling)} aporta opciones de escalado; la composición no necesita resolver todas las peleas en los primeros niveles.`,
    );
  if (ctx.enemies.some((e) => e.championId === null) || ctx.enemies.length < 5)
    lines.push(
      "El equipo rival está incompleto. El plan queda provisional hasta conocer el resto de los picks.",
    );
  return lines.slice(0, 4);
}

export function rankChampions(
  data: GameData,
  ctx: DraftContext,
  pool?: number[],
): RankEntry[] {
  if (!ctx.playerRole) return [];
  const occupied = new Set([
    ...ctx.bans,
    ...ctx.allies
      .concat(ctx.enemies)
      .flatMap((s) => (s.championId ? [s.championId] : [])),
  ]);
  const allies = teamProfiles(ctx.allies),
    enemies = teamProfiles(ctx.enemies);
  return profiles
    .filter(
      (p) =>
        p.roles.includes(ctx.playerRole!) &&
        !occupied.has(p.championId) &&
        data.catalog.champions.some((c) => c.id === p.championId) &&
        (!pool || pool.includes(p.championId)),
    )
    .map((p) => {
      let score = 50;
      const reasons: string[] = [];
      if (
        !allies.some((a) => a.traits.includes("frontline")) &&
        p.traits.includes("frontline")
      ) {
        score += 18;
        reasons.push("Añade primera línea a los aliados conocidos.");
      }
      if (
        !allies.some((a) => a.traits.includes("engage")) &&
        p.traits.includes("engage")
      ) {
        score += 12;
        reasons.push("Aporta una opción de iniciación.");
      }
      if (
        allies.filter((a) => a.damage === "physical").length >= 2 &&
        p.damage === "magic"
      ) {
        score += 15;
        reasons.push(
          "Diversifica el daño frente a la concentración física aliada.",
        );
      }
      if (
        allies.filter((a) => a.damage === "magic").length >= 2 &&
        p.damage === "physical"
      ) {
        score += 15;
        reasons.push(
          "Diversifica el daño frente a la concentración mágica aliada.",
        );
      }
      if (
        enemies.filter((e) => e.traits.includes("frontline")).length >= 2 &&
        (p.traits.includes("antiTank") || p.traits.includes("attacks"))
      ) {
        score += 10;
        reasons.push(
          "Ofrece daño sostenido contra la primera línea rival conocida.",
        );
      }
      if (
        enemies.filter((e) => e.traits.includes("engage")).length >= 2 &&
        p.traits.includes("peel")
      ) {
        score += 10;
        reasons.push(
          "Añade protección frente a varias fuentes de iniciación rival.",
        );
      }
      if (!reasons.length)
        reasons.push(
          "Encaja en el rol; el draft conocido todavía no establece una ventaja estratégica clara.",
        );
      return {
        championId: p.championId,
        score: Math.min(95, score),
        reasons,
        tradeoff: p.traits.includes("frontline")
          ? "Entrar requiere seguimiento; la resistencia no garantiza ganar el intercambio."
          : p.traits.includes("scaling")
            ? "Su aporte depende del tiempo y los recursos disponibles para escalar."
            : "La ventaja depende de ejecutar el perfil del campeón; no hay datos de matchup incorporados.",
      };
    })
    .sort((a, b) => b.score - a.score || a.championId - b.championId);
}

export function recommend(
  data: GameData,
  ctx: DraftContext,
  pool?: number[],
): Recommendation {
  const signature = JSON.stringify([
    ctx,
    data.catalog.version,
    rulesRevision,
    pool,
  ]);
  const errors: string[] = [];
  const plans: Plan[] = [];
  const known = ctx.allies.concat(ctx.enemies).filter((s) => s.championId),
    covered = teamProfiles(known).length;
  const result = {
    plans,
    ranking: [] as RankEntry[],
    errors,
    coverage: `${covered}/${known.length} picks conocidos con perfil estratégico. Reglas ${rulesPatch}, revisión ${rulesRevision}; sin estadísticas de meta.`,
    signature,
  };
  if (
    !data.catalog.version.startsWith(rulesPatch + ".") ||
    (ctx.gameVersion && !ctx.gameVersion.startsWith(rulesPatch + "."))
  ) {
    errors.push(
      "Las reglas estratégicas necesitan revisión para el parche activo. El catálogo se puede actualizar de forma independiente.",
    );
    return result;
  }
  result.ranking = rankChampions(data, ctx, pool);
  if (!ctx.playerChampionId) {
    errors.push("Elegí tu campeón para preparar runas y compras.");
    return result;
  }
  const p = profileById.get(ctx.playerChampionId);
  if (!p) {
    errors.push(
      "Este campeón todavía no tiene un perfil estratégico revisado. Sus datos e imágenes están disponibles en la biblioteca.",
    );
    return result;
  }
  if (!ctx.playerRole || !p.roles.includes(ctx.playerRole)) {
    errors.push("Este campeón no tiene un plan revisado para el rol indicado.");
    return result;
  }
  const enemies = teamProfiles(ctx.enemies);
  const physical = enemies.filter((e) => e.damage === "physical"),
    magic = enemies.filter((e) => e.damage === "magic");
  const preferred =
    physical.length >= 3 && physical.length > magic.length
      ? "armor"
      : magic.length >= 3 && magic.length > physical.length
        ? "magic"
        : "principal";
  for (const variant of ["principal", "armor", "magic"]) {
    try {
      const runes = runePage(p, variant);
      const invalid = validateRunes(data, runes);
      if (invalid.length) throw new Error(invalid.join(" "));
      const items = finalItems(p, variant);
      const questUpgrade = p.roles.includes("SUPPORT")
        ? p.group === "enchanter"
          ? 3870
          : p.group === "pyke"
            ? 3877
            : 3869
        : null;
      if (questUpgrade) {
        const upgrade = availableItem(data, questUpgrade, p);
        if (!upgrade.from.includes(3867))
          throw new Error("La mejora de misión requiere revisar su evolución.");
      }
      if (new Set(items).size !== items.length)
        throw new Error("El plan repite objetos completos.");
      if ([3053, 3156].every((id) => items.includes(id)))
        throw new Error(
          "El plan combina opciones incompatibles de salvavidas.",
        );
      const starter = p.roles.includes("SUPPORT")
        ? [3865, 2003, 2003]
        : [p.starter, 2003];
      const steps = purchaseRoute(data, p, starter, items);
      plans.push({
        id: variant,
        recommended: variant === preferred,
        title:
          variant === "principal"
            ? "Plan equilibrado"
            : variant === "armor"
              ? "Resistir ataques físicos"
              : "Resistir daño mágico",
        reason:
          variant === "principal"
            ? "Mantiene el núcleo del perfil y una respuesta defensiva general."
            : variant === "armor"
              ? "Prioriza botas defensivas y una respuesta a ataques físicos, preparada antes de jugar."
              : "Añade resistencia mágica; cobra valor si el daño mágico rival condiciona tu acceso a las peleas.",
        tradeoff:
          variant === "principal"
            ? "No maximiza resistencia contra un único tipo de amenaza."
            : "Dedicar oro a defensa retrasa daño, penetración o utilidad del plan base.",
        starter,
        items,
        questUpgrade,
        runes,
        steps,
        branches: [
          "Si cambia tu rol o el campeón, preparar un plan nuevo antes de entrar a partida.",
          ...(questUpgrade
            ? [
                "Conservar Mapamundi y completar su misión hasta Recompensa Mundial. Elegir la mejora indicada en esa misma ranura; no se compra como un séptimo objeto.",
              ]
            : []),
          ...(teamProfiles(ctx.enemies).filter((e) =>
            e.traits.includes("healing"),
          ).length >= 2
            ? [
                "El draft contiene varias fuentes de curación. Evaluar reducción de curaciones con el equipo; no se incorpora automáticamente una compra incompatible.",
              ]
            : []),
        ],
        strategy: strategy(data, p, ctx),
      });
    } catch (e) {
      errors.push(
        `${variant}: ${e instanceof Error ? e.message : "Plan incompatible"}`,
      );
    }
  }
  const preferredPlan = plans.find((p) => p.recommended);
  if (preferredPlan && preferred !== "principal")
    preferredPlan.reason += ` ${named(data, preferred === "armor" ? physical : magic)} concentra ${preferred === "armor" ? "perfiles físicos" : "perfiles mágicos"} en el draft conocido. Es una previsión por campeón, no daño observado en partida.`;
  plans.sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return result;
}

export function possibleRoles(slots: DraftSlot[]): (Role[] | null)[] {
  const all: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
  const options = slots.map((s) =>
    s.role
      ? [s.role]
      : s.championId
        ? (profileById.get(s.championId)?.roles ?? all)
        : all,
  );
  const assignments: Role[][] = [];
  function walk(index: number, chosen: Role[]) {
    if (index === options.length) {
      assignments.push(chosen);
      return;
    }
    for (const r of options[index])
      if (!chosen.includes(r)) walk(index + 1, [...chosen, r]);
  }
  walk(0, []);
  return slots.map((s, i) =>
    !s.championId || !profileById.has(s.championId)
      ? null
      : [...new Set(assignments.map((a) => a[i]))],
  );
}
