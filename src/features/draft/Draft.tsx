import { useState } from "react";
import {
  availableChampions,
  phaseNames,
  roleNames,
  roles,
  type Action,
  type Catalog,
  type Role,
  type Session,
  type Team,
} from "../../contracts";

export function Draft({
  session,
  catalog,
  pending,
  send,
}: {
  session: Session;
  catalog: Catalog;
  pending: boolean;
  send: (a: Action) => Promise<void>;
}) {
  const [target, setTarget] = useState<{ team: Team; slot: number }>({
    team: "allies",
    slot: 0,
  });
  const [query, setQuery] = useState("");
  const [banning, setBanning] = useState(false);
  const [swapWith, setSwapWith] = useState(1);
  const draft = session.draft;
  const editable =
    ["CHAMP_SELECT", "DRAFT_FINALIZING"].includes(session.phase) &&
    session.connection === "CONNECTED";
  const byId = new Map(catalog.champions.map((c) => [c.id, c]));
  const candidates = availableChampions(catalog, draft, query);
  const count = draft.allies
    .concat(draft.enemies)
    .filter((s) => s.locked).length;

  return (
    <>
      <div className="draft-heading">
        <div>
          <div className="eyebrow">SESIÓN MANUAL · {count}/10 CONFIRMADOS</div>
          <h1>{phaseNames[session.phase]}</h1>
        </div>
        <label className="role-picker">
          Tu posición
          <select
            aria-label="Tu posición"
            value={draft.playerRole}
            disabled={!editable || pending}
            onChange={(e) =>
              void send({ type: "setRole", role: e.target.value as Role })
            }
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleNames[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="simulation-note">
        Simulador de draft · Los cambios de fase y conexión se controlan
        manualmente.
      </div>
      {session.connection === "RECOVERING" && (
        <div className="notice" role="status">
          Conexión simulada interrumpida. El draft se conserva hasta reconectar.
        </div>
      )}
      <fieldset className="draft-body" disabled={pending}>
        <div className="teams">
          {(["allies", "enemies"] as const).map((team) => (
            <section key={team} className={`team-panel ${team}`}>
              <div className="team-header">
                <h2>{team === "allies" ? "Tu equipo" : "Equipo rival"}</h2>
                <span>{team === "allies" ? "AZUL" : "ROJO"}</span>
              </div>
              {draft[team].map((slot, index) => {
                const champion =
                  slot.championId === null
                    ? undefined
                    : byId.get(slot.championId);
                const selected =
                  target.team === team && target.slot === index && !banning;
                return (
                  <div
                    className={`slot ${selected ? "selected" : ""}`}
                    key={index}
                  >
                    <button
                      className="slot-main"
                      disabled={!editable}
                      onClick={() => {
                        setTarget({ team, slot: index });
                        setSwapWith((index + 1) % 5);
                        setBanning(false);
                      }}
                    >
                      <span className={`portrait ${champion ? "filled" : ""}`}>
                        {champion?.name.slice(0, 2) ?? "＋"}
                      </span>
                      <span>
                        <small>
                          {team === "allies"
                            ? `${roleNames[roles[index]]}${draft.playerRole === roles[index] ? " · VOS" : ""}`
                            : `Rival ${index + 1} · Rol sin confirmar`}
                        </small>
                        <strong>{champion?.name ?? "Elegir campeón"}</strong>
                      </span>
                    </button>
                    {champion && (
                      <button
                        className={`lock ${slot.locked ? "locked" : ""}`}
                        disabled={!editable}
                        aria-label={`${slot.locked ? "Desconfirmar" : "Confirmar"} ${champion.name}`}
                        onClick={() =>
                          void send({ type: "lock", team, slot: index })
                        }
                      >
                        {slot.locked ? "✓" : "Confirmar"}
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <section className="panel bans">
          <div className="section-row">
            <h2>
              Bans <span className="muted">{draft.bans.length}/10</span>
            </h2>
            <button
              className={banning ? "active-button" : ""}
              disabled={!editable}
              onClick={() => setBanning(!banning)}
            >
              {banning ? "Volver a picks" : "Agregar ban"}
            </button>
          </div>
          <div className="ban-list">
            {draft.bans.map((id) => (
              <button
                key={id}
                disabled={!editable}
                onClick={() => void send({ type: "unban", champion: id })}
                aria-label={`Quitar ban de ${byId.get(id)?.name}`}
              >
                {byId.get(id)?.name}
                <span>×</span>
              </button>
            ))}
            {draft.bans.length === 0 && <p>Sin campeones bloqueados.</p>}
          </div>
        </section>
        {editable && (
          <section className="panel catalog">
            <div className="section-row">
              <h2>
                {banning
                  ? "Bloquear campeón"
                  : `Elegir para ${target.team === "allies" ? roleNames[roles[target.slot]] : `rival ${target.slot + 1}`}`}
              </h2>
              <input
                aria-label="Buscar campeón"
                placeholder="Buscar campeón…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="champion-grid">
              {candidates.map((champion) => (
                <button
                  key={champion.id}
                  title={champion.title}
                  aria-label={champion.name}
                  disabled={banning && draft.bans.length >= 10}
                  onClick={() =>
                    void send(
                      banning
                        ? { type: "ban", champion: champion.id }
                        : { type: "select", ...target, champion: champion.id },
                    )
                  }
                >
                  <span>{champion.name.slice(0, 2)}</span>
                  {champion.name}
                </button>
              ))}
              {candidates.length === 0 && (
                <p>No hay campeones disponibles con ese nombre.</p>
              )}
            </div>
            {!banning && (
              <div className="swap-controls">
                <button
                  onClick={() =>
                    void send({ type: "select", ...target, champion: null })
                  }
                >
                  Vaciar posición
                </button>
                <label>
                  Intercambiar con
                  <select
                    aria-label="Posición para intercambiar"
                    value={swapWith}
                    onChange={(e) => setSwapWith(Number(e.target.value))}
                  >
                    {roles.map((r, i) =>
                      i === target.slot ? null : (
                        <option key={r} value={i}>
                          {target.team === "allies"
                            ? roleNames[r]
                            : `Rival ${i + 1}`}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  onClick={() =>
                    void send({
                      type: "swap",
                      team: target.team,
                      first: target.slot,
                      second: swapWith,
                    })
                  }
                >
                  Intercambiar
                </button>
              </div>
            )}
          </section>
        )}
        {!editable && session.connection === "CONNECTED" && (
          <section className="panel">
            <h2>Draft conservado</h2>
            <p>
              Esta sesión de prueba permite comprobar la transición y limpieza
              de datos. Los planes de runas y compras todavía no están
              implementados.
            </p>
          </section>
        )}
        <section className="simulation-controls">
          <div>
            <strong>Controles de simulación</strong>
            <small>Revisión {draft.revision}</small>
          </div>
          <div className="control-buttons">
            {session.phase === "IDLE" && (
              <button onClick={() => void send({ type: "queue" })}>
                Entrar en cola
              </button>
            )}
            {["IDLE", "QUEUE"].includes(session.phase) && (
              <button
                className="primary"
                onClick={() => void send({ type: "start" })}
              >
                Iniciar draft
              </button>
            )}
            {["DRAFT_FINALIZING", "LOADING", "IN_GAME", "POST_GAME"].includes(
              session.phase,
            ) && (
              <button
                className="primary"
                disabled={session.connection !== "CONNECTED"}
                onClick={() => void send({ type: "advance" })}
              >
                {session.phase === "DRAFT_FINALIZING"
                  ? "Pasar a carga"
                  : session.phase === "LOADING"
                    ? "Iniciar partida"
                    : session.phase === "IN_GAME"
                      ? "Terminar partida"
                      : "Volver a inicio"}
              </button>
            )}
            <button
              onClick={() =>
                void send({
                  type:
                    session.connection === "CONNECTED"
                      ? "disconnect"
                      : "reconnect",
                })
              }
            >
              {session.connection === "CONNECTED"
                ? "Desconectar"
                : "Reconectar"}
            </button>
            <button onClick={() => void send({ type: "dodge" })}>
              Descartar sesión
            </button>
          </div>
        </section>
      </fieldset>
    </>
  );
}
