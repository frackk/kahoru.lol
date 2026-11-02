import type { GameData } from "../gameData";
import type { DraftContext } from "./recommendations";
import { strategyFacts } from "./strategyFacts";

export function strategy(data: GameData, context: DraftContext): string[] {
  const facts = strategyFacts(data, context);
  return ["opening", "objectives", "fights"].map((phase) =>
    facts
      .filter((f) => f.phase === phase)
      .slice(0, phase === "fights" ? 2 : 1)
      .map((f) => f.text)
      .join(" "),
  );
}
