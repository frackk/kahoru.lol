import type { GameData, Item } from "../gameData";
import type { DraftContext, Plan, RunePage } from "./recommendations";
import { purchaseRoute, validateRunes } from "./recommendations";
import { officialPages } from "./analysis";
import { draftSignals } from "./draftSignals";
import { getClientKnowledge, profileById } from "./profiles";

export interface DecisionReason {
  id: string;
  text: string;
  references: string[];
  weight: number;
}
export interface Configuration extends Plan {
  decision: { score: number; reasons: DecisionReason[]; changes: string[] };
}
const groups = [
  [3053, 3156, 6673],
  [3033, 3036, 6694],
  [3135, 3137],
];
const compatible = (ids: number[]) =>
  new Set(ids).size === ids.length &&
  groups.every((g) => ids.filter((id) => g.includes(id)).length <= 1);
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
  const effectChecks: Record<number, RegExp> = {
    3157: /estasis/iu,
    3102: /escudo antihechizos/iu,
    3165: /heridas/iu,
    3033: /heridas/iu,
    6609: /heridas/iu,
    3075: /heridas/iu,
    3135: /penetración de magia/iu,
    3156: /escudo contra daño mágico/iu,
    4401: /resistencia mágica/iu,
    3190: /aliados.{0,120}escudo/iu,
    3504: /curar o escudar a un aliado/iu,
  };
  const allyProtection = own.abilities.some((a) =>
    /(?:cura|curar|escudo|escudar).{0,100}aliad|aliad.{0,100}(?:cura|escudo)/iu.test(
      a.description,
    ),
  );
  const pages: RunePage[] = [];
  for (const p of [
    providerPage ?? observed[0].runes,
    observed[0].runes,
    ...officialPages(ctx.playerChampionId, ctx.playerRole),
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
  for (const page of [...pages])
    for (const tweak of tweaks) {
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
        text: tweak.text,
        rune: tweak.to,
      });
    }
  const output: Configuration[] = [];
  for (const seed of observed) {
    const items = seed.items.map(item).filter((i): i is Item => !!i);
    const ap = items.filter((i) => i.tags.includes("SpellDamage")).length >= 2;
    const ad = items.filter((i) => i.tags.includes("Damage")).length >= 2;
    const tank =
      !ap &&
      !ad &&
      items.filter(
        (i) => i.tags.includes("Armor") || i.tags.includes("SpellBlock"),
      ).length >= 2;
    const crit =
      items.filter((i) => i.tags.includes("CriticalStrike")).length >= 2;
    const replacements: { id: number; reason: string; need: boolean }[] = [
      {
        id: 3157,
        need: ap && signals.physical >= 2 && signals.engage >= 1,
        reason:
          "Estasis como alternativa ante entradas físicas; sacrifica una compra ofensiva y exige usar el activo.",
      },
      {
        id: 3102,
        need: ap && signals.magic >= 2 && signals.control.length >= 1,
        reason:
          "Escudo antihechizos y resistencia mágica como alternativa frente al control y daño mágico rivales.",
      },
      {
        id: 3165,
        need: ap && signals.healing.length >= 2,
        reason:
          "Heridas graves aplicadas con daño mágico ante varias fuentes de curación.",
      },
      {
        id: 3135,
        need: ap && signals.frontline >= 2,
        reason:
          "Penetración mágica porcentual como alternativa si la primera línea rival compra resistencia mágica.",
      },
      {
        id: crit ? 3033 : 6609,
        need: ad && signals.healing.length >= 2,
        reason:
          "Heridas graves aplicadas con daño físico; comprobar si otro aliado ya puede cubrirlas.",
      },
      {
        id: 3156,
        need: ad && signals.magic >= 3,
        reason:
          "Daño de ataque y defensa mágica como alternativa ante varias fuentes de daño mágico; excluye otros objetos de Salvavidas.",
      },
      {
        id: 3075,
        need:
          tank &&
          signals.healing.some((e) => e.profile.traits.includes("attacks")),
        reason:
          "Armadura y heridas al atacante; requiere que el objetivo curativo te ataque, no se aplica por cercanía.",
      },
      {
        id: 4401,
        need: tank && signals.magic >= 3,
        reason:
          "Alternativa de resistencia mágica ante varias fuentes mágicas; conserva la función de primera línea.",
      },
      {
        id: 3190,
        need: ctx.playerRole === "SUPPORT" && signals.engage >= 2,
        reason:
          "Escudo activo a aliados cercanos como alternativa de protección frente a varias entradas.",
      },
      {
        id: 3504,
        need:
          ctx.playerRole === "SUPPORT" &&
          allyProtection &&
          signals.allies.some(
            (a) => a.locked && a.profile.traits.includes("attacks"),
          ),
        reason:
          "Potenciar ataques del aliado al curarlo o escudarlo; requiere una herramienta propia que pueda aplicar el efecto.",
      },
    ].filter(
      (r) =>
        r.need &&
        item(r.id)?.purchasable &&
        effectChecks[r.id]?.test(item(r.id)!.description) &&
        !seed.items.includes(r.id),
    );
    const builds = [{ ids: seed.items, changes: [] as string[] }];
    for (const replacement of replacements) {
      const added = item(replacement.id)!;
      const slots = seed.items
        .map((id, i) => ({ item: item(id)!, i }))
        .filter(
          ({ item: it, i }) =>
            i >= 2 &&
            it.cost >= 1800 &&
            !it.tags.includes("Boots") &&
            !it.requiredChampion,
        );
      // Comparar una sustitución por vez mantiene el resto de la identidad observada.
      for (const { i } of slots) {
        const ids = [...seed.items];
        const removed = item(ids[i])!;
        ids[i] = replacement.id;
        if (!compatible(ids)) continue;
        if (
          ap &&
          !added.tags.includes("SpellDamage") &&
          removed.tags.includes("SpellDamage") &&
          ctx.playerRole !== "SUPPORT"
        )
          continue;
        builds.push({
          ids,
          changes: [`${removed.name} → ${added.name}: ${replacement.reason}`],
        });
      }
    }
    for (const build of builds)
      for (const page of pages) {
        const ids = runeIds(page);
        const key = page.primaryRunes[0];
        const reasons: DecisionReason[] = [];
        const add = (text: string, references: string[], weight: number) =>
          reasons.push({ id: `e${reasons.length}`, text, references, weight });
        const published =
          runeIds(page).join() === runeIds(providerPage ?? seed.runes).join();
        const tweak = generated.get(ids.join());
        add(
          published
            ? "Configuración de runas observada por la fuente para este campeón y rol."
            : tweak
              ? "Página adaptada por Kahoru a partir de una opción del campeón y rol; sin muestra estadística propia."
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
              Math.min(3, signals.physical),
            );
          if (it.tags.includes("SpellBlock") && signals.magic >= 2)
            add(
              `${it.name}: resistencia mágica frente a ${signals.enemies
                .filter((e) => e.profile.damage === "magic")
                .map((e) => name(e.championId))
                .join(", ")}.`,
              [`item:${id}`],
              Math.min(3, signals.magic),
            );
          if (/heridas/iu.test(it.description) && signals.healing.length >= 2)
            add(
              `${it.name}: respuesta a la curación de ${signals.healing.map((e) => name(e.championId)).join(", ")}; revisar su condición de aplicación.`,
              [`item:${id}`],
              5,
            );
          if (
            (it.tags.includes("MagicPenetration") ||
              it.tags.includes("ArmorPenetration")) &&
            signals.frontline >= 2
          )
            add(
              `${it.name}: alternativa de penetración frente a primera línea; no se presupone qué resistencias comprarán.`,
              [`item:${id}`],
              1,
            );
        }
        const changes = [...build.changes];
        if (key !== seed.runes.primaryRunes[0])
          changes.push(
            `Runa clave: ${rune(seed.runes.primaryRunes[0])?.name} → ${rune(key)?.name}.`,
          );
        const score =
          reasons.reduce((n, r) => n + r.weight, 0) -
          (build.changes.length ? 1 : 0);
        const id = `config-${build.ids.join("-")}-${ids.join("-")}`;
        if (output.some((p) => p.id === id)) continue;
        try {
          const checkpoints = seed.checkpoints.filter((p) =>
            build.ids.includes(p.finishInto),
          );
          if (!checkpoints.length && signals.healing.length >= 2) {
            for (const finishInto of build.ids.slice(2)) {
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
                reason:
                  "Adelantar el componente de heridas graves y completar su objeto más adelante; revisar qué aliado puede aplicarlas.",
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
            checkpoints.map((p) => p.itemId),
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
            title: "Configuración contextual",
            reason: reasons.slice().sort((a, b) => b.weight - a.weight)[0].text,
            tradeoff:
              "Ajuste calculado por Kahoru. No hay una tasa medida de esta configuración completa contra este draft.",
            decision: { score, reasons, changes },
            samples: build.changes.length ? [] : seed.samples,
            source: `OP.GG MCP: referencia de compras y página estadística. Riot: páginas alternativas y descripciones del paquete ${data.catalog.version}. ${published ? "Se conserva la página estadística." : tweak ? "Página adaptada por Kahoru." : "Página alternativa del cliente de Riot."} Las sustituciones de objetos no tienen una muestra conjunta medida.`,
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
    if (selected.length < 12 && !selected.some((q) => q.id === p.id))
      selected.push(p);
  return selected
    .sort((a, b) => b.decision.score - a.decision.score)
    .slice(0, 12)
    .map((p, i) => ({
      ...p,
      recommended: i === 0,
      title: i === 0 ? "Plan contextual" : `Alternativa contextual ${i + 1}`,
    }));
}
