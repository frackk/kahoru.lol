import knowledge from "../../data/knowledge/profiles.json";
import bundled from "../../data/client-recommendations.json";
import catalog from "../../data/champions.json";
import type { Champion, Role } from "../contracts";
export interface Profile {
  championId: number;
  slug: string;
  group: string;
  roles: Role[];
  damage: "physical" | "magic" | "mixed";
  traits: string[];
  core: number[];
  starter: number;
  boots: number;
  runes: string;
}
let client = bundled;
export type ClientKnowledge = typeof bundled;
export const getClientKnowledge = () => client;
export let rulesPatch = client.clientVersion.split(".").slice(0, 2).join(".");
export let rulesRevision = 3;
const createProfiles = (
  client: ClientKnowledge,
  champions: Champion[] = catalog.champions,
) =>
  client.champions.map((c): Profile => {
    const previous = knowledge.profiles.find((p) => p.championId === c.id);
    const slug = champions.find((p) => p.id === c.id)?.slug ?? String(c.id);
    const traits = [...new Set(previous?.traits ?? [])];
    if (c.classes.includes("marksman") && ![22, 110, 429].includes(c.id)) {
      const index = traits.indexOf("engage");
      if (index >= 0) traits.splice(index, 1);
    }
    if (c.classes.includes("marksman") && !traits.includes("attacks"))
      traits.push("attacks");
    const profile: Profile = {
      championId: c.id,
      slug,
      roles: c.roles as Role[],
      damage:
        (previous?.damage as Profile["damage"]) ??
        (c.damage === "kPhysical"
          ? "physical"
          : c.damage === "kMagic"
            ? "magic"
            : "mixed"),
      traits,
      group: previous?.group ?? c.classes[0] ?? "unknown",
      core: [],
      starter: 0,
      boots: 0,
      runes: "",
    };
    if (c.id === 234) {
      profile.group = "resetFighter";
      profile.traits = ["attacks", "resets", "healing"];
    }
    return profile;
  });
export const profiles: Profile[] = createProfiles(client);
export const profileById = new Map(profiles.map((p) => [p.championId, p]));
export const kitById = new Map(
  client.champions.map((c) => [c.id, c.abilities]),
);

export function installClientKnowledge(
  next: ClientKnowledge,
  champions: Champion[],
) {
  client = next;
  rulesPatch = next.clientVersion.split(".").slice(0, 2).join(".");
  rulesRevision++;
  profiles.splice(0, profiles.length, ...createProfiles(next, champions));
  profileById.clear();
  for (const p of profiles) profileById.set(p.championId, p);
  kitById.clear();
  for (const c of next.champions) kitById.set(c.id, c.abilities);
}
