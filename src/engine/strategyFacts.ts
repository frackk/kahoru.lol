import type { GameData } from "../gameData";
import type { DraftContext, Plan } from "./recommendations";
import { profileById, kitById } from "./profiles";

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
  const ownName = name(ctx.playerChampionId!);
  const allied = ctx.allies.filter(
    (s) => s.championId && s.championId !== ctx.playerChampionId,
  );
  const enemies = ctx.enemies.filter((s) => s.championId);
  const names = (slots: typeof allied) =>
    slots
      .map((s) => name(s.championId!))
      .slice(0, 3)
      .join(", ");
  const hasControl = (id: number) =>
    kitById
      .get(id)
      ?.some((a) =>
        /\b(aturde|aturden|inmoviliza|inmovilizan|derriba|derriban|empuja|empujan|atrae|encanta|encantan|suspende|suspenden)\b/iu.test(
          a.description,
        ),
      );
  const control = allied.filter((s) => hasControl(s.championId!));
  const front = allied.filter((s) =>
    profileById.get(s.championId!)?.traits.includes("frontline"),
  );
  const danger = enemies.filter((s) => hasControl(s.championId!));
  const role = ctx.playerRole;
  if (!role)
    add(
      "opening",
      `Falta confirmar la posición de ${ownName}; no se fija un plan de línea hasta conocerla.`,
    );
  else if (role === "JUNGLE") {
    add(
      "opening",
      `Con ${ownName} en jungla, la apertura prioriza conservar recursos propios y buscar jugadas con seguimiento de las líneas. El draft no basta para decidir una invasión ni una ruta de campamentos.`,
    );
    if (control.length)
      add(
        "opening",
        `Herramientas de control aliadas en ${names(control)}: son puntos de coordinación para un gank, siempre que su oleada y su posición permitan acompañarlo.`,
      );
  } else if (role === "TOP")
    add(
      "opening",
      `Con ${ownName} en top, el plan inicial se apoya en intercambios que permitan conservar recursos y controlar la oleada. La posición rival inferida no prueba una ventaja de matchup.`,
    );
  else if (role === "MID")
    add(
      "opening",
      `Con ${ownName} en mid, el control de oleada conecta la fase de línea con las jugadas del jungla. Una salida que abandona una oleada importante puede costar más de lo que aporta.`,
    );
  else if (role === "BOT")
    add(
      "opening",
      `Con ${ownName} en bot, la prioridad es coordinar los intercambios con el support y conservar acceso a las compras principales. El plan no presupone que la pareja aliada gane la línea.`,
    );
  else
    add(
      "opening",
      `Con ${ownName} de support, el plan inicial combina la protección del bot con la posibilidad de disputar espacio junto a él. Un movimiento por el mapa depende de que la oleada permita abandonar la línea.`,
    );
  if (role === "JUNGLE" || role === "SUPPORT")
    add(
      "objectives",
      `En la transición a objetivos, ${ownName} necesita conectar sus movimientos con aliados que puedan acompañarlo. Llegar antes ayuda a preparar espacio; el plan no supone prioridad de línea ni visión ya conseguida.`,
    );
  else if (own?.traits.includes("side"))
    add(
      "objectives",
      `${ownName} ofrece una alternativa de presión lateral. Esa presión necesita coordinarse con los objetivos y con la capacidad del equipo de sostener el resto del mapa; no exige separarse en todo momento.`,
    );
  else
    add(
      "objectives",
      `Al pasar a objetivos, ${ownName} combina la recogida de oleadas con la preparación del equipo. Agruparse sin resolver una oleada puede ceder recursos; llegar tarde puede dejar al equipo sin su aporte.`,
    );
  if (front.length)
    add(
      "objectives",
      `${names(front)} aporta opciones de primera línea. La composición permite preparar espacio alrededor de esos aliados sin obligar a ${ownName} a absorber por su cuenta toda la entrada rival.`,
    );
  if (plan)
    add(
      "objectives",
      `La ruta elegida conserva ${plan.items
        .slice(0, 3)
        .map((id) => data.items.find((i) => i.id === id)?.name)
        .filter(Boolean)
        .join(
          ", ",
        )} como primeras compras. Es una referencia previa: sus muestras son independientes y no prueban una ventaja de la build completa.`,
    );
  if (own?.traits.includes("resets"))
    add(
      "fights",
      `${ownName} busca convertir el primer derribo en continuidad de pelea con Dominio del Soberano. Para Viego, una entrada de seguimiento facilita acceder a una posesión; entrar primero contra toda la composición deja esa condición expuesta.`,
    );
  else if (own?.traits.includes("peel") || role === "SUPPORT")
    add(
      "fights",
      `En peleas, ${ownName} puede orientar sus recursos a proteger el daño aliado o a facilitar una entrada. Reservar una respuesta a la amenaza rival evita comprometer todas sus herramientas a la vez.`,
    );
  else if (own?.traits.includes("engage"))
    add(
      "fights",
      `${ownName} aporta una posible apertura de pelea. Esa entrada necesita que el daño aliado pueda seguirla; iniciar y sobrevivir a todo el daño enemigo son tareas distintas.`,
    );
  else if (role === "BOT" || own?.traits.includes("attacks"))
    add(
      "fights",
      `En peleas, ${ownName} necesita espacio para mantener su daño. La preparación favorece una posición desde la que alcanzar objetivos disponibles sin atravesar por cuenta propia las herramientas de control enemigas.`,
    );
  else
    add(
      "fights",
      `En peleas, ${ownName} necesita coordinar el alcance de sus habilidades con el seguimiento del equipo. El acceso a un objetivo importa tanto como el daño disponible; el plan no presupone acceso libre a la retaguardia.`,
    );
  if (danger.length)
    add(
      "fights",
      `El control de ${names(danger)} condiciona la entrada y el espacio para hacer daño. Esta preparación no conoce sus enfriamientos ni su posición durante la partida.`,
    );
  if (ctx.allies.concat(ctx.enemies).some((s) => !s.championId || !s.locked))
    add(
      "opening",
      "Hay selecciones sin revelar o provisionales: el planteamiento puede cambiar al confirmarse el draft.",
    );
  return facts;
}
