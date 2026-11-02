import {
  hasSample,
  officialPages,
  clientPatch,
  type Analysis,
  type Sample,
} from "./analysis";
import { strategy } from "./strategy";
import { contextualLoadout } from "./loadoutContext";
import { skillOrder, type SkillOrder } from "./skillOrder";
import { draftSignals } from "./draftSignals";
import { matchupEvidence, type MatchupEvidence } from "./matchups";
import {
  searchConfigurations,
  type Configuration,
} from "./configurationSearch";
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
  kind: "buy" | "combine" | "sell" | "consume" | "quest" | "grant";
  cost: number;
  consumes: number[];
  condition?: string;
}
export interface Plan {
  adjustments: string[];
  skills?: SkillOrder;
  matchups: MatchupEvidence[];
  checkpoints: { itemId: number; finishInto: number; reason: string }[];
  recommended: boolean;
  id: string;
  title: string;
  reason: string;
  tradeoff: string;
  starter: number[];
  items: number[];
  questUpgrade: number | null;
  spells: number[];
  source: string;
  samples: { label: string; play: number; win: number }[];
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
  candidates?: Configuration[];
  plans: Plan[];
  ranking: RankEntry[];
  errors: string[];
  coverage: string;
  signature: string;
}

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
  runes?: RunePage,
  earlyComponents: number[] = [],
): PurchaseStep[] {
  let inventory: number[] = [];
  let steps: PurchaseStep[] = [];
  let heldComponents = 0;
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
    const index = inventory.findIndex((id) => [1101, 1102, 1103].includes(id));
    if (index >= 0) {
      const pet = inventory.splice(index, 1)[0];
      add(
        pet,
        "quest",
        0,
        [],
        "Después de completar la evolución de la mascota y liberar su ranura.",
      );
    }
  }
  const build = (id: number, path: number[]) => {
    if (path.includes(id)) throw new Error("La receta contiene un ciclo.");
    if (
      id === 1001 &&
      runes &&
      [...runes.primaryRunes, ...runes.secondaryRunes].includes(8304)
    ) {
      inventory.push(2422);
      add(
        2422,
        "grant",
        0,
        [],
        "Recibir el Calzado Mágico de la runa antes de mejorar botas; no se compra la bota básica.",
      );
      return;
    }
    const item = availableItem(data, id, p);
    const consumed: number[] = [];
    for (const part of item.from) {
      let actual = part === 1001 && inventory.includes(2422) ? 2422 : part;
      if (!inventory.includes(actual)) build(part, [...path, id]);
      actual = part === 1001 && inventory.includes(2422) ? 2422 : part;
      const i = inventory.indexOf(actual);
      if (i < 0) throw new Error("Falta un componente de la receta.");
      inventory.splice(i, 1);
      consumed.push(actual);
      heldComponents++;
    }
    heldComponents -= consumed.length;
    if (inventory.length + heldComponents >= 6)
      throw new InventoryFull("No hay ranuras para los componentes.");
    inventory.push(id);
    add(
      id,
      item.from.length ? "combine" : "buy",
      item.from.length ? item.combineCost : item.cost,
      consumed,
    );
  };
  const ordered = [
    ...targets.slice(0, 2),
    ...earlyComponents,
    ...targets.slice(2),
  ];
  for (const id of ordered) {
    const before = [...inventory];
    const count = steps.length;
    const heldBefore = heldComponents;
    try {
      build(id, []);
    } catch (error) {
      if (!(error instanceof InventoryFull)) throw error;
      inventory = before;
      heldComponents = heldBefore;
      steps = steps.slice(0, count);
      // La compra directa evita suponer ranuras adicionales para componentes tardíos.
      const item = availableItem(data, id, p);
      const availableParts: number[] = [];
      const consumeOwned = (part: number, path: number[]) => {
        if (path.includes(part))
          throw new Error("La receta contiene un ciclo.");
        const index = inventory.indexOf(part);
        if (index >= 0) {
          inventory.splice(index, 1);
          availableParts.push(part);
        } else
          for (const child of availableItem(data, part, p).from)
            consumeOwned(child, [...path, part]);
      };
      for (const part of item.from) consumeOwned(part, [id]);
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
        item.cost -
          availableParts.reduce(
            (n, part) => n + availableItem(data, part, p).cost,
            0,
          ),
        availableParts,
        "Compra completa cuando no haya espacio para toda la receta; la biblioteca muestra sus componentes.",
      );
    }
  }
  return steps;
}

