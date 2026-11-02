import type { GameData } from "../gameData";
import type { DraftContext, RunePage } from "./recommendations";
import { officialPages } from "./analysis";
import { draftSignals, removableControl } from "./draftSignals";
import { kitById, profileById } from "./profiles";

export interface LoadoutChoice {
  runes: RunePage;
  spells: number[];
  reasons: string[];
}
export function contextualLoadout(
  data: GameData,
  ctx: DraftContext,
  base: RunePage,
  spells: number[],
): LoadoutChoice {
  const s = draftSignals(ctx);
  const own = profileById.get(ctx.playerChampionId!);
  const candidates = [
    base,
    ...officialPages(ctx.playerChampionId!, ctx.playerRole!).filter(
      (p) => p.primaryRunes[0] === base.primaryRunes[0],
    ),
  ];
  const score = (page: RunePage) => {
    const ids = [...page.primaryRunes, ...page.secondaryRunes];
    let value = page === base ? 1 : 0;
    if (ids.includes(9111) && (s.engage >= 2 || own?.traits.includes("resets")))
      value += 3;
    if (
      ids.includes(8232) &&
      ctx.playerRole === "JUNGLE" &&
      s.setup.length >= 2 &&
      s.engage < 2
    )
      value += 4;
    if (ids.includes(8304) && s.engage >= 2) value -= 2;
    if (ids.includes(8453) && own?.traits.includes("healing")) value += 2;
    if (ids.includes(8242) && s.control.length >= 2) value += 2;
    return value;
  };
  candidates.sort((a, b) => score(b) - score(a));
  const chosen = candidates[0];
  const runes: RunePage = {
    primary: chosen.primary,
    secondary: chosen.secondary,
    primaryRunes: [...chosen.primaryRunes],
    secondaryRunes: [...chosen.secondaryRunes],
    shards: [...chosen.shards],
  };
  const reasons: string[] = [];
  if (chosen !== base) {
    if (runes.secondaryRunes.includes(8232))
      reasons.push(
        "Secundaria de Riot con Caminar sobre Agua: coordinación de río con el control aliado.",
      );
    else if ([...runes.primaryRunes, ...runes.secondaryRunes].includes(9111))
      reasons.push(
        "Página de Riot con Triunfo: recuperación tras derribos frente a varias entradas rivales.",
      );
    else
      reasons.push(
        "Variante publicada por Riot con mejor ajuste a las herramientas de ambos equipos.",
      );
  }
  const lane = s.enemies.find((e) => e.locked && e.role === ctx.playerRole);
  if (lane?.profile.traits.includes("poke")) {
    const swap = (ids: number[]) => ids.map((id) => (id === 8473 ? 8444 : id));
    if (
      [...runes.primaryRunes, ...runes.secondaryRunes].includes(8473) &&
      data.trees.some((t) =>
        t.slots.some((row) =>
          row.runes.some(
            (r) =>
              r.id === 8444 && /después de recibir daño/iu.test(r.description),
          ),
        ),
      )
    ) {
      runes.primaryRunes = swap(runes.primaryRunes);
      runes.secondaryRunes = swap(runes.secondaryRunes);
      reasons.push(
        "Segundo Aire sustituye Coraza Ósea ante el poke del rival de línea confirmado; es un ajuste por reglas, sin muestra propia.",
      );
    }
  }
  if (!reasons.length)
    reasons.push(
      "Se conserva la página estadística: el draft no justifica cambiarla con las reglas disponibles.",
    );
  let selectedSpells = [...spells];
  const cleansable = s.enemies.filter(
    (e) =>
      e.locked &&
      kitById
        .get(e.championId)
        ?.some((a) => removableControl.test(a.description)),
  );
  if (
    ctx.playerRole === "BOT" &&
    spells.includes(4) &&
    cleansable.length >= 2
  ) {
    selectedSpells = [4, 1];
    reasons.push(
      "Limpiar como opción contra varias fuentes de control removible; no elimina supresiones ni desplazamientos. Sustituye el hechizo defensivo de la fuente.",
    );
  } else
    reasons.push(
      ctx.playerRole === "JUNGLE"
        ? "Se conserva Castigo y la combinación de hechizos publicada para jungla."
        : "Se conservan los hechizos publicados; no hay un ajuste contextual suficientemente respaldado.",
    );
  return { runes, spells: selectedSpells, reasons };
}
