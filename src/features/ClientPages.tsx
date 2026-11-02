import { ImportButtons } from "./ImportButtons";
import { useContext, useState } from "react";
import { GameDataContext, GameIcon } from "../gameData";
import { officialPages, clientPatch } from "../engine/analysis";
import shards from "../../data/knowledge/shards.json";
import spells from "../../data/knowledge/spells.json";
import type { Role } from "../contracts";
export function SpellIcons({ ids }: { ids: number[] }) {
  return (
    <div className="rune-row">
      {ids.map((id) => {
        const s = spells.spells.find((s) => s.id === id);
        return s ? (
          <div key={id}>
            <img
              className="game-icon"
              width={32}
              height={32}
              alt={s.name}
              src={`/knowledge/${spells.version.split(".").slice(0, 2).join(".")}/spells/${id}.png`}
            />
            <small>{s.name}</small>
          </div>
        ) : null;
      })}
    </div>
  );
}
export function ClientPages({
  championId,
  role,
  sessionId,
  enabled = false,
}: {
  championId: number | null;
  role: Role | null;
  sessionId: string;
  enabled?: boolean;
}) {
  const data = useContext(GameDataContext);
  const [selected, setSelected] = useState(0);
  if (
    !championId ||
    !role ||
    !data ||
    !data.catalog.version.startsWith(clientPatch + ".")
  )
    return null;
  const pages = officialPages(championId, role);
  const rune = (id: number) =>
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .find((r) => r.id === id);
  return (
    <details className="client-pages">
      <summary>Páginas del cliente de Riot ({pages.length})</summary>
      <p className="small-note">
        Son recomendaciones del cliente para este campeón y posición. No están
        calculadas contra estos cinco rivales ni incluyen una muestra publicada.
        Podés importarlas durante la selección mediante una acción explícita.
      </p>
      <div className="plan-tabs">
        {pages.map((p, i) => (
          <button
            key={p.recommendationId}
            className={i === selected ? "active-button" : ""}
            onClick={() => setSelected(i)}
          >
            Opción {i + 1} · {rune(p.primaryRunes[0])?.name}
          </button>
        ))}
      </div>
      <div>
        {pages
          .slice(
            selected < pages.length ? selected : 0,
            (selected < pages.length ? selected : 0) + 1,
          )
          .map((p, i) => (
            <section className="panel" key={i}>
              <h3>
                Opción {i + 1} · {rune(p.primaryRunes[0])?.name}
              </h3>
              <div className="rune-row">
                {[...p.primaryRunes, ...p.secondaryRunes].map((id) => (
                  <GameIcon
                    key={id}
                    path={rune(id)?.icon}
                    label={rune(id)?.name ?? String(id)}
                    size={30}
                  />
                ))}
              </div>
              <div className="rune-row">
                {p.shards.map((id, index) => (
                  <img
                    key={index}
                    alt={shards.shards.find((s) => s.id === id)?.name}
                    className="game-icon"
                    width={26}
                    height={26}
                    src={`/knowledge/${shards.patch}/shards/${id}.png`}
                  />
                ))}
              </div>
              <SpellIcons ids={p.spells} />
              <ImportButtons
                championId={championId}
                sessionId={sessionId}
                runes={p}
                spells={p.spells}
                enabled={enabled}
              />
              <small>Revisión del cliente: {p.recommendationId}</small>
            </section>
          ))}
      </div>
    </details>
  );
}
