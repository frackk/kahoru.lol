import type { GameData } from "../gameData";
import type { DraftContext, RunePage } from "./recommendations";
import { validateRunes } from "./recommendations";
import { championTools } from "./championTools";
import { draftSignals, fightContext, laneOpponent } from "./draftSignals";

export const runeKey = (page: RunePage) =>
  [...page.primaryRunes, ...page.secondaryRunes, ...page.shards].join("-");
export interface RuneReason {
  text: string;
  rune: number;
  weight: number;
}

const effects: Record<number, RegExp> = {
  8008: /acumulaciones/iu,
  8010: /acumulaciones/iu,
  8005: /ataques/iu,
  8112: /3 ataques o habilidades/iu,
  9923: /máximo de 3 ataques/iu,
  8230: /velocidad de movimiento/iu,
  8439: /resistencias/iu,
  8214: /escud/iu,
  8465: /escud/iu,
  9111: /derribos restauran/iu,
  9104: /velocidad de ataque/iu,
  9105: /habilidades básicas/iu,
  9103: /robo de vida/iu,
  8017: /más del 60% de Vida/iu,
  8014: /menos del 40% de Vida/iu,
  8299: /menos del 60% de vida/iu,
  8242: /control de masas/iu,
  8453: /curaciones y escudos/iu,
  8451: /vida máxima/iu,
  8444: /recibir daño/iu,
  8473: /3 hechizos o ataques/iu,
  8232: /río/iu,
  8210: /aceleración de habilidad/iu,
  8143: /desplazamiento|salto|teletransportación|sigilo/iu,
  8304: /no puedes comprar botas/iu,
  8128: /se restablece.{0,30}derribo/iu,
  8351: /inmovilizar/iu,
  8360: /cambia uno de tus hechizos/iu,
  8369: /entrado en combate/iu,
  8021: /energizados te curan/iu,
  8437: /cada 4 seg en combate/iu,
  8229: /disparas? un cometa|le disparas un cometa/iu,
  8992: /lo quemas/iu,
};
function supportedRunes(data: GameData) {
  return new Set(
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .filter((r) => effects[r.id]?.test(r.description))
      .map((r) => r.id),
  );
}

