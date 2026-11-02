import type { DraftSlot } from "../contracts";
import { getClientKnowledge, kitById, profileById } from "./profiles";
import type { DraftContext } from "./recommendations";

export const removableControl =
  /\b(aturde|aturden|aturdirá|aturdiendo|aturdidos|inmoviliza|inmovilizan|inmovilizado|atrapa|encanta|encantan|atemoriza|ciega)(?!\p{L})/iu;
export function controlAbility(id: number) {
  return kitById
    .get(id)
    ?.find(
      (a) =>
        removableControl.test(a.description) ||
        /\b(derriba|derriban|empuja|empujan|atrae|suspende|suspenden|suprime)\b/iu.test(
          a.description,
        ),
    );
}
export function draftSignals(ctx: DraftContext) {
  const entries = (slots: DraftSlot[]) =>
    slots.flatMap((slot) => {
      const original = profileById.get(slot.championId!);
      const metadata = getClientKnowledge().champions.find(
        (c) => c.id === slot.championId,
      );
      const traits = new Set(original?.traits ?? []);
      if (metadata?.classes.includes("tank")) traits.add("frontline");
      if (
        metadata?.classes.includes("tank") &&
        controlAbility(slot.championId!)
      )
        traits.add("engage");
      if (
        metadata?.abilities.some((a) =>
          /\b(?:se cura|lo cura|cura a|curando|se sana|recupera.{0,20}vida)/iu.test(
            a.description,
          ),
        )
      )
        traits.add("healing");
      const profile = original
        ? { ...original, traits: [...traits] }
        : undefined;
      return profile
        ? [
            {
              ...slot,
              championId: profile.championId,
              profile,
              weight: slot.locked ? 1 : 0.35,
            },
          ]
        : [];
    });
  const allies = entries(ctx.allies).filter(
    (s) => s.championId !== ctx.playerChampionId,
  );
  const enemies = entries(ctx.enemies);
  const mass = (test: (p: (typeof enemies)[number]) => boolean) =>
    enemies.reduce((n, e) => n + (test(e) ? e.weight : 0), 0);
  return {
    allies,
    enemies,
    physical: mass((e) => e.profile.damage === "physical"),
    magic: mass((e) => e.profile.damage === "magic"),
    frontline: mass((e) => e.profile.traits.includes("frontline")),
    engage: mass((e) => e.profile.traits.includes("engage")),
    healing: enemies.filter(
      (e) => e.locked && e.profile.traits.includes("healing"),
    ),
    control: enemies.filter((e) => e.locked && controlAbility(e.championId)),
    setup: allies.filter((a) => a.locked && controlAbility(a.championId)),
    carries: allies.filter(
      (a) =>
        a.locked && (a.profile.traits.includes("scaling") || a.role === "BOT"),
    ),
  };
}
