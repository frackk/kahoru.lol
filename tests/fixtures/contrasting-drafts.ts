import type { DraftContext } from "../../src/engine/recommendations";
import { roles } from "../../src/contracts";
const team = (ids: number[]) =>
  ids.map((championId, i) => ({ championId, role: roles[i], locked: true }));
export const pastDraft: DraftContext = {
  sessionId: "past-draft",
  playerChampionId: 234,
  playerRole: "JUNGLE",
  bans: [],
  allies: team([133, 234, 30, 21, 161]),
  enemies: team([54, 31, 202, 115, 497]),
};
export const frontlineDraft: DraftContext = {
  sessionId: "frontline",
  playerChampionId: 234,
  playerRole: "JUNGLE",
  bans: [],
  allies: team([54, 234, 103, 222, 89]),
  enemies: team([516, 113, 50, 22, 12]),
};
export const fragileDraft: DraftContext = {
  sessionId: "fragile",
  playerChampionId: 234,
  playerRole: "JUNGLE",
  bans: [],
  allies: team([54, 234, 80, 222, 89]),
  enemies: team([133, 76, 101, 81, 350]),
};