export function createRuneEvaluator(data: GameData, ctx: DraftContext) {
  const tools = championTools(ctx.playerChampionId!);
  const lane = laneOpponent(ctx);
  const supported = supportedRunes(data);
  const s = draftSignals(ctx),
    fight = fightContext(ctx);
  const names = (ids: number[]) =>
    ids
      .slice(0, 3)
      .map((id) => data.catalog.champions.find((c) => c.id === id)?.name)
      .join(", ");
  return (page: RunePage, speed = 0) => {
    const key = page.primaryRunes[0];
    const ids = [...page.primaryRunes, ...page.secondaryRunes];
    const reasons: RuneReason[] = [];
    const add = (rune: number, text: string, weight: number) => {
      if (ids.includes(rune) && supported.has(rune))
        reasons.push({ rune, text, weight });
    };
    if ([8008, 8010, 8005].includes(key)) {
      const sustained = fight.extended * 0.65 + fight.access * 0.35;
      add(
        key,
        `La página gana valor si podés mantener contacto${s.frontline ? ` frente a ${names(s.enemies.filter((e) => e.tools.frontline).map((e) => e.championId))}` : ""}; perder el objetivo limita las acumulaciones.`,
        sustained * 5 +
          (key === 8008 ? Math.min(0.8, speed * fight.access) : 0),
      );
    }
    if ([8112, 9923].includes(key))
      add(
        key,
        `${key === 9923 ? "Lluvia de Espadas concentra los primeros ataques" : "Electrocutar concentra el intercambio corto"}${s.setup.length ? ` tras el control de ${names(s.setup.map((e) => e.championId))}` : ""}; no presupone acceso libre al carry.`,
        (1 - fight.extended) * 4 +
          fight.access * (key === 9923 && tools.attacks ? 2 : 1.5),
      );
    if ([8230, 8439].includes(key))
      add(
        key,
        "Movilidad o resistencia para salir del intercambio; se sacrifica una clave de daño.",
        fight.pressure * 4,
      );
    if ([8214, 8465].includes(key) && tools.protection)
      add(
        key,
        `Protección para ${names(s.carries.map((e) => e.championId)) || "el aliado acompañado"}; el valor depende de jugar a su alcance.`,
        2 + fight.pressure * 2,
      );
    if (key === 8128)
      add(
        key,
        "Cosecha Oscura depende de encontrar objetivos bajos de vida y derribos; no se presuponen almas acumuladas.",
        (1 - fight.extended) * 3 + fight.access,
      );
    if (key === 8351 && tools.control.length)
      add(
        key,
        "Aumento Glacial protege el seguimiento aliado tras inmovilizar; su reducción de daño no protege al usuario.",
        2 + fight.pressure * 1.5,
      );
    if (key === 8360)
      add(
        key,
        "Libro de Hechizos conserva flexibilidad de invocadores; requiere planificar intercambios fuera de combate.",
        2,
      );
    if (key === 8369)
      add(
        key,
        "Primer Golpe requiere iniciar el daño; el alcance o poke rival puede impedir su activación.",
        1.5 +
          fight.access * 1.5 -
          Math.min(1, s.enemies.filter((e) => e.tools.poke).length * 0.25),
      );
    if (key === 8021)
      add(
        key,
        "Sobre la Marcha ofrece recuperación y movimiento para sostener intercambios; sacrifica daño de otra clave.",
        1.8 + fight.pressure * 1.5,
      );
    if (key === 8437)
      add(
        key,
        "Agarre necesita ataques repetidos contra campeones después de entrar en combate; no acumula vida por farmear campamentos.",
        ctx.playerRole === "JUNGLE" ? 0.5 : 2 + fight.extended * 2,
      );
    if (key === 8229 || (key === 8214 && !tools.protection))
      add(
        key,
        "La clave permite hostigar con habilidades antes de comprometer una entrada; su efecto no demuestra prioridad de línea.",
        2 + (tools.poke ? 1 : 0) + (1 - fight.extended) * 0.5,
      );
    if (key === 8992)
      add(
        key,
        "Toque de la Muerte Ígnea premia mantener la quemadura con habilidades; comparar con daño inmediato si el contacto es breve.",
        2 + fight.extended * 2,
      );
    add(
      9111,
      "Triunfo ayuda a continuar después del primer derribo; no protege antes de conseguirlo.",
      tools.healing || tools.executes ? 1.1 : 0.3,
    );
    add(
      9104,
      "Celeridad acompaña los ataques y efectos al impacto del kit.",
      tools.attacks ? 1.3 + fight.extended * 0.4 : 0,
    );
    add(
      9105,
      "Aceleración prioriza volver a disponer de habilidades básicas frente a invertir en ataques.",
      tools.attacks ? 0.25 : 1.4,
    );
    add(
      9103,
      "Linaje aporta recuperación mediante ataques; tarda en acumularse y no evita el control rival.",
      tools.attacks && ctx.playerRole === "BOT" ? 0.9 : 0,
    );
    add(
      8017,
      "Corte mejora el daño sobre objetivos con más del 60% de vida: aporta al inicio, no al remate.",
      fight.extended * 1.8,
    );
    add(
      8014,
      "Golpe de Gracia prioriza cerrar el primer derribo sobre objetivos bajos de vida.",
      (1 - fight.extended) * 1.4 + Number(tools.executes) * 0.4,
    );
    add(
      8299,
      "La Última Batalla exige pelear con poca vida; se valora junto a recuperación y resistencia.",
      tools.healing && fight.extended > 0.5 ? 1.5 : 0.25,
    );
    add(
      8242,
      `Inquebrantable aporta resistencia al recibir control${s.control.length ? ` de ${names(s.control.map((e) => e.championId))}` : ""}; no lo elimina.`,
      s.control.length >= 2 ? 1.8 : 0,
    );
    add(
      8453,
      "Revitalizar refuerza las curaciones o escudos propios; no se supone que todos los aliados los aprovechen igual.",
      tools.healing || tools.protection || tools.shield ? 1.3 : 0,
    );
    add(
      8444,
      `Segundo Aire responde al desgaste del rival de línea ${lane?.confidence === "inferred" ? "inferido; confirmar la asignación" : "confirmado"}.`,
      lane?.tools.poke ? 1.8 * lane.certainty : 0,
    );
    add(
      8473,
      "Coraza Ósea reduce un intercambio concentrado; el poke puede consumirla antes de la entrada.",
      lane && !lane.tools.poke ? 1.3 * lane.certainty : 0,
    );
    add(
      8232,
      "Caminar sobre Agua favorece encuentros en río; no aporta esa ventaja dentro de las líneas.",
      ctx.playerRole === "JUNGLE" && s.setup.length >= 2 ? 1.2 : 0,
    );
    add(
      8210,
      "Trascendencia orienta la inversión a ciclos de habilidades.",
      tools.attacks ? 0.2 : 1.1,
    );
    add(
      8143,
      "Impacto Súbito acompaña una entrada con movilidad del kit; verificar su activación antes de depender de ella.",
      tools.mobility ? 0.8 : 0,
    );
    if (ids.includes(8304) && fight.pressure > 0.6)
      add(
        8304,
        "Calzado Mágico retrasa la posibilidad de comprar botas frente a varias amenazas de control.",
        -1.2,
      );
    // Cada zona de la página tiene un presupuesto; no premiar una página solo
    // porque conocemos más efectos menores que en otra.
    for (const [runes, budget] of [
      [page.primaryRunes.slice(1), 1.7],
      [page.secondaryRunes, 1.2],
    ] as [number[], number][]) {
      const total = reasons.reduce(
        (n, r) => n + (runes.includes(r.rune) ? Math.max(0, r.weight) : 0),
        0,
      );
      if (total > budget)
        for (const reason of reasons)
          if (reason.weight > 0 && runes.includes(reason.rune))
            reason.weight *= budget / total;
    }
    return reasons.filter((r) => r.weight !== 0);
  };
}

