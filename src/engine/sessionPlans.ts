import type { GameData } from "../gameData";
import type { Role } from "../contracts";
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
  private roles = new Map<string, Role>();
  role(sessionId: string) {
    return this.roles.get(sessionId) ?? null;
  }
  setRole(sessionId: string, role: Role | null) {
    if (role) this.roles.set(sessionId, role);
    else this.roles.delete(sessionId);
  }
  prepare(
    data: GameData,
    context: DraftContext,
    editable: boolean,
    pool?: number[],
  ): Prepared | undefined {
    const previous = this.sessions.get(context.sessionId);
    if (!editable) return previous;
    context = {
      ...context,
      playerRole: this.role(context.sessionId) ?? context.playerRole,
    };
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
    while (this.sessions.size > 8) {
      const oldest = this.sessions.keys().next().value!;
      this.sessions.delete(oldest);
      this.roles.delete(oldest);
    }
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
