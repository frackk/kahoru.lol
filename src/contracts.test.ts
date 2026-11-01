import { describe, expect, it } from "vitest";
import {
  availableChampions,
  type Catalog,
  type DraftSnapshot,
} from "./contracts";
import { readPreferences } from "./preferences";

const catalog: Catalog = {
  version: "test",
  locale: "es_AR",
  source: "test",
  retrievedAt: "",
  sha256: "",
  champions: [
    { id: 1, slug: "Annie", name: "Annie", title: "" },
    { id: 2, slug: "Olaf", name: "Olaf", title: "" },
    { id: 3, slug: "Chogath", name: "Cho'Gath", title: "" },
    { id: 4, slug: "Belveth", name: "Bél'Veth", title: "" },
  ],
};
const draft: DraftSnapshot = {
  sessionId: "test",
  patch: "test",
  mode: "SUMMONERS_RIFT_DRAFT",
  playerRole: "MID",
  revision: 0,
  updatedAt: "0",
  bans: [2],
  allies: [{ championId: 1, locked: false, role: "TOP" }],
  enemies: [{ championId: 3, locked: true, role: null }],
};

describe("selección de campeones", () => {
  it("excluye bans, picks tentativos y confirmados de ambos equipos", () => {
    expect(availableChampions(catalog, draft, "").map((c) => c.id)).toEqual([
      4,
    ]);
  });
  it("busca sin distinguir tildes, mayúsculas o espacios extremos", () => {
    expect(
      availableChampions(catalog, draft, " BEL' ").map((c) => c.id),
    ).toEqual([4]);
    expect(availableChampions(catalog, draft, "ausente")).toEqual([]);
  });
});

describe("preferencias", () => {
  it("recupera el valor por defecto ante datos corruptos o tipos inválidos", () => {
    for (const raw of [null, "{", "null", '"texto"', '{"compact":"sí"}'])
      expect(readPreferences(raw)).toEqual({ compact: false });
  });
  it("restaura solo las propiedades admitidas", () => {
    expect(readPreferences('{"compact":true,"endpoint":"other"}')).toEqual({
      compact: true,
    });
  });
});
