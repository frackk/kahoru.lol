import type { SkillOrder as Order } from "../engine/skillOrder";
import { kitById } from "../engine/profiles";

export function SkillOrder({
  order,
  championId,
}: {
  order?: Order;
  championId: number;
}) {
  const abilities = kitById.get(championId);
  return (
    <section className="skill-order" aria-label="Orden de habilidades">
      <h3>Habilidades · niveles 1–18</h3>
      {order ? (
        <>
          <div className="skill-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Habilidad</th>
                  {order.order.map((_, i) => (
                    <th scope="col" key={i}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["Q", "W", "E", "R"] as const).map((key, index) => (
                  <tr key={key}>
                    <th scope="row" title={abilities?.[index + 1]?.name}>
                      {key}
                    </th>
                    {order.order.map((value, i) => (
                      <td
                        className={value === key ? "skill-point" : ""}
                        key={i}
                      >
                        {value === key ? key : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small-note">
            {order.reason} OP.GG · {order.play.toLocaleString("es-AR")}{" "}
            partidas.
            {order.observedLevels < 18
              ? ` Niveles ${order.observedLevels + 1}–18 completados por límites de rango y prioridad de R; sin muestra separada.`
              : ""}
          </p>
        </>
      ) : (
        <p className="small-note">
          No hay una secuencia completa verificable para este campeón y
          posición. No se rellena con un orden genérico.
        </p>
      )}
    </section>
  );
}
