import knowledge from "../../data/knowledge/profiles.json";
import type { Role } from "../contracts";

export interface Profile {
  championId: number;
  slug: string;
  group: string;
  roles: Role[];
  damage: "physical" | "magic" | "mixed";
  core: number[];
  starter: number;
  boots: number;
  runes: string;
  traits: string[];
}
export const profiles = knowledge.profiles as Profile[];
export const rulesPatch = knowledge.patch;
export const rulesRevision = knowledge.revision;
export const profileById = new Map(profiles.map((p) => [p.championId, p]));
