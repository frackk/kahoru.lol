import { useContext, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GameDataContext, GameIcon, type GameData } from "../gameData";
import { refreshRecentStatistics } from "../statistics";

interface LibraryEntry {
  id: number;
  name: string;
  icon?: string;
  cost?: number;
  purchasable?: boolean;
  from?: number[];
  description?: string;
  title?: string;
}

export function DataLibrary({
  onUpdate,
}: {
  onUpdate: (data: GameData) => void | Promise<void>;
}) {
  const data = useContext(GameDataContext);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"champions" | "items" | "runes">("items");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void invoke<{ message: string; completed: number; total: number }>(
        "get_update_status",
      )
        .then((s) =>
          setMessage(
            `${s.message}${s.total ? ` · ${s.completed}/${s.total}` : ""}`,
          ),
        )
        .catch(() => {});
    }, 700);
    return () => clearInterval(timer);
  }, [busy]);
  async function update() {
    setBusy(true);
    setMessage("Comprobando Data Dragon…");
    try {
      const next = await invoke<GameData>("update_game_data");
      await onUpdate(next);
      const official = (await invoke<{ message: string }>("get_update_status"))
        .message;
      setMessage(
        "Datos oficiales comprobados. Actualizando análisis recientes…",
      );
      const refreshed = await refreshRecentStatistics();
      setMessage(
        `${official} Análisis recientes comprobados: ${refreshed.completed}/${refreshed.total}.`,
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p>Cargando datos…</p>;
  const entries: LibraryEntry[] =
    tab === "champions"
      ? data.catalog.champions
      : tab === "items"
        ? data.items
        : data.trees.flatMap((t) => t.slots.flatMap((s) => s.runes));
  const filtered = entries.filter((e) =>
    e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="eyebrow">DATA DRAGON · {data.catalog.version}</div>
      <h1>Datos del juego</h1>
      <section className="panel data-updates">
        <div>
          <h2>Comprobar actualizaciones</h2>
          <p>
            Se busca la versión del parche detectado en LoL. Sin cliente
            abierto, se comprueba el parche del catálogo actual.
          </p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void update()}
        >
          {busy ? "Comprobando…" : "Comprobar datos"}
        </button>
        <p role="status">{message}</p>
        <p className="small-note">
          Con LoL abierto se comprueban también sus páginas recomendadas,
          posiciones y kits, y se revisan hasta cinco análisis consultados en
          esta sesión: compras, runas, spells, habilidades y matchups de OP.GG.
          Cambiar el catálogo vuelve a validar runas y recetas. Se respetan la
          caché y los límites del proveedor.
        </p>
        <details>
          <summary>Fuentes y alcance</summary>
          <p>
            Riot Games: catálogo, descripciones, imágenes, versiones y páginas
            del cliente. OP.GG MCP: agregados por campeón y posición. Son
            fuentes distintas; las páginas de Riot no aportan una segunda
            muestra estadística.
          </p>
          <p>
            El conocimiento estratégico por reglas se distribuye con la
            aplicación. No se entrena ni se reescribe automáticamente a partir
            de búsquedas web.
          </p>
          <a
            href="https://www.leagueoflegends.com/es-mx/news/tags/patch-notes/"
            target="_blank"
            rel="noreferrer"
          >
            Notas oficiales de los parches
          </a>
        </details>
      </section>
      <div className="library-toolbar">
        <div className="control-buttons">
          {(["champions", "items", "runes"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active-button" : ""}
              onClick={() => setTab(t)}
            >
              {t === "champions"
                ? "Campeones"
                : t === "items"
                  ? "Objetos"
                  : "Runas"}
            </button>
          ))}
        </div>
        <input
          placeholder="Buscar…"
          aria-label="Buscar en los datos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="small-note">
        {filtered.length} resultados · Fuente: Riot Games ·{" "}
        {new Date(data.catalog.retrievedAt).toLocaleDateString("es-AR")}
      </p>
      <div className="library-grid">
        {filtered.map((e) => (
          <article className="panel library-entry" key={e.id}>
            <GameIcon path={e.icon} label={e.name} size={48} />
            <div>
              <strong>{e.name}</strong>
              {e.cost !== undefined && (
                <small>
                  {e.cost} de oro ·{" "}
                  {e.purchasable
                    ? "Disponible en tienda"
                    : "No disponible en tienda"}
                </small>
              )}
              <p>{e.description ?? e.title}</p>
              {e.from && e.from.length > 0 && (
                <div className="recipe-icons">
                  {e.from.map((id, i) => {
                    const c = data.items.find((item) => item.id === id);
                    return (
                      <GameIcon
                        key={i}
                        path={c?.icon}
                        label={c?.name ?? `Componente ${id}`}
                        size={28}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
