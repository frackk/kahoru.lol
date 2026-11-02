import type { GameData } from "../gameData";
import type { Role } from "../contracts";
import { readStatistics } from "../statistics";
import { rulesRevision } from "./profiles";
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
  frozen?: boolean;
  modelChoice?: { planId: string; reasons: string[] };
}
export class SessionPlans {
  constructor(private lookup: typeof readStatistics = readStatistics) {}
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
    if (!editable) {
      if (previous) previous.frozen = true;
      return previous;
    }
    if (previous) previous.frozen = false;
    context = {
      ...context,
      playerRole: this.role(context.sessionId) ?? context.playerRole,
    };
    const analysis = this.lookup(
      context.playerChampionId,
      context.playerRole,
    )?.data;
    if (
      previous?.result.signature ===
      JSON.stringify([
        context,
        data.catalog.version,
        rulesRevision,
        pool,
        analysis,
      ])
    )
      return previous;
    const result = recommend(
      data,
      context,
      pool,
      analysis,
      previous?.userSelected ? previous.selected : undefined,
    );
    if (
      previous?.userSelected &&
      previous.playerChampionId === context.playerChampionId &&
      !result.plans.some((p) => p.id === previous.selected)
    ) {
      const candidate = result.candidates?.find(
        (p) => p.id === previous.selected,
      );
      if (candidate) result.plans = [candidate, ...result.plans].slice(0, 3);
    }
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
  applyModelChoice(
    sessionId: string,
    signature: string,
    planId: string,
    reasonIds: string[],
    expectedSelection?: string,
  ) {
    const entry = this.sessions.get(sessionId);
    const candidate = entry?.result.candidates?.find((p) => p.id === planId);
    if (
      !entry ||
      entry.frozen ||
      entry.result.signature !== signature ||
      (expectedSelection !== undefined &&
        entry.selected !== expectedSelection) ||
      !candidate ||
      !reasonIds.length ||
      reasonIds.some(
        (id) => !candidate.decision.reasons.some((r) => r.id === id),
      )
    )
      return false;
    entry.result.plans = [
      candidate,
      ...entry.result.plans.filter((p) => p.id !== planId),
    ].slice(0, 3);
    entry.selected = planId;
    entry.userSelected = true;
    entry.modelChoice = {
      planId,
      reasons: reasonIds.map(
        (id) => candidate.decision.reasons.find((r) => r.id === id)!.text,
      ),
    };
    return true;
  }
}
export const sessionPlans = new SessionPlans();
