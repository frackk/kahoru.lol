import type { GameData } from "../gameData";
import type { DraftContext, Plan, RunePage } from "./recommendations";
import { purchaseRoute, validateRunes } from "./recommendations";
import { officialPages } from "./analysis";
import { draftSignals } from "./draftSignals";
import { getClientKnowledge, profileById } from "./profiles";
import { buildSearch, buildStats, type BuildEvaluation } from "./buildSearch";

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
  const item = (id: number) => data.items.find((i) => i.id === id);
  const name = (id: number) =>
    data.catalog.champions.find((c) => c.id === id)?.name ?? String(id);
  const rune = (id: number) =>
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .find((r) => r.id === id);
  const allyProtection = own.abilities.some((a) =>
    /(?:cura|curar|escudo|escudar).{0,100}aliad|aliad.{0,100}(?:cura|escudo)/iu.test(
      a.description,
    ),
  );
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
  const generated = new Map<string, { text: string; rune: number }>();
  const lane = signals.enemies.find(
    (e) => e.locked && e.role === ctx.playerRole,
  );
  const canHeal =
    allyProtection ||
    own.abilities.some((a) =>
      /\b(?:se cura|lo cura|recupera.{0,20}vida)/iu.test(a.description),
    );
  const tweaks = [
    {
      from: 8014,
      to: 8017,
      when: signals.frontline >= 2,
      valid: /60%/u,
      text: "Corte como alternativa para dañar objetivos con más del 60% de vida; no equivale por sí sola a una ventaja contra tanques.",
    },
    {
      from: 8451,
      to: 8242,
      when: signals.control.length >= 2,
      valid: /control de masas/iu,
      text: "Inquebrantable como alternativa de resistencia al recibir control de masas; se compara con la vida de Sobrecrecimiento.",
    },
    {
      from: 8451,
      to: 8453,
      when: canHeal,
      valid: /curaciones y escudos/iu,
      text: "Revitalizar como alternativa para las curaciones o escudos del kit propio; se compara con la vida de Sobrecrecimiento.",
    },
    {
      from: 8473,
      to: 8444,
      when: !!lane?.profile.traits.includes("poke"),
      valid: /recibir daño/iu,
      text: "Segundo Aire como alternativa a Coraza Ósea ante el poke del rival de línea confirmado.",
    },
  ];
  for (const tweak of tweaks)
    for (const page of [...pages]) {
      if (
        !tweak.when ||
        !tweak.valid.test(rune(tweak.to)?.description ?? "") ||
        !runeIds(page).includes(tweak.from)
      )
        continue;
      const replace = (ids: number[]) =>
        ids.map((id) => (id === tweak.from ? tweak.to : id));
      const changed = {
        ...page,
        primaryRunes: replace(page.primaryRunes),
        secondaryRunes: replace(page.secondaryRunes),
      };
      if (
        validateRunes(data, changed).length ||
        pages.some((p) => runeIds(p).join() === runeIds(changed).join())
      )
        continue;
      pages.push(changed);
      generated.set(runeIds(changed).join(), {
        text: [generated.get(runeIds(page).join())?.text, tweak.text]
          .filter(Boolean)
          .join(" "),
        rune: tweak.to,
      });
    }
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
      const tweak = generated.get(ids.join());
      const retained =
        !published &&
        !tweak &&
        !riotPages.some((p) => runeIds(p).join() === ids.join());
      add(
        published
          ? "Configuración de runas observada por la fuente para este campeón y rol."
          : tweak
            ? "Página adaptada por Kahoru a partir de una opción del campeón y rol; sin muestra estadística propia."
            : retained
              ? "Página elegida previamente; se reevalúa con el draft actual, sin muestra estadística propia."
              : "Página alternativa publicada por el cliente para este campeón y rol; se evalúa completa, incluida su runa clave.",
        [`champion:${ctx.playerChampionId}`, `rune:${key}`],
        published ? 1 : 0,
      );
      if (tweak) add(tweak.text, [`rune:${tweak.rune}`], 2);
      if (signals.frontline >= 2 && [8008, 8010].includes(key))
        add(
          `${rune(key)?.name}: alternativa de acumulaciones para intercambios prolongados frente a ${signals.enemies
            .filter((e) => e.profile.traits.includes("frontline"))
            .map((e) => name(e.championId))
            .join(", ")}; exige tiempo de contacto.`,
          [`rune:${key}`],
          5,
        );
      if (
        signals.frontline < 2 &&
        [8112, 9923].includes(key) &&
        signals.setup.length
      )
        add(
          `${rune(key)?.name}: alternativa para intercambios cortos coordinados con el control de ${name(signals.setup[0].championId)}.`,
          [`rune:${key}`, `champion:${signals.setup[0].championId}`],
          4,
        );
      if (signals.engage >= 2 && [8230, 8465, 8439].includes(key))
        add(
          `${rune(key)?.name}: comparar su movilidad o defensa con las entradas de ${signals.enemies
            .filter((e) => e.profile.traits.includes("engage"))
            .map((e) => name(e.championId))
            .join(", ")}; la activación depende de su descripción.`,
          [`rune:${key}`],
          4,
        );
      if (
        ids.includes(9111) &&
        (signals.engage >= 2 || profile.traits.includes("resets"))
      )
        add(
          "Triunfo aporta recuperación tras un derribo; importa sobrevivir hasta conseguirlo.",
          ["rune:9111"],
          2,
        );
      if (
        ids.includes(8232) &&
        ctx.playerRole === "JUNGLE" &&
        signals.setup.length >= 2 &&
        signals.engage < 2
      )
        add(
          "Caminar sobre Agua ofrece una alternativa para coordinar río con el control de las líneas aliadas.",
          ["rune:8232"],
          3,
        );
      const attackSpeed = build.ids.some((id) =>
        item(id)?.tags.includes("AttackSpeed"),
      );
      if (key === 8008 && attackSpeed)
        add(
          "La velocidad de ataque de los objetos acompaña la acumulación de Cadencia Letal; necesita acceso sostenido al objetivo.",
          [
            "rune:8008",
            ...build.ids
              .filter((id) => item(id)?.tags.includes("AttackSpeed"))
              .map((id) => `item:${id}`),
          ],
          2,
        );
      if (
        [8214, 8465].includes(key) &&
        allyProtection &&
        signals.carries.length
      )
        add(
          `La página permite orientar recursos de protección a ${name(signals.carries[0].championId)}.`,
          [`rune:${key}`, `champion:${signals.carries[0].championId}`],
          2,
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
          `Frente a la referencia: ${deltas.join(", ")}. Solo atributos fijos; no incluye pasivas condicionales ni daño de habilidades.`,
          build.ids.map((id) => `item:${id}`),
          0,
        );
      if (
        [8112, 9923].includes(key) &&
        signals.frontline < 2 &&
        build.evaluation.stats.crit >= 0.5
      )
        add(
          "La inversión en crítico acompaña una propuesta de intercambios cortos; exige acceso a un objetivo y desplaza presupuesto que podría ir a vida.",
          [
            `rune:${key}`,
            ...build.ids
              .filter((id) => item(id)?.tags.includes("CriticalStrike"))
              .map((id) => `item:${id}`),
          ],
          1,
        );
      if (
        [8008, 8010].includes(key) &&
        signals.frontline >= 2 &&
        build.evaluation.stats.speed >= 0.4
      )
        add(
          "La velocidad de ataque de la ruta sostiene las acumulaciones de la página en peleas prolongadas; perder contacto reduce su valor.",
          [
            `rune:${key}`,
            ...build.ids
              .filter((id) => item(id)?.tags.includes("AttackSpeed"))
              .map((id) => `item:${id}`),
          ],
          1,
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
          source: `OP.GG MCP: referencia de compras y página estadística. Riot: páginas alternativas y descripciones del paquete ${data.catalog.version}. ${published ? "Se conserva la página estadística." : tweak ? "Página adaptada por Kahoru." : retained ? "Se conserva la página elegida previamente." : "Página alternativa del cliente de Riot."} Las compras y su orden se comparan por estadísticas y mecánicas verificadas. El puntaje es heurístico; no hay una muestra conjunta medida.`,
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
  for (const p of output)
    if (
      !selected.some((q) => q.runes.primaryRunes[0] === p.runes.primaryRunes[0])
    )
      selected.push(p);
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
