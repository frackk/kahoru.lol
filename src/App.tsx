import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  phaseNames,
  type Action,
  type Catalog,
  type Session,
} from "./contracts";
import { Draft } from "./features/draft/Draft";
import { LiveClient } from "./features/LiveClient";
import { GameDataContext, type GameData } from "./gameData";
import { DataLibrary } from "./features/DataLibrary";
import { readPreferences } from "./preferences";
import { useLiveSession } from "./liveSession";

type Page = "home" | "draft" | "data" | "settings" | "about";
const pages: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: "⌂" },
  { id: "draft", label: "Simulador", icon: "◇" },
  { id: "data", label: "Datos del juego", icon: "▤" },
  { id: "settings", label: "Ajustes", icon: "⚙" },
  { id: "about", label: "Acerca de", icon: "ⓘ" },
];

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [gameData, setGameData] = useState<GameData | null>(null);
  const live = useLiveSession(gameData);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [preferences, setPreferences] = useState(() => {
    try {
      return readPreferences(localStorage.getItem("kahoru.preferences.v1"));
    } catch {
      return readPreferences(null);
    }
  });

  useEffect(() => {
    let active = true;
    if (!isTauri()) return;
    Promise.all([
      invoke<GameData>("get_game_data"),
      invoke<Session>("get_session"),
    ])
      .then(([data, state]) => {
        if (active) {
          setCatalog(data.catalog);
          setGameData(data);
          setSession(state);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudo iniciar la sesión. Cerrá y volvé a abrir la aplicación.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function send(action: Action) {
    if (!session || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      setSession(
        await invoke<Session>("dispatch", {
          action,
          revision: session.draft.revision,
        }),
      );
    } catch (reason) {
      setError(
        typeof reason === "string" ? reason : "No se pudo completar la acción.",
      );
      try {
        setSession(await invoke<Session>("get_session"));
      } catch {
        /* Se conserva el último snapshot disponible. */
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function start() {
    void send({ type: "start" });
    setPage("draft");
  }
  const confirmed =
    session?.draft.allies.concat(session.draft.enemies).filter((s) => s.locked)
      .length ?? 0;

  return (
    <GameDataContext.Provider value={gameData}>
      <div className={`shell ${preferences.compact ? "compact" : ""}`}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">k</span>
            <span>
              kahoru<span className="muted">.lol</span>
            </span>
          </div>
          <div className="nav-label">PREPARACIÓN DE PARTIDA</div>
          <nav aria-label="Navegación principal">
            {pages.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setPage(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="version">DESARROLLO · v0.3.0</span>
            <span>
              made by <strong>frack.one</strong>
            </span>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <span>{pages.find((p) => p.id === page)?.label}</span>
            <div className="status-group">
              <span className="status">
                <i />
                Cliente local + simulador
              </span>
              <span className="badge">DATOS {catalog?.version ?? "—"}</span>
            </div>
          </header>
          <div className="content">
            {!isTauri() && (
              <div className="notice" role="alert">
                Abrí kahoru.lol como aplicación de escritorio. La vista del
                navegador no tiene acceso al núcleo de sesión.
              </div>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {isTauri() && !session && !error && (
              <p role="status">Cargando catálogo y sesión…</p>
            )}
            {page === "home" && (
              <>
                <LiveClient
                  catalog={catalog}
                  snapshot={live.snapshot}
                  error={live.error}
                />
                <div className="eyebrow">TU PRÓXIMA PARTIDA</div>
                <h1>
                  Prepará el draft.
                  <br />
                  <span className="muted">Entendé tus opciones.</span>
                </h1>
                <p className="intro">
                  Armá composiciones, probá intercambios y recorré una selección
                  completa con los campeones del catálogo oficial.
                </p>
                <div className="home-grid">
                  <section className="panel hero-panel">
                    <span className="badge accent">SIMULADOR DISPONIBLE</span>
                    <h2>El draft empieza acá</h2>
                    <p>
                      Dos equipos, cinco posiciones y hasta diez bans. Cada
                      cambio se valida antes de aplicarse.
                    </p>
                    <button
                      className="primary"
                      disabled={!session || pending}
                      onClick={start}
                    >
                      Nuevo draft <span>↗</span>
                    </button>
                  </section>
                  <section className="panel">
                    <div className="eyebrow">SESIÓN DEL SIMULADOR</div>
                    <h2>
                      {session ? phaseNames[session.phase] : "Sin iniciar"}
                    </h2>
                    <dl>
                      <div>
                        <dt>Picks confirmados</dt>
                        <dd>{confirmed} / 10</dd>
                      </div>
                      <div>
                        <dt>Conexión con LoL</dt>
                        <dd>Detección automática</dd>
                      </div>
                      <div>
                        <dt>Fuente</dt>
                        <dd>Entrada manual</dd>
                      </div>
                    </dl>
                    {session && session.phase !== "IDLE" && (
                      <button onClick={() => setPage("draft")}>
                        Continuar sesión
                      </button>
                    )}
                  </section>
                </div>
                <section className="data-strip">
                  <span className="data-symbol">▤</span>
                  <div>
                    <strong>
                      {catalog?.champions.length ?? "—"} campeones · Data Dragon{" "}
                      {catalog?.version ?? "—"}
                    </strong>
                    <p>
                      Catálogo local disponible sin conexión. El parche del
                      juego se consulta en la conexión del cliente.
                    </p>
                  </div>
                </section>
              </>
            )}
            {page === "draft" && session && catalog && (
              <Draft
                key={session.draft.sessionId}
                session={session}
                catalog={catalog}
                pending={pending}
                send={send}
              />
            )}
            {page === "data" && (
              <DataLibrary
                onUpdate={(data) => {
                  setGameData(data);
                  setCatalog(data.catalog);
                }}
              />
            )}
            {page === "settings" && (
              <>
                <div className="eyebrow">PREFERENCIAS LOCALES</div>
                <h1>Ajustes</h1>
                <section className="panel settings">
                  <h2>Presentación</h2>
                  <label className="setting-row">
                    <span>
                      <strong>Espaciado compacto</strong>
                      <small>Más información visible en la ventana.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.compact}
                      onChange={(e) => {
                        const next = { compact: e.target.checked };
                        setPreferences(next);
                        try {
                          localStorage.setItem(
                            "kahoru.preferences.v1",
                            JSON.stringify(next),
                          );
                        } catch {
                          setError(
                            "No se pudo guardar la preferencia en este equipo.",
                          );
                        }
                      }}
                    />
                  </label>
                  <div className="setting-row">
                    <span>
                      <strong>Idioma</strong>
                      <small>Español · Argentina</small>
                    </span>
                    <span className="badge">ES</span>
                  </div>
                </section>
                <section className="panel settings">
                  <h2>Datos y privacidad</h2>
                  <p>
                    La conexión con LoL es local y de solo lectura. No se
                    recopilan cuentas, historial de partidas ni telemetría.
                  </p>
                  <p>
                    Comprobá el paquete oficial desde Datos del juego. Las
                    reglas estratégicas tienen su propia revisión por parche;
                    actualizar imágenes no equivale a actualizar el meta.
                  </p>
                </section>
              </>
            )}
            {page === "about" && (
              <>
                <div className="eyebrow">KAHORU.LOL · 0.3.0</div>
                <h1>Antes de entrar a la Grieta.</h1>
                <section className="panel about">
                  <h2>made by frack.one</h2>
                  <p>
                    Detección del cliente local y lectura automática del draft.
                    Ranking por composición, runas y rutas de compra para los
                    perfiles cubiertos. La importación de runas y las
                    estadísticas de meta siguen pendientes.
                  </p>
                  <dl>
                    <div>
                      <dt>Fuente</dt>
                      <dd>Riot Games · Data Dragon</dd>
                    </div>
                    <div>
                      <dt>Versión incluida</dt>
                      <dd>{catalog?.version ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Descarga del catálogo</dt>
                      <dd>
                        {catalog
                          ? new Date(catalog.retrievedAt).toLocaleDateString(
                              "es-AR",
                            )
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Parche del cliente</dt>
                      <dd>Disponible en Inicio</dd>
                    </div>
                  </dl>
                  <p className="source-url">{catalog?.source}</p>
                  <p className="legal">
                    kahoru.lol isn't endorsed by Riot Games and doesn't reflect
                    the views or opinions of Riot Games or anyone officially
                    involved in producing or managing Riot Games properties.
                    Riot Games, and all associated properties are trademarks or
                    registered trademarks of Riot Games, Inc.
                  </p>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </GameDataContext.Provider>
  );
}