function teamProfiles(slots: DraftSlot[]): Profile[] {
  return slots.flatMap((s) =>
    s.championId && profileById.has(s.championId)
      ? [profileById.get(s.championId)!]
      : [],
  );
}
function compatibleItems(ids: number[]) {
  return [
    [3053, 3156, 6673],
    [3033, 3036, 6694],
    [3135, 3137],
  ].every((group) => ids.filter((id) => group.includes(id)).length <= 1);
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
      .filter((s) => s.locked || s.championId === ctx.playerChampionId)
      .concat(ctx.enemies)
      .flatMap((s) => (s.championId ? [s.championId] : [])),
  ]);
  const enemies = teamProfiles(ctx.enemies);
  const allyMass = (test: (p: Profile) => boolean) =>
    ctx.allies
      .filter((s) => s.championId !== ctx.playerChampionId)
      .reduce((n, s) => {
        const p = s.championId ? profileById.get(s.championId) : undefined;
        return n + (p && test(p) ? (s.locked ? 1 : 0.35) : 0);
      }, 0);
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
        allyMass((a) => a.traits.includes("frontline")) < 1 &&
        p.traits.includes("frontline")
      ) {
        score +=
          18 *
          (1 -
            Math.min(
              1,
              allyMass((a) => a.traits.includes("frontline")),
            ));
        reasons.push("Añade primera línea a los aliados conocidos.");
      }
      if (
        allyMass((a) => a.traits.includes("engage")) < 1 &&
        p.traits.includes("engage")
      ) {
        score +=
          12 *
          (1 -
            Math.min(
              1,
              allyMass((a) => a.traits.includes("engage")),
            ));
        reasons.push("Aporta una opción de iniciación.");
      }
      if (
        allyMass((a) => a.damage === "physical") > 1 &&
        p.damage === "magic"
      ) {
        score += 15 * Math.min(1, allyMass((a) => a.damage === "physical") - 1);
        reasons.push(
          "Diversifica el daño frente a la concentración física aliada.",
        );
      }
      if (
        allyMass((a) => a.damage === "magic") > 1 &&
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
      if (ctx.allies.some((s) => s.championId === p.championId && !s.locked)) {
        score -= 10;
        reasons.push(
          "Está en hover de un aliado: confirmar la disponibilidad antes de elegirlo.",
        );
      }
      return {
        championId: p.championId,
        score: Math.max(0, Math.min(95, Math.round(score))),
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
  analysis?: Analysis,
  preferredConfigurationId?: string,
): Recommendation {
  const signature = JSON.stringify([
    ctx,
    data.catalog.version,
    rulesRevision,
    pool,
    analysis,
  ]);
  const errors: string[] = [];
  const result: Recommendation = {
    plans: [],
    ranking: [],
    errors,
    coverage: `${profiles.length} campeones con posiciones del cliente. Composición por reglas; builds con fuente y muestra.`,
    signature,
  };
  const patch = data.catalog.version.split(".").slice(0, 2).join(".");
  if (
    patch !== rulesPatch ||
    (ctx.gameVersion && !ctx.gameVersion.startsWith(patch + "."))
  ) {
    errors.push(
      "Los datos y el cliente pertenecen a parches distintos. Actualizá el paquete antes de preparar la partida.",
    );
    return result;
  }
  result.ranking = rankChampions(data, ctx, pool);
  if (!ctx.playerChampionId || !ctx.playerRole) {
    errors.push("Elegí campeón y posición para preparar la partida.");
    return result;
  }
  const p = profileById.get(ctx.playerChampionId);
  if (!p) {
    errors.push("El campeón no figura en el paquete activo.");
    return result;
  }
  if (!analysis) {
    errors.push(
      "La build necesita un análisis por campeón y posición. No se completa con una plantilla genérica.",
    );
    return result;
  }
  const a = analysis.analysis?.data;
  if (!a || a.trends?.win?.version !== patch) {
    errors.push(
      "El proveedor no informa tendencias para el parche activo. No usamos esa build como actual.",
    );
    return result;
  }
  if (
    analysis.analysis.position.toUpperCase() !==
    {
      MID: "MID",
      BOT: "ADC",
      SUPPORT: "SUPPORT",
      TOP: "TOP",
      JUNGLE: "JUNGLE",
    }[ctx.playerRole]
  ) {
    errors.push("El análisis corresponde a otra posición.");
    return result;
  }
  if (!hasSample(a.core_items) || !hasSample(a.starter_items)) {
    errors.push(
      "No hay muestra suficiente para el núcleo o el inicio de esta posición.",
    );
    return result;
  }
  const providerRunes: RunePage = {
    primary: a.runes?.primary_page_id,
    secondary: a.runes?.secondary_page_id,
    primaryRunes: a.runes?.primary_rune_ids ?? [],
    secondaryRunes: a.runes?.secondary_rune_ids ?? [],
    shards: a.runes?.stat_mod_ids ?? [],
  };
  if (validateRunes(data, providerRunes).length) {
    errors.push("Las runas del proveedor no son compatibles con el paquete.");
    return result;
  }
  const loadout = contextualLoadout(
    data,
    ctx,
    providerRunes,
    hasSample(a.summoner_spells) ? a.summoner_spells.ids : [],
  );
  const runes = loadout.runes;
  if (validateRunes(data, runes).length) {
    errors.push(
      "El ajuste contextual produjo una página inválida; no se ofrece para importar.",
    );
    return result;
  }
  const official =
    patch === clientPatch ? officialPages(p.championId, ctx.playerRole) : [];
  const agrees = official.some(
    (page) =>
      JSON.stringify([...page.primaryRunes, ...page.secondaryRunes].sort()) ===
      JSON.stringify([...runes.primaryRunes, ...runes.secondaryRunes].sort()),
  );
  const item = (id: number) => data.items.find((i) => i.id === id);
  const upgrade =
    a.core_items.ids.find((id) =>
      [3869, 3870, 3871, 3876, 3877].includes(id),
    ) ?? null;
  const core = a.core_items.ids.filter((id) => id !== upgrade);
  const signals = draftSignals(ctx);
  const boots = hasSample(a.boots) ? [...a.boots.ids] : [];
  const adjustments = [...loadout.reasons];
  const defensiveBoots =
    signals.magic >= 3 ? 3111 : signals.physical >= 3 ? 3047 : null;
  if (
    boots.length === 1 &&
    [3006, 3047, 3111, 3158, 3020, 3009].includes(boots[0]) &&
    defensiveBoots &&
    defensiveBoots !== boots[0] &&
    item(defensiveBoots)?.purchasable
  ) {
    boots[0] = defensiveBoots;
    adjustments.push(
      `${item(defensiveBoots)!.name}: resistencia ante la concentración de daño ${defensiveBoots === 3111 ? "mágico" : "físico"} rival; sustituye las botas estadísticas. Ajuste por reglas, no por muestra de matchup.`,
    );
  }
  const base = [...core.slice(0, 1), ...boots, ...core.slice(1)];
  const limit =
    ctx.playerRole === "SUPPORT" && a.starter_items.ids.includes(3865) ? 5 : 6;
  const rows = [
    ...(a.fourth_items ?? []),
    ...(a.fifth_items ?? []),
    ...(a.sixth_items ?? []),
  ]
    .filter(hasSample)
    .filter((row) =>
      row.ids.every((id) => !base.includes(id) && id !== upgrade),
    );
  const candidates: { ids: number[]; samples: Sample[]; fit: number }[] = [];
  const physical = signals.physical,
    magic = signals.magic;
  for (const first of rows) {
    const ids = [...base, ...first.ids];
    if (!compatibleItems(ids)) continue;
    const samples = [first];
    for (const row of [
      ...(a.fifth_items ?? []),
      ...(a.sixth_items ?? []),
      ...rows,
    ].filter(hasSample)) {
      if (ids.length >= limit) break;
      if (
        row.ids.some((id) => ids.includes(id) || id === upgrade) ||
        ids.length + row.ids.length > limit ||
        !compatibleItems([...ids, ...row.ids])
      )
        continue;
      ids.push(...row.ids);
      samples.push(row);
    }
    if (
      ids.length !== limit ||
      new Set(ids).size !== ids.length ||
      candidates.some((c) => c.ids.join() === ids.join())
    )
      continue;
    const fit = ids.reduce(
      (n, id) =>
        n +
        (item(id)?.tags.includes("Armor") ? physical : 0) +
        (item(id)?.tags.includes("SpellBlock") ? magic : 0),
      0,
    );
    candidates.push({ ids, samples, fit });
  }
  if (base.length === limit)
    candidates.push({ ids: base, samples: [], fit: 0 });
  candidates.sort((a, b) => b.fit - a.fit);
  for (const candidate of candidates) {
    if (
      result.plans.length >= 3 &&
      !preferredConfigurationId?.startsWith(
        `config-${candidate.ids.join("-")}-`,
      )
    )
      continue;
    const index = result.plans.length;
    try {
      const starter = a.starter_items.ids;
      const routeProfile = {
        ...p,
        roles: [ctx.playerRole],
        starter: starter[0],
      };
      if (!compatibleItems(candidate.ids)) continue;
      const checkpoints: Plan["checkpoints"] = [];
      if (signals.healing.length >= 2) {
        for (const finishInto of candidate.ids.slice(2)) {
          const component = item(finishInto)?.from.find((id) =>
            [3076, 3123, 3916].includes(id),
          );
          if (
            !component ||
            !item(component)?.purchasable ||
            !/heridas graves/iu.test(item(component)!.description)
          )
            continue;
          if (
            component === 3076 &&
            !signals.healing.some((e) => e.profile.traits.includes("attacks"))
          )
            continue;
          checkpoints.push({
            itemId: component,
            finishInto,
            reason:
              "Adelantar heridas graves tras las dos primeras compras ante varias fuentes de curación; completar el objeto más adelante. Revisar si otro aliado puede cubrirlas. Vesta requiere recibir ataques del objetivo.",
          });
          break;
        }
      }
      const steps = purchaseRoute(
        data,
        routeProfile,
        starter,
        candidate.ids,
        runes,
        checkpoints.map((c) => c.itemId),
      );
      result.plans.push({
        id: `items-${candidate.ids.join("-")}`,
        recommended: index === 0,
        title:
          index === 0 ? "Plan por composición" : `Alternativa ${index + 1}`,
        reason: `Núcleo observado por OP.GG. ${candidate.ids
          .slice(base.length)
          .map((id) => item(id)?.name)
          .join(
            " y ",
          )} completa la ruta entre opciones publicadas por esa fuente.`,
        tradeoff:
          "Las muestras de cada compra se observan por separado: no representan la probabilidad de ganar con este plan completo.",
        starter,
        items: candidate.ids,
        questUpgrade: upgrade,
        runes,
        spells: loadout.spells,
        adjustments,
        skills: skillOrder(ctx, analysis),
        matchups: matchupEvidence(ctx, analysis),
        checkpoints,
        source: `OP.GG MCP · tendencias ${a.trends.win.version} · región no informada · todos los rangos. ${agrees ? "La página coincide con una recomendación del cliente de Riot." : "La página difiere de las recomendaciones del cliente; no hay consenso demostrado."}`,
        samples: [
          { label: "Núcleo", play: a.core_items.play, win: a.core_items.win },
          ...candidate.samples.map((row, i) => ({
            label: `Compra alternativa ${i + 1}`,
            play: row.play,
            win: row.win,
          })),
        ],
        steps,
        branches: [
          ...([...runes.primaryRunes, ...runes.secondaryRunes].includes(8304)
            ? [
                "Calzado Mágico impide comprar botas antes de recibir las gratuitas. La ruta de componentes requiere esa condición; no da por cumplido su momento de obtención.",
              ]
            : []),
          "Las variantes completas se construyen a partir de compras observadas por separado. Necesitan evaluación estratégica; no son combinaciones con una tasa conjunta medida.",
        ],
        strategy: strategy(data, ctx),
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Ruta no compatible");
    }
  }
  if (!result.plans.length && !errors.length)
    errors.push(
      "La fuente no ofrece una ruta completa compatible; no añadimos objetos de relleno.",
    );
  const configurations = searchConfigurations(
    data,
    ctx,
    result.plans,
    providerRunes,
    preferredConfigurationId,
  );
  if (configurations.length) {
    result.candidates = configurations;
    result.plans = configurations.slice(0, 3);
  }
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
