import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import {join,dirname} from "node:path";
const root = new URL("../", import.meta.url);
const files=[process.env.LEAGUE_LOCKFILE,"C:/Riot Games/League of Legends/lockfile","C:/Program Files (x86)/Riot Games/League of Legends/lockfile"].filter(Boolean);
if(process.env.PROGRAMDATA){try{const installations=JSON.parse(await readFile(join(process.env.PROGRAMDATA,"Riot Games/RiotClientInstalls.json"),"utf8"));for(const path of Object.keys(installations.associated_client??{}))files.push(join(path.toLowerCase().endsWith(".exe")?dirname(path):path,"lockfile"));}catch{ /* Se conservan las ubicaciones habituales. */ }}
let credentials;
for(const path of files){try{credentials=(await readFile(path,"utf8")).trim().split(":");break;}catch{ /* Probar la instalación siguiente. */ }}
if(!credentials||credentials.length!==5||credentials[4]!=="https"||!/^\d+$/.test(credentials[2]))throw Error("No se encontró una conexión HTTPS válida. Abrí LoL o indicá LEAGUE_LOCKFILE.");
const ca = await readFile(
  new URL("src-tauri/certificates/riotgames.pem", root),
);
async function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://127.0.0.1:${credentials[2]}${path}`,
        { auth: `riot:${credentials[3]}`, ca, timeout: 3000 },
        (r) => {
          let s = "";
          r.on("data", (b) => (s += b));
          r.on("end", () =>
            r.statusCode === 200
              ? resolve(JSON.parse(s))
              : reject(Error(`El cliente no ofrece ${path}`)),
          );
        },
      )
      .on("error", reject);
  });
}
const catalog = JSON.parse(
  await readFile(new URL("data/champions.json", root), "utf8"),
);
const positions = await get("/lol-perks/v1/recommended-champion-positions");
const version = await get("/lol-patch/v1/game-version");
const map = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MIDDLE: "MID",
  BOTTOM: "BOT",
  UTILITY: "SUPPORT",
};
const plain = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const champions = [];
for (const c of catalog.champions) {
  const info = await get(`/lol-game-data/assets/v1/champions/${c.id}.json`);
  const roles = (positions[c.id]?.recommendedPositions ?? []).filter(
    (r) => map[r],
  );
  const pages = [];
  for (const role of roles) {
    const recommendations = await get(
      `/lol-perks/v1/recommended-pages/champion/${c.id}/position/${role.toLowerCase()}/map/11`,
    );
    for (const p of recommendations) {
      pages.push({
        role: map[role],
        recommendationId: p.recommendationId,
        primary: p.primaryPerkStyleId,
        secondary: p.secondaryPerkStyleId,
        primaryRunes: p.perks
          .filter(
            (x) =>
              x.slotType !== "kStatMod" && x.styleId === p.primaryPerkStyleId,
          )
          .map((x) => x.id),
        secondaryRunes: p.perks
          .filter(
            (x) =>
              x.slotType !== "kStatMod" && x.styleId === p.secondaryPerkStyleId,
          )
          .map((x) => x.id),
        shards: p.perks
          .filter((x) => x.slotType === "kStatMod")
          .map((x) => x.id),
        spells: p.summonerSpellIds,
      });
    }
  }
  champions.push({
    id: c.id,
    roles: roles.map((r) => map[r]),
    damage: info.tacticalInfo.damageType,
    durability: info.playstyleInfo.durability,
    classes: info.roles,
    abilities: [info.passive, ...info.spells].map((s) => ({
      name: s.name,
      description: plain(s.abilityDescription ?? s.description ?? ""),
    })),
    pages,
  });
}
const out = {
  schemaVersion: 1,
  clientVersion: version,
  retrievedAt: new Date().toISOString(),
  source:
    "League Client API: public champion metadata and recommended pages; map 11",
  champions,
};
await writeFile(
  new URL("data/client-recommendations.json", root),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    champions: champions.length,
    pages: champions.reduce((n, c) => n + c.pages.length, 0),
    withoutPages: champions.filter((c) => !c.pages.length).map((c) => c.id),
  }),
);
