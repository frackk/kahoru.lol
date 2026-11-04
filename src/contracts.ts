export const roles = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as const;
export type Role = (typeof roles)[number];
export type Team = "allies" | "enemies";
export type MapSide = "BLUE" | "RED";
export const sideNames: Record<MapSide, string> = {
  BLUE: "Azul · base inferior izquierda",
  RED: "Rojo · base superior derecha",
};
export type Phase =
  | "IDLE"
  | "QUEUE"
  | "CHAMP_SELECT"
  | "DRAFT_FINALIZING"
  | "LOADING"
  | "IN_GAME"
  | "POST_GAME";
export interface Champion {
  id: number;
  slug: string;
  name: string;
  title: string;
  icon?: string;
  tags?: string[];
  resource?: string;
  range?: number;
}
export interface Catalog {
  version: string;
  locale: string;
  source: string;
  retrievedAt: string;
  sha256: string;
  champions: Champion[];
}
export interface DraftSlot {
  championId: number | null;
  locked: boolean;
  role: Role | null;
}
export interface DraftSnapshot {
  sessionId: string;
  patch: string;
  mode: string;
  playerRole: Role;
  allies: DraftSlot[];
  enemies: DraftSlot[];
  bans: number[];
  revision: number;
  updatedAt: string;
}
export interface Session {
  source: "simulator";
  phase: Phase;
  connection: "CONNECTED" | "RECOVERING";
  draft: DraftSnapshot;
}
export type Action =
  | {
      type:
        "start" | "queue" | "advance" | "dodge" | "disconnect" | "reconnect";
    }
  | { type: "select"; team: Team; slot: number; champion: number | null }
  | { type: "lock"; team: Team; slot: number }
  | { type: "swap"; team: Team; first: number; second: number }
  | { type: "ban" | "unban"; champion: number }
  | { type: "setRole"; role: Role };

export const roleNames: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MID: "Mid",
  BOT: "Bot / ADC",
  SUPPORT: "Support",
};
export const phaseNames: Record<Phase, string> = {
  IDLE: "Sin sesión",
  QUEUE: "En cola",
  CHAMP_SELECT: "Selección de campeones",
  DRAFT_FINALIZING: "Draft confirmado",
  LOADING: "Pantalla de carga",
  IN_GAME: "Partida",
  POST_GAME: "Fin de partida",
};

export function availableChampions(
  catalog: Catalog,
  draft: DraftSnapshot,
  query: string,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const occupied = new Set([
    ...draft.bans,
    ...draft.allies
      .concat(draft.enemies)
      .flatMap((s) => (s.championId === null ? [] : [s.championId])),
  ]);
  return catalog.champions.filter(
    (champion) =>
      !occupied.has(champion.id) &&
      normalize(champion.name).includes(normalize(query.trim())),
  );
}
