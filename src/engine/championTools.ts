import { getClientKnowledge, profileById, rulesRevision } from "./profiles";

export const removableControl =
  /\b(?:aturd\p{L}*|inmoviliz\p{L}*|atrapa|encant\p{L}*|atemoriz\p{L}*|ciega|silencia|provoca(?:rá)? terror|huy\p{L}* de miedo|huir aterroriz\p{L}*|se duermen|duerme)(?!\p{L})/iu;
const displacement =
  /\b(?:derriba|empuja|atrae|suspende|repele|lanza.{0,30}(?:aire|aires))\b/iu;
const suppression = /\bsuprime\b/iu;
const cache = new Map<number, ReturnType<typeof readTools>>();
let revision = -1;

function readTools(id: number) {
  const champion = getClientKnowledge().champions.find((c) => c.id === id);
  const abilities = champion?.abilities ?? [];
  const description = abilities.map((a) => a.description).join(" ");
  const traits = profileById.get(id)?.traits ?? [];
  const control = abilities.filter(
    (a) =>
      removableControl.test(a.description) ||
      displacement.test(a.description) ||
      suppression.test(a.description),
  );
  return {
    specialAttacks:
      /velocidad fija|debe recargar|críticos.{0,30}no infligen daño|probabilidad de golpe crítico.{0,20}aumenta|aumenta la probabilidad de golpe crítico|ataques.{0,50}se consideran habilidades|tardan más en disparar/iu.test(
        abilities[0]?.description ?? "",
      ),
    control,
    tenacity: abilities.filter((a) => removableControl.test(a.description)),
    displacement: abilities.filter((a) => displacement.test(a.description)),
    suppression: abilities.filter((a) => suppression.test(a.description)),
    attacks:
      traits.includes("attacks") ||
      /ataques (?:básicos )?infligen|al impacto|ataca dos veces/iu.test(
        description,
      ),
    mobility:
      /se desplaza|se lanza|salta|se teletransporta|desplazarse|descienden sobre/iu.test(
        description,
      ),
    healing:
      traits.includes("healing") ||
      /se cura|lo cura|cura a|curando|curaci[oó]n|restaura.{0,30}vida|recupera.{0,20}vida|drena la vida/iu.test(
        description,
      ),
    protection:
      /(?:cura|curar|escudo|escudar).{0,100}aliad|aliad.{0,100}(?:cura|escudo)/iu.test(
        description,
      ),
    shield: /escudo/iu.test(description),
    percentHealth:
      /(?:porcentaje|según|basado en).{0,40}(?:vida|PV)|vida (?:actual|máxima|faltante) del (?:objetivo|enemigo)/iu.test(
        description,
      ),
    executes: /ejecuta|vida faltante|menos vida/iu.test(description),
    frontline:
      traits.includes("frontline") || !!champion?.classes.includes("tank"),
    poke: traits.includes("poke"),
    classes: champion?.classes ?? [],
  };
}

export function championTools(id: number) {
  if (revision !== rulesRevision) {
    cache.clear();
    revision = rulesRevision;
  }
  if (!cache.has(id)) cache.set(id, readTools(id));
  return cache.get(id)!;
}
