import { useContext, useState } from "react";
import { GameDataContext, GameIcon, ChampionIcon } from "../gameData";
import { roleNames, roles, type Role } from "../contracts";
import { sessionPlans } from "../engine/sessionPlans";
import { type DraftContext } from "../engine/recommendations";
import { profileById, profiles } from "../engine/profiles";
import shardData from "../../data/knowledge/shards.json";

export function Preparation({
  context,
  editable,
  onChoose,
  disabledReason,
}: {
  context: DraftContext;
  editable: boolean;
  onChoose?: (id: number) => void;
  disabledReason?: string;
}) {
  const data = useContext(GameDataContext);
  const [manualRole, setManualRole] = useState<Role | null>(() =>
    sessionPlans.role(context.sessionId),
  );
  const [pool, setPool] = useState<number[]>(() => {
    try {
      const v: unknown = JSON.parse(
        localStorage.getItem("kahoru.pool.v1") ?? "[]",
      );
      return Array.isArray(v)
        ? v.filter(
            (id): id is number => Number.isInteger(id) && profileById.has(id),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [poolOnly, setPoolOnly] = useState(false);
  const [, render] = useState(0);
  const [message, setMessage] = useState("");
  if (!data) return null;
  const ctx = { ...context, playerRole: manualRole ?? context.playerRole };
  const prepared = disabledReason
    ? undefined
    : sessionPlans.prepare(data, ctx, editable, poolOnly ? pool : undefined);
  const result = prepared?.result;
  const selected = result?.plans.find((p) => p.id === prepared?.selected);
  const rune = (id: number) =>
    data.trees
      .flatMap((t) => t.slots.flatMap((s) => s.runes))
      .find((r) => r.id === id);
  const item = (id: number) => data.items.find((i) => i.id === id);
  function star(id: number) {
    const next = pool.includes(id)
      ? pool.filter((p) => p !== id)
      : [...pool, id];
    setPool(next);
    try {
      localStorage.setItem("kahoru.pool.v1", JSON.stringify(next));
    } catch {
      setMessage("No se pudo guardar el champion pool.");
    }
  }
  async function copy() {
    if (!selected || !data) return;
    const text = [
      data.catalog.champions.find((c) => c.id === ctx.playerChampionId)?.name,
      selected.title,
      ...selected.strategy,
      "Runas: " +
        selected.runes.primaryRunes
          .concat(selected.runes.secondaryRunes)
          .map((id) => rune(id)?.name ?? id)
          .join(", "),
      "Fragmentos: " +
        selected.runes.shards
          .map((id) => shardData.shards.find((s) => s.id === id)?.name ?? id)
          .join(", "),
      "Compras: " +
        selected.items.map((id) => item(id)?.name ?? id).join(" → "),
      ...(selected.questUpgrade
        ? ["Mejora de misión: " + item(selected.questUpgrade)?.name]
        : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Plan copiado.");
    } catch {
      setMessage("No se pudo copiar. Podés seleccionar el texto del plan.");
    }
  }
  return (
    <section className="preparation" aria-label="Preparación de partida">
      <div className="section-row">
        <div>
          <div className="eyebrow">ANTES DE LA PARTIDA</div>
          <h2>Opciones para el draft</h2>
        </div>
        <label>
          Tu rol{" "}
          <select
            aria-label="Rol del análisis"
            value={ctx.playerRole ?? ""}
            disabled={!editable || Boolean(onChoose)}
            onChange={(e) => {
              const role = e.target.value ? (e.target.value as Role) : null;
              sessionPlans.setRole(context.sessionId, role);
              setManualRole(role);
            }}
          >
            <option value="">Sin confirmar</option>
            {roles.map((r) => (
              <option value={r} key={r}>
                {roleNames[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small-note">
        {result?.coverage ??
          disabledReason ??
          "No hay un plan prepartida conservado para esta sesión."}{" "}
        Los puntajes son relativos, sin probabilidad de victoria. Confianza
        orientativa: baja.
      </p>
      {!editable && prepared && (
        <div className="notice">
          Plan prepartida conservado. Durante la partida no se adapta a la
          sesión en vivo.
        </div>
      )}
      {editable && result && (
        <>
          <div className="section-row">
            <h3>Alternativas para tu posición</h3>
            <label>
              <input
                type="checkbox"
                checked={poolOnly}
                onChange={(e) => setPoolOnly(e.target.checked)}
              />{" "}
              Solo mi pool ({pool.length})
            </label>
          </div>
          <div className="pool-controls">
            <select
              aria-label="Añadir al pool"
              value=""
              onChange={(e) => {
                if (e.target.value) star(Number(e.target.value));
              }}
            >
              <option value="">Añadir favorito…</option>
              {profiles
                .filter(
                  (p) => !ctx.playerRole || p.roles.includes(ctx.playerRole),
                )
                .filter((p) => !pool.includes(p.championId))
                .map((p) => (
                  <option value={p.championId} key={p.championId}>
                    {
                      data.catalog.champions.find((c) => c.id === p.championId)
                        ?.name
                    }
                  </option>
                ))}
            </select>
            {pool.map((id) => (
              <button
                key={id}
                onClick={() => star(id)}
                aria-label={`Quitar favorito ${data.catalog.champions.find((c) => c.id === id)?.name}`}
              >
                {data.catalog.champions.find((c) => c.id === id)?.name} ×
              </button>
            ))}
          </div>
          {poolOnly && pool.length === 0 && (
            <p className="small-note">
              Agregá campeones a tu pool para ver alternativas con este filtro.
            </p>
          )}
          <div className="rank-grid">
            {result.ranking.slice(0, 8).map((entry) => {
              const c = data.catalog.champions.find(
                (c) => c.id === entry.championId,
              );
              return (
                <article className="rank-card" key={entry.championId}>
                  <div className="rank-top">
                    <ChampionIcon id={entry.championId} />
                    <strong>{c?.name}</strong>
                    <span className="score">{entry.score}</span>
                    <button
                      aria-label={`Favorito ${c?.name}`}
                      onClick={() => star(entry.championId)}
                    >
                      {pool.includes(entry.championId) ? "★" : "☆"}
                    </button>
                  </div>
                  <p>{entry.reasons[0]}</p>
                  <details>
                    <summary>Motivos y límites</summary>
                    {entry.reasons.slice(1).map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                    <p>{entry.tradeoff}</p>
                  </details>
                  {onChoose && (
                    <button onClick={() => onChoose(entry.championId)}>
                      Elegir en el simulador
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="small-note">
            {profiles.length} perfiles definidos. La disponibilidad en tu cuenta
            no está comprobada; las selecciones se realizan en el cliente de
            LoL.
          </p>
        </>
      )}
      {result?.errors.length ? (
        <div className="analysis-errors">
          {result.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}
      {result && result.plans.length > 0 && (
        <>
          <h3>
            Planes para{" "}
            {
              data.catalog.champions.find((c) => c.id === ctx.playerChampionId)
                ?.name
            }
          </h3>
          <div className="plan-tabs">
            {result.plans.map((plan) => (
              <button
                className={
                  prepared?.selected === plan.id ? "active-button" : ""
                }
                key={plan.id}
                onClick={() => {
                  sessionPlans.select(ctx.sessionId, plan.id);
                  render((n) => n + 1);
                }}
              >
                <strong>{plan.title}</strong>
                {plan.recommended && (
                  <span className="recommended-label">
                    Sugerido por composición
                  </span>
                )}
                <small>{plan.reason}</small>
              </button>
            ))}
          </div>
          {selected && (
            <section className="panel selected-plan">
              <div className="section-row">
                <h2>{selected.title}</h2>
                <button onClick={() => void copy()}>Copiar plan</button>
              </div>
              <p>{selected.reason}</p>
              <p className="small-note">{selected.tradeoff}</p>
              <div className="rune-build-grid">
                <section>
                  <h3>Runas completas</h3>
                  <div className="rune-row">
                    {selected.runes.primaryRunes.map((id) => (
                      <div key={id}>
                        <GameIcon
                          path={rune(id)?.icon}
                          label={rune(id)?.name ?? String(id)}
                          size={42}
                        />
                        <small>{rune(id)?.name}</small>
                      </div>
                    ))}
                  </div>
                  <div className="rune-row secondary">
                    {selected.runes.secondaryRunes.map((id) => (
                      <div key={id}>
                        <GameIcon
                          path={rune(id)?.icon}
                          label={rune(id)?.name ?? String(id)}
                          size={34}
                        />
                        <small>{rune(id)?.name}</small>
                      </div>
                    ))}
                  </div>
                  <div className="rune-row shards">
                    {selected.runes.shards.map((id, index) => {
                      const s = shardData.shards.find((s) => s.id === id);
                      return (
                        <div key={index}>
                          <img
                            className="game-icon"
                            src={`/knowledge/${shardData.patch}/shards/${id}.png`}
                            width={30}
                            height={30}
                            alt={s?.name}
                          />
                          <small>{s?.name}</small>
                        </div>
                      );
                    })}
                  </div>
                  <p className="small-note">
                    Selección manual. La importación al cliente requiere
                    validación técnica y revisión de su uso.
                  </p>
                </section>
                <section>
                  <h3>Objetos de inicio</h3>
                  <div className="build-row">
                    {selected.starter.map((id, i) => (
                      <div key={i}>
                        <GameIcon
                          path={item(id)?.icon}
                          label={item(id)?.name ?? String(id)}
                        />
                        <small>{item(id)?.name}</small>
                      </div>
                    ))}
                  </div>
                  <h3>Ruta base</h3>
                  <div className="build-row">
                    {selected.items.map((id, i) => (
                      <div key={i}>
                        <GameIcon
                          path={item(id)?.icon}
                          label={item(id)?.name ?? String(id)}
                          size={44}
                        />
                        <small>
                          {i + 1}. {item(id)?.name}
                        </small>
                        <small>{item(id)?.cost} oro</small>
                      </div>
                    ))}
                  </div>
                  {selected.questUpgrade && (
                    <div className="quest-upgrade">
                      <GameIcon
                        path={item(selected.questUpgrade)?.icon}
                        label={
                          item(selected.questUpgrade)?.name ??
                          "Mejora de misión"
                        }
                        size={36}
                      />
                      <p>
                        <strong>{item(selected.questUpgrade)?.name}</strong>
                        <br />
                        Mejora al completar la misión de support. Conserva la
                        ranura de Mapamundi.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <details className="purchase-details">
                <summary>
                  Compras, componentes y condiciones ({selected.steps.length}{" "}
                  pasos)
                </summary>
                <ol>
                  {selected.steps.map((step) => (
                    <li key={step.id}>
                      <GameIcon
                        path={item(step.itemId)?.icon}
                        label={item(step.itemId)?.name ?? String(step.itemId)}
                        size={24}
                      />
                      <span>
                        {step.kind === "sell"
                          ? "Vender"
                          : step.kind === "consume"
                            ? "Consumir"
                            : step.kind === "quest"
                              ? "Completar misión"
                              : step.kind === "combine"
                                ? "Completar"
                                : "Comprar"}{" "}
                        {item(step.itemId)?.name}{" "}
                        {step.cost > 0 ? `· ${step.cost} oro` : ""}
                        <small>{step.condition}</small>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="small-note">
                  Costes de referencia, sin conocer tu oro real. Los pasos de
                  consumo, misión o venta son condiciones del plan y no acciones
                  detectadas ni automatizadas.
                </p>
              </details>
              <section className="strategy">
                <h3>Planteamiento previo</h3>
                {selected.strategy.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {selected.branches.map((line) => (
                  <p className="small-note" key={line}>
                    {line}
                  </p>
                ))}
              </section>
              <p role="status">{message}</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
