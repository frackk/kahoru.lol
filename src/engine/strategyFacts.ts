import type { GameData } from "../gameData";
import type { DraftContext, Plan } from "./recommendations";
import { profileById } from "./profiles";
import { controlAbility, draftSignals } from "./draftSignals";

export function strategyFacts(data: GameData, ctx: DraftContext, plan?: Plan) {
  const facts: {
    id: string;
    phase: "opening" | "objectives" | "fights";
    text: string;
  }[] = [];
  const add = (phase: (typeof facts)[number]["phase"], text: string) =>
    facts.push({ id: `f${facts.length}`, phase, text });
  const name = (id: number) =>
    data.catalog.champions.find((c) => c.id === id)?.name ?? String(id);
  const own = profileById.get(ctx.playerChampionId!);
  const s = draftSignals(ctx);
  const setup = [...s.setup].sort(
    (a, b) => Number(b.role === "MID") - Number(a.role === "MID"),
  )[0];
  const carry = s.carries[0];
  const front = s.allies.find(
    (a) => a.locked && a.profile.traits.includes("frontline"),
  );
  const threat = s.control[0];
  const ownControl = ctx.playerChampionId
    ? controlAbility(ctx.playerChampionId)
    : undefined;
  const target = setup
    ? `${name(setup.championId)} (${controlAbility(setup.championId)!.name})`
    : null;
  if (ctx.playerRole === "JUNGLE") {
    add(
      "opening",
      target
        ? `Apertura: buscar una salida hacia ${target}; su control facilita el gank si la línea permite acompañarlo. Sin ventana, completar campamentos y comprar.`
        : "Apertura: priorizar campamentos y primera compra; no hay una línea con control aliado confirmado para justificar un desvío.",
    );
  } else if (ctx.playerRole === "SUPPORT") {
    add(
      "opening",
      carry
        ? `Línea: coordinar intercambios con ${name(carry.championId)}; salir al río cuando su oleada permita dejarlo acompañado o a salvo.`
        : "Línea: confirmar la pareja de bot antes de fijar intercambios o movimientos al río.",
    );
  } else {
    const opponent = s.enemies.find(
      (e) => e.locked && e.role === ctx.playerRole,
    );
    add(
      "opening",
      opponent
        ? `Línea contra ${name(opponent.championId)}: ${controlAbility(opponent.championId) ? `respetar ${controlAbility(opponent.championId)!.name} antes de comprometer el intercambio` : "preparar la oleada antes de salir a apoyar"}. No hay ventaja de línea demostrada.`
        : "Línea: la posición rival sigue sin confirmar; preparar oleadas y la primera compra antes de comprometer movimientos.",
    );
  }
  add(
    "objectives",
    carry
      ? `Recursos: potenciar a ${name(carry.championId)} como fuente de daño sostenido; preparar objetivos con su llegada, sin suponer prioridad de línea.`
      : target
        ? `Objetivos: coordinar una captura con ${target} antes de disputar espacio.`
        : "Objetivos: preparar la llegada conjunta; falta evidencia para elegir un aliado como condición de victoria.",
  );
  if (own?.traits.includes("side"))
    add(
      "objectives",
      "Alternativa: presión lateral coordinada con el objetivo; evitar separar al equipo cuando no pueda sostener el resto del mapa.",
    );
  if (own?.traits.includes("resets"))
    add(
      "fights",
      `Peleas: buscar el primer derribo tras ${front ? `la entrada de ${name(front.championId)}` : "el control aliado"}; Dominio del Soberano permite continuar. Evitar iniciar solo contra los cinco.`,
    );
  else if (own?.traits.includes("peel"))
    add(
      "fights",
      `Peleas: reservar protección para ${carry ? name(carry.championId) : "el daño aliado"}; responder a la entrada rival antes de gastar todo para iniciar.`,
    );
  else if (own?.traits.includes("engage"))
    add(
      "fights",
      `Peleas: abrir solo con seguimiento de ${carry ? name(carry.championId) : "los aliados"}; una entrada fuera de su alcance deja al equipo sin tu control.`,
    );
  else if (
    ownControl &&
    ctx.playerRole !== "BOT" &&
    !own?.traits.includes("attacks")
  )
    add(
      "fights",
      `Peleas: buscar una captura con ${ownControl.name} para habilitar el daño de ${carry ? name(carry.championId) : "los aliados"}; si no conecta, conservar espacio antes de comprometer el resto del kit.`,
    );
  else
    add(
      "fights",
      `Peleas: ${front ? `jugar detrás de ${name(front.championId)}` : "entrar después del control aliado"}; hacer daño al objetivo accesible sin cruzar toda la primera línea.`,
    );
  if (threat)
    add(
      "fights",
      `Amenaza: ${name(threat.championId)} con ${controlAbility(threat.championId)!.name}; conservar espacio para no comprometer toda la entrada en ese control.`,
    );
  if (s.healing.length)
    add(
      "objectives",
      `Compra a valorar: heridas graves frente a ${s.healing
        .slice(0, 2)
        .map((e) => name(e.championId))
        .join(" y ")}; comprobar quién puede aplicarlas de forma fiable.`,
    );
  if (plan?.adjustments.length)
    add("objectives", `Configuración: ${plan.adjustments[0]}`);
  return facts;
}