export function expandRunePages(
  data: GameData,
  ctx: DraftContext,
  seeds: RunePage[],
) {
  const tools = championTools(ctx.playerChampionId!);
  const supported = supportedRunes(data);
  const signals = draftSignals(ctx);
  const evaluate = createRuneEvaluator(data, ctx);
  const all = new Map(seeds.map((p) => [runeKey(p), p]));
  const lane = laneOpponent(ctx);
  const replacements: number[][] = [
    [9104, 9105, 9103],
    [8014, 8017, 8299],
    [
      8451,
      ...(tools.healing || tools.shield ? [8453] : []),
      ...(signals.control.length >= 2 ? [8242] : []),
    ],
    ...(lane && ctx.playerRole !== "JUNGLE" ? [[8473, 8444]] : []),
  ];
  const offer = (p: RunePage) => {
    if (!validateRunes(data, p).length) all.set(runeKey(p), p);
  };
  for (const seed of seeds) {
    // Compara cambios en ambas filas y árboles; la clave sigue respaldada para el campeón/rol.
    let beam = [seed];
    for (const group of replacements) {
      const next = [...beam];
      for (const page of beam) {
        const current = [...page.primaryRunes, ...page.secondaryRunes].find(
          (id) => group.includes(id),
        );
        if (!current) continue;
        for (const id of group) {
          if (!supported.has(id)) continue;
          const swap = (runes: number[]) =>
            runes.map((r) => (r === current ? id : r));
          const changed = {
            ...page,
            primaryRunes: swap(page.primaryRunes),
            secondaryRunes: swap(page.secondaryRunes),
          };
          if (!validateRunes(data, changed).length) next.push(changed);
        }
      }
      const score = (p: RunePage) =>
        evaluate(p).reduce((n, r) => n + r.weight, 0);
      beam = [...new Map(next.map((p) => [runeKey(p), p])).values()]
        .sort((a, b) => score(b) - score(a))
        .slice(0, 4);
    }
    for (const page of beam) {
      offer(page);
      const pairs: { tree: number; ids: number[] }[] = [];
      if (signals.control.length >= 2 || (lane && ctx.playerRole !== "JUNGLE"))
        pairs.push({
          tree: 8400,
          ids: [
            ctx.playerRole !== "JUNGLE" && lane?.tools.poke ? 8444 : 8473,
            tools.healing || tools.shield ? 8453 : 8242,
          ],
        });
      if (tools.attacks || tools.executes)
        pairs.push({ tree: 8000, ids: [9111, tools.attacks ? 9104 : 9105] });
      if (ctx.playerRole === "JUNGLE" && signals.setup.length >= 2)
        pairs.push({ tree: 8200, ids: [8210, 8232] });
      for (const pair of pairs)
        if (
          pair.tree !== page.primary &&
          pair.ids.every((id) => supported.has(id))
        )
          offer({ ...page, secondary: pair.tree, secondaryRunes: pair.ids });
    }
  }
  const score = (p: RunePage) => evaluate(p).reduce((n, r) => n + r.weight, 0);
  const sorted = [...all.values()].sort((a, b) => score(b) - score(a));
  const selected = new Map(seeds.map((p) => [runeKey(p), p]));
  const counts = new Map<number, number>();
  for (const page of sorted) {
    const key = page.primaryRunes[0];
    if ((counts.get(key) ?? 0) >= 5) continue;
    selected.set(runeKey(page), page);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...selected.values()];
}
