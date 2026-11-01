import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(
    "Indicá una versión explícita: npm run data:update -- 16.21.1",
  );
}
const source = `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_AR/champion.json`;
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Data Dragon respondió ${response.status}`);
const raw = await response.text();
const payload = JSON.parse(raw);
if (payload.version !== version || payload.type !== "champion") {
  throw new Error("La respuesta no corresponde a la versión solicitada");
}
const champions = Object.values(payload.data)
  .map((entry) => {
    const id = Number(entry.key);
    if (!Number.isSafeInteger(id) || id <= 0 || !entry.name || !entry.id) {
      throw new Error("Campeón inválido en el catálogo");
    }
    return { id, slug: entry.id, name: entry.name, title: entry.title };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "es"));
if (
  champions.length < 100 ||
  new Set(champions.map((c) => c.id)).size !== champions.length
) {
  throw new Error("El catálogo está incompleto o contiene duplicados");
}
const catalog = {
  version,
  locale: "es_AR",
  source,
  retrievedAt: new Date().toISOString(),
  sha256: createHash("sha256").update(raw).digest("hex"),
  champions,
};
await mkdir("data", { recursive: true });
await writeFile(
  "data/champions.json.tmp",
  `${JSON.stringify(catalog, null, 2)}\n`,
);
await rename("data/champions.json.tmp", "data/champions.json");
console.log(`${champions.length} campeones · Data Dragon ${version}`);
