import type { DraftSlot } from "../contracts";
import { profileById } from "./profiles";
import type { DraftContext } from "./recommendations";
import { championTools } from "./championTools";
import { possibleRoles } from "./roleInference";
export { removableControl } from "./championTools";

export function controlAbility(id: number) {
  return championTools(id).control[0];
}

export function draftSignals(ctx: DraftContext) {
  const entries = (slots: DraftSlot[]) =>
    slots.flatMap((slot) => {
      const original = profileById.get(slot.championId!);
      if (!original) return [];
      const tools = championTools(original.championId);
      const traits = new Set(original.traits);
      if (tools.frontline) traits.add("frontline");
      if (tools.frontline && tools.control.length) traits.add("engage");
      if (tools.healing) traits.add("healing");
      if (tools.attacks) traits.add("attacks");
      const support =
        slot.role === "SUPPORT" ||
        (!slot.role &&
          original.roles.length === 1 &&
          original.roles[0] === "SUPPORT");
      // Prior cualitativo de recursos y clase. No predice el daño de la partida.
      const resources = support
        ? tools.classes.includes("mage")
          ? 0.65
          : 0.35
        : 1;
      const threat = tools.classes.includes("marksman")
        ? 1.15
        : tools.classes.includes("tank") && !tools.classes.includes("fighter")
          ? 0.65
          : 1;
      const damageWeight = resources * threat * (slot.locked ? 1 : 0.35);
      return [
        {
          ...slot,
          championId: original.championId,
          profile: { ...original, traits: [...traits] },
          tools,
          weight: slot.locked ? 1 : 0.35,
          damageWeight,
        },
      ];
    });
  const allies = entries(ctx.allies).filter(
    (s) => s.championId !== ctx.playerChampionId,
  );
  const enemies = entries(ctx.enemies);
  const mass = (test: (p: (typeof enemies)[number]) => boolean) =>
    enemies.reduce((n, e) => n + (test(e) ? e.weight : 0), 0);
  const exposure = (team: typeof enemies) => {
    const physical = team.reduce(
      (n, e) =>
        n +
        e.damageWeight *
          (e.profile.damage === "physical"
            ? 1
            : e.profile.damage === "mixed"
              ? 0.5
              : 0),
      0,
    );
    const magic = team.reduce(
      (n, e) =>
        n +
        e.damageWeight *
          (e.profile.damage === "magic"
            ? 1
            : e.profile.damage === "mixed"
              ? 0.5
              : 0),
      0,
    );
    const total = physical + magic;
    return {
      physical: total ? physical / total : 0.5,
      magic: total ? magic / total : 0.5,
      total,
    };
  };
  return {
    allies,
    enemies,
    exposure: exposure(enemies),
    allyExposure: exposure(allies),
    physical: mass((e) => e.profile.damage === "physical"),
    magic: mass((e) => e.profile.damage === "magic"),
    frontline: mass((e) => e.profile.traits.includes("frontline")),
    engage: mass((e) => e.profile.traits.includes("engage")),
    healing: enemies.filter((e) => e.locked && e.tools.healing),
    control: enemies.filter((e) => e.locked && e.tools.control.length),
    tenacity: enemies.filter((e) => e.locked && e.tools.tenacity.length),
    setup: allies.filter((a) => a.locked && a.tools.control.length),
    carries: allies.filter(
      (a) =>
        a.locked && (a.profile.traits.includes("scaling") || a.role === "BOT"),
    ),
  };
}

export function fightContext(ctx: DraftContext) {
  const s = draftSignals(ctx);
  const own = championTools(ctx.playerChampionId ?? 0);
  const clamp = (v: number) => Math.max(0.15, Math.min(0.9, v));
  const escape = s.enemies.reduce(
    (n, e) => n + Number(e.tools.mobility) * e.weight,
    0,
  );
  const access = clamp(
    0.55 +
      s.setup.length * 0.06 +
      Number(own.mobility) * 0.12 -
      s.control.length * 0.045 -
      escape * 0.035,
  );
  const extended = clamp(0.2 + s.frontline * 0.18 + Number(own.healing) * 0.06);
  const pressure = clamp(0.15 + s.control.length * 0.1 + s.engage * 0.09);
  return { access, extended, pressure, exposure: s.exposure };
}

export function laneOpponent(ctx: DraftContext) {
  if (!ctx.playerRole || ctx.playerRole === "JUNGLE") return null;
  const signals = draftSignals(ctx);
  const confirmed = signals.enemies.find(
    (e) => e.locked && e.role === ctx.playerRole,
  );
  if (confirmed)
    return { ...confirmed, confidence: "confirmed" as const, certainty: 1 };
  const hypotheses = possibleRoles(ctx.enemies);
  const index = hypotheses.findIndex(
    (roles, i) =>
      ctx.enemies[i].locked &&
      roles?.length === 1 &&
      roles[0] === ctx.playerRole,
  );
  const inferred = signals.enemies.find(
    (e) => e.championId === ctx.enemies[index]?.championId,
  );
  return inferred
    ? { ...inferred, confidence: "inferred" as const, certainty: 0.6 }
    : null;
}
