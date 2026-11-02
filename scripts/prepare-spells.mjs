import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
const version = JSON.parse(
  await readFile("data/champions.json", "utf8"),
).version;
const source = `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_AR/summoner.json`;
const response = await fetch(source);
if (!response.ok) throw Error("No se pudieron obtener hechizos");
const raw = await response.json();
const spells = [];
for (const s of Object.values(raw.data).filter((s) =>
  s.modes.includes("CLASSIC"),
)) {
  const id = Number(s.key);
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${s.image.full}`;
  const r = await fetch(url);
  if (!r.ok) throw Error("Icono no disponible");
  const folder = `public/knowledge/${version.split(".").slice(0, 2).join(".")}/spells`;
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/${id}.png`, Buffer.from(await r.arrayBuffer()));
  spells.push({
    id,
    name: s.name,
    description: s.description.replace(/<[^>]*>/g, " "),
    level: s.summonerLevel,
    source: url,
  });
}
await writeFile(
  "data/knowledge/spells.json",
  JSON.stringify(
    { version, source, retrievedAt: new Date().toISOString(), spells },
    null,
    2,
  ) + "\n",
);
console.log({ spells: spells.length });
