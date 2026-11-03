import { createContext, useContext } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Catalog } from "./contracts";

export interface Item {
  id: number;
  name: string;
  icon: string;
  description: string;
  cost: number;
  combineCost: number;
  purchasable: boolean;
  from: number[];
  into: number[];
  tags: string[];
  stats: Partial<Record<string, number>>;
  requiredChampion: string | null;
}
export interface Rune {
  id: number;
  name: string;
  icon: string;
  description: string;
}
export interface RuneTree {
  id: number;
  name: string;
  icon: string;
  slots: { runes: Rune[] }[];
}
export interface GameData {
  schemaVersion: number;
  catalog: Catalog;
  items: Item[];
  trees: RuneTree[];
  assetBase: string | null;
  assets: Record<string, { url: string; sha256: string }>;
}
export const GameDataContext = createContext<GameData | null>(null);
export function GameIcon({
  path,
  label,
  size = 40,
}: {
  path?: string;
  label: string;
  size?: number;
}) {
  const data = useContext(GameDataContext);
  if (!path || !data?.assets[path])
    return (
      <span
        className="icon-empty"
        style={{ width: size, height: size }}
        aria-label={label}
      >
        ?
      </span>
    );
  const src = data.assetBase
    ? convertFileSrc(`${data.assetBase}/${path}`)
    : `/game/${data.catalog.version}/${path}`;
  return (
    <img
      className="game-icon"
      src={src}
      alt={label}
      title={label}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
export function ChampionIcon({
  id,
  size = 40,
}: {
  id: number | null;
  size?: number;
}) {
  const data = useContext(GameDataContext);
  const c = data?.catalog.champions.find((c) => c.id === id);
  return (
    <GameIcon
      path={c?.icon}
      label={c?.name ?? "Campeón sin revelar"}
      size={size}
    />
  );
}
