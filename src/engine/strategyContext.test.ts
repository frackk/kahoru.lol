import { it, expect } from "vitest";
import data from "../../data/game-data.json";
import { roles } from "../contracts";
import type { GameData } from "../gameData";
import { strategyContext } from "./strategyContext";
import { profiles } from "./profiles";
for (const role of roles)
  it(`preparación para ${role}: fases completas y sin identidades`, () => {
    for (const champion of profiles.filter((p) => p.roles.includes(role))) {
      const context = {
        sessionId: "test",
        playerChampionId: champion.championId,
        playerRole: role,
        allies: [{ championId: champion.championId, role, locked: true }],
        enemies: [],
        bans: [],
      };
      const payload = strategyContext(data as GameData, context);
      const value = JSON.parse(payload);
      expect(
        new Set(value.facts.map((f: { phase: string }) => f.phase)),
      ).toEqual(new Set(["opening", "objectives", "fights"]));
      expect(payload).not.toMatch(/puuid|summonerId|playerName/);
      expect(payload.length).toBeLessThan(32000);
    }
  });
it("Viego: primer derribo y seguimiento, con aliados concretos", () => {
  const slot = (championId: number) => ({
    championId,
    role: null,
    locked: true,
  });
  const value = JSON.parse(
    strategyContext(data as GameData, {
      sessionId: "test",
      playerChampionId: 234,
      playerRole: "JUNGLE",
      allies: [82, 234, 80, 222, 432].map(slot),
      enemies: [113, 141, 134, 21, 50].map(slot),
      bans: [],
    }),
  );
  expect(JSON.stringify(value.facts)).toContain("primer derribo");
  expect(JSON.stringify(value.facts)).toContain("Mordekaiser");
});
