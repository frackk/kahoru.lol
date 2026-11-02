import type { GameData } from "../gameData";
import {
  recommend,
  type DraftContext,
  type Recommendation,
} from "./recommendations";

interface Prepared {
  result: Recommendation;
  selected: string;
  playerChampionId: number | null;
  userSelected: boolean;
}
export class SessionPlans {
  private sessions = new Map<string, Prepared>();
  prepare(
    data: GameData,
    context: DraftContext,
    editable: boolean,
    pool: number[] = [],
  ): Prepared | undefined {
    const previous = this.sessions.get(context.sessionId);
    if (!editable) return previous;
    const result = recommend(data, context, pool);
    if (previous?.result.signature === result.signature) return previous;
    const next = {
      result,
      playerChampionId: context.playerChampionId,
      userSelected:
        previous?.playerChampionId === context.playerChampionId &&
        previous.userSelected,
      selected:
        previous?.userSelected &&
        previous?.playerChampionId === context.playerChampionId &&
        result.plans.some((p) => p.id === previous?.selected)
          ? previous!.selected
          : (result.plans[0]?.id ?? ""),
    };
    this.sessions.set(context.sessionId, next);
    while (this.sessions.size > 8)
      this.sessions.delete(this.sessions.keys().next().value!);
    return next;
  }
  select(sessionId: string, planId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry?.result.plans.some((p) => p.id === planId)) {
      entry.selected = planId;
      entry.userSelected = true;
    }
  }
}
export const sessionPlans = new SessionPlans();
