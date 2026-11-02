import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? ""))
  throw new Error("Se requiere una versión explícita de Data Dragon.");
const base = `https://ddragon.leagueoflegends.com/cdn/${version}`;
const responses = new Map();
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  const raw = await r.text();
  responses.set(url, raw);
  return JSON.parse(raw);
}
const [champions, items, trees] = await Promise.all([
  json(`${base}/data/es_AR/champion.json`),
  json(`${base}/data/es_AR/item.json`),
  json(`${base}/data/es_AR/runesReforged.json`),
]);
if (champions.version !== version || items.version !== version)
  throw new Error("Versiones inconsistentes");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const catalog = {
  version,
  locale: "es_AR",
  source: `${base}/data/es_AR/champion.json`,
  retrievedAt: new Date().toISOString(),
  sha256: hash(responses.get(`${base}/data/es_AR/champion.json`)),
  champions: Object.values(champions.data)
    .map((c) => ({
      id: Number(c.key),
      slug: c.id,
      name: c.name,
      title: c.title,
      icon: `champion/${c.image.full}`,
      tags: c.tags,
      resource: c.partype,
      range: c.stats.attackrange,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es")),
};
const game = {
  schemaVersion: 1,
  catalog,
  assetBase: null,
  items: Object.entries(items.data)
    .filter(([id, i]) => Number(id) < 10000 && i.maps?.["11"])
    .map(([id, i]) => ({
      id: Number(id),
      name: i.name,
      icon: `item/${i.image.full}`,
      description: i.description
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      cost: i.gold.total,
      combineCost: i.gold.base,
      purchasable: i.gold.purchasable && i.inStore !== false,
      from: (i.from ?? []).map(Number),
      into: (i.into ?? []).map(Number),
      tags: i.tags ?? [],
      requiredChampion: i.requiredChampion ?? null,
    })),
  trees: trees.map((t) => ({
    id: t.id,
    name: t.name,
    icon: `tree/${t.id}.png`,
    slots: t.slots.map((s) => ({
      runes: s.runes.map((r) => ({
        id: r.id,
        name: r.name,
        icon: `rune/${r.id}.png`,
        description: r.longDesc
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      })),
    })),
  })),
  assets: {},
};
const downloads = new Map();
for (const c of catalog.champions)
  downloads.set(c.icon, `${base}/img/${c.icon}`);
for (const i of game.items) downloads.set(i.icon, `${base}/img/${i.icon}`);
for (const t of trees) {
  downloads.set(
    `tree/${t.id}.png`,
    `https://ddragon.leagueoflegends.com/cdn/img/${t.icon}`,
  );
  for (const s of t.slots)
    for (const r of s.runes)
      downloads.set(
        `rune/${r.id}.png`,
        `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}`,
      );
}
const queue = [...downloads];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (;;) {
      const entry = queue.pop();
      if (!entry) return;
      const [path, url] = entry;
      if (
        !/^(champion|item|rune|tree)\/[A-Za-z0-9_.-]+\.png$/.test(path) ||
        path.includes("..")
      )
        throw new Error("Ruta de imagen no válida");
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`${r.status}: ${url}`);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
        throw new Error(`PNG inválido: ${url}`);
      const target = `public/game/${version}/${path}`;
      await mkdir(target.substring(0, target.lastIndexOf("/")), {
        recursive: true,
      });
      await writeFile(target, bytes);
      game.assets[path] = { url, sha256: hash(bytes) };
    }
  }),
);
game.assets = Object.fromEntries(
  Object.entries(game.assets).sort(([a], [b]) => a.localeCompare(b)),
);
await writeFile("data/game-data.json", JSON.stringify(game, null, 2) + "\n");
await writeFile("data/champions.json", JSON.stringify(catalog, null, 2) + "\n");
console.log(
  `${catalog.champions.length} campeones, ${game.items.length} objetos, ${downloads.size} imágenes · ${version}`,
);
