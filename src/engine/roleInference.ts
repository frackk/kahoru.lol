import type { DraftSlot, Role } from "../contracts";
import { profileById } from "./profiles";

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
