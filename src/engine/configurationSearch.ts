import type { GameData } from "../gameData";
import type { DraftContext, Plan, RunePage } from "./recommendations";
import { purchaseRoute, validateRunes } from "./recommendations";
import { officialPages } from "./analysis";
import { draftSignals } from "./draftSignals";
import { getClientKnowledge, profileById } from "./profiles";
import { expandRunePages, createRuneEvaluator, runeKey } from "./runeSearch";
import { buildSearch, buildStats, type BuildEvaluation } from "./buildSearch";
import { championTools } from "./championTools";

export interface DecisionReason {
  id: string;
  text: string;
  references: string[];
  weight: number;
}
export interface Configuration extends Plan {
  decision: {
    score: number;
    reasons: DecisionReason[];
    changes: string[];
    evaluation: BuildEvaluation;
  };
}
const runeIds = (p: RunePage) => [
  ...p.primaryRunes,
  ...p.secondaryRunes,
  ...p.shards,
];

export function searchConfigurations(
  data: GameData,
  ctx: DraftContext,
  observed: Plan[],
  providerPage?: RunePage,
  preferredId?: string,
): Configuration[] {
  if (!ctx.playerChampionId || !ctx.playerRole || !observed.length) return [];
  const own = getClientKnowledge().champions.find(
    (c) => c.id === ctx.playerChampionId,
  );
  const profile = profileById.get(ctx.playerChampionId)!;
  if (!own || !profile) return [];
  const signals = draftSignals(ctx);
  const evaluateRunes = createRuneEvaluator(data, ctx);
  const item = (id: number) => data.items.find((i) => i.id === id);
  const name = (id: number) =>
    data.catalog.champions.find((c) => c.id === id)?.name ?? String(id);
  const rune = (id: number) =>
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .find((r) => r.id === id);
  const pages: RunePage[] = [];
  const riotPages = officialPages(ctx.playerChampionId, ctx.playerRole);
  const previous = /^config-(?:\d+-)*\d+$/u.test(preferredId ?? "")
    ? preferredId!.slice(7).split("-").map(Number)
    : [];
  const previousRunes = previous.slice(-9);
  const previousPage: RunePage = {
    primary:
      data.trees.find((t) =>
        t.slots[0].runes.some((r) => r.id === previousRunes[0]),
      )?.id ?? 0,
    secondary:
      data.trees.find((t) =>
        t.slots
          .slice(1)
          .some((s) => s.runes.some((r) => r.id === previousRunes[4])),
      )?.id ?? 0,
    primaryRunes: previousRunes.slice(0, 4),
    secondaryRunes: previousRunes.slice(4, 6),
    shards: previousRunes.slice(6),
  };
  for (const p of [
    providerPage ?? observed[0].runes,
    observed[0].runes,
    ...riotPages,
  ]) {
    if (
      !validateRunes(data, p).length &&
      !pages.some((q) => runeIds(q).join() === runeIds(p).join())
    )
      pages.push(p);
  }
  const publishedPages = new Set(pages.map(runeKey));
  const expanded = expandRunePages(data, ctx, pages);
  pages.splice(0, pages.length, ...expanded);
  const lane = signals.enemies.find(
    (e) => e.locked && e.role === ctx.playerRole,
  );
  if (
    !validateRunes(data, previousPage).length &&
    !pages.some((p) => runeIds(p).join() === runeIds(previousPage).join())
  )
    pages.push(previousPage);
  const output: Configuration[] = [];
  const reference = buildStats(observed[0].items.map((id) => item(id)!));
  for (const build of buildSearch(data, ctx, observed, previous.slice(0, -9))) {
    const seed = build.seed;
    for (const page of pages) {
      const ids = runeIds(page);
      const key = page.primaryRunes[0];
      const reasons: DecisionReason[] = [];
      const add = (text: string, references: string[], weight: number) =>
        reasons.push({ id: `e${reasons.length}`, text, references, weight });
      const published =
        runeIds(page).join() === runeIds(providerPage ?? seed.runes).join();
      const adapted =
        expanded.some((p) => runeKey(p) === runeKey(page)) &&
        !publishedPages.has(runeKey(page));
      const retained =
        runeKey(page) === runeKey(previousPage) &&
        !publishedPages.has(runeKey(page));
      add(
        published
          ? "Configuración de runas observada por la fuente para este campeón y rol."
          : adapted
            ? "Página adaptada por Kahoru a partir de una opción del campeón y rol; sin muestra estadística propia."
            : retained
              ? "Página elegida previamente; se reevalúa con el draft actual, sin muestra estadística propia."
              : "Página alternativa publicada por el cliente para este campeón y rol; se evalúa completa, incluida su runa clave.",
        [`champion:${ctx.playerChampionId}`, `rune:${key}`],
        published ? 0.3 : 0,
      );
      for (const reason of evaluateRunes(page, build.evaluation.stats.speed))
        add(reason.text, [`rune:${reason.rune}`], reason.weight);
      const mechanics = build.evaluation.mechanics;
      if (championTools(ctx.playerChampionId).specialAttacks)
        add(
          "La pasiva modifica las reglas de ataque o crítico. Se limita el cambio de la referencia porque faltan sus coeficientes completos; no se simula como un atacante estándar.",
          [`champion:${ctx.playerChampionId}`],
          0,
        );
      if (mechanics.critDamage && build.evaluation.stats.crit)
        add(
          "El daño crítico adicional se evalúa junto a la probabilidad de crítico de toda la ruta; no como DA aislado.",
          build.ids
            .filter((id) =>
              /Daño de Golpe Crítico/iu.test(item(id)!.description),
            )
            .map((id) => `item:${id}`),
          0,
        );
      if (mechanics.tenacity && signals.tenacity.length)
        add(
          `Tenacidad frente a ${signals.tenacity.map((e) => name(e.championId)).join(", ")}; no se cuenta dos veces la misma respuesta ni se aplica a supresiones o desplazamientos.`,
          build.ids.map((id) => `item:${id}`),
          0,
        );
      for (const id of build.ids) {
        const it = item(id)!;
        if (it.tags.includes("Armor") && signals.physical >= 2)
          add(
            `${it.name}: armadura frente a ${signals.enemies
              .filter((e) => e.profile.damage === "physical")
              .map((e) => name(e.championId))
              .join(", ")}.`,
            [`item:${id}`],
            0,
          );
        if (it.tags.includes("SpellBlock") && signals.magic >= 2)
          add(
            `${it.name}: resistencia mágica frente a ${signals.enemies
              .filter((e) => e.profile.damage === "magic")
              .map((e) => name(e.championId))
              .join(", ")}.`,
            [`item:${id}`],
            0,
          );
        if (/heridas/iu.test(it.description) && signals.healing.length >= 2)
          add(
            `${it.name}: respuesta a la curación de ${signals.healing.map((e) => name(e.championId)).join(", ")}; revisar su condición de aplicación.`,
            [`item:${id}`],
            0,
          );
        if (
          (it.tags.includes("MagicPenetration") ||
            it.tags.includes("ArmorPenetration")) &&
          signals.frontline >= 2
        )
          add(
            `${it.name}: alternativa de penetración frente a primera línea; no se presupone qué resistencias comprarán.`,
            [`item:${id}`],
            0,
          );
      }
      const changes = [...build.changes];
      const deltas = Object.entries(build.evaluation.stats).flatMap(
        ([stat, value]) => {
          const key = stat as keyof typeof reference;
          const delta = value - reference[key];
          if (Math.abs(delta) < 0.001) return [];
          const labels = {
            ad: "DA",
            ap: "PH",
            health: "vida",
            armor: "armadura",
            mr: "RM",
            speed: "velocidad de ataque",
            crit: "crítico",
          };
          return [
            `${labels[key]} ${delta > 0 ? "+" : ""}${Math.round(delta * (["speed", "crit"].includes(key) ? 100 : 1))}${["speed", "crit"].includes(key) ? " puntos porcentuales" : ""}`,
          ];
        },
      );
      if (deltas.length)
        add(
          `Frente a la referencia: ${deltas.join(", ")}. Diferencia de atributos fijos; los modificadores reconocidos se evalúan por separado, sin simular una rotación completa.`,
          build.ids.map((id) => `item:${id}`),
          0,
        );
      if (key !== seed.runes.primaryRunes[0])
        changes.push(
          `Runa clave: ${rune(seed.runes.primaryRunes[0])?.name} → ${rune(key)?.name}.`,
        );
      const score =
        build.evaluation.score + reasons.reduce((n, r) => n + r.weight, 0);
      const id = `config-${build.ids.join("-")}-${ids.join("-")}`;
      const stats = build.evaluation.stats;
      const focus = build.ids.some((id) =>
        [3165, 3033, 6609, 3075].includes(id),
      )
        ? "Heridas graves"
        : stats.armor >= 50 && stats.mr >= 40
          ? "Defensa mixta"
          : stats.mr >= 40
            ? "Resistencia mágica"
            : stats.armor >= 50
              ? "Armadura"
              : build.ids.includes(6653)
                ? "Desgaste"
                : stats.crit >= 0.5
                  ? "Crítico"
                  : stats.speed >= 0.4
                    ? "Ataques"
                    : "Daño";
      const footwear = build.ids.find((id) => item(id)!.tags.includes("Boots"));
      const firstPurchase = build.ids.find(
        (id) => !item(id)!.tags.includes("Boots"),
      )!;
      if (output.some((p) => p.id === id)) continue;
      try {
        const checkpoints: Plan["checkpoints"] = [];
        if (!checkpoints.length && signals.healing.length >= 2) {
          for (const finishInto of build.ids.slice(1)) {
            const component = item(finishInto)?.from.find((id) =>
              [3916, 3123, 3076].includes(id),
            );
            if (
              !component ||
              (component === 3076 &&
                !signals.healing.some((e) =>
                  e.profile.traits.includes("attacks"),
                ))
            )
              continue;
            checkpoints.push({
              itemId: component,
              finishInto,
              afterItems:
                ctx.playerRole !== "JUNGLE" &&
                lane &&
                signals.healing.some((e) => e.championId === lane.championId)
                  ? 0
                  : build.ids.findIndex(
                      (id) => !item(id)!.tags.includes("Boots"),
                    ) + 1,
              reason:
                "Comprar el componente de heridas graves antes de completar su objeto; conservar el primer pico de poder salvo que el rival confirmado de línea necesite la respuesta antes. Revisar qué aliado puede aplicarlas.",
            });
            break;
          }
        }
        const steps = purchaseRoute(
          data,
          { ...profile, roles: [ctx.playerRole], starter: seed.starter[0] },
          seed.starter,
          build.ids,
          page,
          checkpoints.map((p) => ({
            itemId: p.itemId,
            afterItems: p.afterItems ?? 2,
          })),
        );
        output.push({
          ...seed,
          id,
          items: build.ids,
          runes: {
            primary: page.primary,
            secondary: page.secondary,
            primaryRunes: [...page.primaryRunes],
            secondaryRunes: [...page.secondaryRunes],
            shards: [...page.shards],
          },
          steps,
          checkpoints,
          recommended: false,
          adjustments: reasons
            .slice()
            .sort((a, b) => b.weight - a.weight)
            .map((r) => r.text),
          title: [
            rune(key)?.name ?? "Runas",
            focus,
            footwear ? item(footwear)!.name : null,
          ]
            .filter(Boolean)
            .join(" · "),
          reason: `${item(firstPurchase)!.name} primero. ${reasons.slice().sort((a, b) => b.weight - a.weight)[0].text}`,
          tradeoff: deltas.length
            ? `Cambios de atributos: ${deltas.slice(0, 4).join(", ")}. No hay una tasa medida de esta configuración contra este draft.`
            : "Se conserva la inversión de la referencia; las runas cambian sus condiciones de uso. No hay una tasa medida contra este draft.",
          decision: { score, reasons, changes, evaluation: build.evaluation },
          samples: build.changes.length ? [] : seed.samples,
          source: `OP.GG MCP: referencia de compras y página estadística. Riot: páginas alternativas y descripciones del paquete ${data.catalog.version}. ${published ? "Se conserva la página estadística." : adapted ? "Página adaptada por Kahoru." : retained ? "Se conserva la página elegida previamente." : "Página alternativa del cliente de Riot."} Las compras y su orden se comparan por estadísticas y mecánicas verificadas. El puntaje es heurístico; no hay una muestra conjunta medida.`,
        });
      } catch {
        /* Descartar rutas imposibles sin bloquear las demás configuraciones. */
      }
    }
  }
  output.sort(
    (a, b) => b.decision.score - a.decision.score || a.id.localeCompare(b.id),
  );
  // Reservar diversidad de claves y compras antes de llenar el cupo del modelo.
  const selected: Configuration[] = [];
  const baseline = output.find(
    (p) =>
      p.items.join() === observed[0].items.join() &&
      runeIds(p.runes).join() ===
        runeIds(providerPage ?? observed[0].runes).join(),
  );
  if (baseline) selected.push(baseline);
  const preferred = output.find((p) => p.id === preferredId);
  if (preferred && preferred !== baseline) selected.push(preferred);
  const representedKeys = new Set<number>();
  for (const p of output) {
    const key = p.runes.primaryRunes[0];
    if (representedKeys.has(key)) continue;
    representedKeys.add(key);
    if (!selected.some((q) => q.id === p.id)) selected.push(p);
  }
  for (const p of output)
    if (
      selected.length < 9 &&
      !selected.some((q) => q.items.join() === p.items.join())
    )
      selected.push(p);
  for (const p of output)
    if (selected.length < 12 && !selected.some((q) => q.id === p.id))
      selected.push(p);
  return selected
    .sort((a, b) => b.decision.score - a.decision.score)
    .slice(0, 12)
    .map((p, i) => ({
      ...p,
      decision: {
        ...p.decision,
        reasons: p.decision.reasons.map((r, j) => ({ ...r, id: `r${i}e${j}` })),
      },
      recommended: i === 0,
    }));
}
