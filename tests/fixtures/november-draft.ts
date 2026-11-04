import type { DraftContext } from "../../src/engine/recommendations";
import { roles } from "../../src/contracts";

// Selección aportada por el usuario; sin resultado, compras reales ni identidades.
export const novemberDraft: DraftContext = {
  sessionId: "november-draft",
  playerChampionId: 234,
  playerRole: "JUNGLE",
  playerSide: null,
  allies: [82, 234, 39, 202, 43].map((championId, i) => ({
    championId,
    role: roles[i],
    locked: true,
  })),
  enemies: [111, 23, 103, 21, 9].map((championId) => ({
    championId,
    role: null,
    locked: true,
  })),
  bans: [],
};
